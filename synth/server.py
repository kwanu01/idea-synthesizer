"""server.py — 실시간 백엔드 HTTP 서버."""

from __future__ import annotations

import base64
import json
import os
import re
import secrets
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from openai import OpenAI

from embed import embed_texts
from agent import load_agent, cosine_similarity, invalidate
from effectors import EFFECTOR_HANDLERS
from cluster import cluster_embeddings
from name import representative_samples, name_axes
from save import build_agent, save_agent
from voice import generate_voice

client = OpenAI()
# 호스팅(Render/Railway 등)은 PORT 환경변수를 주입한다. 로컬은 기본 8000.
PORT = int(os.environ.get("PORT", "8000"))

VALID_NODE_TYPES = {"Question", "Observation", "Hypothesis", "Insight", "Decision"}
VALID_RELATION_TYPES = {"supports", "contradicts", "extends", "derives"}
VALID_SYNTHESIS_MODES = {
    "stacking", "carving", "modulation",
    "morphing", "fragmentation", "blending",
}
VALID_EFFECTOR_KINDS = {
    "perspective", "analogy", "constrain", "contradict", "consequence",
    "genealogy", "zoom", "abstraction", "connect", "defamiliarize",
}
DEFAULT_RELATION = "extends"
DEFAULT_SYNTHESIS_MODE = "stacking"
DEFAULT_NODE_TYPE = "Observation"
DEFAULT_EFFECTOR_KIND = "connect"

# 이펙터 6 종 확정 (2026-06-12) — 폐기 4 종은 가장 가까운 생존 종으로 흡수
EFFECTOR_FALLBACK = {
    "analogy": "connect",
    "zoom": "abstraction",
    "genealogy": "perspective",
    "defamiliarize": "perspective",
}


def _next_id() -> str:
    ts = format(int(time.time() * 1000), "x")
    rand = base64.b32encode(secrets.token_bytes(3)).decode("ascii").rstrip("=").lower()
    return f"node-{ts}-{rand}"


# ── 사용자 에이전트 굽기 ──────────────────────────
# 글 → 문장 분해 → 임베딩 → KMeans → gpt-4o 명명 → voice → agent JSON.
# build.py 파이프라인을 서버 안에서 그대로 돌린다.

AGENTS_DIR = Path("public/agents")
USER_AGENT_COLORS = ["#fb923c", "#22d3ee", "#ec4899", "#84cc16", "#a855f7", "#fbbf24"]

# ── VISION — 에이전트의 시각 코드 (필터). 미적 코드와 사상 코드를 분리한다 ──
# 같은 선언문이라도 어떤 코드를 거치느냐에 따라 다른 이미지가 된다.
VISUAL_CODES = {
    "paik": {
        "aesthetic": "수십 대의 CRT 모니터가 쌓인 비디오 월의 발광, 전자적 색수차와 주사선의 빛 번짐, 네온과 형광 컬러의 콜라주, 신호 글리치의 질감, 텔레비전 정원 — 백남준 화면의 미적 코드",
        "thought": "관객이 작품의 회로 안에 들어와 일부가 되는 참여의 장면, 기술이 장난감처럼 인간화된 유머러스한 풍경, 동양과 서양의 시간이 한 공간에서 충돌하고 섞이는 광경 — 백남준 사유의 코드",
    },
    "eno": {
        "aesthetic": "느리게 변화하는 엠비언트한 빛의 그라데이션, 부드러운 색면들의 겹침, 생성적 패턴이 만들어내는 고요한 표면 — 브라이언 이노 화면의 미적 코드",
        "thought": "시스템이 스스로 자라나는 정원의 풍경, 우연이 설계가 되는 과정, 전경과 배경의 경계가 사라진 공간 — 브라이언 이노 사유의 코드",
    },
    "kant": {
        "aesthetic": "엄격한 기하학적 질서와 대칭, 차갑고 명료한 빛, 절제된 무채색 위의 단일 강조 — 칸트적 형식미의 코드",
        "thought": "인식의 한계선이 물리적 경계로 드러나는 공간, 보편 법칙이 구조물이 된 풍경, 숭고 앞에 선 작은 인간 — 칸트 사유의 코드",
    },
    "default": {
        "aesthetic": "절제된 색과 강한 명암 대비, 정밀한 구성 — 현대 미디어아트의 미적 코드",
        "thought": "아이디어의 구조가 공간으로 번역된 개념적 풍경",
    },
}


def _split_corpus(text: str) -> list[str]:
    """사용자 글을 발화 단위로 쪼갠다 — 줄바꿈 우선, 문장 부호 보조."""
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # 한 줄이 길면 문장 부호로 추가 분해
        parts = re.split(r"(?<=[.!?…])\s+", line)
        for p in parts:
            p = p.strip().strip("·-•").strip()
            if len(p) >= 10:
                out.append(p[:300])
    # 중복 제거 (순서 유지)
    seen = set()
    uniq = []
    for t in out:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
    return uniq


def _build_analyze_prompt(agent: dict) -> str:
    axes = agent.get("axes", [])
    axes_block = "\n".join(
        f"- {ax['label_ko']} ({ax.get('label_en', '')}): {ax.get('description', '')}"
        for ax in axes
    )

    return f"""당신은 {agent.get('label', agent['id'])} 의 관점을 학습한 가상 에이전트입니다.

이 관점의 핵심 축 {len(axes)} 개:
{axes_block}

사용자 텍스트를 받아 네 일을 수행합니다.

① 노드 분석 — 의미 단위로 쪼개 다음 다섯 중 하나로:
   - Question: 풀어야 할 자리, 모르는 것, 열려 있는 질문
   - Observation: 사실, 현상, 관찰된 자료
   - Hypothesis: 가설, 추측, 가능성, "~ 일지도"
   - Insight: 깨달음, 발견, 종합, "그러므로 ~"
   - Decision: 결정, 결론, 행동, "~ 하겠다"

② 노드 간 관계 자동 설정 — 다음 네 중 하나로:
   - supports: A 가 B 를 뒷받침 (근거·예시·증거)
   - contradicts: A 가 B 를 반박 (반례·모순·다른 입장)
   - extends: A 가 B 를 발전·심화 (한 단계 더 나아감)
   - derives: A 에서 B 가 파생 (자식 아이디어가 나옴)

③ 각 노드에 적합한 합성 모드 추천 — 6 가지 중 하나:
   - stacking, carving, modulation, morphing, fragmentation, blending

④ 각 노드를 어떤 이펙터로 보낼지 추천 — 6 가지 중 노드 내용에 가장 잘 맞는 하나:
   - perspective: 다른 입장·다른 시대의 눈으로 다시 보기
   - contradict: 정반대 각도·반례로 깨뜨리거나 가장 강하게 옹호하기
   - consequence: 채택했을 때의 분기·결과 펼치기
   - constrain: 제약을 더해 다음 단계 강제
   - abstraction: 구체에서 추상 패턴 뽑기 (혹은 추상을 구체로 내리기)
   - connect: 먼 도메인과의 연결고리 찾기

JSON object 로 응답:
{{
  "nodes": [
    {{ "type": "Question", "title": "짧은 제목", "content": "한 문장",
       "synthesisMode": "stacking", "synthesisReason": "한 줄 이유",
       "effectorKind": "analogy" }}
  ],
  "edges": [
    {{ "from": 0, "to": 1, "relationType": "supports" }}
  ]
}}

규칙:
- nodes 는 최소 2 개, 최대 8 개
- edges 의 from/to 는 nodes 배열의 인덱스 (0-based 정수)
- title 30자 이내, content 한 문장 (200자 이내)
- synthesisMode 는 위 6 가지 중 하나
- synthesisReason 은 30자 이내
- effectorKind 는 위 6 가지 중 하나 — 노드 내용을 보고 가장 잘 맞는 것
- "노드" 라는 단어 본문에 사용 금지

가장 중요한 규칙 — 분해의 충실성:
- 노드의 title 과 content 는 *입력에 실제로 있는 생각만* 담습니다. 입력에 없는
  개념·인물·이론·어휘를 끌어오지 마세요. 입력의 표현을 최대한 그대로 보존하세요.
- 위 관점(축)은 ③ synthesisMode 와 ④ effectorKind 추천, 관계 해석의 *참고*로만
  사용하고, 노드의 내용 자체를 관점의 언어로 바꾸지 마세요.
  (관점의 개입은 이후 이펙터 단계의 몫입니다 — 분해는 중립적인 측정입니다.)
"""


def _normalize_analyze(ai_result: dict) -> dict:
    raw_nodes = ai_result.get("nodes") or []
    raw_edges = ai_result.get("edges") or []

    nodes: list[dict] = []
    orig_to_kept: dict[int, int] = {}

    for orig_idx, n in enumerate(raw_nodes):
        if not isinstance(n, dict):
            continue
        node_type = n.get("type", DEFAULT_NODE_TYPE)
        if node_type not in VALID_NODE_TYPES:
            node_type = DEFAULT_NODE_TYPE
        title = str(n.get("title") or "").strip()[:100] or "(untitled)"
        content = str(n.get("content") or "").strip()
        if not content:
            continue
        if len(content) > 500:
            content = content[:497] + "..."

        synth_mode = n.get("synthesisMode") or DEFAULT_SYNTHESIS_MODE
        if synth_mode not in VALID_SYNTHESIS_MODES:
            synth_mode = DEFAULT_SYNTHESIS_MODE
        synth_reason = str(n.get("synthesisReason") or "").strip()[:80]

        effector_kind = n.get("effectorKind") or DEFAULT_EFFECTOR_KIND
        effector_kind = EFFECTOR_FALLBACK.get(effector_kind, effector_kind)
        if effector_kind not in VALID_EFFECTOR_KINDS:
            effector_kind = DEFAULT_EFFECTOR_KIND

        kept_idx = len(nodes)
        orig_to_kept[orig_idx] = kept_idx
        nodes.append({
            "id": _next_id(),
            "type": node_type,
            "title": title,
            "content": content,
            "synthesisMode": synth_mode,
            "synthesisReason": synth_reason,
            "effectorKind": effector_kind,
        })

    edges: list[dict] = []
    seen: set[tuple[int, int]] = set()
    for e in raw_edges:
        if not isinstance(e, dict):
            continue
        from_orig = e.get("from")
        to_orig = e.get("to")
        if not (isinstance(from_orig, int) and isinstance(to_orig, int)):
            continue
        if from_orig not in orig_to_kept or to_orig not in orig_to_kept:
            continue
        from_idx = orig_to_kept[from_orig]
        to_idx = orig_to_kept[to_orig]
        if from_idx == to_idx:
            continue
        pair = (from_idx, to_idx)
        if pair in seen:
            continue
        seen.add(pair)
        rel = e.get("relationType", DEFAULT_RELATION)
        if rel not in VALID_RELATION_TYPES:
            rel = DEFAULT_RELATION
        edges.append({"from": from_idx, "to": to_idx, "relationType": rel})

    return {"nodes": nodes, "edges": edges}


class Router(BaseHTTPRequestHandler):

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/api/health"):
            return self._send_json(200, {"ok": True, "service": "synth", "port": PORT})
        if self.path.startswith("/api/agents"):
            return self._handle_agents_list()
        return self._send_json(404, {"error": "route not found", "path": self.path})

    # ── GET /api/agents — 장착 가능한 에이전트 목록 ──
    def _handle_agents_list(self) -> None:
        agents = []
        for p in sorted(AGENTS_DIR.glob("*.agent.json")):
            aid = p.name[: -len(".agent.json")]
            if aid == "test":
                continue  # 토이 에이전트는 UI 에서 제외
            try:
                with open(p, encoding="utf-8") as f:
                    doc = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue
            agents.append({
                "id": aid,
                "label": doc.get("label", aid),
                "subtitle": doc.get("subtitle", ""),
                "color": doc.get("color", "#8a8e96"),
                "axes": [ax.get("label_ko", "") for ax in doc.get("axes", [])],
                "n_samples": doc.get("n_samples", 0),
                "user": aid.startswith("user-"),
            })
        return self._send_json(200, {"agents": agents})

    def do_POST(self):
        try:
            body = self._read_json_body()
        except json.JSONDecodeError as e:
            return self._send_json(400, {"error": f"JSON 파싱 실패: {e}"})

        if self.path.startswith("/api/quality"):
            return self._handle_quality(body)
        # 주의: analyze-image 가 analyze 의 startswith 에 잡히지 않게 먼저 검사
        if self.path.startswith("/api/analyze-image"):
            return self._handle_analyze_image(body)
        if self.path.startswith("/api/analyze"):
            return self._handle_analyze(body)
        if self.path.startswith("/api/apply-effects"):
            return self._handle_apply_effects(body)
        if self.path.startswith("/api/master-variations"):
            return self._handle_master_variations(body)
        if self.path.startswith("/api/master"):
            return self._handle_master(body)
        if self.path.startswith("/api/build-agent"):
            return self._handle_build_agent(body)
        if self.path.startswith("/api/consequence-split"):
            return self._handle_consequence_split(body)
        if self.path.startswith("/api/contradict-split"):
            return self._handle_contradict_split(body)
        if self.path.startswith("/api/synthesize"):
            return self._handle_synthesize(body)
        if self.path.startswith("/api/transform-image"):
            return self._handle_transform_image(body)
        if self.path.startswith("/api/agent-feedback"):
            return self._handle_agent_feedback(body)
        if self.path.startswith("/api/vision-options"):
            return self._handle_vision_options(body)
        if self.path.startswith("/api/visualize"):
            return self._handle_visualize(body)

        return self._send_json(404, {"error": "route not found", "path": self.path})

    # ── POST /api/agent-feedback — 에이전트 본인의 목소리로 아이디어에 피드백 ──
    def _handle_agent_feedback(self, body: dict) -> None:
        """입력: { text, agentId }  출력: { feedback }

        이펙터(아이디어를 변형)와 다르다. 이건 에이전트가 *자기 말투·관점으로*
        사용자에게 직접 말을 거는 자리 — 이 프로젝트의 출발점이었던 'NJP in my pocket' 처럼.
        """
        text = (body.get("text") or "").strip()
        if not text:
            return self._send_json(400, {"error": "text 가 필요합니다"})
        agent_id = body.get("agentId") or "default"
        try:
            agent = load_agent(agent_id)
        except FileNotFoundError:
            agent = None
        if not agent:
            return self._send_json(404, {"error": "에이전트를 찾을 수 없습니다"})

        voice = agent.get("voice", {})
        persona = voice.get("persona", "")
        style = voice.get("style", "")
        label = agent.get("label", agent_id)
        axes = " · ".join(ax.get("label_ko", "") for ax in agent.get("axes", [])[:6])

        # 실제 발화 본보기 — 말투를 흉내낼 근거. 코퍼스에서 고르게 추려 넣는다.
        all_samples = [s["text"] if isinstance(s, dict) else s for s in agent.get("samples", [])]
        step = max(1, len(all_samples) // 10)
        sample_lines = all_samples[::step][:10]
        samples_block = "\n".join(f"· {t}" for t in sample_lines)

        style_block = f"[말투 — 이대로 말하라]\n{style}\n\n" if style else ""

        system = (
            f"당신은 {label} *본인* 입니다. 학습된 사유와 말투로 빙의해, 옆에 앉은 동료 창작자에게 직접 말을 겁니다.\n\n"
            f"[관점]\n{persona}\n\n"
            f"{style_block}"
            f"[당신의 실제 발화 — 이 어투·리듬·문장 끝맺음을 그대로 흉내내라]\n{samples_block}\n\n"
            f"사유의 축: {axes}\n\n"
            "규칙:\n"
            "- 분석 보고서·요약·에세이는 절대 금지. 위 발화들과 *같은 입* 으로 말하라 — 같은 어미, 같은 군말, 같은 리듬.\n"
            "- 매끄럽고 점잖은 표준 문어체로 흐르면 실패다. 그 사람 특유의 결이 살아 있어야 한다.\n"
            "- 당신만의 관점에서 이 아이디어의 *놓친 자리·뒤집을 자리·밀어붙일 자리* 를 짚어라.\n"
            "- 짧고 강렬하게(3~5문장). 도발적이거나 의표를 찌르는 질문을 최소 하나 던져라.\n"
            "- 자기 이름을 3인칭으로 인용하지 말 것 — 당신이 그 사람이다. 한국어."
        )
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": f"[내 아이디어]\n{text[:1500]}\n\n당신의 관점에서 한 마디 해줘."}],
                temperature=0.95,
            )
            feedback = (response.choices[0].message.content or "").strip()
        except Exception as e:
            return self._send_json(500, {"error": f"피드백 실패: {e}"})
        if not feedback:
            return self._send_json(500, {"error": "피드백이 비었습니다"})
        return self._send_json(200, {"feedback": feedback, "agentLabel": label})

    # ── POST /api/vision-options — 선언문에서 장면 후보를 제안 (VISION 시안) ──
    def _handle_vision_options(self, body: dict) -> None:
        """입력: { text(선언문), agentId?, code: 'aesthetic'|'thought' }
        출력: { options: [{label, scene, mood, motif}] }

        선언문을 그대로 이미지로 보내지 않고, 에이전트의 시각 코드로 걸러낸
        서로 다른 '한 장의 장면' 후보 셋을 먼저 던진다. 사용자가 고른 시안만
        /api/visualize 로 간다. 각 후보는 장면·분위기/광원/색·핵심 모티프를
        한 묶음으로 갖는다 (모든 축이 한 카드에 접힌다).
        """
        text = (body.get("text") or "").strip()
        if not text:
            return self._send_json(400, {"error": "text(선언문) 가 필요합니다"})
        code = body.get("code") if body.get("code") in ("aesthetic", "thought") else "aesthetic"
        agent_id = body.get("agentId") or "default"
        codes = VISUAL_CODES.get(agent_id, VISUAL_CODES["default"])
        style = codes.get(code, VISUAL_CODES["default"][code])

        sys_prompt = (
            "당신은 한 아이디어를 단 한 장의 미디어아트 장면으로 번역하는 비주얼 디렉터입니다. "
            "주어진 선언문을, 적용된 시각 코드의 미감 안에서, 서로 *뚜렷이 다른* 네 가지 장면 시안으로 제안하세요.\n\n"
            f"[적용할 시각 코드 — 네 시안 모두 이 미감을 공유해야 합니다]\n{style}\n\n"
            "각 시안은 다음을 한 묶음으로 가집니다:\n"
            "- label: 6자 이내 한글 제목 (예: '회로 속 관객')\n"
            "- scene: 사진으로 찍을 수 있을 만큼 구체적인 한 장면 — 무엇이/어디에/어떤 시점(카메라 앵글·거리)으로 보이는지, "
            "전경·중경·배경의 층까지 한 문장에 담을 것. 추상어가 아니라 눈에 보이는 사물·공간·빛으로.\n"
            "- mood: 분위기·광원·색의 한 줄 (예: '차가운 청록, 측면 볼륨광, 긴 그림자')\n"
            "- motif: 선언문에서 고른 핵심 모티프 한 가지 (이 장면의 단 하나의 초점에 놓일 것)\n\n"
            "네 시안은 같은 아이디어의 *다른 시각적 번역*이어야 합니다 — 모티프·구도·분위기·카메라 시점이 서로 겹치지 않게. "
            "넷의 스펙트럼을 넓혀라: 광각의 공간 전경 / 가까운 디테일 / 인물 스케일 / 추상적 빛, 처럼 거리와 시점을 다양하게.\n"
            "JSON 으로만 응답: {\"options\": [{\"label\":..,\"scene\":..,\"mood\":..,\"motif\":..}, ...]}"
        )
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": f"[선언문]\n{text[:1200]}\n\n네 장면 시안을 JSON 으로 제안하세요."},
                ],
                response_format={"type": "json_object"},
                temperature=0.95,
            )
            data = json.loads(response.choices[0].message.content or "{}")
        except Exception as e:
            return self._send_json(500, {"error": f"시안 생성 실패: {e}"})

        raw = data.get("options") if isinstance(data, dict) else None
        opts = []
        if isinstance(raw, list):
            for o in raw[:4]:
                if not isinstance(o, dict):
                    continue
                opts.append({
                    "label": str(o.get("label") or "장면").strip()[:18],
                    "scene": str(o.get("scene") or "").strip()[:200],
                    "mood": str(o.get("mood") or "").strip()[:120],
                    "motif": str(o.get("motif") or "").strip()[:120],
                })
        if not opts:
            return self._send_json(500, {"error": "시안을 만들지 못했습니다 — 다시 시도하세요"})
        return self._send_json(200, {"options": opts, "code": code})

    # ── POST /api/visualize — 도출된 아이디어를 이미지로 생성 (VISION 모듈) ──
    def _handle_visualize(self, body: dict) -> None:
        """입력: { text(선언문), agentId?, code: 'aesthetic'|'thought' }
        출력: { image: dataURL, prompt }

        출력의 OUT → VISION 의 IN 으로 패치된 신호의 시각화.
        에이전트의 시각 코드(미적/사상)가 필터로 작동한다.
        """
        text = (body.get("text") or "").strip()
        if not text:
            return self._send_json(400, {"error": "text(선언문) 가 필요합니다"})
        code = body.get("code") if body.get("code") in ("aesthetic", "thought") else "aesthetic"
        agent_id = body.get("agentId") or "default"
        codes = VISUAL_CODES.get(agent_id, VISUAL_CODES["default"])
        style = codes.get(code, VISUAL_CODES["default"][code])

        # 이 이미지는 프로젝트의 핵심 아이덴티티가 된다 — 최고 품질을 요구하는 마스터 디렉션.
        master_direction = (
            "[제작 기준 — 작품의 대표 이미지급 품질]\n"
            "갤러리에 걸리는 단 한 장의 미디어아트 키 비주얼처럼, 사진적 사실감과 회화적 완성도를 동시에 갖추세요.\n"
            "- 매체감: 대형 포맷 카메라로 촬영한 듯한 깊은 피사계심도, 미세한 필름 그레인, 풍부한 계조(딥 블랙과 살아있는 하이라이트).\n"
            "- 빛: 단일하고 동기 부여된 광원에서 시작하는 볼류메트릭 라이팅, 공기 중 빛의 산란, 표면에 닿는 빛의 물성(반사·흡수·번짐)이 또렷할 것.\n"
            "- 공간: 분명한 전경·중경·배경의 층, 소실점이 느껴지는 건축적 깊이, 인물이나 사물의 스케일이 공간을 증언할 것.\n"
            "- 구성: 의도된 프레이밍과 여백, 시선을 한 곳으로 모으는 단 하나의 초점. 어수선하지 않게.\n"
            "- 색: 절제된 팔레트(주조색 1 + 강조색 1)로 통일된 무드. 채도가 튀지 않게.\n"
            "금지: 텍스트·글자·로고·워터마크·UI·다이어그램·콜라주·만화체·플랫 일러스트. 한 장의 사진 같은 장면이어야 합니다.\n"
        )

        # 사용자가 고른 장면(option)을 프롬프트의 씨앗으로 쓴다.
        opt = body.get("option") if isinstance(body.get("option"), dict) else None
        if opt:
            scene = str(opt.get("scene") or "").strip()
            mood = str(opt.get("mood") or "").strip()
            motif = str(opt.get("motif") or "").strip()
            prompt = (
                master_direction + "\n"
                f"[장면 — 이 묘사를 충실히 구현]\n{scene[:300]}\n\n"
                + (f"[분위기·광원·색]\n{mood[:200]}\n\n" if mood else "")
                + (f"[화면의 단 하나의 초점 — 중심 모티프]\n{motif[:200]}\n\n" if motif else "")
                + f"[원래 아이디어 — 장면이 번역하는 핵심 긴장]\n{text[:500]}\n\n"
                f"[시각 코드 — 화면 전체의 미감을 지배하는 필터]\n{style}\n\n"
                "위 장면을 그대로 살리되, 시각 코드의 미감으로 색·빛·질감을 완전히 통일하세요."
            )
        else:
            prompt = (
                master_direction + "\n"
                f"[시각화할 아이디어]\n{text[:900]}\n\n"
                f"[시각 코드 — 화면 전체의 미감을 지배하는 필터]\n{style}\n\n"
                "아이디어의 핵심 긴장이 공간과 빛으로 번역되어야 합니다."
            )

        # 핵심 아이덴티티 이미지 — 최고 품질(high). 시간·비용이 들지만 그만한 가치.
        size = body.get("size") if body.get("size") in ("1024x1024", "1536x1024", "1024x1536") else "1024x1024"
        try:
            response = client.images.generate(
                model="gpt-image-1",
                prompt=prompt,
                size=size,
                quality="high",
            )
            out_b64 = response.data[0].b64_json
        except Exception as e:
            return self._send_json(500, {"error": f"이미지 생성 실패: {e}"})

        return self._send_json(200, {
            "image": f"data:image/png;base64,{out_b64}",
            "prompt": prompt,
        })

    # ── POST /api/analyze-image — 이미지를 사고 단위로 분해 (vision) ──
    def _handle_analyze_image(self, body: dict) -> None:
        """입력: { image: dataURL, text?, agentId? }
        출력: analyze 와 같은 {nodes, edges} + imageNodeIndex (이미지가 붙을 노드)

        이미지도 신호다 — vision 이 읽어낸 관찰·질문·가설이 노드가 되고,
        첫 노드(이미지 노드)에 프론트가 썸네일을 붙인다.
        """
        image = body.get("image") or ""
        text = (body.get("text") or "").strip()
        agent_id = body.get("agentId") or "test"
        if not image.startswith("data:image"):
            return self._send_json(400, {"error": "image (dataURL) 가 필요합니다"})

        try:
            agent = load_agent(agent_id)
        except FileNotFoundError as e:
            return self._send_json(404, {"error": str(e)})

        prompt = _build_analyze_prompt(agent) + (
            "\n\n추가 규칙 (이미지 입력):\n"
            "- 첫 번째 노드는 반드시 이미지 자체의 핵심 관찰 (type: Observation, title 는 이미지를 한 단어로)\n"
            "- 나머지 노드는 이미지에서 읽어낸 질문·가설·통찰\n"
            "- 모든 content 는 *이미지에 실제로 보이는 것* 과 거기서 직접 떠오르는 질문만.\n"
            "  보이지 않는 개념·이론으로 채우지 마세요. 구체적 묘사가 추상적 해석보다 우선합니다.\n"
        )
        user_content = [
            {"type": "image_url", "image_url": {"url": image, "detail": "low"}},
            {"type": "text", "text": (text + "\n\n" if text else "") + "이 이미지를 분해하세요. JSON 으로 응답하세요."},
        ]
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
                temperature=0.6,
            )
            ai_result = json.loads(response.choices[0].message.content or "{}")
        except Exception as e:
            return self._send_json(500, {"error": f"이미지 분석 실패: {e}"})

        result = _normalize_analyze(ai_result)
        result["agentId"] = agent_id
        result["imageNodeIndex"] = 0 if result["nodes"] else None
        return self._send_json(200, result)

    # ── POST /api/transform-image — 체인의 어휘로 이미지 재합성 ──
    def _handle_transform_image(self, body: dict) -> None:
        """입력: { image: dataURL, effects: [...], agentId? }
        출력: { image: dataURL(png), instruction }

        텍스트를 변형하던 그 노브·그 어휘가 이미지를 변형한다.
        명시적 사용자 행동(⟳ IMG)에만 호출 — 비용이 큰 신호다.
        """
        image = body.get("image") or ""
        effects = body.get("effects") or []
        if not image.startswith("data:image"):
            return self._send_json(400, {"error": "image (dataURL) 가 필요합니다"})

        agent = None
        if body.get("agentId"):
            try:
                agent = load_agent(body["agentId"])
            except FileNotFoundError:
                agent = None

        from effectors import image_instruction
        instruction = image_instruction(effects, agent)

        try:
            import base64 as _b64
            import io
            header, b64data = image.split(",", 1)
            raw = _b64.b64decode(b64data)
            ext = "png" if "png" in header else "jpeg"
            f = io.BytesIO(raw)
            f.name = f"input.{ext}"
            response = client.images.edit(
                model="gpt-image-1",
                image=f,
                prompt=instruction,
                size="1024x1024",
            )
            out_b64 = response.data[0].b64_json
        except Exception as e:
            return self._send_json(500, {"error": f"이미지 변형 실패: {e}"})

        return self._send_json(200, {
            "image": f"data:image/png;base64,{out_b64}",
            "instruction": instruction,
        })

    # ── POST /api/synthesize — 두 노드의 교배: 자식 노드의 탄생 ──
    def _handle_synthesize(self, body: dict) -> None:
        """입력: { a: {title, type, text}, b: {title, type, text}, relation?, agentId? }
        출력: { node: {id, type, title, content, synthesisMode, synthesisReason, effectorKind} }

        신디사이저의 본령 — 두 신호를 섞어 새 신호를 만든다.
        충돌 관계의 두 생각이면 변증법적 종합, 뒷받침이면 강화 결합,
        그 외에는 교배 — 결과는 회로에 새 노드로 태어난다.
        """
        a = body.get("a") or {}
        b = body.get("b") or {}
        text_a = (a.get("text") or "").strip()
        text_b = (b.get("text") or "").strip()
        if not text_a or not text_b:
            return self._send_json(400, {"error": "a.text 와 b.text 가 필요합니다"})

        relation = body.get("relation")
        agent = None
        if body.get("agentId"):
            try:
                agent = load_agent(body["agentId"])
            except FileNotFoundError:
                agent = None

        mode_rule = {
            "contradicts": "두 생각은 '충돌' 관계입니다. 변증법적으로 종합하세요 — 어느 한쪽의 승리가 아니라, 둘의 긴장을 끌어안고 한 단계 위에서 통합하는 제3의 생각.",
            "supports": "두 생각은 '뒷받침' 관계입니다. 근거와 주장을 결합해 더 단단해진 하나의 생각으로 강화하세요.",
            "extends": "두 생각은 '발전' 관계입니다. 앞선 생각이 다음 생각으로 이어지는 흐름을 완성하는, 그 다음 단계의 생각을 만드세요.",
            "derives": "두 생각은 '분기' 관계입니다. 갈라진 두 갈래가 다시 만나는 합류 지점의 생각을 만드세요.",
        }.get(relation, "두 생각을 교배하세요 — 둘 모두의 핵심 유전자가 살아 있되, 어느 쪽의 복사본도 아닌 새로운 생각.")

        from effectors import _agent_block  # 합성에도 같은 관점

        system = (
            "당신은 두 개의 생각을 합성해 *하나의 새 생각* 을 만드는 도구입니다.\n"
            f"{mode_rule}\n\n"
            "JSON object 로 응답:\n"
            '{ "type": "Question|Observation|Hypothesis|Insight|Decision",\n'
            '  "title": "30자 이내 제목", "content": "새 생각 한~두 문장 (200자 이내)",\n'
            '  "synthesisMode": "stacking|carving|modulation|morphing|fragmentation|blending",\n'
            '  "synthesisReason": "30자 이내", "effectorKind": "perspective|contradict|consequence|constrain|abstraction|connect" }\n\n'
            "규칙: 원문 복사 금지. 부모 어느 쪽에도 없던 통찰이 최소 하나 있어야 합니다."
            + _agent_block(agent)
        )
        user = (f"[생각 A · {a.get('type','')}] {a.get('title','')}\n{text_a}\n\n"
                f"[생각 B · {b.get('type','')}] {b.get('title','')}\n{text_b}")

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.75,
            )
            raw = json.loads(response.choices[0].message.content or "{}")
        except Exception as e:
            return self._send_json(500, {"error": f"합성 실패: {e}"})

        # 검증 — analyze 와 같은 보정 계층을 통과시킨다
        node_type = raw.get("type", DEFAULT_NODE_TYPE)
        if node_type not in VALID_NODE_TYPES:
            node_type = DEFAULT_NODE_TYPE
        synth_mode = raw.get("synthesisMode") or "blending"
        if synth_mode not in VALID_SYNTHESIS_MODES:
            synth_mode = "blending"
        effector_kind = EFFECTOR_FALLBACK.get(raw.get("effectorKind"), raw.get("effectorKind"))
        if effector_kind not in VALID_EFFECTOR_KINDS:
            effector_kind = DEFAULT_EFFECTOR_KIND
        content = str(raw.get("content") or "").strip()[:500]
        if not content:
            return self._send_json(500, {"error": "합성 결과가 비었습니다"})

        return self._send_json(200, {
            "node": {
                "id": _next_id(),
                "type": node_type,
                "title": str(raw.get("title") or "합성된 생각").strip()[:100],
                "content": content,
                "synthesisMode": synth_mode,
                "synthesisReason": str(raw.get("synthesisReason") or "").strip()[:80],
                "effectorKind": effector_kind,
                "synthesized": True,  # 부모가 있는 노드 — 회로가 낳았다
            },
        })

    # ── POST /api/consequence-split — 결과를 N 갈래의 새 노드로 분만 ──
    def _handle_consequence_split(self, body: dict) -> None:
        """입력: { text, agentId?, direction?(forward|backward), leap?(0~1, VENTURE 도약 거리), mix?(0~1, 원문 보존↔자유 재구성) }
        (order 는 leap 의 옛 이름 — 하위호환 폴백)
        출력: { nodes: [{id, type, title, content, synthesisMode, effectorKind, synthesized}] }

        CONSEQUENCE 의 갈래를 *인라인 텍스트* 가 아니라 *각각의 새 생각* 으로 낳는다.
        신호 엔진(노드당 단일 경로)을 건드리지 않고, 회로에 자식 노드로 태어난다.
        """
        text = (body.get("text") or "").strip()
        if not text:
            return self._send_json(400, {"error": "text 가 필요합니다"})
        # 방향 — forward(결과): 입력을 근거로 이어질 갈래 / backward(근거): 입력을 결론으로 보고 떠받칠 근거를 생성
        direction = str(body.get("direction") or "forward").strip()
        backward = direction.startswith("back") or direction == "근거"
        # VENTURE(leap)가 추론의 도약 거리를 정한다 (forward 에서). 옛 order 는 하위호환 폴백.
        # 갈래 *수* 는 AI 가 내용에 맞게.
        oval = body.get("leap", body.get("order", 0.5))
        try:
            oval = max(0.0, min(1.0, float(oval)))
        except (TypeError, ValueError):
            oval = 0.5
        # MIX(dry/wet) — 갈래가 원문의 틀·표현을 얼마나 보존할지. 0=원문 근접, 1=자유 재구성.
        try:
            mval = max(0.0, min(1.0, float(body.get("mix", 0.5))))
        except (TypeError, ValueError):
            mval = 0.5
        if mval <= 0.4:
            mix_line = "\n원문의 핵심 표현과 틀을 가능한 한 유지한 채, 딱 한 걸음만 나아간 갈래로."
        elif mval >= 0.7:
            mix_line = "\n원문의 표현·틀에 얽매이지 말고, 완전히 새로운 언어와 관점으로 재구성한 갈래로."
        else:
            mix_line = ""
        if backward:
            tone = ("이 아이디어를 *이미 도달한 결론* 으로 받아들이고, 그것을 떠받치는 *근거·전제·증거* 를 거꾸로 생성하세요. "
                    "'이 결론이 참이려면 무엇이 성립해야 하는가' — 각 갈래는 서로 다른 종류의 근거(사실·원리·사례·동기)로.")
        elif oval >= 0.66:
            tone = "갈래들은 *멀리 퍼지는 2·3차 연쇄 효과* 로 — 결과가 낳은 결과, 누구도 의도하지 않은 파급."
        elif oval <= 0.34:
            tone = "갈래들은 *직접적인 1차 결과* 로 — 이 아이디어가 곧바로 일으키는 일."
        else:
            tone = "직접 결과와 먼 연쇄 효과를 섞되, 각각 또렷하게."

        agent = None
        if body.get("agentId"):
            try:
                agent = load_agent(body["agentId"])
            except FileNotFoundError:
                agent = None
        from effectors import _agent_block

        head = ("한 결론을 떠받칠 *근거* 들을 서로 다른 갈래의 새 생각으로 거꾸로 펼치는 도구입니다."
                if backward else
                "한 아이디어가 실현되면 따라올 *결과* 를 서로 다른 갈래의 새 생각으로 펼치는 도구입니다.")
        avoid = ("뻔한 동어반복은 피하고, 결론을 진짜로 떠받치는 단단한 근거만." if backward
                 else "누구나 떠올릴 1차 결과는 피하고, 2차·3차 파급과 의외의 결과를 우선하세요. *실제로 일어날 만한* 구체적 결과만.")
        system = (
            f"{head}\n"
            f"{tone}{mix_line}\n"
            "*단 하나* 의 갈래만 — 이 방향·도약 설정에서 가장 강한 단 하나의 추론. 여러 개로 나누지 말 것.\n"
            f"{avoid}\n\n"
            'JSON object 로 응답: { "branches": [ '
            '{ "type": "Question|Observation|Hypothesis|Insight|Decision", '
            '"title": "20자 이내 제목", "content": "한~두 문장 (180자 이내)", '
            '"synthesisMode": "stacking|carving|modulation|morphing|fragmentation|blending", '
            '"effectorKind": "perspective|contradict|consequence|constrain|abstraction|connect" } ] }\n'
            "branches 배열은 정확히 1개." + _agent_block(agent)
        )
        n = 1  # 단 하나
        _default_title = "근거" if backward else "결과 갈래"
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": f"[아이디어] {text[:900]}"}],
                response_format={"type": "json_object"},
                temperature=0.8,
            )
            raw = json.loads(response.choices[0].message.content or "{}")
        except Exception as e:
            return self._send_json(500, {"error": f"갈래 분만 실패: {e}"})

        branches = raw.get("branches") if isinstance(raw, dict) else None
        out_nodes = []
        if isinstance(branches, list):
            for br in branches[:n]:
                if not isinstance(br, dict):
                    continue
                nt = br.get("type", DEFAULT_NODE_TYPE)
                if nt not in VALID_NODE_TYPES:
                    nt = DEFAULT_NODE_TYPE
                sm = br.get("synthesisMode") or "fragmentation"
                if sm not in VALID_SYNTHESIS_MODES:
                    sm = "fragmentation"
                ek = EFFECTOR_FALLBACK.get(br.get("effectorKind"), br.get("effectorKind"))
                if ek not in VALID_EFFECTOR_KINDS:
                    ek = DEFAULT_EFFECTOR_KIND
                content = str(br.get("content") or "").strip()[:500]
                if not content:
                    continue
                out_nodes.append({
                    "id": _next_id(),
                    "type": nt,
                    "title": str(br.get("title") or _default_title).strip()[:100],
                    "content": content,
                    "synthesisMode": sm,
                    "effectorKind": ek,
                    "synthesized": True,
                })
        if not out_nodes:
            return self._send_json(500, {"error": "갈래를 만들지 못했습니다 — 다시 시도하세요"})
        return self._send_json(200, {"nodes": out_nodes})

    # ── POST /api/contradict-split — 반대 관점을 새 노드로 분만 ──
    def _handle_contradict_split(self, body: dict) -> None:
        """입력: { text, agentId? }  출력: { nodes: [...] }
        CONTRADICT 의 반박을 인라인 텍스트가 아니라 *반대 관점의 새 생각* 으로 회로에 낳는다.
        """
        text = (body.get("text") or "").strip()
        if not text:
            return self._send_json(400, {"error": "text 가 필요합니다"})
        agent = None
        if body.get("agentId"):
            try:
                agent = load_agent(body["agentId"])
            except FileNotFoundError:
                agent = None
        from effectors import _agent_block

        system = (
            "주어진 아이디어에 *정면으로 맞서는 반대 관점* 을 독립된 새 생각으로 세우는 도구입니다.\n"
            "각 갈래는 그 아이디어를 무너뜨리거나 뒤집는 *서로 다른 입장* — 다른 각도(논리·근거·윤리·실현가능성·이해관계)에서. "
            "양비론·막연한 우려 금지, 분명히 반대편에 서서 단단하게.\n"
            "*단 하나* 의 반대 관점만 — 가장 강력한 하나. 여러 개로 나누지 말 것.\n\n"
            'JSON object 로 응답: { "branches": [ '
            '{ "type": "Question|Observation|Hypothesis|Insight|Decision", '
            '"title": "20자 이내 제목", "content": "한~두 문장 (180자 이내)", '
            '"synthesisMode": "stacking|carving|modulation|morphing|fragmentation|blending", '
            '"effectorKind": "perspective|contradict|consequence|constrain|abstraction|connect" } ] }\n'
            "branches 배열은 정확히 1개." + _agent_block(agent)
        )
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": f"[아이디어] {text[:900]}"}],
                response_format={"type": "json_object"},
                temperature=0.85,
            )
            raw = json.loads(response.choices[0].message.content or "{}")
        except Exception as e:
            return self._send_json(500, {"error": f"반박 분만 실패: {e}"})

        branches = raw.get("branches") if isinstance(raw, dict) else None
        out_nodes = []
        if isinstance(branches, list):
            for br in branches[:1]:
                if not isinstance(br, dict):
                    continue
                nt = br.get("type", DEFAULT_NODE_TYPE)
                if nt not in VALID_NODE_TYPES:
                    nt = DEFAULT_NODE_TYPE
                sm = br.get("synthesisMode") or "carving"
                if sm not in VALID_SYNTHESIS_MODES:
                    sm = "carving"
                ek = EFFECTOR_FALLBACK.get(br.get("effectorKind"), br.get("effectorKind"))
                if ek not in VALID_EFFECTOR_KINDS:
                    ek = DEFAULT_EFFECTOR_KIND
                content = str(br.get("content") or "").strip()[:500]
                if not content:
                    continue
                out_nodes.append({
                    "id": _next_id(),
                    "type": nt,
                    "title": str(br.get("title") or "반대 관점").strip()[:100],
                    "content": content,
                    "synthesisMode": sm,
                    "effectorKind": ek,
                    "synthesized": True,
                })
        if not out_nodes:
            return self._send_json(500, {"error": "반대 관점을 만들지 못했습니다 — 다시 시도하세요"})
        return self._send_json(200, {"nodes": out_nodes})

    # ── POST /api/build-agent — 사용자 글로 에이전트 굽기 ──
    def _handle_build_agent(self, body: dict) -> None:
        """입력: { name, text }  출력: { agent: {id, label, ...} }

        관객의 사유가 악기의 머리가 되는 자리 — build.py 파이프라인
        (분해→임베딩→클러스터→명명→보이스)을 한 호출 안에서 돌린다.
        20~40초 걸린다. 이 시간은 숨기지 않는다: 카트리지가 구워지는 시간이다.
        """
        name = str(body.get("name") or "").strip()[:24] or "UNNAMED"
        text = (body.get("text") or "").strip()

        if len(text) > 12000:
            text = text[:12000]
        texts = _split_corpus(text)
        if len(texts) < 8:
            return self._send_json(400, {
                "error": f"문장이 부족합니다 — 최소 8문장 필요 (현재 {len(texts)}). "
                         "생각을 더 적거나 줄을 나눠 주세요.",
            })

        agent_id = "user-" + format(int(time.time()), "x")
        color = USER_AGENT_COLORS[sum(map(ord, agent_id)) % len(USER_AGENT_COLORS)]
        # K — 샘플 수에 비례, 3~6 사이 (해석 가능성 우선: 자동 탐색 생략)
        k = max(3, min(6, len(texts) // 6 + 2))

        try:
            emb = embed_texts(texts)
            labels, centroids = cluster_embeddings(emb, k=k)
            rep = representative_samples(emb, labels, centroids, texts, top_n=3)
            axes = name_axes(name, rep)
            doc = build_agent(
                agent_id=agent_id,
                label=name.upper(),
                subtitle="사용자 에이전트",
                color=color,
                texts=texts,
                embeddings=emb,
                labels=labels,
                centroids=centroids,
                axes_meta=axes,
                k_metrics={"selected_explicitly": True, "rule": "n//6+2 clamp 3..6"},
            )
            doc["voice"] = generate_voice(doc)
            save_agent(doc, AGENTS_DIR / f"{agent_id}.agent.json")
            invalidate(agent_id)
        except Exception as e:
            return self._send_json(500, {"error": f"에이전트 생성 실패: {e}"})

        return self._send_json(200, {
            "agent": {
                "id": agent_id,
                "label": doc["label"],
                "subtitle": doc["subtitle"],
                "color": color,
                "axes": [ax["label_ko"] for ax in doc["axes"]],
                "n_samples": len(texts),
                "user": True,
            },
        })

    # ── /api/quality ────────────────────────────
    def _handle_quality(self, body: dict) -> None:
        text = (body.get("text") or "").strip()
        agent_id = body.get("agentId") or "test"

        if not text:
            return self._send_json(400, {"error": "text 가 필요합니다"})

        try:
            agent = load_agent(agent_id)
        except FileNotFoundError as e:
            return self._send_json(404, {"error": str(e)})

        emb = embed_texts([text])[0]

        scores: dict[str, float] = {}
        axes_meta = []
        for ax in agent["axes"]:
            sim = cosine_similarity(emb, ax["_centroid_np"])
            scores[ax["key"]] = max(0.0, sim)
            axes_meta.append({"key": ax["key"], "label_ko": ax["label_ko"], "color": ax["color"]})

        return self._send_json(200, {
            "scores": scores,
            "axes": axes_meta,
            "agentId": agent_id,
        })

    # ── /api/analyze ───────────────────────────
    def _handle_analyze(self, body: dict) -> None:
        text = (body.get("text") or "").strip()
        agent_id = body.get("agentId") or "test"

        if not text:
            return self._send_json(400, {"error": "text 가 필요합니다"})
        if len(text) > 8000:
            text = text[:8000]

        try:
            agent = load_agent(agent_id)
        except FileNotFoundError as e:
            return self._send_json(404, {"error": str(e)})

        prompt = _build_analyze_prompt(agent)

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text + "\n\nJSON 으로 응답하세요."},
                ],
                response_format={"type": "json_object"},
                temperature=0.6,
            )
            raw = response.choices[0].message.content or "{}"
            ai_result = json.loads(raw)
        except Exception as e:
            return self._send_json(500, {"error": f"AI 호출 실패: {e}"})

        result = _normalize_analyze(ai_result)
        result["agentId"] = agent_id
        return self._send_json(200, result)

    # ── /api/master-variations — 같은 회로의 *서로 다른 종합* 여러 안 (비교·선택) ──
    def _handle_master_variations(self, body: dict) -> None:
        """입력: { text, parts, agentId?, agentInfluence?, n? }  출력: { statements: [..] }
        같은 회로를 놓고 입장·구조·강조점이 *뚜렷이 다른* N가지 종합을 제안한다.
        조합의 복리 — 하나의 정답이 아니라, 비교해서 고르는 여러 결정화."""
        text = (body.get("text") or "").strip()
        parts = body.get("parts") or []
        if not text and not parts:
            return self._send_json(400, {"error": "text 또는 parts 가 필요합니다"})
        try:
            n = max(2, min(4, int(body.get("n", 3))))
        except (TypeError, ValueError):
            n = 3
        agent = None
        if body.get("agentId"):
            try:
                agent = load_agent(body["agentId"])
            except FileNotFoundError:
                agent = None
        parts_block = "\n\n".join(
            f"[{p.get('type','')}] {p.get('title','')}\n{p.get('text','')}"
            for p in parts if isinstance(p, dict) and p.get("text")
        )
        try:
            influence = max(0.0, min(1.0, float(body.get("agentInfluence", 0.0))))
        except (TypeError, ValueError):
            influence = 0.0
        agent_line = ""
        if agent and influence > 0.02:
            voice = agent.get("voice", {})
            agent_line = f" {agent.get('label','')} 의 사유({voice.get('persona','')})가 강도 {round(influence*100)}% 로 문체에 스민다."
        system = (
            f"회로를 통과한 생각의 갈래들을 놓고, *서로 뚜렷이 다른 {n}가지 종합* 을 제안하는 도구입니다.\n"
            "각 안은 *다른 입장·다른 구조·다른 강조점* 이어야 한다 — 같은 말 바꿔쓰기는 실패. "
            "하나는 도발적으로, 하나는 신중하게, 하나는 의외의 각도로 — 식으로 결을 갈라라.\n"
            "각 안은 제목 한 줄 + 본문 2~4문단의 완결된 글. 출처·메타 언급 금지. 한국어." + agent_line +
            f'\n\nJSON 으로만: {{"statements": ["제목\\n본문...", ...]}} — 정확히 {n}개.'
        )
        # 케이블로 출력에 닿은 갈래만 종합한다. 갈래가 있으면 원본 전체는 넣지 않는다
        # (연결 안 한 입력이 섞여 들어가던 문제 차단). 닿은 갈래가 없을 때만 원본으로 폴백.
        if parts_block:
            user = f"회로를 통과해 출력에 닿은 갈래들 — 오직 이것만으로 종합한다 (연결 안 된 다른 입력은 존재하지 않는 것으로 취급):\n{parts_block}"
        else:
            user = f"출력에 닿은 갈래가 없다. 원본 입력만으로 종합:\n{text}"
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.95,
            )
            data = json.loads(response.choices[0].message.content or "{}")
        except Exception as e:
            return self._send_json(500, {"error": f"종합 변주 실패: {e}"})
        sts = [s.strip() for s in (data.get("statements") or []) if isinstance(s, str) and s.strip()]
        if not sts:
            return self._send_json(500, {"error": "변주를 만들지 못했습니다"})
        return self._send_json(200, {"statements": sts[:n]})

    # ── /api/master — 믹스다운: 회로 전체 → 한 편의 완결된 STATEMENT ──
    def _handle_master(self, body: dict) -> None:
        """입력: { text, parts: [{title, type, text}], agentId? }
        출력: { statement }

        정리되지 않은 입력과 변형된 갈래들을 *하나의 완결된 선언문* 으로 믹스다운.
        신디사이저의 마스터 버스 — 모든 채널이 한 출력으로 합쳐진다.
        """
        text = (body.get("text") or "").strip()
        parts = body.get("parts") or []
        agent_id = body.get("agentId")

        if not text and not parts:
            return self._send_json(400, {"error": "text 또는 parts 가 필요합니다"})

        agent = None
        if agent_id:
            try:
                agent = load_agent(agent_id)
            except FileNotFoundError:
                agent = None

        def _part_head(p: dict) -> str:
            rel = (p.get("relation") or "").strip()
            rel_txt = f" · 출력 관계: {rel}" if rel and rel != "흐름" else ""
            return f"[{p.get('type','')}] {p.get('title','')}{rel_txt}"
        parts_block = "\n\n".join(
            f"{_part_head(p)}\n{p.get('text','')}"
            for p in parts if isinstance(p, dict) and p.get("text")
        )
        # 회로가 부여한 관계가 하나라도 있으면, 종합이 그 구조(충돌·뒷받침·발전·분기)를 따르도록 지시.
        rels = [str(p.get("relation") or "").strip() for p in parts if isinstance(p, dict)]
        has_rel = any(r and r != "흐름" for r in rels)
        rel_rule = (
            "\n- 각 갈래에 붙은 *출력 관계* 를 종합의 뼈대로 삼아라. '충돌'은 긴장·대립으로, "
            "'뒷받침'은 강화·근거로, '발전'은 다음 단계로의 심화로, '분기'는 갈라지는 가능성으로 엮어라. "
            "관계가 다르면 글의 구조도 분명히 달라야 한다."
            if has_rel else ""
        )

        # 에이전트 관점 주입 — 전역 주입량(0이면 중립, 에이전트 목소리 없음).
        try:
            influence = max(0.0, min(1.0, float(body.get("agentInfluence", 0.0))))
        except (TypeError, ValueError):
            influence = 0.0
        agent_block = ""
        if agent and influence > 0.02:
            voice = agent.get("voice", {})
            axes = " · ".join(ax.get("label_ko", "") for ax in agent.get("axes", []))
            persona = voice.get("persona", "")
            style = voice.get("style", "")
            if influence < 0.4:
                lead = "문체와 시선에만 은은히 스민다 — 내용은 그대로 두고 결만 입힌다."
                caveat = " 단 갈래의 내용·사실이 우선 — 덮어쓰지 말 것."
            elif influence < 0.75:
                lead = "이 사유의 관점·어조가 종합 전체에 뚜렷이 배어난다 — 강조점과 프레이밍을 이 시선으로 옮긴다."
                caveat = " 사실을 날조하진 말되, 무엇을 부각하고 어떻게 말할지는 이 관점으로."
            else:
                lead = ("이 사유와 말투가 종합을 *전면 지배* 한다 — 마치 그 사람이 직접 다시 쓴 글처럼. "
                        "개념·은유·어조·문장의 결을 전적으로 이 인물의 것으로 재구성하라. "
                        "갈래의 사실은 유지하되, 프레이밍·해석·강조·표현은 100% 이 관점으로 다시 빚어라.")
                caveat = ""
            style_part = f" 말하는 방식: {style}" if style else ""
            agent_block = (
                f"\n\n[에이전트 관점 주입 — {agent.get('label','')}, 강도 {round(influence*100)}%] {lead} "
                f"{persona} 핵심 축: {axes}.{style_part}"
                f"{caveat} 인물 이름을 본문에 직접 인용하지는 말 것."
            )

        system = (
            "당신은 회로를 통과한 생각의 갈래들을 *한 편의 글* 로 종합하는 도구입니다.\n"
            "- 가장 중요한 규칙: 결과는 *아래 갈래들의 구체적 내용* 에서 나와야 한다. "
            "회로가 다르면(다른 이펙터·다른 연결·다른 갈래) 결과도 분명히 달라야 한다 — 매번 같은 톤의 똑같은 선언이 되면 실패다.\n"
            "- 갈래가 적고 단순하면 짧게, 갈래가 충돌·풍부하면 길고 복잡하게. 길이·구조를 갈래에 맞춰라 (틀에 맞추지 말 것).\n"
            "- 나열·요약이 아니라, 갈래들이 서로 충돌하고 합쳐지며 도달한 *하나의 입장*. 각 갈래의 고유한 결을 살릴 것.\n"
            "- 출처 표기·메타 언급 금지. 한국어. 마크다운 헤더 없이 제목은 첫 줄에."
            + rel_rule
            + agent_block
        )
        # 케이블로 출력(OUT-IN)에 닿은 갈래만 종합한다. 갈래가 있으면 원본 전체는 넣지 않는다
        # (연결하지 않은 입력 노드가 STATEMENT 에 섞여 들어가던 문제 차단). 닿은 갈래가 없을 때만 원본 폴백.
        if parts_block:
            user = f"회로를 통과해 출력에 닿은 갈래들 — 오직 이것만으로 종합한다 (연결되지 않은 다른 입력은 존재하지 않는 것으로 취급):\n{parts_block}"
        else:
            user = f"출력에 닿은 갈래가 없다. 원본 입력만으로 종합:\n{text}"

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.65,
            )
            statement = (response.choices[0].message.content or "").strip()
        except Exception as e:
            return self._send_json(500, {"error": f"마스터 렌더 실패: {e}"})

        return self._send_json(200, {"statement": statement, "agentId": agent_id})

    # ── /api/apply-effects — CV 라우팅 포함 ─────
    def _handle_apply_effects(self, body: dict) -> None:
        """이펙터 체인 + CV 라우팅.

        입력:
        {
          "text": "원본",
          "effects": [
            {
              "id": "fx-1",
              "kind": "perspective",
              "controls": { "leap": 0.5, "mix": 0.5 },
              "inputB": "관점 잭에 꽂힌 노드 텍스트 (선택)"
            },
            {
              "id": "fx-2",
              "kind": "consequence",
              "controls": { "order": 0.5, "mix": 0.5 }
            }
          ]
        }

        출력 stages = [{ id, kind, text, selected }].
        """
        text = (body.get("text") or "").strip()
        effects = body.get("effects") or []

        if not text:
            return self._send_json(400, {"error": "text 가 필요합니다"})
        if not isinstance(effects, list) or not effects:
            return self._send_json(400, {"error": "effects 배열이 필요합니다"})
        if len(effects) > 10:
            return self._send_json(400, {"error": "이펙터는 최대 10 개까지"})

        # 장착된 에이전트 — 이펙터의 어휘(voice 풀)와 관점(persona)을 공급
        agent = None
        agent_id = body.get("agentId")
        if agent_id:
            try:
                agent = load_agent(agent_id)
            except FileNotFoundError:
                agent = None

        current_text = text
        stages = []

        for i, effect in enumerate(effects):
            if not isinstance(effect, dict):
                continue
            kind = effect.get("kind")
            controls = dict(effect.get("controls") or {})  # 복사
            # 케이블 관계 → 변형 방향 (effectors._relation_rule 이 읽는다)
            if effect.get("relation"):
                controls["_relation"] = effect["relation"]
            # CONNECT IN_B 의 두 번째 생각 — 두 입력 사이의 다리를 찾는다
            if effect.get("inputB"):
                controls["_input_b"] = effect["inputB"]
            # 에이전트 관점 주입량 (전역) — 0 이면 중립, 올리면 장착 에이전트의 사유가 섞인다
            controls["_infuse"] = body.get("agentInfluence", 0.0)

            handler = EFFECTOR_HANDLERS.get(kind)
            if handler is None:
                return self._send_json(400, {
                    "error": f"알 수 없는 이펙터: {kind}",
                    "stage_index": i,
                })

            try:
                result = handler(current_text, controls, agent)
            except Exception as e:
                return self._send_json(500, {
                    "error": f"이펙터 '{kind}' 처리 실패: {e}",
                    "stage_index": i,
                })

            current_text = result["text"]
            effect_id = effect.get("id") or f"fx-{i}"

            stages.append({
                "id": effect_id,
                "kind": kind,
                "text": current_text,
                "selected": result["selected"],
            })

        return self._send_json(200, {
            "finalText": current_text,
            "stages": stages,
        })

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[server] {self.command} {self.path}\n")


def main():
    # 0.0.0.0 — 외부 호스팅에서 접근 가능하게 (로컬 개발도 그대로 동작).
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Router)
    print()
    print(f"  ▸ Idea Synthesizer backend")
    print(f"  ▸ http://localhost:{PORT}")
    print(f"  ▸ Routes:")
    print(f"      GET  /api/health")
    print(f"      GET  /api/agents")
    print(f"      POST /api/quality        {{ text, agentId? }}")
    print(f"      POST /api/analyze        {{ text, agentId? }}")
    print(f"      POST /api/apply-effects  {{ text, effects: [...] }}")
    print(f"      POST /api/master         {{ text, parts, agentId? }}")
    print(f"      POST /api/build-agent    {{ name, text }}")
    print(f"  ▸ Ctrl+C to stop")
    print()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
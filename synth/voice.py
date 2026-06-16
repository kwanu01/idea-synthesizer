"""voice.py — 에이전트의 '목소리' 생성 CLI.

에이전트의 코퍼스·축을 근거로, 이펙터들이 쓸 *그 사상가의 어휘* 를 만든다:
  - persona: 변형 프롬프트에 주입될 관점 요약 (2~3 문장)
  - pools:   9 개 풀 컨트롤 (WHO·DOMAIN·AXIS·ANGLE·ERA·FOCUS·VIEWPOINT)의
             선택지를 그 사유의 세계로 교체

이게 없으면 이펙터는 범용 풀('10대 학생', '자전거 타기')로 떨어지고,
에이전트를 학습한 의미가 사라진다.

사용법:
    python3 synth/voice.py <agentId>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from openai import OpenAI

client = OpenAI()

POOL_SPEC = {
    "perspective": {"who": 16},
    "analogy": {"domain": 16},
    "constrain": {"axis": 14},
    "contradict": {"angle": 14},
    "consequence": {"domain": 14},
    "genealogy": {"era": 14},
    "zoom": {"focus": 14},
    "connect": {"domain": 16},
    "defamiliarize": {"viewpoint": 14},
}

POOL_MEANING = """\
- perspective.who: 이 사상의 세계에 등장하는 *시선의 주체들* (예: 어떤 인물형·역할·존재의 눈)
- analogy.domain: 이 사상가가 즐겨 빌리던 *비유의 영역들*
- constrain.axis: 이 사상의 관점에서 의미 있는 *제약들*
- contradict.angle: 이 사상이 받았거나 던졌던 *비판의 각도들*
- consequence.domain: 이 사상이 주목한 *결과의 영역들*
- genealogy.era: 이 사상의 계보에서 의미 있는 *시점·시대들*
- zoom.focus: 이 사상이 들여다보던 *측면·디테일들*
- connect.domain: 이 사상이 연결하던 *먼 분야들*
- defamiliarize.viewpoint: 이 사상이 빌려 쓰던 *낯선 시점들*"""


def generate_voice(agent: dict) -> dict:
    """에이전트 dict 를 받아 voice {persona, pools} 를 생성해 반환.
    CLI 와 서버(/api/build-agent)가 공유하는 코어."""
    axes_block = "\n".join(
        f"- {ax['label_ko']}: {ax.get('description','')}" for ax in agent.get("axes", [])
    )
    samples = [s["text"] if isinstance(s, dict) else s for s in agent.get("samples", [])][:30]
    samples_block = "\n".join(f"· {t}" for t in samples)

    spec_block = json.dumps(
        {ek: {k: f"<문자열 {n}개>" for k, n in v.items()} for ek, v in POOL_SPEC.items()},
        ensure_ascii=False, indent=2,
    )

    system = f"""당신은 한 사상가의 코퍼스를 근거로, 아이디어 변형 도구가 쓸 *그 사상의 어휘* 를 설계합니다.

사상가: {agent.get('label','')}
사유의 축:
{axes_block}

코퍼스 발화:
{samples_block}

JSON object 로 응답:
{{
  "persona": "<이 사유로 아이디어를 변형할 때의 관점 요약 2~3 문장. '~한다' 결>",
  "style": "<이 사람이 *실제로 말하는 방식* — 어조·문장 끝맺음·말버릇·즐겨 쓰는 표현·반말/존대 여부를 구체적으로. 코퍼스 발화의 결을 그대로 본떠 2~3 문장. 끝에 실제 말투를 흉내낸 짧은 예시 표현 2~3개를 따옴표로.>",
  "pools": {spec_block}
}}

풀의 의미:
{POOL_MEANING}

규칙:
- 모든 선택지는 한국어 2~7 단어. 코퍼스의 사유에서 직접 길어 올린 것만.
- 일반적·범용적 선택지 금지 ('10대 학생', '자전거 타기' 같은 결 금지)
- 같은 풀 안에서 서로 충분히 달라야 함. 노브를 돌리면 *다른 세계* 가 나오게.
- 각 풀은 약한 것 → 강한 것, 가까운 것 → 먼 것 순으로 정렬.
- style 은 *내용*이 아니라 *말투*다. 무엇을 말하는지가 아니라 어떻게 말하는지 — 그 사람 특유의 리듬·어미·군말을 잡아라. 코퍼스가 문어체여도, 그 인물이 입으로 말할 때의 결을 추론해 적어라."""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": "JSON 으로 응답하세요."},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    voice = json.loads(response.choices[0].message.content or "{}")

    # 검증 — 풀 모양 보정
    pools = voice.get("pools", {})
    clean = {}
    for ek, knobs in POOL_SPEC.items():
        for knob in knobs:
            opts = pools.get(ek, {}).get(knob)
            if isinstance(opts, list) and len(opts) >= 6:
                clean.setdefault(ek, {})[knob] = [str(o)[:40] for o in opts]

    return {
        "persona": str(voice.get("persona", ""))[:400],
        "style": str(voice.get("style", ""))[:500],
        "pools": clean,
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("사용법: python3 synth/voice.py <agentId>", file=sys.stderr)
        return 1
    agent_id = sys.argv[1]
    path = Path("public/agents") / f"{agent_id}.agent.json"
    if not path.exists():
        print(f"[error] 에이전트 없음: {path}", file=sys.stderr)
        return 1

    with open(path, encoding="utf-8") as f:
        agent = json.load(f)

    print(f"=== voice 생성: {agent_id} ===")
    agent["voice"] = generate_voice(agent)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(agent, f, ensure_ascii=False, indent=2)

    print(f"persona: {agent['voice']['persona'][:80]}...")
    for ek, knobs in agent["voice"]["pools"].items():
        for knob, opts in knobs.items():
            print(f"  {ek}.{knob}: {len(opts)}개  예: {opts[0]} / {opts[len(opts)//2]}")
    print(f"=== 저장 — {path} ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""effectors.py — 10 이펙터의 처리 로직 (실용 도구 결).

디자이너의 실제 의사결정에 도움 되는 답만. 시적 비유·환상 금지.
이펙터의 관점이 원본과 관련 약하면 AI 가 그것을 자기 검증한다.
"""

from __future__ import annotations

import json
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()


PRACTICAL_RULE = (
    "\n\n출력 규칙 (도구로서의 효용 — 반드시 지킬 것):\n"
    "- 사용자가 *지금 바로 가져다 쓸 수 있는* 구체적 결과만. 추상적 일반론·시적 비유·공상·SF 금지.\n"
    "- 가장 중요한 기준은 *참신함* 이다. 사용자가 AI 에게 '이거 어떻게 생각해?' 라고 물어 5초 만에 들을 법한 답이면 "
    "완전한 실패다. 사용자가 *스스로는 떠올리지 못했을* 각·연결·반례·재구성을 줘라 — 익숙한 것을 낯선 자리에 놓고, "
    "당연한 전제를 뒤집고, 분야를 가로질러 끌어와라. 평범함은 이 도구의 유일한 금기다.\n"
    "- 그러면서도 반드시 *말이 되어야* 한다. 기발하기만 하고 근거 없는 헛소리는 참신함이 아니다 — 놀랍지만 "
    "다시 보면 '맞네' 싶은, 단단히 작동하는 도약이어야 한다.\n"
    "- 발뺌·면책·메타 언급 금지. '원본과 관련이 약하다' 같은 회피는 절대 금지 — 이 도구의 역할은 약한 연결에서도 "
    "*쓸 만한 각* 을 끝까지 캐내는 것이다. 관련이 멀어 보일수록 더 파고들어 단단한 결과를 박아라.\n"
    "- 분량: 핵심을 담되 군더더기 없이 (2~4 문장). 출처 표기 금지, 변형된 텍스트 그 자체만."
)



def _mix_rule(controls: dict) -> str:
    """공통 MIX (DRY/WET) — 원문을 얼마나 보존할지. 1.0 = 전면 변형."""
    wet = max(0.0, min(1.0, float(controls.get("mix", 1.0) or 1.0)))
    if wet >= 0.95:
        return ""
    keep = int(round((1.0 - wet) * 100))
    return (f"\n\n[MIX] 원문의 문장과 표현을 약 {keep}% 보존하세요. "
            "보존 비율이 높을수록 원문에 가깝게, 낮을수록 자유롭게 변형합니다.")


def _leap_rule(controls: dict) -> str:
    """LEAP — 각 이펙터의 *고유한 도약 축*. 극(low↔high)은 핸들러가 controls 에 주입한다.
    올릴수록 그 축을 따라 더 의외의 자리로 도약. 위치마다 escalate, 같은 위치는 같은 도약(시드 고정)."""
    try:
        v = max(0.0, min(1.0, float(controls.get("leap", 0.0))))
    except (TypeError, ValueError):
        v = 0.0
    low = controls.get("_leap_low") or "익숙한 해석"
    high = controls.get("_leap_high") or "의외의 도약"
    pct = round(v * 100)
    # 죽은 구간 최소화 — 노브 전 구간이 의미를 갖도록 다섯 단계로 촘촘히, 상단은 훨씬 과감하게.
    if v < 0.08:
        return ""  # 거의 0 = 충실한 기본
    elif v < 0.3:
        body = f"'{low}' 쪽에 가깝되, 뻔한 첫 해석에 한 꼬임을 더해 살짝 신선하게."
    elif v < 0.5:
        body = f"'{low}' 의 익숙한 자리를 분명히 벗어나 '{high}' 쪽으로 — 전문가가 도달할 비자명한 각도로."
    elif v < 0.72:
        body = (f"'{high}' 쪽으로 크게 — 전제를 뒤집거나 먼 분야를 끌어와, 사용자가 미처 못 본 자리로 데려가라. "
                "익숙한 해석은 전부 버려라.")
    elif v < 0.9:
        body = (f"'{high}' 의 과감한 극단으로 — 통념을 정면으로 거스르는, 거의 이단적인 재구성. "
                "그러나 다시 보면 '그렇구나' 싶게 단단해야 한다.")
    else:
        body = (f"'{high}' 의 *가장 낯설고 극단적인* 끝까지 도약하라 — 상상조차 못 한 관점, 분야의 통념을 뒤집는 발상. "
                "안전하거나 예상 가능한 구석이 조금이라도 있으면 완전한 실패다.")
    return f"\n\n[도약 {pct}% · {low} ↔ {high}] {body}"


def _leap_seed(controls: dict, text: str) -> int:
    """VENTURE 위치 + VARY(변주) + 입력으로 결정되는 시드.
    같은 위치·같은 변주 = 같은 결과(고정). VARY 만 바꾸면 *강도는 그대로, 종류만 다른* 도약이 나온다."""
    try:
        step = int(round(max(0.0, min(1.0, float(controls.get("leap", 0.0)))) * 40))
    except (TypeError, ValueError):
        step = 0
    try:
        vary = int(round(float(controls.get("vary", 0))))
    except (TypeError, ValueError):
        vary = 0
    h = 2166136261
    for c in (text[:96] + f"|lp{step}|v{vary}"):
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    return h % 2147483647


# 케이블 관계 → 변형의 방향. 색이 장식이 아니라 배선이다 —
# 사용자가 케이블에 지정한 관계가 이펙터의 작동 방향을 실제로 바꾼다.
_RELATION_RULES = {
    "supports": "이 신호는 '뒷받침' 케이블로 입력되었습니다. 원문의 핵심 주장을 보강하고, 근거와 사례를 강화하는 방향으로 변형하세요.",
    "contradicts": "이 신호는 '충돌' 케이블로 입력되었습니다. 원문과의 긴장을 유지하며, 대립점과 모순이 드러나는 방향으로 변형하세요.",
    "extends": "이 신호는 '발전' 케이블로 입력되었습니다. 원문을 한 단계 더 밀고 나가, 다음 단계로 심화하는 방향으로 변형하세요.",
    "derives": "이 신호는 '분기' 케이블로 입력되었습니다. 원문에서 갈라져 나온 새로운 갈래를 여는 방향으로 변형하세요.",
    "transfer": "",  # 흐름 — 중립 통과
}


def _relation_rule(controls: dict) -> str:
    rel = controls.get("_relation")
    txt = _RELATION_RULES.get(rel or "", "")
    return f"\n\n[케이블 관계] {txt}" if txt else ""


def _agent_block(agent: dict | None, amount: float = 0.0) -> str:
    """장착된 에이전트의 관점을 *주입량(amount, 0~1)* 만큼 변형에 섞는다.
    기본(0)은 중립 — 에이전트 목소리 없음(순수·유용한 변형). 올릴수록 그 사유가 강해진다.
    """
    try:
        amount = max(0.0, min(1.0, float(amount)))
    except (TypeError, ValueError):
        amount = 0.0
    if not agent or amount <= 0.02:
        return ""
    voice = agent.get("voice", {})
    persona = voice.get("persona", "")
    style = voice.get("style", "")
    axes_block = " · ".join(ax.get("label_ko", "") for ax in agent.get("axes", [])[:6])
    label = agent.get("label", agent.get("id", ""))
    if amount < 0.4:
        tone = "은은한 힌트로만 스며든다 — 내용을 덮지 말 것."
        strong = False
    elif amount < 0.75:
        tone = "결과의 시선과 어조에 뚜렷이 배어난다 — 강조점과 표현을 이 관점으로 옮긴다."
        strong = False
    else:
        tone = ("결과를 *전면 지배* 한다 — 이 인물이 직접 다시 쓴 듯, 개념·은유·어조·문장의 결을 "
                "전적으로 그 사람의 것으로. 이펙터 고유의 작동은 유지하되 그 결과를 100% 이 관점과 말투로 재구성하라.")
        strong = True
    out = f"\n\n[에이전트 관점 주입 — {label}, 강도 {round(amount * 100)}%]"
    if persona:
        out += f"\n{persona}"
    if axes_block:
        out += f"\n이 사유의 축: {axes_block}"
    if style:
        out += f"\n말하는 방식: {style}"
    out += f"\n이 사유가 {tone}"
    if not strong:
        out += " 단, 이펙터 고유의 작동(무엇을 하는가)을 덮어쓰지 말 것."
    out += " 인물 이름을 본문에 직접 인용하는 상투적 표현은 금지."
    return out


def _load_option_pools() -> dict:
    path = Path("data/effector_options.json")
    if not path.exists():
        print(f"[warning] {path} 없음 — seed_options.py 먼저 실행하세요.")
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


_OPTION_POOLS = _load_option_pools()


def _pick_from_pool(effector_kind: str, knob_name: str, value: float, agent: dict | None = None) -> dict:
    """에이전트 voice 풀 우선 — 장착된 사상가의 어휘로 고른다. 없으면 범용 풀."""
    pool = None
    if agent:
        pool = (agent.get("voice", {}).get("pools", {})
                .get(effector_kind, {}).get(knob_name))
    if not pool:
        pool = _OPTION_POOLS.get(effector_kind, {}).get(knob_name, [])
    if not pool:
        return {"label": f"<{knob_name}={value:.2f}>", "index": 0, "total": 0}
    v = max(0.0, min(1.0, value))
    idx = int(round(v * (len(pool) - 1)))
    return {"label": pool[idx], "index": idx, "total": len(pool)}


def _pick_label(value: float, labels: list[str]) -> dict:
    v = max(0.0, min(1.0, value))
    idx = int(round(v * (len(labels) - 1)))
    return {"label": labels[idx], "index": idx, "total": len(labels)}



def _apply_effect(system_prompt: str, user_text: str, temperature: float = 0.6, controls: dict | None = None) -> str:
    kwargs = dict(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
        temperature=temperature,
    )
    # LEAP — 위치별 시드로 도약을 고정(같은 위치=같은 결과) + 도약이 클수록 생성 다양성(temperature) 상향
    if controls is not None:
        kwargs["seed"] = _leap_seed(controls, user_text)
        try:
            lv = max(0.0, min(1.0, float(controls.get("leap", 0.0))))
        except (TypeError, ValueError):
            lv = 0.0
        kwargs["temperature"] = min(1.15, temperature + lv * 0.4)
    try:
        response = client.chat.completions.create(**kwargs)
    except Exception:
        kwargs.pop("seed", None)  # seed 미지원 모델/오류 시 안전 폴백
        response = client.chat.completions.create(**kwargs)
    return (response.choices[0].message.content or "").strip()


def _center_distance(v: float) -> float:
    return abs(max(0.0, min(1.0, v)) - 0.5) * 2


# ── 이미지 변형 지시문 — 같은 노브·같은 어휘가 이미지에도 작동한다 ──
# 텍스트 핸들러와 동일한 풀(_pick_from_pool)에서 어휘를 뽑아
# images.edit 프롬프트로 조립한다. 신디사이저 논리의 시각 버전.
def image_instruction(effects: list, agent: dict | None = None) -> str:
    lines = []
    keep = None
    for e in effects:
        kind = e.get("kind")
        c = e.get("controls") or {}
        rel = e.get("relation")
        ib = str(c.get("_input_b") or e.get("inputB") or "").strip()
        if kind == "perspective":
            if ib:
                lines.append(f"다음 시점의 눈으로 재해석한 장면으로 — \"{ib[:160]}\"")
            else:
                lines.append("장착된 에이전트의 시선으로 재해석한 장면으로")
        elif kind == "contradict":
            mode = "강하게 옹호하듯 응집되고 확신에 찬" if c.get("steelman", 0.5) >= 0.5 else "정면으로 반박하듯 대립과 균열이 드러나는"
            lines.append(f"{mode} 분위기로")
        elif kind == "consequence":
            lines.append("이 장면의 결과가 도래한 이후의 모습으로 — 파급의 흔적이 보이게")
        elif kind == "constrain":
            if ib:
                lines.append(f"다음 제약이 시각적으로 강하게 드러나게 — \"{ib[:160]}\"")
            else:
                lines.append("장착된 에이전트가 중시할 제약이 화면을 지배하게")
        elif kind == "abstraction":
            d = max(0.0, min(1.0, c.get("direction", 0.5)))
            lines.append("훨씬 더 추상적인 형태 언어로" if d > 0.5 else "훨씬 더 구체적이고 사실적으로")
        elif kind == "connect":
            if ib:
                lines.append(f"다음 생각의 시각 요소와 결합해서 — \"{ib[:160]}\"")
            else:
                lines.append("겉보기엔 무관한 다른 분야의 시각 요소와 결합해서")
        if rel == "contradicts":
            lines.append("대립과 모순의 긴장을 화면에 유지")
        mix = c.get("mix")
        if mix is not None:
            keep = int(round((1.0 - max(0.0, min(1.0, float(mix)))) * 100))

    persona = (agent or {}).get("voice", {}).get("persona", "")
    out = "이 이미지를 다음 규칙의 순서대로 변형하세요:\n"
    out += "\n".join(f"{i+1}. {l}" for i, l in enumerate(lines)) if lines else "1. 원본의 구도를 유지하며 재해석"
    if keep is not None and keep > 5:
        out += f"\n원본 이미지의 구도·요소를 약 {keep}% 보존하세요."
    if persona:
        out += f"\n전체의 미감은 이 관점을 따릅니다: {persona}"
    out += "\n사진/이미지 자체만 변형하고 텍스트나 글자는 추가하지 마세요."
    return out


# ── 1. PERSPECTIVE — WHO + STRENGTH ────────────
def apply_perspective(text: str, controls: dict, agent: dict | None = None) -> dict:
    controls["_leap_low"], controls["_leap_high"] = "익숙한 시선", "이질적 존재의 눈"
    # 시점은 '관점 잭' 에 꽂힌 노드의 내용 — 그 생각이 *바라보는 눈* 이 된다 (조건을 데이터로 주입).
    src = str(controls.get("_input_b") or "").strip()
    if src:
        view_line = f"옮겨갈 시점 = '관점 입력' 으로 들어온 다음 생각의 눈:\n\"\"\"{src[:400]}\"\"\"\n이 생각이 세상을 보는 방식으로 원래 아이디어를 다시 보세요."
    else:
        view_line = "관점 입력이 비어 있습니다 — 이 아이디어를 가장 *낯설고 신선하게* 비춰줄 구체적인 시점 하나(특정 인물·직업·세대·존재)를 당신이 골라 *그게 누구인지 밝히고* 그 눈으로 다시 보세요. 뻔한 시점은 금지."

    system = f"""이 아이디어를 *다른 시점* 에서 다시 풀어 쓰는 도구입니다. (PERSPECTIVE 고유 기능: 시점 이동)
{view_line}

그 시선에서 이 아이디어가 어떻게 보이고 어떤 우려·의문·기대를 부르는지 구체적으로. 시점이 다르면 결과도 분명히 달라야 합니다.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, controls=controls),
        "selected": {},
    }


# ── 2. ANALOGY — DOMAIN + FIDELITY + ELABORATION ──
def apply_analogy(text: str, controls: dict, agent: dict | None = None) -> dict:
    domain = _pick_from_pool("analogy", "domain", controls.get("domain", 0.5), agent)
    fidelity_val = controls.get("fidelity", 0.5)
    fidelity = _pick_label(fidelity_val, ["자유롭게", "균형 있게", "정확하게"])
    elaboration = _pick_label(controls.get("elaboration", 0.5), ["2~3 문장", "3~5 문장"])

    system = f"""한 아이디어를 *{domain["label"]}* 영역의 비유로 옮겨 풀어 쓰는 도구입니다.
비유 방식: {fidelity["label"]} / 분량: {elaboration["label"]}

원본 아이디어가 {domain["label"]} 의 구조와 *어떻게 일대일 대응되는지* 구체적으로.
디자이너가 그 비유에서 *실제로 어떤 행동·결정을 얻을 수 있는지* 박으세요.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, temperature=0.7, controls=controls),
        "selected": {"domain": domain, "fidelity": fidelity, "elaboration": elaboration},
    }


# ── 3. CONSTRAIN — AXIS + STRICT ───────────────
def apply_constrain(text: str, controls: dict, agent: dict | None = None) -> dict:
    controls["_leap_low"], controls["_leap_high"] = "현실적 제약", "극단적 제약"
    # 제약 조건은 두 번째 입력(IN_B)으로 들어온 신호 — 무한히 자유로운 제약.
    cond = str(controls.get("_input_b") or "").strip()  # 제약 입력 잭에 꽂힌 조건 (무한히 자유)
    if cond:
        constraint_line = f"걸어야 할 제약 (제약 입력 잭으로 들어온 조건): *{cond[:400]}* — 이 제약을 타협 없이, 진짜 한계로 끝까지 밀어붙여 적용하세요."
    else:
        constraint_line = "제약 입력이 비어 있습니다 — 이 아이디어를 *가장 흥미롭게 재발명하게 만들* 도발적인 제약 하나를 당신이 골라 *그게 무슨 제약인지 밝히고* 걸어보세요. 뻔한 제약은 금지."

    system = f"""한 아이디어에 *제약* 을 걸어 다시 풀어 쓰는 도구입니다. (CONSTRAIN 고유 기능: 제약 부과)
{constraint_line}
제약은 약하게 권고하지 마세요 — *진짜 한계로 작동할 때* 비로소 아이디어가 단련됩니다.

이 제약을 받으면 아이디어가 *어떻게 바뀌어야 살아남는지* 구체적으로.
*무엇을 빼고, 무엇을 더하고, 어디를 바꿔야 하는지* 디자이너가 실행 가능한 자리로 박으세요.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, controls=controls),
        "selected": {},
    }


# ── 4. CONTRADICT — 반대 관점 (옹호 폐기, 항상 반박) ──
def apply_contradict(text: str, controls: dict, agent: dict | None = None) -> dict:
    controls["_leap_low"], controls["_leap_high"] = "표면적 반박", "근본 전복"
    # 항상 *반대 관점* 을 세운다. 인라인 변형은 그 아이디어에 맞서는 입장으로 다시 쓴다.
    # (반대 관점을 별도의 새 노드로 낳는 것은 /api/contradict-split 이 담당 — 프론트 ⑂ 버튼.)
    system = f"""이 아이디어에 *정면으로 맞서는 반대 관점* 을 세우는 도구입니다. (CONTRADICT — 반박)
이 아이디어가 *실제로 무너지는 가장 치명적인 지점* 을 못 박고, 왜 그런지, 그리고 그 반대편에서 보면 무엇이 더 옳은지를 구체적으로 쓰세요.
어느 각도(논리·근거·윤리·실현가능성)가 가장 아픈지는 당신이 판단. 막연한 우려·양비론 금지 — 한쪽 입장에 분명히 서서 반박하세요.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, temperature=0.75, controls=controls),
        "selected": {},
    }


# ── 5. CONSEQUENCE — ORDER (직접↔연쇄) ────────
def apply_consequence(text: str, controls: dict, agent: dict | None = None) -> dict:
    controls["_leap_low"], controls["_leap_high"] = "가까운 추론", "먼·숨은 추론"
    # ORDER — 인과 거리. 노브 위치가 출력의 *구조 자체* 를 바꾼다 (목록 ↔ 사슬).
    order_val = max(0.0, min(1.0, controls.get("order", 0.5)))
    if order_val <= 0.34:
        order_rule = ("인과 거리 = *직접(1차)*. 이 아이디어가 *곧바로, 당장* 일으키는 직접적 결과만 짚으세요. "
                      "멀리 내다보는 2차·3차 파급은 *절대 언급 금지* — 눈앞에서 바로 일어나는 일만, 구체적으로.")
    elif order_val >= 0.66:
        order_rule = ("인과 거리 = *먼 연쇄(n차)*. 1차 결과는 *한 문장으로만* 전제하고, 거기서 출발하는 *인과의 사슬* 을 끝까지 따라가세요: "
                      "'A가 B를 낳고, B가 다시 C를 낳는다' 는 식으로 단계를 명시하며, 누구도 예상 못한 *먼 귀결* 까지. 1차 결과 나열에 머물면 실패입니다 — 사슬의 끝을 보여주세요.")
    else:
        order_rule = "인과 거리 = *중간*. 직접 결과에서 출발해 한두 단계 더 나아간 2차 파급까지 추적하세요."

    system = f"""한 아이디어가 실현되면 따라올 결과를 추적합니다. (CONSEQUENCE 고유 기능: 결과 분기)
{order_rule}
긍정·부정 양면을 미화 없이, 비선형적이고 의외인 결과를 노리세요 — 이 도구의 가치는 의외성에 있습니다.

*실제로 일어날 만한* 구체적이고 검증 가능한 결과만. 디자이너가 *지금 어떤 결정을 다시 검토해야 하는지* 짚을 수 있게.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, temperature=0.8, controls=controls),
        "selected": {},
    }


# ── 6. GENEALOGY — ERA + DEPTH + THREAD ────────
def apply_genealogy(text: str, controls: dict, agent: dict | None = None) -> dict:
    era = _pick_from_pool("genealogy", "era", controls.get("era", 0.5), agent)
    depth_val = controls.get("depth", 0.5)
    depth = _pick_label(depth_val, ["표면 한 자리", "중간 한 줄기", "깊은 뿌리"])
    thread = _pick_label(controls.get("thread", 0.5), ["하나의 계보", "여러 갈래 계보"])

    system = f"""한 아이디어의 *{era["label"]}* 시점 뿌리를 찾는 도구입니다.
깊이: {depth["label"]} / 계보: {thread["label"]}

이 아이디어와 비슷한 자리가 *그 시점에 어떻게 존재했고, 어떤 흐름으로 이어져 지금까지 왔는지* 구체적 사실로 박으세요.
*역사적 사례·인물·운동* 을 직접 언급해도 OK.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, controls=controls),
        "selected": {"era": era, "depth": depth, "thread": thread},
    }


# ── 7. ZOOM — LEVEL + FOCUS ────────────────────
def apply_zoom(text: str, controls: dict, agent: dict | None = None) -> dict:
    level_val = controls.get("level", 0.5)
    level = _pick_label(level_val, [
        "더 큰 사회·산업 맥락",
        "한 단계 큰 맥락",
        "그 자리 그대로",
        "디테일 한 자리 확대",
        "가장 미세한 디테일",
    ])
    focus = _pick_from_pool("zoom", "focus", controls.get("focus", 0.5), agent)

    system = f"""한 아이디어의 시야를 *{level["label"]}* 로 조정합니다.
집중할 자리: {focus["label"]}

확대 시: *{focus["label"]}* 자리에서 일어나는 *구체적인 디테일* 만 자세히.
축소 시: 이 아이디어가 더 큰 맥락에서 *어떤 자리* 인지.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, controls=controls),
        "selected": {"level": level, "focus": focus},
    }


# ── 8. ABSTRACTION — DIRECTION + INTENSITY ─────
def apply_abstraction(text: str, controls: dict, agent: dict | None = None) -> dict:
    direction_val = max(0.0, min(1.0, controls.get("direction", 0.5)))
    if direction_val <= 0.34:
        dir_rule = ("방향 = *구체화*. 이 아이디어를 *단 하나의 생생한 장면* 으로 내려쓰세요 — 특정 인물이 특정 시각·장소에서 "
                    "무엇을 하는지, 손에 잡히는 디테일로. 일반론·원리 서술은 금지. 누가·언제·어디서·무엇을 이 또렷이.")
    elif direction_val >= 0.66:
        dir_rule = ("방향 = *추상화*. 이 아이디어를 떠받치는 *일반 원리·패턴* 한 줄로 끌어올리세요 — 이 사례 너머 다른 경우에도 "
                    "적용되는 구조로. 구체적 사례·고유명사는 빼고, 본질만 남긴 명제로.")
    else:
        dir_rule = "방향 = *중간*. 구체와 추상 사이 — 사례 하나를 들면서 그 뒤의 원리도 함께 비추세요."

    system = f"""한 아이디어를 *추상 사다리의 한 지점* 으로 다시 풀어 쓰는 도구입니다. (ABSTRACTION 고유 기능: 추상도 이동)
{dir_rule}
끝과 끝에서 결과의 *형태 자체* 가 분명히 달라야 합니다 (장면 ↔ 명제).{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, controls=controls),
        "selected": {},
    }


# ── 9. CONNECT — DOMAIN + DISTANCE + COUNT ─────
def apply_connect(text: str, controls: dict, agent: dict | None = None) -> dict:
    """연결 — 두 입력(A·B)이 패치돼 있으면 *그 두 생각 사이의 숨은 다리*를 발견한다.
    B 가 없으면(단일 입력) 기존처럼 외부 도메인 풀에서 연결 대상을 고른다 (폴백)."""
    controls["_leap_low"], controls["_leap_high"] = "인접 분야", "먼 분야"
    # 연결 대상은 '연결' 입력 잭에 꽂힌 생각 — 그 둘 사이의 숨은 다리를 찾는다.
    input_b = (controls.get("_input_b") or "").strip()

    if input_b:
        system = f"""겉보기엔 무관한 *두 생각 사이의 숨은 다리* 를 발견하는 도구입니다. (CONNECT 고유 기능: 연결)

[생각 A]
{text[:600]}

[생각 B — 연결 입력]
{input_b[:600]}

A 와 B 가 공유하는 *구조·패턴·원리·기법* 을 찾아내, 디자이너가 *실제로 가져와 쓸* 수 있는 연결로 박으세요.
한쪽을 요약하지 말 것 — *둘을 잇는 다리 자체* 를 쓰세요. 억지 비유가 아니라 정말 작동하는 연결로.{PRACTICAL_RULE}"""
    else:
        system = f"""한 아이디어와 *겉보기엔 전혀 무관한 다른 분야* 사이의 예상치 못한 연결을 찾습니다. (CONNECT 고유 기능: 연결)
끌어올 분야를 *당신이 하나 골라 그게 어느 분야인지 밝히고* 연결하세요 — 누구나 떠올릴 인접 분야가 아니라, 멀지만 정말 작동하는 다리일수록 가치가 큽니다.

그 분야에서 *어떤 패턴·구조·기법* 이 이 아이디어에 *직접 적용 가능* 한지 박으세요.
디자이너가 그것을 *실제로 가져와 쓸* 수 있게.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, temperature=0.75, controls=controls),
        "selected": {},
    }


# ── 10. DEFAMILIARIZE — STRANGENESS + VIEWPOINT ──
def apply_defamiliarize(text: str, controls: dict, agent: dict | None = None) -> dict:
    strangeness_val = controls.get("strangeness", 0.5)
    strangeness = _pick_label(strangeness_val, ["살짝 낯설게", "분명히 낯설게", "완전히 낯설게"])
    viewpoint = _pick_from_pool("defamiliarize", "viewpoint", controls.get("viewpoint", 0.5), agent)

    system = f"""익숙한 자리를 *{viewpoint["label"]}* 의 시점에서 처음 보는 것처럼 묘사합니다.
낯설음 정도: {strangeness["label"]}

당연하게 여기던 자리에 *왜 그렇지?* 같은 질문을 던지고, 사용자가 *깨닫지 못했던 가정* 을 드러내세요.
디자이너가 *재검토할 가치 있는 자리* 를 짚게.{PRACTICAL_RULE}"""

    return {
        "text": _apply_effect(system + _mix_rule(controls) + _relation_rule(controls) + _agent_block(agent, controls.get("_infuse", 0.0)) + _leap_rule(controls), text, temperature=0.75, controls=controls),
        "selected": {"strangeness": strangeness, "viewpoint": viewpoint},
    }


# ── 디스패치 테이블 ─────────────────────────────
EFFECTOR_HANDLERS = {
    "perspective": apply_perspective,
    "analogy": apply_analogy,
    "constrain": apply_constrain,
    "contradict": apply_contradict,
    "consequence": apply_consequence,
    "genealogy": apply_genealogy,
    "zoom": apply_zoom,
    "abstraction": apply_abstraction,
    "connect": apply_connect,
    "defamiliarize": apply_defamiliarize,
}


if __name__ == "__main__":
    original = "AI 가 디자인을 자동화한다."
    print(f"원본: {original}\n")

    for kind, handler in EFFECTOR_HANDLERS.items():
        print(f"--- {kind.upper()} ---")
        result = handler(original, {})
        for knob, meta in result["selected"].items():
            print(f"  [{knob}] {meta['label']}  ({meta.get('index','-')}/{meta.get('total','-')})")
        print(f"  → {result['text']}")
        print()
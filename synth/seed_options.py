"""seed_options.py — 모든 이펙터 노브의 옵션 풀을 AI 로 생성하는 오프라인 도구.

실용 도구 결로 — 디자이너·기획자가 *실제 의사결정에 활용할 수 있는* 옵션만.
판타지·공상·우주·외계 자리 거부.
"""

from __future__ import annotations

import json
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()


PRACTICAL_RULE = (
    "\n\n절대 규칙:\n"
    "- 판타지·공상·우주·외계·SF 자리 완전 금지\n"
    "- 한국 사회·산업·일상에 *실제 존재하는* 자리만\n"
    "- 디자이너·기획자가 회의·발표·작업에서 *실제로 떠올릴 만한* 자리만\n"
    "- 추상 키워드 (핵심·본질·진수 등) 금지 — 구체 자리만\n"
)


SEED_SPECS = {
    # ── PERSPECTIVE — 관점 이동 (WHO 만) ────────────
    "perspective": {
        "who": {
            "count": 120,
            "hint": (
                "디자이너·기획자·아티스트·연구자가 자기 아이디어를 *다른 사람의 시각* 으로 "
                "다시 볼 때 의미 있는 *주체* 의 종류 120 가지. 네 범주에서 골고루:\n"
                "(1) 사용자 페르소나 — 다양한 나이·직업·삶의 상황 "
                "(예: 10대 학생, 30대 직장인, 60대 은퇴자, 장애인 사용자, 비전문가)\n"
                "(2) 이해관계자 — 디자인 결정에 영향 주는 사람 "
                "(예: 투자자, 경쟁사 책임자, 정부 규제기관, 시민 단체, 광고주)\n"
                "(3) 전문가 — 각 분야의 시선 "
                "(예: UX 연구자, 인지심리학자, 법률가, 환경운동가, 마케팅 책임자)\n"
                "(4) 창작 동료 — 같은 작업 영역의 사람 "
                "(예: 비평가, 큐레이터, 동료 작가, 멘토, 편집자)\n"
                "각 항목 짧고 자연스러운 한국어 (3~12자)." + PRACTICAL_RULE
            ),
        },
    },

    # ── ANALOGY — 비유 (DOMAIN 만) ──────────────────
    "analogy": {
        "domain": {
            "count": 150,
            "hint": (
                "한 아이디어를 *다른 영역의 비유* 로 옮길 때 디자이너·기획자가 실제로 "
                "쓸 수 있는 *영역* 150 가지. 친숙하면서 풍부한 자리 우선:\n"
                "- 자연: 식물 성장, 물의 흐름, 동물 군집, 계절 변화\n"
                "- 일상 행위: 요리, 청소, 이사, 여행 준비, 산책\n"
                "- 운동·게임: 축구 전략, 바둑 포석, 카드 게임, 마라톤, 등산\n"
                "- 다른 매체: 영화 편집, 음악 작곡, 연극 무대, 만화 컷 구성\n"
                "- 도구·작업: 자동차 운전, 자전거 정비, 카메라 조작, 목공\n"
                "- 사회 활동: 회의 진행, 협상, 친구 관계, 가족 모임\n"
                "- 자기 관리: 식단 조절, 운동 루틴, 수면 패턴, 독서 습관\n"
                "각 항목 자연스러운 한국어 (3~12자)." + PRACTICAL_RULE
            ),
        },
    },

    # ── CONSTRAIN — 제약 (AXIS 만) ──────────────────
    "constrain": {
        "axis": {
            "count": 120,
            "hint": (
                "디자이너·기획자의 아이디어에 가할 수 있는 *실무 제약* 120 가지:\n"
                "- 시간: 1시간, 하루, 1주, 1개월, 1분기\n"
                "- 예산: 0원, 5만원, 50만원, 500만원, 5000만원\n"
                "- 인력: 혼자, 2인, 5인, 10인, 50인\n"
                "- 청중 규모: 5명, 50명, 500명, 5만명\n"
                "- 청중 특성: 비전문가, 초등학생, 노인, 시각장애인, 비한국어 사용자\n"
                "- 윤리: 개인정보 수집 불가, 환경 영향 최소화, 약자 우선, 광고 없이\n"
                "- 기술: 코드 없이, 무료 도구만, 오프라인만, 모바일만, AI 없이\n"
                "- 표현: 글 없이, 색 없이, 사진 없이, 정지 화면만\n"
                "- 재료: 종이만, 디지털만, 재활용 재료만\n"
                "각 항목 짧은 한국어 (3~15자)." + PRACTICAL_RULE
            ),
        },
    },

    # ── CONTRADICT — 반박 (ANGLE 만) ────────────────
    "contradict": {
        "angle": {
            "count": 80,
            "hint": (
                "디자인·기획에 대한 *비판이 자주 일어나는 자리* 80 가지. "
                "실제 비평·리뷰·피드백에서 등장하는 결:\n"
                "- 사용성: 사용자가 못 씀, 학습 곡선 가파름, 오류 가능성 큼\n"
                "- 비즈니스: 수익 모델 없음, 시장 너무 좁음, 경쟁 우위 약함\n"
                "- 윤리: 사용자 데이터 남용, 중독 유발, 약자 배제\n"
                "- 환경: 자원 낭비, 탄소 배출, 폐기물 다량\n"
                "- 접근성: 장애인 배제, 저소득층 배제, 디지털 격차 심화\n"
                "- 문화: 특정 집단 차별, 문화적 무지, 표현 단조로움\n"
                "- 유지보수: 시간 지나면 무너짐, 의존성 너무 큼, 업데이트 어려움\n"
                "- 확장성: 작을 때만 작동, 글로벌 불가능, 다국어 어려움\n"
                "- 차별화: 이미 존재함, 기존 것보다 못함, 차별점 모호\n"
                "- 진정성: 진심 안 보임, 마케팅 위주, 깊이 없음\n"
                "각 항목 짧은 한국어 (5~20자)." + PRACTICAL_RULE
            ),
        },
    },

    # ── CONSEQUENCE — 결과 (DOMAIN 만) ──────────────
    "consequence": {
        "domain": {
            "count": 80,
            "hint": (
                "한 디자인·기획이 실현되면 *결과가 일어나는 영역* 80 가지. "
                "디자이너가 실제로 *영향* 을 고려해야 할 자리:\n"
                "- 개인 일상: 수면, 식사, 운동, 출퇴근, 여가, 학습 시간\n"
                "- 관계: 가족 관계, 친구 관계, 직장 동료, 연인 관계\n"
                "- 직업·산업: 일자리 종류, 노동 시간, 직업 정체성, 신산업 출현\n"
                "- 도시·공간: 도시 풍경, 동네 분위기, 공공 공간 사용, 주거 형태\n"
                "- 환경: 탄소 배출, 폐기물, 자원 소비, 생물 다양성\n"
                "- 미디어·정보: 미디어 소비 습관, 뉴스 접근 방식, 정보 신뢰도\n"
                "- 문화·예술: 예술 창작 방식, 대중문화 흐름, 언어 변화\n"
                "- 교육: 학습 방법, 교실 풍경, 평가 방식, 사교육 시장\n"
                "- 정치·시민: 정치 담론, 시민 참여, 사회 운동\n"
                "각 항목 짧은 한국어 (3~12자)." + PRACTICAL_RULE
            ),
        },
    },

    # ── GENEALOGY — 계보 (ERA 만) ───────────────────
    "genealogy": {
        "era": {
            "count": 60,
            "hint": (
                "한 아이디어의 *역사적 뿌리* 를 추적할 때 의미 있는 *시대 단위* 60 가지. "
                "디자이너·기획자가 자기 아이디어가 어디서 왔는지 짚을 때 쓸 자리:\n"
                "- 가까운 과거: 10년 전, 20년 전, 1990년대, 1980년대\n"
                "- 산업 시점: 인터넷 보급 직전, PC 보급기, 스마트폰 등장 직전, 클라우드 시대 시작\n"
                "- 디자인 시점: 바우하우스, 미드센추리 모던, 스위스 스타일, 플랫 디자인 등장\n"
                "- 한국 시점: 87년 체제, IMF 직후, 2002 월드컵, 광화문 촛불\n"
                "- 기술 시점: 웹 2.0, 모바일 앱 시대, AI 시대 시작\n"
                "각 항목 짧은 한국어 (3~15자). 빅뱅·중세·고대 같은 자리 금지." + PRACTICAL_RULE
            ),
        },
    },

    # ── ZOOM — 확대 (FOCUS 만) ──────────────────────
    "zoom": {
        "focus": {
            "count": 80,
            "hint": (
                "한 아이디어를 *확대* 할 때 *집중할 측면* 80 가지. "
                "디자이너가 자기 아이디어의 한 자리를 깊이 파고 들 때 의미 있는 자리:\n"
                "- 사용 흐름: 첫 사용, 반복 사용, 실수했을 때, 도움이 필요할 때\n"
                "- 감정: 기쁨, 불안, 좌절, 호기심, 성취감, 지루함\n"
                "- 사용 환경: 출퇴근, 침대 위, 회의 중, 운전 중, 운동 중\n"
                "- 기술 자리: 첫 화면, 데이터 입력, 결과 출력, 에러 처리, 알림\n"
                "- 사회적 자리: 혼자 사용, 가족과, 친구와, 낯선 사람과\n"
                "각 항목 짧은 한국어 (3~12자)." + PRACTICAL_RULE
            ),
        },
    },

    # ── CONNECT — 연결 (DOMAIN 만) ──────────────────
    "connect": {
        "domain": {
            "count": 120,
            "hint": (
                "한 아이디어와 *예상치 못한 연결* 을 찾을 때 의미 있는 *분야* 120 가지. "
                "디자이너·기획자가 *자기 영역 바깥의 영감* 을 찾을 때 쓸 자리:\n"
                "- 과학: 분자 생물학, 양자 물리, 동물 행동학, 인지과학, 신경과학\n"
                "- 예술: 추상 회화, 실험 영화, 무용, 사진, 판화\n"
                "- 산업: 자동차 제조, 농업, 어업, 광업, 건설, 항공\n"
                "- 일상: 카페 운영, 마트 진열, 미용실, 빨래방, 편의점\n"
                "- 자연: 산호초, 사막, 빙하, 우림, 갯벌, 태풍\n"
                "- 인문: 인류학, 고고학, 종교사, 언어학, 민속학\n"
                "- 스포츠: 검도, 양궁, 컬링, 스케이트, 등산, 다이빙\n"
                "각 항목 짧은 한국어 (3~10자)." + PRACTICAL_RULE
            ),
        },
    },

    # ── DEFAMILIARIZE — 낯설게 (VIEWPOINT 만) ───────
    "defamiliarize": {
        "viewpoint": {
            "count": 60,
            "hint": (
                "익숙한 자리를 *낯설게* 보기 위한 *시점* 60 가지. "
                "디자이너가 당연하게 여기던 자리에서 새 의미를 찾을 때 쓸 자리:\n"
                "- 외부자 시선: 외국인 방문자, 다른 업계 사람, 첫 사용자\n"
                "- 아이의 시선: 5세 어린이, 초등학생, 처음 본 사람\n"
                "- 특수 상황: 막 깨어났을 때, 정전 중, 와이파이 없을 때\n"
                "- 직업적 시선: 인류학자, 시인, 만화가, 다큐멘터리 감독, 광고 카피라이터\n"
                "- 대비되는 사용자: 비전문가, 노인, 시각장애인, 비한국어 사용자\n"
                "각 항목 짧은 한국어 (5~20자)." + PRACTICAL_RULE
            ),
        },
    },
}


def generate_options(hint: str, count: int) -> list[str]:
    system = f"""다음 요구를 받아 JSON 배열을 반환합니다.

규칙:
- 배열 길이는 정확히 {count}
- 각 원소는 짧고 자연스러운 한국어 라벨 (보통 3~15자)
- 중복 금지
- 다양성과 구체성 우선
- 판타지·공상·우주·외계 자리 완전 금지

JSON object 로 응답:
{{ "options": ["...", "...", ...] }}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": hint},
        ],
        response_format={"type": "json_object"},
        temperature=0.9,
    )
    raw = response.choices[0].message.content or "{}"
    parsed = json.loads(raw)
    options = parsed.get("options", [])
    seen = set()
    unique = []
    for opt in options:
        if isinstance(opt, str) and opt.strip() and opt not in seen:
            seen.add(opt)
            unique.append(opt.strip())
    return unique[:count]


def main():
    output: dict[str, dict[str, list[str]]] = {}

    for effector_kind, knobs in SEED_SPECS.items():
        output[effector_kind] = {}
        for knob_name, spec in knobs.items():
            count = spec["count"]
            hint = spec["hint"]
            print(f"\n[생성] {effector_kind}.{knob_name} — {count} 옵션 요청 ...")
            options = generate_options(hint, count)
            output[effector_kind][knob_name] = options
            print(f"  → {len(options)} 옵션 받음")
            preview = ", ".join(options[:5])
            print(f"  미리보기: {preview} ...")

    out_path = Path("data/effector_options.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n=== 저장 완료 → {out_path} ===")
    total = sum(len(opts) for knobs in output.values() for opts in knobs.values())
    print(f"총 옵션 수: {total} 자리")


if __name__ == "__main__":
    main()
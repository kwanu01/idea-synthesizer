# 모듈러 신호 시스템

*Idea Synthesizer* 의 핵심 시스템 명세. 사용자가 모듈러 신디사이저처럼 회로를 구성하며 아이디어를 변형·합성·진화시키는 방식의 완전한 정의.

학기 안에 완성되는 모든 자리를 다룬다. 학기 후 확장 자리는 없다.

---

## 1. 시스템 개요

사용자는 세 종류의 요소와 한 종류의 케이블을 다룬다.

| 요소 | 역할 |
|---|---|
| **노드 (Node)** | 아이디어 그 자체. 회로의 신호원 또는 신호 처리 단계 |
| **이펙터 (Effector)** | 아이디어를 디벨롭·정리·변형시키는 처리 모듈 (10 종) |

| 케이블 | 역할 |
|---|---|
| **신호 케이블** | 아이디어 자체를 한 모듈에서 다른 모듈로 흘림 (관계 라벨 박힘) |

CV 케이블 결은 폐기됨. 이펙터 사이의 결은 *체인 순서* + *관계 라벨* + *컨트롤 값* 로 결정.

사용자가 텍스트를 입력하면 AI 가 노드들을 자동 생성하고 각 노드의 합성 모드를 추천한다. 사용자는 이펙터를 회로에 추가하고 케이블로 연결한다. 모든 노브와 슬라이더 조작은 셰이더에 즉시 반응한다 (AI 호출 없음).

---

## 2. 노드 시스템

### 2.1 두 차원의 직교

노드는 두 독립적인 차원을 동시에 가진다.

**차원 A — type** (사고의 종류)

| type | 의미 |
|---|---|
| `Question` | 풀어야 할 자리, 열려 있는 질문 |
| `Observation` | 사실, 현상, 관찰된 자료 |
| `Hypothesis` | 가설, 추측, 가능성 |
| `Insight` | 깨달음, 발견, 종합 |
| `Decision` | 결정, 결론, 행동 |

**차원 B — synthesisMode** (조작 방식)

같은 type 의 노드라도 synthesisMode 는 다를 수 있다. AI 가 노드 내용을 보고 6 모드 중 가장 적합한 자리를 자동 추천한다.

### 2.2 합성 모드 6 종

| ID | 한국어 | 신디사이저 | 강조하는 완성도 | 컨트롤 |
|---|---|---|---|---|
| `stacking` | 쌓기 | Additive | 깊이 | H1·H2·H3·H4 슬라이더 |
| `carving` | 깎기 | Subtractive | 명확성 | CUT·RES 노브 |
| `modulation` | 변조 | FM | 신선함·긴장 | RATIO·DEPTH 노브 |
| `morphing` | 변형 | Wavetable | 시간 진화 | POSITION·SPEED 노브 |
| `fragmentation` | 분쇄 | Granular | 우연 | GRAIN·DENSITY·SEED 노브 |
| `blending` | 균형 | Vector | 균형 | XY 패드 |

각 모드의 상세 의미:

- **Stacking (Additive)** — 단순한 요소 여러 개를 더해 풍부한 결과. 시그니처 amber `#fbbf24`.
- **Carving (Subtractive)** — 풍부함에서 핵심만 깎아냄. 시그니처 cyan `#06b6d4`.
- **Modulation (FM)** — 한 측면이 다른 측면을 흔듦. 시그니처 violet `#a78bfa`.
- **Morphing (Wavetable)** — 여러 상태 사이를 부드럽게 이동. 시그니처 orange `#f97316`.
- **Fragmentation (Granular)** — 작은 단위로 쪼개 재배치. 시그니처 lime `#84cc16`.
- **Blending (Vector)** — 4 자리 사이 XY 균형. 시그니처 magenta `#ec4899`.

---

## 3. 이펙터 시스템 — 10 종

이펙터는 *사고의 한 동사* 이다. 음악 신디사이저의 신호 처리 (REVERB, DELAY 등) 가 아니라, **AI 의 의미 분석으로 비로소 가능해진 아이디어 작업의 모듈화**.

각 이펙터는 노드 또는 다른 이펙터의 출력을 받아 *한 가지 사고 동작* 으로 변형한다.

### 3.1 이펙터 10 종

#### PERSPECTIVE (관점 이동)
다른 사람·다른 시대·다른 분야의 시각으로 다시 보게 한다.
**컨트롤**: WHO (관점 주체), TIME (시대), STRENGTH (변형 강도)
**색**: 보라 `#a78bfa`

#### ANALOGY (비유)
다른 영역의 비유로 옮긴다. 친숙한 영역의 구조를 빌림.
**컨트롤**: DOMAIN (비유 영역), FIDELITY (정확 ↔ 자유), ELABORATION (얼마나 풀어쓸지)
**색**: 주황 `#f97316`

#### CONSTRAIN (제약 부과)
시간·예산·기술·청중·도덕 제약을 가해 변형시킨다.
**컨트롤**: AXIS (어느 제약), STRICT (엄격도), SPECIFIC (추상 ↔ 구체)
**색**: 회색 `#64748b`

#### CONTRADICT (반박)
아이디어의 반대 또는 약점을 강제로 생성한다.
**컨트롤**: ANGLE (반박 각도), INTENSITY (강도), STEELMAN (악마의 대변인 ↔ 가장 강한 옹호)
**색**: 로즈 `#f43f5e`

#### CONSEQUENCE (결과 추적)
실현되면 따라올 결과를 시간·영역별로 추적한다.
**컨트롤**: TIMESCALE (단기·중기·장기), DOMAIN (개인·사회·환경), BRANCHING (한 결과 ↔ 여러 갈래)
**색**: 인디고 `#6366f1`

#### GENEALOGY (계보 찾기)
사상적·역사적 뿌리를 찾는다.
**컨트롤**: ERA (얼마나 거슬러), DEPTH (얕음 ↔ 깊음), THREAD (단일 ↔ 다중)
**색**: 황 `#fbbf24`

#### ZOOM (확대·축소)
한 자리를 파고들거나 더 큰 맥락으로 끌어올린다.
**컨트롤**: LEVEL (큰 맥락 ↔ 미세 자리), FOCUS (어디에 집중)
**색**: 사이언 `#06b6d4`

#### ABSTRACTION (추상화·구체화)
추상으로 끌어올리거나 구체로 내림.
**컨트롤**: DIRECTION (구체 ↔ 추상), INTENSITY (변형 강도)
**색**: 에메랄드 `#10b981`

#### CONNECT (연결)
다른 분야와의 예상치 못한 연결.
**컨트롤**: DOMAIN (어느 분야), DISTANCE (가까운 ↔ 먼), COUNT (한 연결 ↔ 여러 연결)
**색**: 핑크 `#ec4899`

#### DEFAMILIARIZE (낯설게 하기)
익숙한 자리를 처음 보는 것처럼 묘사.
**컨트롤**: STRANGENESS (낯설음 정도), VIEWPOINT (외부자·아이·외국인), LITERALNESS (은유적 ↔ 문자 그대로)
**색**: 노랑 `#eab308`

### 3.2 이펙터의 공통 구조

모든 이펙터는 두 잭을 가진다 (CV 결 폐기).

| 잭 | 종류 | 역할 |
|---|---|---|
| **입력 잭** (상단 좌) | 신호 | 노드 또는 다른 이펙터의 출력을 받음 |
| **출력 잭** (상단 우) | 신호 | 변형된 아이디어를 다음 모듈로 |

CONNECT 이펙터만 IN A · IN B 두 입력 잭을 가진다.

데이터 모델:

```json
{
  "id": "effector-...",
  "kind": "perspective",
  "controls": {
    "who": 0.4,
    "time": 0.6,
    "strength": 0.7
  },
  "bypass": false
}
```

- `controls`: 사용자가 수동으로 박는 노브 값 (0~1)
- `bypass`: 켜고 끄기

### 3.3 컨트롤 값 → 의미적 위치 매핑

이펙터 컨트롤은 연속 노브이지만 AI 에게 전달될 때는 *의미적 위치* 로 해석된다. 예:

- PERSPECTIVE 의 WHO (0~1) → `["어린이", "일반인", "전문가", "비판자", "외부자", "미래 인류학자"]` 중 가까운 자리
- ANALOGY 의 DOMAIN (0~1) → `["요리", "건축", "음악", "생물", "기계", "자연 현상", "운동", "도시"]` 중 가까운 자리

매핑은 Python 백엔드의 이펙터 핸들러에 내장. 사용자가 노브를 돌리면 현재 선택된 자리가 노브 아래 라벨로 표시 (예: "외부자").

---

## 4. 케이블 연결 규칙

### 4.1 신호 케이블 — 아이디어 자체의 흐름

| 출발 (출력 잭) | 도착 (입력 잭) | 의미 |
|---|---|---|
| 노드 OUT | 노드 IN | 아이디어 → 다른 아이디어 |
| 노드 OUT | 이펙터 IN | 아이디어 → 이펙터 적용 |
| 이펙터 OUT | 노드 IN | 이펙터 결과 → 다음 아이디어 |
| 이펙터 OUT | 이펙터 IN | 이펙터 체인 (직렬 처리) |

관계 타입은 노드↔노드 연결에서만 의미 있음. 네 종류:

| 관계 | 색 | 의미 |
|---|---|---|
| `supports` | 라임 `#84cc16` | A 가 B 를 뒷받침 (근거·예시·증거) |
| `contradicts` | 로즈 `#f43f5e` | A 가 B 를 반박 (반례·모순) |
| `extends` | 주황 `#fb923c` | A 가 B 를 발전·심화 |
| `derives` | 사이언 `#06b6d4` | A 에서 B 가 파생 |

### 4.2 시각 구분

- **신호 케이블**: 두꺼운 색 (관계 라벨의 시그니처 색)
- 케이블 색이 곧 관계 (transfer/supports/contradicts/extends/derives)

### 4.3 다중 연결 규칙

- 노드의 입력·출력 잭은 *여러 케이블* 받을 수 있음
- 이펙터의 신호 입력 잭도 *여러 케이블* 받을 수 있음
- 이펙터의 신호 출력 잭도 *여러 케이블* 가능
- 같은 모듈 안의 잭끼리는 연결 X (이펙터 자기 자신 IN → 자기 자신 OUT 차단)

---

## 5. AI 의 역할 (호출이 발생하는 자리)

AI 호출은 비용이 발생하므로 명시적·자동 디바운스 자리에만 작동한다. 케이블 연결과 셰이더 갱신은 어떤 경우에도 AI 호출을 일으키지 않는다.

| 사용자 행동 | AI 호출 | 결과 |
|---|---|---|
| Submit (텍스트 분류) | 1 회 | 노드들 + 합성 모드 추천 + 관계 |
| 이펙터 노브·슬라이더·셀렉터 조작 | 디바운스 1 회 | 노브 멈춘 뒤 800ms 후 자동 apply-effects → 결과 갱신 |
| 케이블 연결·분리 | 즉시 1 회 | 회로 구조 변경 후 자동 apply-effects 트리거 |
| 셰이더 (배경 그래픽) | 0 회 | 노브 조작에 즉시 반응 |
| 에이전트 평가 (자동) | 임베딩 1 회 | Python 코사인 거리, gpt-4o 없음 |

핵심 결정: **이펙터 조작 → 결과 텍스트가 디바운스로 자동 갱신**. SPEC 이전 결의 "Apply Effects 버튼" 은 폐기. 사용자는 노브를 돌리기만 하면 OUTPUT 자리의 결과 텍스트가 800ms 뒤 자동으로 다시 합성된다.

### 5.1 합성 모드 추천 (Submit 시)

AI 가 각 노드의 내용을 보고 6 모드 중 하나를 추천. 사용자는 추천을 받아들이거나 수동으로 다른 모드로 변경.

### 5.2 자동 Apply Effects (디바운스)

이펙터 컨트롤이 변경되거나 케이블이 연결·분리될 때:

1. 변경 즉시 *pending* 표시 (OUTPUT LCD 가 `--` 또는 점멸)
2. 마지막 변경 후 **800ms** 동안 추가 변경이 없으면 자동으로 호출 트리거 (`/api/apply-effects`)
3. 원본 노드 텍스트 + 케이블 그래프로 결정된 이펙터 체인 + 각 이펙터의 현재 컨트롤 값 (CV 조절 결과 반영) 을 AI 에 전송
4. AI 가 각 이펙터의 사고 동작을 *순서대로* 적용해 변형 텍스트 생성
5. OUTPUT 자리의 결과 텍스트가 새 텍스트로 교체 (페이드 갱신)
6. 각 이펙터의 *변형 강도* (원본과 결과의 임베딩 거리, 0~1) 가 백엔드 응답으로 갱신 — 시각 자리 표시용으로만 쓰임 (셰이더 등)

### 5.3 호출 최소화 결

- 디바운스 800ms — 사용자가 노브를 빠르게 돌리는 동안에는 한 번도 호출 안 됨
- 같은 컨트롤 값이 다시 들어오면 *중복 호출 X* (서버 캐시 또는 클라이언트 해시)
- bypass 켜진 이펙터는 체인에서 제외
- 빈 체인 (이펙터 0개) 일 때는 호출 안 함 (OUTPUT = 원본 그대로)

예시:
- 원본: "AI 가 디자인을 자동화한다"
- 체인: PERSPECTIVE(어린이) → CONSEQUENCE(장기) → DEFAMILIARIZE(외부자)
- 1단계: "AI 가 그림 그리는 일을 사람 대신 해 준다"
- 2단계: "사람들이 그림 그리는 법을 잊는다. 그림은 명령으로 시키는 자리가 된다."
- 3단계: "한 종이 자신의 손으로 형상을 만들던 능력을 다른 종에게 양도한다."

---

## 6. 데이터 모델

### 6.1 노드

```json
{
  "id": "node-...",
  "type": "Source",
  "title": "...",
  "content": "...",
  "synthesisMode": "stacking",
  "synthesisReason": "단순 속성을 쌓아 풍부함 만듦",
  "controls": { "h1": 0.8, "h2": 0.5, "h3": 0.3, "h4": 0.2 },
  "axisScores": { "axis_key": 0.65 },
  "dominantAxis": "axis_key",
  "dominantColor": "#22d3ee"
}
```

### 6.2 이펙터

```json
{
  "id": "effector-...",
  "kind": "perspective",
  "position": { "x": 400, "y": 200 },
  "controls": { "who": 0.4, "time": 0.6, "strength": 0.7 },
  "controlSources": { "who": null, "time": "effector-abc", "strength": null },
  "cvOut": 0.85,
  "bypass": false
}
```

### 6.3 케이블

```json
{
  "id": "cable-...",
  "from": { "moduleId": "node-X", "jack": "out" },
  "to": { "moduleId": "effector-Y", "jack": "in" },
  "kind": "signal",
  "relationType": "transfer"
}
```

CV 케이블:

```json
{
  "id": "cable-...",
  "from": { "moduleId": "effector-A", "jack": "cv_out" },
  "to": { "moduleId": "effector-B", "jack": "control:who" },
  "kind": "cv"
}
```

### 6.4 에이전트 (자리 A 의 산출물)

```json
{
  "id": "paik",
  "label": "PAIK · NJP",
  "subtitle": "1932 — 2006",
  "color": "#ec4899",
  "generated_at": "...",
  "embedding_model": "text-embedding-3-small",
  "embedding_dim": 1536,
  "n_samples": 80,
  "k_selected": 3,
  "k_metrics": { "silhouette": 0.42, "...": "..." },
  "axes": [
    {
      "key": "media_nature",
      "label_ko": "매체의 본성",
      "label_en": "Media Nature",
      "description": "...",
      "color": "#22d3ee",
      "centroid": [1536 자리 실수 배열],
      "n_samples": 23,
      "representative_samples": ["...", "...", "..."]
    }
  ],
  "samples": [
    { "text": "...", "axis": "media_nature" }
  ]
}
```

---

## 7. 학기 안 일정 (6/1 ~ 6/12)

| 날짜 | 자리 | 상태 |
|---|---|---|
| Day 1 (6/1) | hello.py — OpenAI 연결 확인 | ✓ |
| Day 2 (6/2) | embed.py — 임베딩 + 캐시 | ✓ |
| Day 3 (6/3) | cluster.py — KMeans + 자동 K | ✓ |
| Day 4 (6/4) | name.py — gpt-4o 자동 명명 | ✓ |
| Day 5 (6/5) | save.py + build.py — 에이전트 JSON CLI | ✓ |
| Day 6 (6/6) | server.py — HTTP 서버 + /api/health | ✓ |
| Day 7 (6/7) | /api/quality — 에이전트 평가 백엔드 | ✓ |
| Day 8 (6/8) | /api/analyze — AI 분류 + 합성 모드 추천 | ✓ |
| Day 9 (6/9) | 이펙터 10 종 핸들러 (1/2) | ✓ |
| Day 10 (6/10) | 이펙터 10 종 핸들러 (2/2) + /api/apply-effects | ✓ |
| Day 11 (6/11) | CV 라우팅 (controlSources 처리) + 프론트 연결 | ✓ |
| Day 12 (6/12) | 통합 테스트 + 발표 자료 + 영상 + paik 에이전트 + quality→시각 회로 | 마감일 작업 |

### Day 12 추가분 (2026-06-12)

- **paik 에이전트** — `corpus/paik.jsonl` (백남준 발화·어록 45 문장, `note` 필드로 직접 발화/의역 구분) → `build.py paik --k 6` → `public/agents/paik.agent.json`. 6 축: 예술가 정체성 · 기술의 인간화 · 매체 상호작용 · 문화 융합 · 시간의 콜라주 · 관객 참여. 축 색은 케이블 6 색 팔레트로 정렬. 자동 K 탐색은 K=9 를 골랐으나 silhouette 0.06 으로 무의미해 가독성 위해 K=6 명시 선택.
- **quality→시각 회로** — OUTPUT 의 finalText 확정 시 `/api/quality` 호출. 점수는 `AxisMeter` LED 래더 (축당 10 칸, 켜진 칸 수 = 광량) 로만 번역. **점수의 숫자 노출 금지 원칙 준수.** 코사인 원점수 0.12~0.52 구간을 래더 전체 폭으로 매핑.
- **AGENT 셀** — TopBar 의 LCD 셀 클릭으로 평가 에이전트 교체 (paik ↔ test). 같은 회로가 다른 사상의 기준으로 재평가된다.
- **유로랙 결 강화** — RackModule 4 모서리 볼트, 모듈 간 gap 4px 로 압축. 상하 랙 레일(나사 구멍) + 하단 유틸리티 랙 (PWR LED · AGENT 슬롯 · 네임플레이트 · 블랭크 패널).
- **이펙터 모듈 독립화 (2차)** — 이펙터 10 장이 각자 알루미늄 패널 + 4 미니 나사 + 어두운 잭 strip + 색띠 + 검정 라벨 밴드(클릭 = bypass, 활성 LED)를 가진 독립 모듈로. 모듈마다 동작 의미를 새긴 **패널 인쇄 글리프** (perspective = 두 시선, consequence = 분기, zoom = 동심 사각 등).
- **부품 실물 질감 (2차)** — 노브: 그라데이션 원기둥 + 스커트 링 + 회전 그루브 + 270° 점선 호. 슬라이더/양극 페이더: 음각 슬롯 + 눈금 + 그립 라인 캡 + 의미 라벨 (TIME: FUT/PAST · ERA: NOW/ROOT · LEVEL: FINE/WIDE · DIST: FAR/NEAR). ABSTRACTION 은 세로 양극 (위 = 추상). 잭: 4 단계 동심원. 케이블: 3 레이어 + 플러그 머리. XYPad: 보조 그리드.

### Day 12 추가분 (3차 — 워크스테이션화)

- **SCOPE 뷰** — OUTPUT 상단 캔버스 (`ScopeView.jsx`). 멀티채널 오실로스코프: 노드 = 채널 레인, 합성 모드가 파형 함수 (stacking=배음, carving=tanh 각진 결, modulation=FM, morphing=사인↔삼각, fragmentation=양자화+시드 점프, blending=두 파 균형). 관계 = 레인 좌측을 잇는 곡선 + 이동 펄스 (관계 색 4종). 진폭 = 에이전트 평가 평균, busy = 난류. 데이터 없으면 에이전트 색 리사주 대기 패턴. 스캔라인·glow 없음.
- **AGENT HEAD** — INPUT 상단 카드 슬롯 (`AgentHead.jsx`). EJECT → 빈 슬롯 (NO AGENT) → INSERT → BOOT (축 LED 순차 점등) 카드 교체 모션. 에이전트 4종: paik (NAM JUNE PAIK), **eno (BRIAN ENO, 32 발화 5축)**, **kant (IMMANUEL KANT, 32 발화 5축)**, test. 메타는 `lib/agents.js`.
- **PoolKnob** — 옵션 풀 9 컨트롤 (who·domain×3·axis·angle·era·focus·viewpoint) 전부 노브 + 미니 LCD 로 교체. **지금 무엇을 골랐는지 항상 보인다.** `data/effector_options.json` 을 프론트가 직접 import.
- **zoom focus 버그 픽스** — 프론트가 {x,y} 를 보내 zoom 체인이 500 나던 자리 → 0~1 스칼라 (백엔드 `_pick_from_pool` 공식과 일치). Switch3 도 인덱스 → 0~1 정규화 (MID→LONG 오매핑 픽스). 옛 세션은 `sanitizeEffectorState` 가 정돈.
- **AUTO PATCH** — 노드별 추천 effectorKind 로 자동 케이블 (체인 있는 노드는 불간섭). 첫 사용자의 막막함 보조.
- **패스스루 출력** — 이펙터가 없는 노드도 OUTPUT 에 정돈된 본문이 `DRY` 태그로 흐르고 평가도 받는다.
- **이펙터 가독성** — 라벨 밴드에 한국어 부제, hover 시 모듈 설명 (무슨 일을 하는지 + 컨트롤별 의미), 컨트롤 개별 툴팁.
- **워크스테이션 메뉴 실작동** — FILE (새 세션 / 세션 저장·열기 .json / **아이디어 리포트 .md — 노드·mermaid 관계 다이어그램·변형 결과** / 스코프 캡처 .png) · VIEW (SCOPE 토글, 케이블 정리) · WINDOW (유틸리티 랙, 전체 화면) · HELP (패치 가이드 오버레이).

### Day 12 추가분 (4차 — 에이전트 보이스 엔진)

- **에이전트 보이스** — 이펙터의 옵션 풀이 범용 잡탕('10대 학생', '자전거 타기')이라 에이전트 학습의 의미가 죽던 문제의 근본 수술. `synth/voice.py` 가 코퍼스·축을 근거로 gpt-4o 에게 **그 사상가의 어휘** (9 풀: who·domain×3·axis·angle·era·focus·viewpoint) 와 **persona** 를 생성시켜 agent JSON 의 `voice` 에 저장. `effectors.py` 는 voice 풀 우선 + 모든 시스템 프롬프트에 `_agent_block` (관점 주입, 이름 직접 인용 금지). `/api/apply-effects` 가 `agentId` 를 받아 핸들러에 전달. paik·eno·kant 생성 완료 — paik 의 WHO 는 이제 '가난한 예술가 / 비디오 작곡가 / 관객 참여자'.
- **/api/master — 믹스다운** — 정리 안 된 입력 + 회로를 통과한 갈래들 → **한 편의 완결된 STATEMENT** (제목 + 3~6 문단, 장착 에이전트의 사유 통과). OUTPUT 하단 MASTER OUT 의 RENDER 버튼. 리포트 .md 에 포함.
- **SCOPE V3 — 입자 섬유 필드** — 파형 레인 폐기. 입자 ~620 개가 회로 데이터가 만드는 벡터장 (노드 = 모드별 소용돌이 어트랙터, 관계 = 섬유 통로, 평가 = 반경·수명, busy = 난류 분사) 을 따라 흐르며 잔상으로 누적 — 포인트 클라우드/등고선 결. 흑백 + 관계색 펄스 + TD 결의 미세 데이터 주석.
- **AUTO PATCH 리롤** — 누를 때마다 다른 회로 (추천 70% · 이웃 30%, 35% 확률 2단 체인). 자동 케이블만 걷어내고 수동 케이블 보존. 버튼은 알루미늄 결로 차분하게.
- **줌 케이블 픽스** — CableLayer 좌표계를 viewport(fixed) → 오버레이 상대(absolute) 측정으로. 브라우저 확대/핀치 줌에서 어긋나던 문제 해소 + 60fps 불필요 리렌더 제거.
- **볼트 겹침 픽스** — 이펙터 모듈 모서리 미니 나사 제거 (RackModule 볼트와 이중).
- '연주법' 표현 폐기 → **패치 가이드**.
- **버그 픽스** — 에이전트 파일 위치/경로 어긋남 정리. 어휘는 '에이전트' 로 확정 (카트리지 표현 폐기), 경로는 `public/agents/*.agent.json`.

---

## 8. 결로 정리

- 노드는 *type × synthesisMode* 두 차원의 곱
- 6 합성 모드는 신디사이저 합성 방식 (Additive·Subtractive·FM·Wavetable·Granular·Vector) 의 아이디어판
- 10 이펙터는 AI 의 의미 분석으로 가능해진 *사고의 동사* (PERSPECTIVE·ANALOGY·CONSTRAIN 등)
- 케이블 두 종류 — 신호 케이블 (아이디어 흐름) + CV 케이블 (노브 자동 조절)
- AI 호출은 Submit 과 Apply Effects 두 자리에만
- 노브 조작·이펙터 추가·케이블 연결은 모두 AI 호출 없이 즉시
- 학기 안 12 일 일정으로 모든 자리 완성

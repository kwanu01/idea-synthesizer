# 소프트웨어적 사고 — Final 발표 자료

**Idea Synthesizer Backend — Python 합성 엔진**

20221739 박황관우 · 가상공간디자인 학과 (자유주제 5번, 전공 관련)

---

## 발표 구조 (총 약 22 슬라이드, 8~10분 영상)

| 구역 | 슬라이드 수 | 시간 |
|---|---|---|
| A. 작품 정체 | 4 | 1:30 |
| B. 시스템 개요 | 4 | 1:30 |
| C. Python 백엔드 4 라우트 | 5 | 2:30 |
| D. 핵심 기술 자리 | 4 | 2:00 |
| E. 시연 | 3 | 2:00 |
| F. 학기 후 + 결론 | 2 | 0:30 |

---

## A. 작품 정체 (4 슬라이드, 1:30)

### A1. 제목

> **Idea Synthesizer Backend**
> Python 합성 엔진
> 20221739 박황관우 · 2026 봄학기

### A2. 작품의 출발 동기

- 우리는 평소 AI 와 대화하며 많은 아이디어를 얻는다
- 그러나 대화가 길어질수록 핵심·주변이 한꺼번에 위로 밀린다
- 작업 가능한 구조로 남는 것은 적다
- **흩어진 아이디어를 *조작 가능한 회로* 로 바꾸고 시각화하면 어떨까?**

### A3. 두 수업의 한 작품

```
  가상공간디자인 I final           소프트웨어적 사고 final
  ┌──────────────────────┐        ┌──────────────────────┐
  │  웹 신디사이저         │ ←→    │  Python 백엔드 엔진   │
  │  (React + Three.js)  │  API   │  (이번 발표 자리)     │
  └──────────────────────┘        └──────────────────────┘
```

본 발표는 **Python 백엔드 자리** 만 다룬다. 웹 작품은 별도 final.

### A4. 신디사이저의 계보

| 시대 | 매체 | 변형되는 것 |
|---|---|---|
| 1964~ Moog | 사운드 신디사이저 | 사운드 |
| 1969~ 백남준·아베 | 비디오 신디사이저 | 비디오 신호 |
| **2026 본 작품** | **아이디어 신디사이저** | **아이디어 (텍스트)** |

음향 → 영상 → 아이디어. 같은 모듈러 합성의 원리를 *새 매체* 로 옮기는 작업.

---

## B. 시스템 개요 (4 슬라이드, 1:30)

### B1. 작품 안의 네 요소

| 요소 | 역할 |
|---|---|
| **에이전트** | 한 사상가·관점의 데이터 묶음 (백남준 등 — 교체 가능) |
| **노드** | 아이디어 한 자리 (Question·Observation·Hypothesis·Insight·Decision) |
| **이펙터** | 아이디어를 변형하는 도구 10 종 |
| **케이블** | 신호 케이블 — 아이디어가 노드에서 이펙터로 흐르는 길 |

(CV 케이블은 웹 인터페이스에서는 폐기 — 백엔드에는 자동 라우팅 자리로 남아 있음, D4 참조)

### B2. 노드의 두 차원

| 차원 A — type (사고 종류) | 차원 B — 합성 모드 (조작 방식) |
|---|---|
| Question (질문) | stacking (쌓기) |
| Observation (관찰) | carving (깎기) |
| Hypothesis (가설) | modulation (변조) |
| Insight (통찰) | morphing (변형) |
| Decision (결정) | fragmentation (분쇄) |
|  | blending (균형) |

5 type × 6 mode 의 직교. 사용자가 같은 type 의 노드라도 다른 모드를 부여 가능.

### B3. 이펙터 10 종 — 아이디어 작업의 동사

| 이펙터 | 동작 |
|---|---|
| PERSPECTIVE | 다른 사람의 관점으로 다시 보기 |
| ANALOGY | 다른 영역의 비유로 옮기기 |
| CONSTRAIN | 시간·예산·청중 제약 부과 |
| CONTRADICT | 반박 또는 강한 옹호 |
| CONSEQUENCE | 실현 시 따라올 결과 추적 |
| GENEALOGY | 사상적·역사적 뿌리 찾기 |
| ZOOM | 한 자리 확대 또는 큰 맥락 |
| ABSTRACTION | 추상화·구체화 |
| CONNECT | 다른 분야와의 연결 |
| DEFAMILIARIZE | 낯설게 하기 |

음악 신디사이저의 이펙터(REVERB·DELAY 등) 대신 **AI 의 의미 분석으로 비로소 가능해진 사고의 동사들**.

### B4. 전체 흐름 다이어그램

```
┌────────────────────────────────────────────────────────┐
│  사용자 입력 텍스트                                       │
│  ("AI 가 디자인을 자동화한다")                            │
└─────────────────────┬──────────────────────────────────┘
                      ↓
              POST /api/analyze
                      ↓
┌────────────────────────────────────────────────────────┐
│  AI 분석 (gpt-4o) + Python 정규화                       │
│  → 노드 5 + 관계 4 자동 생성                             │
└─────────────────────┬──────────────────────────────────┘
                      ↓
              POST /api/quality                  ┌──────────┐
                      ↓                          │ 에이전트   │
┌────────────────────────────────────────┐       │  paik.   │
│  임베딩 + 코사인 거리 (numpy)            │ ←─── │ agent.json│
│  → 노드별 에이전트 축 점수                │       └──────────┘
└─────────────────────┬──────────────────┘
                      ↓
           POST /api/apply-effects
                      ↓
┌────────────────────────────────────────────────────────┐
│  이펙터 체인 (10 종 중 선택) + CV 라우팅                  │
│  → 단계별 변형 텍스트                                    │
└────────────────────────────────────────────────────────┘
```

---

## C. Python 백엔드 4 라우트 (5 슬라이드, 2:30)

### C1. 백엔드 서버의 자리

- Python 표준 `http.server` 만 사용 (FastAPI · Flask 등 외부 프레임워크 없이)
- 포트 8000 에서 대기
- 네 라우트 — 각각 작품의 한 동작 담당

```bash
$ python3 synth/server.py

  ▸ Idea Synthesizer backend
  ▸ http://localhost:8000
  ▸ Routes:
      GET  /api/health
      POST /api/quality        { text, agentId? }
      POST /api/analyze       { text, agentId? }
      POST /api/apply-effects  { text, effects: [...] }
```

### C2. /api/quality — 에이전트 평가

입력 텍스트가 *에이전트의 어느 축에 가까운지* 코사인 거리로 점수화.

```
입력: "매체가 자기 작동을 드러낸다"

출력:
  technological_innovation  0.553  ← 가장 높음
  culinary_techniques       0.263
  economic_trends           0.193
```

**AI 호출**: 임베딩 1 회만. 코사인 거리 계산은 numpy.

### C3. /api/analyze — AI 분석 + 합성 모드 추천

긴 텍스트를 *여러 노드와 관계* 로 자동 분해.

```
입력: "AI 가 디자인을 자동화하면 일자리가 줄어들까?
       일부는 AI 도구를 받아들였다.
       새 직업 프롬프트 엔지니어도 생겼다.
       결국 역할이 바뀌는 자리다."

출력 (4 노드 + 3 엣지):
  · [Question]   [stacking]   AI가 일자리에 미치는 영향
  · [Observation] [blending]  AI 도구 수용
  · [Observation] [morphing]  새 직업 탄생
  · [Insight]    [modulation] 디자이너 역할 변화
  엣지: 0 -[supports]→ 3, 1 -[supports]→ 3, 2 -[supports]→ 3
```

**AI 호출**: gpt-4o 1 회 (JSON mode). Python 이 응답 검증·정규화.

### C4. /api/apply-effects — 이펙터 체인 처리

원본 텍스트 + 이펙터 배열 → 순서대로 변형 → 단계별 결과 + 최종.

```
입력: "AI 가 디자인을 자동화한다"
체인: PERSPECTIVE(외국인 노동자) → CONSEQUENCE(교실 환경) → DEFAMILIARIZE(외부자)

출력 단계별:
1단계 PERSPECTIVE:
  "외국인 노동자로서 AI 자동화가 자기 일자리에 어떤 영향을 미칠지..."
2단계 CONSEQUENCE:
  "교실 환경에서 AI 도구로 인해 학습 방법이 어떻게 바뀔지..."
3단계 DEFAMILIARIZE:
  "처음 보는 사람의 시선에서 디자인 도구의 변화를 본다면..."
```

**AI 호출**: 이펙터 수만큼 (체인 3 → AI 3 회). 각 약 1 센트.

### C5. AI 호출 자리 vs Python 자리

| 자리 | 누가 | 비용 |
|---|---|---|
| 에이전트 자동 생성 (build.py) | AI (임베딩 + gpt-4o) | 한 번만, 약 5 센트 |
| 에이전트 평가 (/api/quality) | AI (임베딩 1 회) + Python (numpy) | 사용자 입력마다, 약 0.001 센트 |
| 분석 (/api/analyze) | AI (gpt-4o 1 회) + Python (검증·정규화) | 사용자 Submit 마다, 약 1 센트 |
| 이펙터 적용 (/api/apply-effects) | AI (gpt-4o N 회) | 사용자 Apply 마다, 약 N × 1 센트 |
| **노브·슬라이더 조작** | **0 호출** | **0 원** |

설계 원칙: **명시적 사용자 행동에만 AI 호출**. 노브 한 번 돌릴 때마다 AI 호출하면 비용 폭주.

---

## D. 핵심 기술 자리 (4 슬라이드, 2:00)

### D1. 임베딩 — 의미를 좌표로

OpenAI `text-embedding-3-small` 모델:
- 입력: 한 문장
- 출력: 1536 개의 실수 (한 문장의 *의미 좌표*)

같은 문장 → 같은 좌표 (결정론적). 다른 문장 사이 *코사인 거리* 가 *의미적 유사도*.

```python
def embed_texts(texts: list[str]) -> np.ndarray:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return np.array([item.embedding for item in response.data], dtype=np.float32)
```

디스크 캐시 (SHA256 해시 키) — 같은 문장 두 번 임베딩 안 함.

### D2. 클러스터링 — 에이전트의 축이 데이터에서 떠오름

scikit-learn `KMeans` 로 *비슷한 의미끼리 자동 그룹화*. 사용자가 *K* (그룹 수) 를 결정 안 해도 4 지표 종합으로 자동 선택:

- silhouette score (응집도)
- Davies-Bouldin index (분리도)
- Calinski-Harabasz index (밀도 비율)
- Elbow method (수확체감 자리)

```
K=2  sil=0.080  db=2.430  ch=18.20
K=3  sil=0.150  db=1.380  ch=35.10  ← 자동 선택
K=4  sil=0.090  db=1.820  ch=28.40
```

데이터의 *자연스러운 그룹 수* 가 결정됨.

### D3. AI 분석 + JSON Mode

gpt-4o 의 `response_format={"type": "json_object"}` 활용. 응답이 *반드시 유효한 JSON*. 

Python 의 역할:
- AI 응답을 *스키마 검증*
- 잘못된 type/relationType/synthesisMode 자동 보정
- 빈 노드·중복 엣지 자동 제거
- 노드 ID 자동 부여

**AI 가 의미를 만들고, Python 이 구조를 안정시킨다.**

### D4. CV 라우팅 — 이펙터 출력이 다른 이펙터의 노브 자동 조절

신디사이저의 Control Voltage 개념을 아이디어 처리에 옮긴 *백엔드 기능*. (웹 인터페이스의 현 버전은 신호 케이블만 노출하지만, API 는 `controlSources` 로 이 기능을 그대로 받는다.)

```
fx-1 CONTRADICT (intensity=0.9) → cvOut=0.9
fx-2 PERSPECTIVE (strength CV 입력) → strength 자동 0.9 로 갈래
```

`controlSources` 배열로 어느 노브가 어느 이펙터의 출력에 연결됐는지 명시. 백엔드가 순서대로 처리하면서 자동 라우팅.

---

## E. 시연 (3 슬라이드 + 영상, 2:00)

### E1. 통합 테스트 실행 — 영상

`python3 synth/test_integration.py` 실행 화면. 6 자리 모두 통과:

1. /api/health
2. /api/quality (3 입력)
3. /api/analyze (4 노드 + 3 엣지 분류)
4. /api/apply-effects (단일)
5. /api/apply-effects (3 단계 체인)
6. /api/apply-effects (CV 라우팅)

마지막 `✓ 모든 자리 통과` 메시지.

### E2. 에이전트 생성 — 영상

`python3 synth/build.py paik --corpus corpus/paik.jsonl --k 6 ...` 실행.
백남준의 발화·어록 45 문장 → 임베딩 → KMeans → gpt-4o 자동 명명 → JSON 저장.

생성된 6 축 (gpt-4o 가 클러스터를 보고 직접 명명):
예술가 정체성 · 기술의 인간화 · 매체 상호작용 · 문화 융합 · 시간의 콜라주 · 관객 참여

생성된 `paik.agent.json` 의 구조 한 화면:
- 메타 (id, label, color)
- axes (6 자리, 각 centroid + 대표 샘플)
- samples (45 자리, 각 어느 축인지)

**정직한 기록**: 자동 K 탐색은 K=9 를 골랐지만 silhouette 0.06 — 통계적으로 무의미한 분할이었다. 화면 가독과 축의 해석 가능성을 위해 K=6 을 명시적으로 선택. 자동화가 항상 옳지 않다는 것도 데이터가 가르쳐 준 자리.

### E3. 웹 작품과의 연결 — 이미 작동 중

이 백엔드는 가상공간디자인 final 의 웹 작품에 *이미* 연결되어 있다:
- 사용자가 텍스트 입력 → /api/analyze → 자동 노드 회로
- 노드에 이펙터 케이블 연결 → /api/apply-effects → 자동 변형
- 변형 결과 → /api/quality → 에이전트 6 축 평가 → **LED 래더의 빛으로만 표시** (점수는 화면에 숫자로 등장하지 않음)
- TopBar 의 AGENT 셀 클릭 → 평가 에이전트 교체 → 같은 회로가 다른 기준으로 재평가

(웹 작품 시연은 가상공간디자인 final 발표에서)

---

## F. 학기 후 + 결론 (2 슬라이드, 0:30)

### F1. 학기 후 확장 가능한 자리

- **다양한 에이전트** — 들뢰즈·매클루언·이어령 등 무한히 추가 가능
- **사용자 정의 에이전트** — 사용자가 자기 디자인 원칙·창작 규칙도 에이전트화
- **이펙터 추가** — 사고의 동사 더 다양하게 (SYNTHESIZE·DECOMPOSE 등)
- **세션 분석 리포트** — 사용자의 사고 패턴 시각화

### F2. 결론

> 이 작품은 *AI 와 대화하다 흩어진 아이디어* 를 모듈러 신디사이저처럼 *조작 가능한 회로* 로 바꾸는 도구의 백엔드입니다.
>
> Python 의 핵심 학습 요소 (외부 API 활용·데이터 처리·머신러닝·HTTP 서버·문자열 처리) 가 한 작품 안에서 자연스럽게 연결되며, *AI 가 의미를 분석할 수 있게 된 시대* 에서 비로소 가능해진 *아이디어 자체의 모듈러 합성* 을 시연합니다.

---

## 시연 영상 스크립트 (8~10분)

```
0:00 ~ 0:30  ─ 작품 소개
              "Idea Synthesizer Backend ─ Python 합성 엔진"
              두 수업의 한 작품, 본 발표는 Python 자리

0:30 ~ 1:30  ─ 작품의 출발 동기 + 신디사이저 계보
              AI 와의 대화 정리 문제 → 모듈러 회로 아이디어

1:30 ~ 3:00  ─ 시스템 개요
              에이전트 / 노드 / 이펙터 / 케이블 네 요소
              전체 흐름 다이어그램

3:00 ~ 5:00  ─ 백엔드 4 라우트 시연 (test_integration.py 실행)
              · /api/health
              · /api/quality (3 입력 → 각 에이전트 축 점수)
              · /api/analyze (4 노드 + 3 엣지 자동 분석)

5:00 ~ 6:30  ─ 이펙터 시연
              · 단일 PERSPECTIVE
              · 3 단계 체인
              · CV 라우팅 (자동 노브 조절)

6:30 ~ 7:30  ─ 핵심 기술 자리
              임베딩 / 클러스터링 / JSON mode / CV 라우팅 코드 한 화면씩

7:30 ~ 8:30  ─ 에이전트 생성 (build.py) 시연
              백남준 45 발화 → K=6 → gpt-4o 자동 명명 (paik.agent.json)

8:30 ~ 9:30  ─ 학기 후 + 결론
              가상공간디자인 final 의 웹 작품과의 연결
              한 줄 결론

9:30 ~ 10:00 ─ Q&A 안내
```

---

## 제출 zip 구성

`20221739_박황관우.zip`:

```
20221739_박황관우/
├── code/                       ← 코드.zip 풀린 자리
│   ├── synth/
│   │   ├── hello.py
│   │   ├── embed.py
│   │   ├── cluster.py
│   │   ├── name.py
│   │   ├── save.py
│   │   ├── build.py
│   │   ├── seed_options.py
│   │   ├── effectors.py
│   │   ├── agent.py
│   │   ├── server.py
│   │   └── test_integration.py
│   ├── corpus/test.jsonl · corpus/paik.jsonl
│   ├── data/effector_options.json
│   ├── public/agents/test.agent.json · paik.agent.json
│   ├── requirements.txt
│   └── .env.example         ← 실제 .env 는 제외
├── presentation.pptx
├── demo.mp4                    ← 5~10분 영상
└── README.md                   ← 실행 방법
```

`.env` (실제 API 키) 와 `venv/`, `cache/` 는 제출에서 *제외*.

---

## README.md 예시

```markdown
# Idea Synthesizer Backend

Idea Synthesizer 의 Python 합성 엔진.

## 실행

1. `cp .env.example .env` 후 OPENAI_API_KEY 박기
2. `pip install -r requirements.txt`
3. `python3 synth/build.py test --corpus corpus/test.jsonl ...` (에이전트 생성)
4. `python3 synth/server.py` (서버 시작)
5. 다른 터미널에서 `python3 synth/test_integration.py` (통합 테스트)
```

---

## 자기 평가 항목 (PPT 마지막 슬라이드)

- **주제 적합성**: 자유주제 5번, 전공(가상공간디자인) 관련
- **난이도 적절성**: 12 일에 백엔드 완성, 학기 안 안전 완주
- **창의성**: AI 와의 대화 정리 + 모듈러 신디사이저 결의 아이디어 합성
- **ChatGPT/Claude 활용**: 코드 골격은 본인 작성, AI 는 디버깅·아이디어 토론 결로
- **학술적 정직성**: 자동 K 탐색이 고른 K=9 를 silhouette 0.06 근거로 기각하고 K=6 명시 선택 — 자동화의 한계까지 기록

# Frontend Guide — Idea Synthesizer

이 문서는 프론트엔드를 처음부터 직접 짤 때 필요한 *모든 백엔드 명세 + 단계별 작업 순서* 를 담는다. 디자인은 자유. 다만 백엔드와 잘 맞물리려면 아래 스키마와 흐름을 정확히 지켜야 한다.

---

## 0. 디렉토리 구조

```
MAIN/
├── synth/                ← Python 백엔드 (12 파일)
│   ├── server.py             ─ HTTP 디스패처 (4 라우트)
│   ├── effectors.py          ─ 10 이펙터 함수 + 옵션 풀 로더
│   ├── embed.py              ─ OpenAI 임베딩 + 캐시
│   ├── cluster.py            ─ KMeans 자동 K
│   ├── name.py               ─ gpt-4o 클러스터 자동 명명
│   ├── agent.py          ─ 에이전트 로더
│   ├── save.py / build.py    ─ 에이전트 생성 CLI
│   ├── seed_options.py       ─ 이펙터 옵션 풀 CLI
│   ├── hello.py              ─ OpenAI 연결 확인
│   └── test_integration.py   ─ 6 시나리오 통합 테스트
├── data/effector_options.json  ─ 9 이펙터의 노브 옵션 풀 (806 옵션)
├── public/agents/test.agent.json  ─ 평가 에이전트 (3 축 · 12 샘플)
├── corpus/test.jsonl         ─ 원본 코퍼스 (12 문장)
├── cache/embeddings.npz      ─ SHA256-keyed 임베딩 캐시
└── venv/                     ─ Python 가상환경
```

프론트 자리는 이 폴더 안에 자유롭게 짜라. `synth/`·`data/`·`public/agents/`·`corpus/`·`cache/` 는 백엔드 전용이니 *건드리지 마라*.

---

## 1. 백엔드 실행

```bash
cd MAIN
source venv/bin/activate
python3 synth/server.py
```

성공하면 `listening on http://localhost:8000` 떠야 한다. 이 자리는 *계속 켜둬야* 한다.

`.env.local` 이 없으면 OpenAI 호출이 실패한다. 키는 사용자가 가지고 있는 것으로 박는다:

```
OPENAI_API_KEY=sk-...
```

---

## 2. 백엔드 4 라우트 — 입력·출력 스키마

### 2.1 `GET /api/health`

서버 살아있음 신호. body 없음.

**응답**
```json
{ "ok": true, "service": "synth", "port": 8000 }
```

### 2.2 `POST /api/analyze` — 텍스트 → 노드·엣지

사용자 텍스트를 받아 노드로 쪼개고 관계를 찾고, 각 노드에 *추천 이펙터* 까지 매긴다.

**요청**
```json
{
  "text": "텍스트 본문",
  "agentId": "test"
}
```

**응답**
```json
{
  "nodes": [
    {
      "id": "node-xxxxx",
      "type": "Question" | "Observation" | "Hypothesis" | "Insight" | "Decision",
      "title": "짧은 제목 (30자 이내)",
      "content": "한 문장 본문 (200자 이내)",
      "synthesisMode": "stacking" | "carving" | "modulation" | "morphing" | "fragmentation" | "blending",
      "synthesisReason": "왜 그 모드인지 한 줄 (30자 이내)",
      "effectorKind": "perspective" | "analogy" | "constrain" | "contradict" | "consequence" | "genealogy" | "zoom" | "abstraction" | "connect" | "defamiliarize"
    }
  ],
  "edges": [
    {
      "from": 0,           ← nodes 배열 인덱스
      "to": 1,
      "relationType": "supports" | "contradicts" | "extends" | "derives"
    }
  ]
}
```

- 노드 최소 2 개, 최대 8 개.
- `id` 는 백엔드가 생성 — 프론트에서 그대로 쓰면 된다.
- `effectorKind` 가 노드별 추천 이펙터 — 프론트가 그걸 *자동 라우팅* 으로 쓸 수 있다.

### 2.3 `POST /api/quality` — 텍스트 → 에이전트 N 축 점수

에이전트(`test.agent.json`) 의 N 축 (현재 3 축) centroid 와 입력 텍스트의 임베딩을 코사인 비교. 0~1 점수.

**요청**
```json
{ "text": "텍스트", "agentId": "test" }
```

**응답**
```json
{
  "scores": {
    "축 키 1": 0.72,
    "축 키 2": 0.54,
    "축 키 3": 0.31
  }
}
```

축 키와 라벨은 에이전트 JSON 에 들어있다 (`/agents/test.agent.json` GET 으로 직접 fetch 가능). 그 안의 `axes` 배열에 `key, label_ko, label_en, color, description` 다 있음.

### 2.4 `POST /api/apply-effects` — 이펙터 체인 변형

텍스트를 이펙터 체인으로 흘려보내 *변형된 텍스트* 를 받는다. 핵심 인터랙션.

**요청**
```json
{
  "text": "원본 텍스트",
  "effects": [
    {
      "id": "fx-1",
      "kind": "perspective",
      "controls": {
        "who": 0.3,           ← 0~1 노브 값
        "strength": 0.7
      },
      "controlSources": {
        "who": null,
        "strength": "fx-prev" ← 다른 이펙터의 cvOut 이 이 노브를 자동 조절
      }
    }
  ]
}
```

**응답**
```json
{
  "stages": [
    {
      "id": "fx-1",
      "kind": "perspective",
      "selected": {
        "who": { "label": "옵션 라벨", "index": 12, "total": 100 },
        "strength": { "label": "...", "index": 78, "total": 100 }
      },
      "controlsActual": { "who": 0.3, "strength": 0.7 },
      "cvOut": 0.65,        ← 이펙터의 출력 강도 (다음 이펙터의 노브 조절용)
      "text": "이 단계 변형된 텍스트"
    }
  ],
  "finalText": "체인 모든 단계 통과한 최종 텍스트"
}
```

체인은 *직렬*. 첫 이펙터 input 은 원본 텍스트, 두 번째는 첫 번째의 output, 등.

`controlSources[knob]` 가 다른 이펙터의 `id` 면, 그 이펙터의 `cvOut` 이 이 노브 값을 *덮어쓴다* (CV 라우팅).

---

## 3. 10 이펙터 + 노브 명세

각 이펙터의 노브 이름과 의미. UI 에서 노브를 만들 때 *정확히 이 키* 로 controls 에 박아야 백엔드가 알아듣는다.

| kind | 의미 | 노브 |
|---|---|---|
| `perspective` | 다른 입장/시간대로 바꿔 다시 보기 | `who` · `strength` |
| `analogy` | 다른 도메인의 유사 구조 가져와 비추기 | `domain` |
| `constrain` | 제약 더해 다음 단계 강제 | `axis` · `strict` |
| `contradict` | 반대 각도/반례로 깨뜨리기 | `angle` · `intensity` · `steelman` |
| `consequence` | 채택했을 때의 분기·결과 펼치기 | `domain` · `branching` |
| `genealogy` | 생각의 역사적 계보 추적 | `era` |
| `zoom` | 부분 확대 또는 전체 줄여 큰 그림 | `focus` |
| `abstraction` | 구체 → 추상 (또는 반대) | `level` |
| `connect` | 다른 도메인과 연결고리 | `domain` |
| `defamiliarize` | 익숙한 것을 낯설게 재정의 | `strangeness` · `viewpoint` |

각 노브는 0~1 float. 백엔드가 그 값을 받아 *옵션 풀에서 한 옵션 선택* 한다 (예: who=0.3 → 옵션 30 번 선택). 옵션 풀은 `data/effector_options.json` 에 미리 생성됨 — 노브 한 번 돌릴 때마다 AI 호출 안 함 (캐시).

---

## 4. 단계별 작업 순서 — 한 단계 한 단계

### 단계 A: 셋업 (10 분)

A-1. `MAIN/` 안에 `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css` 만들기

A-2. `vite.config.js` 에 proxy 박기 (브라우저의 `/api/*` 호출이 Python 백엔드로 가게)

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
```

A-3. `npm install react react-dom @vitejs/plugin-react vite` (+ 원하는 라이브러리)

A-4. 백엔드 켜기 (`python3 synth/server.py`) + Vite (`npm run dev`)

**원하는 효과**: 브라우저에서 `http://localhost:5173` 가 떠야 함.

### 단계 B: 첫 핸드셰이크 (5 분)

B-1. `fetch('/api/health')` → 응답 받기

```js
const r = await fetch('/api/health').then(r => r.json())
// r === { ok: true, service: 'synth', port: 8000 }
```

**원하는 효과**: 화면에 "backend alive" 같은 표시. 백엔드 안 켜져있으면 fetch 가 실패하니 이게 첫 통신 확인.

### 단계 C: 텍스트 입력 + 분석 (15 분)

C-1. textarea + "Analyze" 버튼 UI 만들기.

C-2. 버튼 누르면 `POST /api/analyze` 호출:

```js
const r = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, agentId: 'test' })
}).then(r => r.json())
// r.nodes, r.edges
```

C-3. 응답을 console.log 로 확인 — 노드 배열 / 엣지 배열의 형태가 위 명세와 같은지.

C-4. 노드를 화면에 *어떻게든* 표시 (간단한 리스트, 카드 등).

**원하는 효과**: 사용자가 텍스트 흘려보내면 화면에 노드 N 개가 떨어짐. 각 노드의 `type`, `title`, `content`, `effectorKind`, `synthesisMode` 가 다 들어있음.

### 단계 D: 이펙터 인스턴스 시각화 (20 분)

D-1. 분석된 노드 각각의 `effectorKind` 를 보고, *그에 맞는 이펙터 모듈 UI* 를 그린다.

D-2. 각 이펙터 모듈에는 위 §3 표의 노브들이 박혀야 한다 (예: `perspective` 모듈에는 `who`, `strength` 두 노브).

D-3. 노브 값은 0~1 로 컨트롤 (드래그·슬라이더·뭐든).

**원하는 효과**: 노드 5 개 분류되면 화면에 이펙터 모듈 5 개가 등장. 각자 다른 종류·다른 노브 갯수.

### 단계 E: 이펙터 호출 + 결과 (15 분)

E-1. "Apply" 버튼 만들기.

E-2. 누르면 `POST /api/apply-effects` 호출 — 노드 텍스트와 이펙터 체인을 보냄.

```js
const r = await fetch('/api/apply-effects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: node.content,
    effects: [
      {
        id: 'fx-1',
        kind: node.effectorKind,
        controls: { who: 0.5, strength: 0.7 },  // ← 사용자 노브 값
        controlSources: {}
      }
    ]
  })
}).then(r => r.json())
// r.stages[0].text = 변형된 텍스트
// r.finalText = 체인 마지막 결과
```

E-3. `finalText` 를 *어디든* 표시 (output 박스, OUT 모듈 등).

**원하는 효과**: 노브 조작 → Apply → 변형 텍스트가 화면에 떨어짐.

### 단계 F: 잭·케이블 시각 (난이도 ↑, 30 분)

F-1. 노드 모듈 / 이펙터 모듈에 IN/OUT 잭 (작은 원) 박기.

F-2. analyze 직후 *자동으로* 노드 OUT → 추천 이펙터 IN 으로 케이블 (SVG bezier) 그리기.

F-3. 케이블 좌표 = 두 잭의 DOM 위치. `getBoundingClientRect()` 로 측정.

F-4. fixed full-screen SVG overlay 가 두 영역을 가로지르며 케이블 그림.

**원하는 효과**: 노드 ↔ 이펙터가 케이블로 연결된 게 보임. 늘어진 sag 곡선.

### 단계 G: 체인 + CV 라우팅 (난이도 ↑↑, 40 분)

G-1. 사용자가 한 이펙터 OUT → 다른 이펙터 IN 으로 케이블 *수동* 으로 꽂을 수 있게 (마우스 드래그).

G-2. effects 배열을 *체인 순서대로* 보냄. 첫 이펙터 OUT 이 둘째 input.

G-3. CV 케이블: 한 이펙터의 *cvOut 잭* → 다른 이펙터의 *노브 옆 CV in 잭* 으로 연결하면, `controlSources[knob] = 그 이펙터 id` 를 보냄.

```js
{
  id: 'fx-2',
  kind: 'perspective',
  controls: { who: 0.5, strength: 0.5 },  // 기본값 (덮어씌워짐)
  controlSources: { strength: 'fx-1' }    // ← fx-1 의 cvOut 이 strength 를 덮음
}
```

G-4. 응답 `stages[i].controlsActual` 보면 실제로 적용된 값이 들어있음.

**원하는 효과**: 한 이펙터의 강도가 다음 이펙터의 노브를 자동으로 흔드는 동적 회로.

### 단계 H: 에이전트 평가 (선택, 15 분)

H-1. 노드 또는 finalText 를 `POST /api/quality` 로 보냄 → 축 N 개의 점수 받음.

H-2. 점수를 *글자로 보여주지 마라* (장난감 결을 죽임). 배경 셰이더의 색·강도로 흘리든, 작은 LED 칸 N 개로 보이든.

**원하는 효과**: 사용자가 회로를 짤 때 화면 어딘가가 *반응*. 점수표 X.

---

## 5. UI 구성 권장 (자유 — 참고)

```
┌────────────────────────────────────────────────┐
│ Header                                         │
├──────────┬────────────────────────┬───────────┤
│          │                         │           │
│  좌측    │      메인 베이          │  팔레트   │
│  INPUT   │      (이펙터 모듈)      │  (선택)   │
│  패널    │                         │           │
│          │                         │           │
│  텍스트  │                         │           │
│  입력 →  │                         │           │
│  분석된  │      케이블             │           │
│  노드들  │      SVG overlay        │           │
│          │                         │           │
├──────────┴────────────────────────┴───────────┤
│ OUT — 최종 합성 텍스트                          │
└────────────────────────────────────────────────┘
```

다만 분할 방식은 자유. 한 화면 안에 다 들어가도, 탭으로 나뉘어도 OK.

---

## 6. 흔한 에러

| 증상 | 원인 |
|---|---|
| `ECONNREFUSED` | Python 서버 안 켜져있음 |
| `HTTP 500` from `/api/*` | OpenAI API 키 없음 또는 한도 초과 |
| `에이전트 없음: paik` | `agentId: 'test'` 로 보내라 (paik 은 학기 후) |
| analyze 응답 nodes 빔 | 입력 텍스트가 너무 짧음 |
| apply-effects 응답 stages 빔 | effects 배열이 빔 또는 kind 가 잘못된 키 |

---

## 7. 도와줄 자리

- 백엔드 자체에 버그 같으면 `synth/server.py` traceback 보고 알려라
- 새 라우트가 필요하면 (예: 이펙터 옵션 목록 fetch) 백엔드 추가는 가능
- 노브 수동 조작 → AI 호출은 *절대 안 함* (옵션 풀에서 캐시된 옵션 선택만)

---

이 가이드를 책처럼 두고, 각 단계 끝날 때마다 백엔드 응답이 맞아떨어지는지 console.log 로 확인하면서 짜라. 디자인 자체는 자유 — 어떤 시각이든 위 스키마만 맞으면 동작한다.

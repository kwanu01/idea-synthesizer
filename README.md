<div align="center">

# Idea Synthesizer

**모듈러 신디사이저 인터페이스로 아이디어를 조작하는 사고 워크스테이션**

[**▶ 라이브 데모 / Live Demo**](https://idea-synthesizer-eight.vercel.app)

한국어 · [English](#english)

</div>

---

## 배경

AI와의 대화는 길어질수록 누적되지만, 구조화된 산출물로는 남지 않는다. 유효한 통찰과 폐기한 가설, 확정한 결론이 단일 스크롤에 혼재해 재탐색 비용이 계속 발생한다. 최근 연구는 이를 *인지적 부채(cognitive debt)* — AI에 사고를 위임할수록 저하되는 비판적 사고력 — 로 설명한다.

핵심 원인은 사용량이 아니라 **상호작용 구조**에 있다. 현행 챗 인터페이스에서 사용자의 역할은 질의와 수신에 한정되며, 사고의 중간 과정은 출력에 보존되지 않는다. 즉 아이디어 자체가 아니라 **아이디어를 조작할 인터페이스가 부재한** 문제다.

## 접근

Idea Synthesizer는 **모듈러 신디사이저의 패러다임을 사고 작업에 적용**한다. 신디사이저가 소리를 신호로 환원해 모듈·케이블·노브로 직접 다루듯, 이 시스템은 생각을 신호로 다룬다 — 노드는 사고 단위 신호, 이펙터는 변형 모듈, 케이블은 노드 간 관계, 노브는 변형 파라미터다.

이를 통해 상호작용을 *수신*에서 *조작*으로 전환한다. AI 출력을 노드로 **분해**하고, 케이블로 **연결**하고, 이펙터로 **조작**한 뒤, 단일 문서로 **종합**한다. 사용자가 회로를 구성하지 않으면 출력이 생성되지 않으므로, 인지적 개입이 인터페이스 차원에서 요구된다.

## 특징

| | |
|---|---|
| **분해 · 연결 · 조작 · 종합** | AI는 구성 요소를 생성하고, 연결과 변형의 결정은 사용자가 수행한다. 사고의 중간 산물은 노드와 케이블로 화면에 영속한다. |
| **에이전트** | 실제 인물의 텍스트로 학습한 페르소나. 분석·변형·종합의 기준 관점으로 작동하며, 교체 시 동일 회로의 결과가 전면 재구성된다. 사용자 텍스트로 신규 에이전트를 생성할 수 있다. |
| **이펙터 6종** | 관점 · 반박 · 추론 · 제약 · 추상 · 연결. 노드를 변형하는 모듈이며, 케이블의 관계 유형(흐름·뒷받침·충돌·발전·분기)이 변형 방향에 반영된다. |
| **신호 경로 판정** | 출력 버스에 연결된 신호만 결과에 반영되고, 미연결 신호는 파이프라인에서 자동 배제되어 불필요한 호출이 차단된다. |

## 사용법

1. 아이디어·메모·대화 텍스트를 입력하고 **Analyze** 실행 — 텍스트가 사고 단위 노드로 분해된다. *(샘플은 **Load Sample**)*
2. **Auto Patch** — 노드가 이펙터를 거쳐 출력까지 케이블로 연결된다. *(잭을 직접 드래그해 수동 연결도 가능하다.)*
3. 이펙터 **노브 조작** — 변형 방식이 변경되며, 입력 종료 시 해당 값으로 결과가 재생성된다.
4. **STATEMENT** — 회로가 출력에 도달하면 조작된 노드가 단일 문서로 자동 종합된다.
5. **에이전트 교체** — 동일 회로에서 결과의 관점과 어휘가 전면 재구성된다.

## 기술

`React 19` · `Vite` · `Python (stdlib http.server)` · `OpenAI gpt-4o · text-embedding-3-small · gpt-image-1`

프론트엔드가 회로 상태를 관리하고, Python 백엔드가 REST API로 LLM 파이프라인(`analyze → effector → agent → master`)을 단방향 처리한다.

<br />

---

# English

<div align="center">

**A thinking workstation that lets you manipulate ideas through a modular-synthesizer interface.**

[**▶ Live Demo**](https://idea-synthesizer-eight.vercel.app)

</div>

## Background

Conversations with AI accumulate as they grow longer, yet rarely leave a structured artifact behind. Valid insights, discarded hypotheses, and final conclusions all coexist in a single scroll, imposing a continual cost of re-navigation. Recent research describes this as *cognitive debt* — the decline in critical thinking that comes from delegating thought to AI.

The root cause lies not in usage volume but in the **structure of interaction**. In current chat interfaces the user's role is limited to querying and receiving, and the intermediate steps of thinking are never preserved in the output. The missing piece is not ideas themselves, but **an interface for manipulating them**.

## Approach

Idea Synthesizer **applies the modular-synthesizer paradigm to the work of thinking**. Just as a synthesizer reduces sound to signals and lets you shape them directly through modules, cables, and knobs, this system treats thought as signal — nodes are units of thinking, effectors are transformation modules, cables are relationships between nodes, and knobs are transformation parameters.

This shifts interaction from *receiving* to *manipulating*: AI output is **decomposed** into nodes, **connected** by cables, **manipulated** through effectors, and **synthesized** into a single document. Because no output is produced unless the user builds the circuit, cognitive engagement is required at the level of the interface itself.

## Features

| | |
|---|---|
| **Decompose · Connect · Manipulate · Synthesize** | AI generates the components; the user decides how they connect and transform. Intermediate products of thought persist on screen as nodes and cables. |
| **Agents** | Personas trained on the writings of real figures. Each acts as the reference perspective for analysis, transformation, and synthesis; swapping one fully reconstructs the result of the same circuit. Users can generate new agents from their own text. |
| **Six effectors** | Perspective · Contradict · Infer · Constrain · Abstract · Connect. Modules that transform nodes; a cable's relationship type (flow, support, conflict, extension, branch) informs the direction of transformation. |
| **Signal-path resolution** | Only signals connected to the output bus reach the result; unconnected signals are automatically excluded from the pipeline, preventing unnecessary calls. |

## How to use

1. Enter idea / note / conversation text and run **Analyze** — the text is decomposed into thinking-unit nodes. *(Try **Load Sample**.)*
2. **Auto Patch** — nodes are cabled through effectors to the output. *(You can also drag jacks to wire manually.)*
3. **Turn an effector knob** — the mode of transformation changes, and on release the result is regenerated with that value.
4. **STATEMENT** — once the circuit reaches the output, the manipulated nodes are synthesized into a single document automatically.
5. **Swap the agent** — the same circuit yields a fully reconstructed result in a new perspective and vocabulary.

## Stack

`React 19` · `Vite` · `Python (stdlib http.server)` · `OpenAI gpt-4o · text-embedding-3-small · gpt-image-1`

The frontend manages circuit state while the Python backend processes the LLM pipeline (`analyze → effector → agent → master`) one-directionally over a REST API.

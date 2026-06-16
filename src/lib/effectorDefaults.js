// 이펙터별 컨트롤 기본값.
// SPEC docs/02_system_spec.md § 3.1 의 컨트롤 결.
//
// 값 결:
//   knob: 0~1, slider: 0~1, bipolar: -1~1, switch3: 0|1|2, xy: { x, y } -1~1

// 각 이펙터 자리에 _bypass:false 박음 — 켜면 체인에서 제외.
export const EFFECTOR_DEFAULTS = {
  // 활성 6종 — 각 이펙터는 *참신성을 만드는 생성축*(노브) + MIX. 열린 값은 _input_b 잭으로.
  // leap = VENTURE 도약 강도 (0..1). vary = 변주(같은 강도에서 다른 종류로 새로 뽑기).
  perspective:   { leap: 0.3, vary: 0, mix: 0.5, _bypass: false },                       // 관점 잭 + VENTURE + VARY + MIX
  contradict:    { leap: 0.3, vary: 0, mix: 0.5, _bypass: false },                        // VENTURE + VARY + MIX (항상 반박)
  consequence:   { leap: 0.3, vary: 0, dir: 0, mix: 0.5, _bypass: false },                // DIRECTION(결과/근거) + VENTURE + VARY + MIX
  constrain:     { leap: 0.3, vary: 0, mix: 0.5, _bypass: false },                       // 제약 잭 + VENTURE + VARY + MIX
  abstraction:   { direction: 0.5, vary: 0, mix: 0.5, _bypass: false },                  // DIRECTION(구체↔추상) + VARY + MIX
  connect:       { leap: 0.3, vary: 0, mix: 0.5, _bypass: false },                       // 연결 잭 + VENTURE + VARY + MIX
  // 폐기·호환 핸들러용 (UI 없음, 백엔드 하위호환만)
  analogy:       { domain: 0.5, fidelity: 0, elaboration: 0.5, mix: 0.5, _bypass: false },
  genealogy:     { era: 0.5, depth: 0.5, thread: 0, mix: 0.5, _bypass: false },
  zoom:          { level: 0.5, focus: 0.5, mix: 0.5, _bypass: false },
  defamiliarize: { strangeness: 0.5, viewpoint: 0.5, literalness: 0, mix: 0.5, _bypass: false },
}

export function defaultsFor(kind) {
  return { ...(EFFECTOR_DEFAULTS[kind] || {}) }
}

export function defaultEffectorState() {
  const state = {}
  for (const kind of Object.keys(EFFECTOR_DEFAULTS)) {
    state[kind] = defaultsFor(kind)
  }
  return state
}

// 옛 세션 호환 — 폐기된 값 모양({x,y} focus, switch 인덱스 풀 노브)을 현행으로 정돈
export function sanitizeEffectorState(s = {}) {
  const next = { ...s }
  if (next.zoom && typeof next.zoom.focus === 'object') {
    next.zoom = { ...next.zoom, focus: 0.5 }
  }
  if (next.constrain && next.constrain.axis > 1) {
    next.constrain = { ...next.constrain, axis: 0.5 }
  }
  if (next.consequence && next.consequence.domain > 1) {
    next.consequence = { ...next.consequence, domain: 0.5 }
  }
  // 옛 switch 인덱스 (0|1|2) → 정규화 값
  if (next.consequence && next.consequence.timescale > 1) {
    next.consequence = { ...next.consequence, timescale: 1 }
  }
  if (next.connect && next.connect.count > 1) {
    next.connect = { ...next.connect, count: 1 }
  }
  // 옛 양극 direction (-1~1) → 0~1
  if (next.abstraction && next.abstraction.direction < 0) {
    next.abstraction = { ...next.abstraction, direction: (next.abstraction.direction + 1) / 2 }
  }
  return next
}

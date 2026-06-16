// 잭 메타 + 케이블 검증.
//
// 잭 id 패턴 (모두 signal · CV 결 폐기):
//   NODE-<id>-OUT         — 노드 OUT (multi)
//   NODE-<id>-IN          — 노드 IN (multi)
//   FX-<kind>-IN          — 이펙터 IN (multi)
//   FX-<kind>-IN_A        — 이펙터 IN A (multi)
//   FX-<kind>-IN_B        — 이펙터 IN B (multi)
//   FX-<kind>-OUT         — 이펙터 OUT (multi)
//
// 논리:
//   - signal 잭은 IN 도 OUT 도 *여러 케이블* 가능
//   - CV IN 만 *한 케이블* (한 노브에 한 조절원)
//   - 같은 *모듈* 안의 잭들끼리는 연결 불가 (이펙터 자기 자신 IN → OUT 차단)

export function parseJack(id) {
  if (!id) return null

  // 노드 — OUT(소스) · IN(부모 혈통 수집: SYNTH 자식이 부모 케이블을 받는 자리)
  if (id.startsWith('NODE-')) {
    const dir = id.endsWith('-OUT') ? 'out' : 'in'
    const nodeId = id.slice('NODE-'.length, id.lastIndexOf('-'))
    return {
      kind: 'signal',
      dir,
      multi: true,
      owner: 'node',
      module: `NODE-${nodeId}`,
    }
  }

  // OUTPUT — 회로의 종착지. IN 에 닿은 신호만 출력되고, OUT 은 출력(선언문)을 내보낸다.
  if (id === 'OUT-IN') {
    return { kind: 'signal', dir: 'in', multi: true, owner: 'output', module: 'OUT' }
  }
  if (id === 'OUT-SEND') {
    return { kind: 'signal', dir: 'out', multi: true, owner: 'output', module: 'OUT' }
  }

  // VISION — 출력(선언문)을 이미지로 생성하는 모듈. OUT-SEND 만 받는다.
  if (id === 'VISION-IN') {
    return { kind: 'signal', dir: 'in', multi: false, owner: 'vision', module: 'VISION' }
  }

  // DIAGRAM — 모니터 셀렉터: 노드/이펙터 신호를 꽂으면 그 신호만 포커스.
  if (id === 'DIAGRAM-IN') {
    return { kind: 'signal', dir: 'in', multi: true, owner: 'monitor', module: 'DIAGRAM' }
  }

  // PANEL — 그래스호퍼 패널: 노드/이펙터 OUT 을 꽂으면 그 지점의 중간 내용을 표시.
  if (id === 'PANEL-IN') {
    return { kind: 'signal', dir: 'in', multi: false, owner: 'monitor', module: 'PANEL' }
  }

  // IWIN — INFER 갈래 플로팅 창. IN = INFER OUT 에서 자동 연결, OUT = 끌어내 다른 데로.
  if (id.startsWith('IWIN-')) {
    const tail = id.slice(id.lastIndexOf('-') + 1)
    const module = id.slice(0, id.lastIndexOf('-'))
    if (tail === 'OUT') return { kind: 'signal', dir: 'out', multi: true, owner: 'inferwin', module }
    if (tail === 'IN') return { kind: 'signal', dir: 'in', multi: true, owner: 'inferwin', module }
  }

  // SYNTH — 두 노드의 교배 모듈. 입력 둘, 각각 케이블 하나만 (multi: false).
  if (id === 'SYNTH-IN_A' || id === 'SYNTH-IN_B') {
    return { kind: 'signal', dir: 'in', multi: false, owner: 'synth', module: 'SYNTH' }
  }

  // 이펙터
  if (id.startsWith('FX-')) {
    // FX-<kind>-OUT / IN / IN_A / IN_B
    const tail = id.slice(id.lastIndexOf('-') + 1)
    const kind = id.slice('FX-'.length, id.lastIndexOf('-'))
    const module = `FX-${kind}`

    if (tail === 'OUT') {
      return { kind: 'signal', dir: 'out', multi: true, owner: 'effector', module }
    }
    if (tail === 'IN' || tail === 'IN_A' || tail === 'IN_B') {
      return { kind: 'signal', dir: 'in', multi: true, owner: 'effector', module }
    }
  }

  return null
}

// 케이블 한 갈래 박을 수 있는지 검증.
// 결과: { ok: true, normalized: {from, to, kind} } 또는 { ok: false, reason }
export function validateCable(from, to, cables) {
  if (!from || !to) return { ok: false, reason: 'empty' }
  if (from === to) return { ok: false, reason: 'self' }

  const a = parseJack(from)
  const b = parseJack(to)
  if (!a) return { ok: false, reason: `unknown jack: ${from}` }
  if (!b) return { ok: false, reason: `unknown jack: ${to}` }

  // 같은 모듈 내 잭끼리는 연결 X (이펙터 자기 자신 IN → OUT 차단)
  if (a.module && b.module && a.module === b.module) {
    return { ok: false, reason: 'same module' }
  }

  // 종류 일치 (signal ↔ signal, cv ↔ cv)
  if (a.kind !== b.kind) return { ok: false, reason: 'kind mismatch (signal vs cv)' }

  // 방향 — 정확히 한 쪽 in · 한 쪽 out
  if (a.dir === b.dir) return { ok: false, reason: `${a.dir}-${b.dir}` }

  // 정규화 — 항상 OUT → IN
  const outId = a.dir === 'out' ? from : to
  const inId  = a.dir === 'in'  ? from : to
  const outMeta = parseJack(outId)
  const inMeta  = parseJack(inId)

  // SYNTH 입력은 노드의 원본 신호만 받는다 (이펙터 출력의 교배는 v2)
  if (inMeta.owner === 'synth' && outMeta.owner !== 'node') {
    return { ok: false, reason: 'synth accepts node signals only' }
  }

  // VISION 입력은 출력(선언문) 신호만 받는다
  if (inMeta.owner === 'vision' && outId !== 'OUT-SEND') {
    return { ok: false, reason: 'vision accepts OUTPUT signal only' }
  }

  // DIAGRAM 입력은 노드/이펙터 신호만 (선언문 신호는 모니터의 대상이 아니다)
  if (inMeta.owner === 'monitor' && outMeta.owner !== 'node' && outMeta.owner !== 'effector') {
    return { ok: false, reason: 'diagram accepts node/effector signals only' }
  }

  // 중복 (정확히 같은 갈래)
  const dup = cables.some((c) => c.from === outId && c.to === inId)
  if (dup) return { ok: false, reason: 'duplicate' }

  // 다중 제한 — multi=false 잭은 이미 박힌 갈래 X
  if (!inMeta.multi) {
    const taken = cables.some((c) => c.to === inId)
    if (taken) return { ok: false, reason: 'in jack already taken' }
  }
  if (!outMeta.multi) {
    const taken = cables.some((c) => c.from === outId)
    if (taken) return { ok: false, reason: 'out jack already taken' }
  }

  return {
    ok: true,
    normalized: { from: outId, to: inId, kind: outMeta.kind },
  }
}

// 케이블 그래프 → 노드별 이펙터 체인 결정.
//
// 입력: cables [{ from: jackId, to: jackId, ... }], nodes [{ id, ... }]
// 출력: { [nodeId]: [{ effectorId, kind }, ...] }
//
// 결: 노드 OUT 잭에서 시작 → 이펙터 IN → 이펙터 OUT → 다음 이펙터 IN ...
// 종점 (다른 이펙터로 안 흘러나가는 자리) 까지의 체인이 그 노드의 결과.

import { parseJack } from './jacks'

// 잭 id 에서 모듈 id 추출 (예: 'FX-perspective-IN' → 'FX-perspective')
function moduleOf(jackId) {
  const meta = parseJack(jackId)
  return meta?.module
}

// 잭 id 에서 이펙터 kind 추출 (예: 'FX-perspective-IN' → 'perspective')
function effectorKindOf(jackId) {
  if (!jackId?.startsWith('FX-')) return null
  return jackId.slice('FX-'.length, jackId.lastIndexOf('-'))
}

// 모듈의 OUT 잭 id (예: 'FX-perspective' → 'FX-perspective-OUT')
function outJackOf(moduleId) {
  return `${moduleId}-OUT`
}

// 한 자리에서 시작해 이펙터 체인 박음 (BFS, 첫 갈래만 따라감 — 분기는 무시)
function followChain(startOutJack, cables, visited = new Set()) {
  const chain = []
  let curOut = startOutJack

  for (let safety = 0; safety < 20; safety++) {
    // curOut 에서 흘러나가는 케이블 찾기 (IN_B 는 곁가지 입력이라 주 흐름에서 제외)
    const next = cables.find((c) => c.from === curOut && !c.to.endsWith('-IN_B'))
    if (!next) break

    const nextModule = moduleOf(next.to)
    if (!nextModule || !nextModule.startsWith('FX-')) break // 이펙터 아닌 자리
    if (visited.has(nextModule)) break // 순환 방지

    visited.add(nextModule)
    const kind = effectorKindOf(next.to)
    chain.push({ effectorId: nextModule, kind })

    // 이 이펙터의 OUT 으로 다음 자리
    curOut = outJackOf(nextModule)
  }

  return chain
}

// 노드 한 자리의 체인 (NODE-<id>-OUT 에서 시작)
export function chainForNode(nodeId, cables) {
  return followChain(`NODE-${nodeId}-OUT`, cables)
}

// 신호 경로 — 노드에서 출발해 OUT 버스(OUT-IN)에 닿는지까지 판정.
// 실제 신디사이저 결: 출력 버스에 꽂히지 않은 신호는 *들리지 않는다*.
// 반환: { chain: [{effectorId, kind}...], audible: boolean }
//   - chain 비고 audible=true  → 드라이 직결 (NODE-OUT → OUT-IN)
//   - chain 있고 audible=true  → 이펙터 통과 후 버스 도달
//   - audible=false            → 버스 미도달 (무음 — 출력 없음)
export function signalPath(nodeId, cables) {
  const visited = new Set()
  const chain = []
  let curOut = `NODE-${nodeId}-OUT`

  for (let safety = 0; safety < 20; safety++) {
    // 이 자리에서 OUT 버스 직결? — 종단 우선
    if (cables.some((c) => c.from === curOut && c.to === 'OUT-IN')) {
      return { chain, audible: true }
    }
    const next = cables.find((c) => c.from === curOut && c.to.startsWith('FX-') && !c.to.endsWith('-IN_B'))
    if (!next) return { chain, audible: false }

    const nextModule = moduleOf(next.to)
    if (!nextModule || visited.has(nextModule)) return { chain, audible: false }
    visited.add(nextModule)
    // relation: 이 홉을 실어 나르는 케이블의 관계 — 변형 방향에 주입된다
    chain.push({ effectorId: nextModule, kind: effectorKindOf(next.to), relation: next.relation || null })
    curOut = outJackOf(nextModule)
  }
  return { chain, audible: false }
}


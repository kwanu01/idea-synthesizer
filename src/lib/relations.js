// 신호 케이블 관계 메타.
// 새 케이블의 기본 관계 = 'transfer'(흐름) — 케이블은 늘 신호가 흐른다. '미정' 빈 상태는 없앴다.
// 더 구체적 관계(뒷받침·충돌·발전·분기)는 케이블 클릭 메뉴로 지정. AUTO PATCH 는 랜덤 지정.

// 진한 전선 결 — Make Noise/Intellijel 풀스택 결의 케이블 색. 파스텔 X.
export const RELATIONS = {
  transfer:    { label: '흐름',   color: '#ea580c' }, // 진한 주황 (기본 흐름)
  supports:    { label: '뒷받침', color: '#65a30d' }, // 진한 라임
  contradicts: { label: '충돌',   color: '#dc2626' }, // 진한 빨강
  extends:     { label: '발전',   color: '#eab308' }, // 진한 황
  derives:     { label: '분기',   color: '#1d4ed8' }, // 진한 파랑
}

export const DEFAULT_COLOR = '#4a4e56' // 진회색 (관계 미정)

export function relationColor(rel) {
  if (!rel) return DEFAULT_COLOR
  return RELATIONS[rel]?.color || DEFAULT_COLOR
}

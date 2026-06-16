// 메탈 텍스처 — ver1 의 쿨 알루미늄 결.
// CLAUDE.md 시각 레퍼런스: #f0f2f5 → #dee0e4 → #cbcdd3, 잉크 #2a2a32, 음각 #a0a3a8.
// Make Noise / 4ms / Intellijel 유로랙 패널 결.

// 가로 브러시드 결 (fractalNoise — 가로로 길게 뻗은 미세 결)
export const BRUSHED_NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.4 0.05' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

// 잔잔한 잡티 (turbulence — 차가운 회색 톤)
export const GRAIN_NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='g'><feTurbulence type='turbulence' baseFrequency='0.65' numOctaves='3' seed='12' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.04  0 0 0 0 0.04  0 0 0 0 0.05  0 0 0 0.12 0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>\")"

// 쿨 알루미늄 톤 (CLAUDE.md 팔레트 그대로)
export const METAL = {
  highlight: '#fafafc',
  top:       '#f0f2f5',
  base:      '#dee0e4',
  shade:     '#cbcdd3',
  recess:    '#a0a3a8',
  edge:      '#2a2c32',
}

export const INK = '#2a2a32'
export const INK_MUTED = '#6a6a72'
export const INK_LIGHT = '#a0a3a8'

// 알루미늄 패널 — ver1 결 (다층 linear gradient + inset 다층)
export const metalPanel = {
  background: `linear-gradient(180deg, ${METAL.top} 0%, ${METAL.base} 100%)`,
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55)`,
  border: `1px solid #c2c5cc`,
}

// 배경 — 같은 쿨 알루미늄, 그림자 X
export const metalBackground = {
  background: `
    linear-gradient(180deg,
      ${METAL.top} 0%,
      ${METAL.base} 35%,
      ${METAL.shade} 70%,
      ${METAL.base} 100%
    )
  `,
}

// 노이즈 2 레이어 스타일 (부모 자리에서 div 두 장 깐다)
export const brushedLayerStyle = {
  position: 'absolute',
  inset: 0,
  background: BRUSHED_NOISE,
  backgroundSize: '240px 240px',
  mixBlendMode: 'multiply',
  opacity: 0.16,
  pointerEvents: 'none',
  borderRadius: 'inherit',
}

export const grainLayerStyle = {
  position: 'absolute',
  inset: 0,
  background: GRAIN_NOISE,
  backgroundSize: '180px 180px',
  mixBlendMode: 'multiply',
  opacity: 0.16,
  pointerEvents: 'none',
  borderRadius: 'inherit',
}

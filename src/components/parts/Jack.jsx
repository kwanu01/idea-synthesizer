// 잭 — 결 C (육각 너트 + 동심원 + 직선 그라데이션 입체)
// props: size · label · labelPosition ('bottom' | 'top' | 'right')

import { useId } from 'react'

export default function Jack({
    id,
    size = 20,
    label,
    labelPosition = 'bottom',
    onDragStart,
    onDragEnd,
    }) {
  const uid = useId().replace(/[:]/g, '')

  // ─── 육각 vertex 6 개 (윗변 평평) ───
  const hexR = size * 0.48
  const hexPoints = []
  for (let i = 0; i < 6; i++) {
    const a = (60 * i + 30) * (Math.PI / 180)
    hexPoints.push(
      `${(size / 2 + Math.cos(a) * hexR).toFixed(2)},${(size / 2 + Math.sin(a) * hexR).toFixed(2)}`
    )
  }
  const hexStr = hexPoints.join(' ')

  const labelEl = label && (
    <span
      style={{
        fontSize: Math.max(7, size * 0.32),
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: '#3a3a42',
        textTransform: 'uppercase',
        fontFamily: '"Helvetica Neue", sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )

  const jackSvg = (
    <div
        data-jack-id={id}
        title={`${label || '잭'} — 드래그해서 다른 잭에 연결 (OUT → IN). 근처에 가면 자석처럼 붙는다`}
        onPointerDown={(e) => {
        e.preventDefault()
        onDragStart?.(id, e)
        }}
        onPointerUp={(e) => onDragEnd?.(id, e)}
        style={{ cursor: 'crosshair', display: 'inline-block' }}
    >
        <svg width={size} height={size}>
        <defs>
            {/* 육각 너트 — 위→아래 직선 그라데이션 (광원 위) */}
            <linearGradient id={`hex-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#dcdce0" />
            <stop offset="100%" stopColor="#6a6a72" />
            </linearGradient>
            {/* 본체 원 — 위→아래 (너트보다 어두운 톤) */}
            <linearGradient id={`body-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#8a8a92" />
            <stop offset="100%" stopColor="#3a3a42" />
            </linearGradient>
        </defs>

        {/* 육각 너트 */}
        <polygon points={hexStr} fill={`url(#hex-${uid})`} />

        {/* 동심원 4 단계 — 외곽 밝은 실버 → 가운데 음각 → 검정 구멍 (CLAUDE.md) */}
        <circle cx={size / 2} cy={size / 2} r={size * 0.36} fill="#c8c8d0" />
        <circle cx={size / 2} cy={size / 2} r={size * 0.28} fill={`url(#body-${uid})`} />
        <circle cx={size / 2} cy={size / 2} r={size * 0.2} fill="#3a3a42" />
        <circle cx={size / 2} cy={size / 2} r={size * 0.13} fill="#0a0a10" />
        </svg>
    </div>
  )

  if (labelPosition === 'top') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {labelEl}
        {jackSvg}
      </div>
    )
  }
  if (labelPosition === 'right') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {jackSvg}
        {labelEl}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {jackSvg}
      {labelEl}
    </div>
  )
}
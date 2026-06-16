// 노브 — CLAUDE.md 형태 결.
// 검정 원기둥 (#1a1a20 → #0a0a0e) · 측면 6 그루브 (60° 간격, 노브와 함께 회전)
// 외곽 두꺼운 점선 270° 호 (가동 범위만) · 흰 인디케이터 라인이 가장자리까지.
// props: value · onChange · size · label · labelPosition ('bottom'|'top'|'right')
// 드래그 위↑ → value 증가. Shift 누르면 정밀

import { useId, useState } from 'react'

export default function Knob({
  value,
  onChange,
  size = 40,
  label,
  labelPosition = 'bottom',
}) {
  const [localValue, setLocalValue] = useState(0.5)
  const uid = useId().replace(/[:]/g, '')
  const v = value ?? localValue
  const handleChange = onChange ?? setLocalValue

  // 가동 범위 270° (-135° ~ +135°)
  const angle = -135 + v * 270
  const rad = (angle - 90) * (Math.PI / 180)

  const cx = size / 2
  const cy = size / 2
  const rArc = size * 0.47      // 점선 호 반지름 (가동 범위 표시)
  const r = size * 0.36         // 본체 반지름

  // 270° 호 path (-135° → +135°, 위 기준)
  const arcPt = (deg) => {
    const a = (deg - 90) * (Math.PI / 180)
    return `${(cx + Math.cos(a) * rArc).toFixed(2)} ${(cy + Math.sin(a) * rArc).toFixed(2)}`
  }
  const arcPath = `M ${arcPt(-135)} A ${rArc} ${rArc} 0 1 1 ${arcPt(135)}`

  // 측면 6 그루브 — 노브와 함께 회전 (60° 간격 짧은 선)
  const grooves = []
  for (let i = 0; i < 6; i++) {
    const ga = (angle + i * 60 - 90) * (Math.PI / 180)
    grooves.push({
      x1: cx + Math.cos(ga) * r * 0.74,
      y1: cy + Math.sin(ga) * r * 0.74,
      x2: cx + Math.cos(ga) * r * 0.96,
      y2: cy + Math.sin(ga) * r * 0.96,
    })
  }

  // 흰 인디케이터 라인 — 중심 부근에서 측면 가장자리까지
  const indX1 = cx + Math.cos(rad) * r * 0.2
  const indY1 = cy + Math.sin(rad) * r * 0.2
  const indX2 = cx + Math.cos(rad) * r * 0.97
  const indY2 = cy + Math.sin(rad) * r * 0.97

  const onPointerDown = (e) => {
    e.preventDefault()
    const startY = e.clientY
    const startV = v
    const move = (ev) => {
      const dy = startY - ev.clientY
      const speed = ev.shiftKey ? 0.001 : 0.005
      handleChange(Math.max(0, Math.min(1, startV + dy * speed)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const labelEl = label && (
    <span
      style={{
        fontSize: Math.max(7, size * 0.22),
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

  const knobSvg = (
    <svg
      width={size}
      height={size}
      onPointerDown={onPointerDown}
      style={{ cursor: 'ns-resize', userSelect: 'none', touchAction: 'none' }}
    >
      <title>{`${label || '노브'} — 위아래 드래그로 조절 · Shift = 정밀 조정`}</title>
      <defs>
        {/* 검정 원기둥 — 단순 linear (radial 금지) */}
        <linearGradient id={`knob-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#3a3e46" />
          <stop offset="100%" stopColor="#22242a" />
        </linearGradient>

      </defs>

      {/* 가동 범위 — 헤어라인 270° 호 (미니멀) */}
      <path
        d={arcPath}
        fill="none"
        stroke="#b8bcc4"
        strokeWidth={1}
      />

      {/* 본체 — 깨끗한 다크 원 + 헤어라인 */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#knob-${uid})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

      {/* 인디케이터 — 흰 라인 하나 */}
      <line
        x1={indX1} y1={indY1} x2={indX2} y2={indY2}
        stroke="#f5f5f7"
        strokeWidth={Math.max(1.6, size * 0.055)}
      />
    </svg>
  )

  if (labelPosition === 'top') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {labelEl}
        {knobSvg}
      </div>
    )
  }
  if (labelPosition === 'right') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {knobSvg}
        {labelEl}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {knobSvg}
      {labelEl}
    </div>
  )
}
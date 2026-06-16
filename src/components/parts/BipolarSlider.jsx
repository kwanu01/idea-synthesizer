// BipolarSlider — 가운데가 0 인 양극 페이더. 가로(기본) 또는 세로(vertical).
// Slider 와 같은 실물 결: 음각 슬롯 + 단계 톤 캡 + 흰 그립 라인 + 눈금.
// props: width · height · value (-1..1) · onChange · leftLabel · rightLabel · vertical
//   vertical 일 때 leftLabel = 아래(−), rightLabel = 위(+)

import { useState } from 'react'
import { INK_MUTED } from '../../lib/textures'

export default function BipolarSlider({
  width = 100,
  height = 18,
  value = 0,
  onChange,
  leftLabel = '−',
  rightLabel = '+',
  vertical = false,
}) {
  const [v, setV] = useState(value)
  const setVal = (next) => {
    const clamped = Math.max(-1, Math.min(1, next))
    setV(clamped)
    onChange?.(clamped)
  }

  // vertical 이면 width=트랙 길이 해석을 바꾸지 않고, 캡 폭 = height 로 교환해 쓴다.
  const trackLen = width
  const capThick = height
  const capW = 10

  const onDown = (e) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const apply = (clientX, clientY) => {
      const ratio = vertical
        ? 1 - (clientY - rect.top) / rect.height
        : (clientX - rect.left) / rect.width
      setVal(ratio * 2 - 1)
    }
    apply(e.clientX, e.clientY)
    const move = (ev) => apply(ev.clientX, ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const frac = (v + 1) / 2
  const capPos = frac * (trackLen - capW)

  const labelStyle = {
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: INK_MUTED,
    textTransform: 'uppercase',
    lineHeight: 1,
  }

  // 슬롯 + 눈금 + 캡 (가로 기준으로 그리고, vertical 이면 회전 배치)
  const track = (
    <div
      onPointerDown={onDown}
      title={`${leftLabel} ↔ ${rightLabel} — 드래그로 조절, 가운데가 중립`}
      style={{
        position: 'relative',
        width: vertical ? capThick : trackLen,
        height: vertical ? trackLen : capThick,
        cursor: vertical ? 'ns-resize' : 'ew-resize',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* 눈금 — -1 · -0.5 · 0 · +0.5 · +1 (0 은 길게) */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const along = capW / 2 + (trackLen - capW) * t
        const long = t === 0.5 ? 6 : 4
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              ...(vertical
                ? { top: trackLen - along - 0.5, left: 0, width: long, height: 1 }
                : { left: along - 0.5, top: 0, width: 1, height: long }),
              background: '#8a8e96',
              pointerEvents: 'none',
            }}
          />
        )
      })}
      {/* 슬롯 */}
      <div
        style={{
          position: 'absolute',
          ...(vertical
            ? { left: capThick / 2 - 2.5, top: 0, bottom: 0, width: 5 }
            : { top: capThick / 2 - 2.5, left: 0, right: 0, height: 5 }),
          background: vertical
            ? 'linear-gradient(90deg, #0a0a10 0%, #1c1e24 55%, #2a2c32 100%)'
            : 'linear-gradient(180deg, #0a0a10 0%, #1c1e24 55%, #2a2c32 100%)',
          borderRadius: 1,
          pointerEvents: 'none',
        }}
      />
      {/* 캡 */}
      <div
        style={{
          position: 'absolute',
          ...(vertical
            ? { left: 0, top: trackLen - capPos - capW, width: capThick, height: capW }
            : { left: capPos, top: 0, width: capW, height: capThick }),
          background: 'linear-gradient(180deg, #4a4c54 0%, #2e3038 45%, #16181e 100%)',
          border: '1px solid #0a0a10',
          borderRadius: 1,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            ...(vertical
              ? { left: 1, right: 1, top: '50%', height: 1.5, marginTop: -0.75 }
              : { top: 1, bottom: 1, left: '50%', width: 1.5, marginLeft: -0.75 }),
            background: '#f0f0f0',
          }}
        />
      </div>
    </div>
  )

  if (vertical) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={labelStyle}>{rightLabel}</span>
        {track}
        <span style={labelStyle}>{leftLabel}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {track}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: trackLen,
          ...labelStyle,
        }}
      >
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

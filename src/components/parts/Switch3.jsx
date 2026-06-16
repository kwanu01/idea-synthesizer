// Switch3 — 3-위치 토글. 세 라벨 + 각 옆 작은 LED 점.
// props: value (0|1|2) · onChange · options (3 labels)

import { useState } from 'react'
import { INK, INK_MUTED, METAL } from '../../lib/textures'

export default function Switch3({
  value = 0,
  onChange,
  options = ['LO', 'MID', 'HI'],
}) {
  // 값은 0~1 정규화로 주고받는다 — 백엔드 _pick_label 의 인덱스 공식과 일치.
  // (옛 인덱스 값 0|1|2 도 받아들임: 1 보다 큰 값은 인덱스로 해석)
  const n = options.length
  const toIdx = (val) =>
    val > 1 ? Math.min(n - 1, Math.round(val)) : Math.round((val ?? 0) * (n - 1))
  const [v, setV] = useState(toIdx(value))
  const handle = (i) => {
    setV(i)
    onChange?.(n > 1 ? i / (n - 1) : 0)
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: '#dfe1e5',
        border: `1px solid ${METAL.recess}`,
        borderRadius: 2,
        padding: '4px 6px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(40,42,48,0.2)',
      }}
    >
      {options.map((opt, i) => (
        <button
          key={opt + i}
          onClick={() => handle(i)}
          title={`${opt} 모드로 전환 — 백엔드 변형 방식이 바뀐다`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: i === toIdx(value ?? v) ? INK : INK_MUTED,
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: i === v ? '#dc2626' : '#3a3a42',
              border: `0.5px solid ${METAL.edge}`,
            }}
          />
          {opt}
        </button>
      ))}
    </div>
  )
}

// 랙 레일 — 유로랙 케이스의 수평 마운팅 레일.
// 모듈 줄 위·아래에 깔리는 금속 띠 + 일정 간격 나사 구멍.
// CLAUDE.md: 입체는 단계적 톤·라인으로만 (blur·drop-shadow 금지).

import { METAL } from '../lib/textures'

export default function RackRail({ holes = 28 }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 7,
        flexShrink: 0,
        margin: '0 6px',
        background: '#e3e5ea',
        border: '1px solid #cdd0d6',
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        boxSizing: 'border-box',
        zIndex: 1,
      }}
    >
      {Array.from({ length: holes }, (_, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: '#b4b8c0',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

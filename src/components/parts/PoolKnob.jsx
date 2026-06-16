// PoolKnob — 옵션 풀을 고르는 노브 + 현재 선택을 보여주는 미니 LCD.
// "노브가 뭘 고르는지 화면에 보여야 한다" — 백엔드 _pick_from_pool 과 같은 인덱스 공식.
//
// props: pool (string[]) · value (0~1) · onChange · label · size

import Knob from './Knob'

export default function PoolKnob({ pool = [], value = 0.5, onChange, label, size = 34 }) {
  const v = Math.max(0, Math.min(1, value ?? 0.5))
  const idx = pool.length ? Math.round(v * (pool.length - 1)) : 0
  const selected = pool[idx] || '—'

  return (
    <div title={`${label} — 노브를 돌리면 장착된 에이전트의 어휘 풀(${pool.length}개)에서 선택된다`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
      <Knob size={size} value={v} onChange={onChange} />
      <span
        style={{
          fontSize: 7.5,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: '#6a6a72',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      {/* 리드아웃 — 보조 정보. 조작은 노브가, 읽기는 이 한 줄이. */}
      <span
        title={`${idx + 1} / ${pool.length} — ${selected}`}
        style={{
          maxWidth: 104,
          color: '#52565e',
          fontSize: 8,
          fontWeight: 600,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
        }}
      >
        {selected}
      </span>
    </div>
  )
}

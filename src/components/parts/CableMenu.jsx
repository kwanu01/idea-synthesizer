// 케이블 컨텍스트 메뉴 — 케이블 클릭 자리에 popup.
// 결: 작은 메탈 자리 + 관계 5 종 (색 점 + 라벨) + 구분선 + 삭제

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { METAL, INK } from '../../lib/textures'
import { RELATIONS, DEFAULT_COLOR } from '../../lib/relations'

export default function CableMenu({
  x,
  y,
  current,
  info = null, // { from, to, seq } — 이 케이블이 누구와 누구를 잇는지
  onSelect,
  onDelete,
  onClose,
}) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x, top: y })

  // mount 후 자기 크기 측정 → viewport 안으로 조정
  useLayoutEffect(() => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const margin = 6
    let left = x
    let top = y
    if (left + r.width + margin > window.innerWidth) {
      left = window.innerWidth - r.width - margin
    }
    if (top + r.height + margin > window.innerHeight) {
      top = window.innerHeight - r.height - margin
    }
    if (left < margin) left = margin
    if (top < margin) top = margin
    setPos({ left, top })
  }, [x, y])

  // 외부 클릭 시 닫음
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 200,
        background: 'linear-gradient(180deg, #f0f2f5 0%, #dee0e4 100%)',
        border: `1px solid ${METAL.edge}`,
        borderRadius: 3,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(40,42,48,0.25), 0 4px 12px rgba(0,0,0,0.3)',
        padding: '4px 0',
        minWidth: 140,
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* 연결 정보 — 누구와 누구를 잇는 케이블인가 */}
      {info && (
        <div
          style={{
            padding: '6px 10px 7px',
            borderBottom: `1px solid ${METAL.recess}`,
            marginBottom: 3,
            maxWidth: 220,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.45,
              wordBreak: 'keep-all',
            }}
          >
            {info.from}
            <span style={{ color: '#9ba0a8', fontWeight: 600 }}> → </span>
            {info.to}
          </div>
          {info.seq != null && (
            <div style={{ fontSize: 8.5, color: '#8a8e96', marginTop: 2 }}>
              체인 {info.seq}번째 단 — 신호가 이 순서로 통과한다
            </div>
          )}
        </div>
      )}

      {Object.entries(RELATIONS).map(([key, meta]) => (
        <RelItem
          key={key}
          active={current === key}
          color={meta.color}
          label={`${meta.label} · ${key}`}
          onClick={() => onSelect?.(key)}
        />
      ))}
      <div
        style={{
          height: 1,
          background: METAL.recess,
          margin: '4px 8px',
        }}
      />
      <RelItem
        color="#dc2626"
        label="삭제"
        danger
        onClick={() => onDelete?.()}
      />
    </div>
  )
}

function RelItem({ active, color, label, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '5px 10px',
        background: active ? 'rgba(40,42,48,0.08)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 10,
        fontWeight: active ? 800 : 600,
        letterSpacing: '0.06em',
        color: danger ? '#dc2626' : INK,
        textTransform: 'uppercase',
        textAlign: 'left',
        fontFamily: 'inherit',
        lineHeight: 1.4,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = 'rgba(40,42,48,0.12)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = active
          ? 'rgba(40,42,48,0.08)'
          : 'transparent')
      }
    >
      <span
        style={{
          width: 10,
          height: 3,
          background: color,
          border: `1px solid ${METAL.edge}`,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </button>
  )
}

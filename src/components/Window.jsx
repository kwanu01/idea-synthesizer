// 플로팅 윈도우 — 드래그·리사이즈·z순서. 워크스테이션의 창.
// children 이 함수면 (w, h) => JSX 로 내부 크기를 받아 그린다 (캔버스 등).
// props: title · children · initialX/Y · initialW/H · minW/H · onClose · onDock

import { useRef, useState } from 'react'
import { INK } from '../lib/textures'

// 두 개의 z 밴드 — 케이블 레이어(CableLayer z:9000)를 사이에 둔다.
//   below (360~) : 케이블 *아래* — INFER/CONTRADICT 갈래 창(플로팅 '노드'). 케이블이 창 안으로 들어가는 게 보인다.
//   above (9100~): 케이블 *위*   — STATEMENT·DIAGRAM·VISION·PANEL 등 일반 창. 케이블에 가리지 않는다.
let zBelow = 360
let zAbove = 9100

export default function Window({
  title = 'WINDOW',
  children,
  initialX = 120,
  initialY = 90,
  initialW = 380,
  initialH = 300,
  minW = 240,
  minH = 160,
  onClose,
  onDock,
  belowCables = false, // 갈래 창만 true — 케이블 아래에 남는다
}) {
  const [pos, setPos] = useState({ x: initialX, y: initialY })
  const [size, setSize] = useState({ w: initialW, h: initialH })
  // lazy init — 증가는 마운트 때 한 번만 (useState 인자를 직접 쓰면 매 렌더마다 증가하는 버그).
  const nextZ = () => (belowCables ? ++zBelow : ++zAbove)
  const [z, setZ] = useState(nextZ)
  const raise = () => setZ(nextZ())

  const drag = (e, fn) => {
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    const move = (ev) => fn(ev.clientX - sx, ev.clientY - sy)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onHeaderDown = (e) => {
    raise()
    const start = { ...pos }
    drag(e, (dx, dy) =>
      setPos({
        x: Math.min(window.innerWidth - 90, Math.max(90 - size.w, start.x + dx)),
        y: Math.min(window.innerHeight - 40, Math.max(0, start.y + dy)),
      })
    )
  }
  const onResizeDown = (e) => {
    e.stopPropagation()
    raise()
    const start = { ...size }
    drag(e, (dx, dy) =>
      setSize({
        w: Math.min(window.innerWidth, Math.max(minW, start.w + dx)),
        h: Math.min(window.innerHeight, Math.max(minH, start.h + dy)),
      })
    )
  }

  const bodyH = size.h - 30

  return (
    <div
      onPointerDown={raise}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        background: '#fafbfc',
        border: '1px solid #c8cbd2',
        borderRadius: 5,
        color: INK,
        fontFamily: '"Helvetica Neue", sans-serif',
        zIndex: z,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 14px 36px rgba(20,22,28,0.4), 0 3px 10px rgba(20,22,28,0.3)',
      }}
    >
      {/* 타이틀 바 — 표준 결: 좌측 신호등(닫기·도크), 가운데 제목 */}
      <div
        onPointerDown={onHeaderDown}
        title="드래그 = 창 이동 · 우하단 모서리 = 크기 조절"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 30,
          flexShrink: 0,
          padding: '0 10px',
          background: 'linear-gradient(180deg, #f6f7f9 0%, #e9ebef 100%)',
          borderBottom: '1px solid #d2d5db',
          cursor: 'move',
          userSelect: 'none',
          zIndex: 1,
        }}
      >
        {onClose && (
          <Dot color="#ff5f57" title="닫기" onClick={onClose} />
        )}
        {onDock && (
          <Dot color="#febc2e" title="도크로 되돌리기" onClick={onDock} />
        )}
        <span
          style={{
            position: 'absolute',
            left: 60,
            right: 60,
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: '#3a3d44',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
          }}
        >
          {title}
        </span>
      </div>

      {/* 본문 */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, zIndex: 1, overflow: 'hidden' }}>
        {typeof children === 'function' ? children(size.w, bodyH) : children}
      </div>

      {/* 리사이즈 핸들 — 우하단 */}
      <div
        onPointerDown={onResizeDown}
        title="크기 조절"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          zIndex: 2,
          background:
            'linear-gradient(135deg, transparent 50%, #6a6e76 50%, #6a6e76 60%, transparent 60%, transparent 70%, #6a6e76 70%, #6a6e76 80%, transparent 80%)',
        }}
      />
    </div>
  )
}

function Dot({ color, onClick, title }) {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      title={title}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: color,
        border: '1px solid rgba(0,0,0,0.15)',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    />
  )
}

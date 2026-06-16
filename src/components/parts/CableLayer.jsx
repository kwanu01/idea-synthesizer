// 잭 좌표 자동 측정 + 케이블 그림 + 드래그 중 임시 케이블
// props: cables · dragging · onCableClick(cableId)
//
// 좌표계: 오버레이 자신(앱 루트에 absolute)을 기준으로 잭 위치를 상대 측정한다.
// viewport(fixed) 기준 측정은 브라우저 확대/핀치 줌에서 어긋났다 — 같은 레이아웃
// 좌표계 안에서 재면 줌·스크롤에 영향받지 않는다.

import { useEffect, useRef, useState } from 'react'
import Cable from './Cable'
import { relationColor, DEFAULT_COLOR } from '../../lib/relations'
import { validateCable } from '../../lib/jacks'

export default function CableLayer({
  cables = [],
  cableSeq = {},
  activeIds = null, // Set — 지금 신호가 흐르는 케이블 (펄스 표시)
  dragging = null,
  onCableClick,
  onCableAdjust,
}) {
  const [positions, setPositions] = useState({})
  const overlayRef = useRef(null)

  // 매 frame 잭 좌표 측정 — 오버레이 기준 상대 좌표
  useEffect(() => {
    let raf
    let lastJson = ''
    const tick = () => {
      const overlay = overlayRef.current
      if (overlay) {
        const base = overlay.getBoundingClientRect()
        const pos = {}
        const jacks = document.querySelectorAll('[data-jack-id]')
        jacks.forEach((el) => {
          const id = el.getAttribute('data-jack-id')
          if (!id) return
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          // 스크롤 영역 밖으로 잘린 잭은 좌표 무효 — 가려진 잭의 케이블이
          // 패널 위로 떠다니지 않게 한다 (overflow auto/scroll 조상 기준 클리핑).
          let clipped = false
          let p = el.parentElement
          while (p && p !== document.body) {
            const oy = getComputedStyle(p).overflowY
            if (oy === 'auto' || oy === 'scroll' || getComputedStyle(p).overflow === 'hidden') {
              const pr = p.getBoundingClientRect()
              if (cy < pr.top - 2 || cy > pr.bottom + 2 || cx < pr.left - 2 || cx > pr.right + 2) {
                clipped = true
                break
              }
            }
            p = p.parentElement
          }
          if (clipped) return
          pos[id] = { x: cx - base.left, y: cy - base.top }
        })
        // 안 바뀌었으면 setState 생략 (불필요한 60fps 리렌더 방지)
        const json = JSON.stringify(pos)
        if (json !== lastJson) {
          lastJson = json
          setPositions(pos)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  // 드래그 중 임시 케이블 — fromId 좌표 → 마우스 자리 (viewport → 오버레이 좌표 변환)
  const base = overlayRef.current?.getBoundingClientRect()
  const dragFrom = dragging && positions[dragging.fromId]
  let dragTo =
    dragging && base
      ? { x: dragging.mouseX - base.left, y: dragging.mouseY - base.top }
      : null

  // 자석 스냅 — 호환 잭 30px 안이면 케이블 끝이 끌려가 붙는다
  let snapPos = null
  if (dragging && dragTo) {
    let bestD = 30
    for (const [id, p] of Object.entries(positions)) {
      if (id === dragging.fromId) continue
      const d = Math.hypot(p.x - dragTo.x, p.y - dragTo.y)
      if (d < bestD && validateCable(dragging.fromId, id, cables).ok) {
        bestD = d
        snapPos = p
      }
    }
    if (snapPos) dragTo = snapPos
  }

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9000, // 케이블은 모듈·플로팅 창 위로 (연결이 항상 보이게)
      }}
    >
      {/* 확정된 케이블들 */}
      {cables.map((c) => {
        const from = positions[c.from]
        const to = positions[c.to]
        if (!from || !to) return null
        return (
          <Cable
            key={c.id}
            from={from}
            to={to}
            // 관계 미정(null) = 진회색 — 색은 사용자가 관계를 지정해야만 입혀진다
            color={relationColor(c.relation)}
            sagFactor={c.sagFactor ?? 1}
            driftFactor={c.driftFactor ?? 0}
            sagPx={c.sagPx ?? null}
            driftPx={c.driftPx ?? null}
            seq={cableSeq[c.id]}
            active={!!activeIds?.has(c.id)}
            onClick={
              onCableClick ? (e) => onCableClick(c.id, e) : undefined
            }
            onAdjust={
              onCableAdjust
                ? (sagPx, driftPx) => onCableAdjust(c.id, sagPx, driftPx)
                : undefined
            }
          />
        )
      })}

      {/* 드래그 중 임시 케이블 */}
      {dragFrom && dragTo && (
        <Cable
          from={dragFrom}
          to={dragTo}
          color={snapPos ? '#f97316' : DEFAULT_COLOR}
          thickness={2}
        />
      )}

      {/* 스냅 후보 하이라이트 — 끌려간 잭에 오렌지 링 */}
      {snapPos && (
        <div
          style={{
            position: 'absolute',
            left: snapPos.x - 13,
            top: snapPos.y - 13,
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: '2px solid #f97316',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

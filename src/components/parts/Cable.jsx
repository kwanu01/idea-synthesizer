// 케이블 — 두 점 사이 bezier sag (늘어진 결).
// 사용자가 hit-area 를 드래그하면 sagPx·driftPx 가 박힘 (마우스 자리로 따라옴).
// 짧은 클릭 (drag 5px 미만) = onClick 호출 (컨텍스트 메뉴).

export default function Cable({
  from = { x: 0, y: 0 },
  to = { x: 100, y: 100 },
  color = '#ec4899',
  thickness = 3,
  sagFactor = 1,
  driftFactor = 0,
  sagPx = null,    // 사용자가 드래그로 박은 sag (px). null 이면 baseSag * sagFactor
  driftPx = null,  // 사용자가 드래그로 박은 drift (px). null 이면 baseDrift
  onClick,
  onAdjust,        // (sagPx, driftPx) — 드래그 결로 자리 갱신
  seq = null,      // 체인 순번 — 케이블 위 1·2·3 배지
  active = false,  // 신호가 흐르는 중 — 케이블 위를 달리는 펄스
}) {
  const factor = Math.max(0.85, Math.min(1.35, sagFactor))
  // sag — 수평 거리에 비례, 낮게 캡 (과한 고리 방지)
  const distBase = Math.hypot(to.x - from.x, to.y - from.y)
  const baseSag = Math.min(64, 18 + distBase * 0.16)
  const curSag = sagPx != null ? sagPx : baseSag * factor

  // pad
  const pad = 280 * factor + Math.abs(driftFactor) * 200 + Math.abs(curSag) * 0.5
  const minX = Math.min(from.x, to.x) - pad
  const minY = Math.min(from.y, to.y) - pad
  const maxX = Math.max(from.x, to.x) + pad
  const maxY = Math.max(from.y, to.y) + pad
  const width = maxX - minX
  const height = maxY - minY

  const fx = from.x - minX
  const fy = from.y - minY
  const tx = to.x - minX
  const ty = to.y - minY

  const dx = tx - fx
  const dy = ty - fy

  const sag = curSag
  // drift — 좌우 자연스러운 휨 (작게, 수평 거리 기준)
  const baseDrift = Math.abs(dx) * 0.08 * driftFactor
  const driftAmount = driftPx != null ? driftPx : baseDrift

  // 제어점을 직선 위 1/3·2/3 지점에 두고 아래로만 sag — 대각선이어도 고리 없이 처진다
  const c1x = fx + dx * 0.33 + driftAmount
  const c1y = fy + dy * 0.33 + sag
  const c2x = fx + dx * 0.67 + driftAmount
  const c2y = fy + dy * 0.67 + sag

  const d = `M ${fx} ${fy} C ${c1x} ${c1y} ${c2x} ${c2y} ${tx} ${ty}`

  // 드래그 결 — pointer 자리 갱신
  const onPointerDown = (e) => {
    if (!onAdjust && !onClick) return
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    let didDrag = false

    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2

    const onMove = (ev) => {
      const movedX = ev.clientX - startX
      const movedY = ev.clientY - startY
      if (!didDrag && Math.hypot(movedX, movedY) > 5) {
        didDrag = true
      }
      if (didDrag && onAdjust) {
        // 마우스 자리 (viewport) → 케이블 중간 자리와 비교
        const newSag = Math.max(20, ev.clientY - midY)
        const newDrift = ev.clientX - midX
        onAdjust(newSag, newDrift)
      }
    }
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!didDrag && onClick) {
        // 짧은 클릭 — 컨텍스트 메뉴
        onClick(ev)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <svg
      style={{
        position: 'absolute',
        left: minX,
        top: minY,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      {/* hit-area — 투명 두꺼운 path, pointer 결.
          케이블이 패널 위를 가로질러 휠을 가로채지 않도록, 휠은 아래 스크롤 영역으로 넘긴다. */}
      {(onClick || onAdjust) && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(16, thickness * 6)}
          style={{ pointerEvents: 'stroke', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onWheel={(e) => {
            // 커서 아래(케이블 제외)의 스크롤 가능한 요소를 찾아 직접 스크롤
            const stack = document.elementsFromPoint(e.clientX, e.clientY)
            const target = stack.find(
              (el) => el !== e.currentTarget && el.scrollHeight > el.clientHeight + 2 &&
                ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)
            )
            if (target) target.scrollTop += e.deltaY
          }}
        />
      )}
      {/* 3 레이어 — 검정 그림자 외곽 + 색 본체 + 흰 하이라이트 얇게 (CLAUDE.md) */}
      <path
        d={d}
        fill="none"
        stroke="#0a0a10"
        strokeWidth={thickness + 2}
        opacity={0.55}
        transform={`translate(0 ${Math.max(1, thickness * 0.4)})`}
      />
      <path d={d} fill="none" stroke={color} strokeWidth={thickness} />
      <path
        d={d}
        fill="none"
        stroke="#ffffff"
        strokeWidth={Math.max(0.8, thickness * 0.3)}
        opacity={0.5}
        transform={`translate(0 ${-thickness * 0.22})`}
      />

      {/* 신호 펄스 — 변형이 흐르는 동안 신호 점이 케이블을 달린다 */}
      {active && (
        <g>
          <circle r={thickness * 1.8} fill={color} opacity="0.3">
            <animateMotion dur="1.1s" repeatCount="indefinite" path={d} />
          </circle>
          <circle r={thickness * 0.85} fill="#ffffff" opacity="0.95">
            <animateMotion dur="1.1s" repeatCount="indefinite" path={d} />
          </circle>
        </g>
      )}

      {/* 플러그 끝 — 잭에 꽂힌 금속 머리 */}
      {[[fx, fy], [tx, ty]].map(([px, py], i) => (
        <g key={i}>
          <circle cx={px} cy={py} r={thickness * 1.7} fill="#3a3a42" />
          <circle cx={px} cy={py} r={thickness * 1.1} fill={color} />
        </g>
      ))}

      {/* 체인 순번 배지 — 신호가 몇 번째로 통과하는 케이블인지 */}
      {seq != null && (() => {
        const bt = 0.42
        const mt = 1 - bt
        const bx = mt * mt * mt * fx + 3 * mt * mt * bt * c1x + 3 * mt * bt * bt * c2x + bt * bt * bt * tx
        const by = mt * mt * mt * fy + 3 * mt * mt * bt * c1y + 3 * mt * bt * bt * c2y + bt * bt * bt * ty
        return (
          <g>
            <circle cx={bx} cy={by} r={7} fill="#16181e" stroke={color} strokeWidth={1.5} />
            <text
              x={bx}
              y={by + 3}
              fontSize="8.5"
              fontWeight="800"
              fill="#f0f2f5"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {seq}
            </text>
          </g>
        )
      })()}
    </svg>
  )
}

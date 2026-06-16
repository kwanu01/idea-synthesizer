// BOOT SCREEN — 처음 만나는 전원 화면. 밝은 알루미늄 톤, 미니멀.
// 시그니처 제스처: 케이블의 플러그를 전원 잭에 꽂으면 — 패칭으로 전원이 들어오듯 —
// 워크스테이션이 패널 슬랫으로 펼쳐지며 부팅된다. (그 제스처가 오디오 잠금 해제도 겸함.)

import { useRef, useState } from 'react'
import * as sound from '../lib/soundEngine'

const SLATS = 7
// 패치 무대 좌표 (가운데 컨테이너 480×120 기준)
const ANCHOR = { x: 40, y: 60 }   // 케이블이 나오는 고정 단자 (좌)
const JACK = { x: 432, y: 60 }    // 전원 잭 (우)
const SNAP = 40

export default function BootScreen({ onEnter }) {
  const [plug, setPlug] = useState({ x: 150, y: 96 }) // 늘어진 플러그 시작 자리
  const [connected, setConnected] = useState(false)
  const [exiting, setExiting] = useState(false)
  const stageRef = useRef(null)

  const connect = () => {
    if (connected) return
    setConnected(true)
    // 케이블 끝을 잭 동심 칼라의 왼쪽 가장자리에 묻는다 — 위에서 본 시트 어셈블리로 전환.
    setPlug({ x: JACK.x - 14, y: JACK.y })
    sound.unlock()
    sound.systemBoot()
    // 2.2초에 걸쳐 점진적으로 점등 → 1초 대기 → 패널이 펼쳐진다
    setTimeout(() => setExiting(true), 2200 + 1000)
    setTimeout(onEnter, 2200 + 1000 + 1050)
  }

  const onPlugDown = (e) => {
    if (connected) return
    e.preventDefault()
    const move = (ev) => {
      const r = stageRef.current?.getBoundingClientRect()
      if (!r) return
      setPlug({ x: ev.clientX - r.left, y: ev.clientY - r.top })
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const r = stageRef.current?.getBoundingClientRect()
      if (r) {
        const px = ev.clientX - r.left
        const py = ev.clientY - r.top
        if (Math.hypot(px - JACK.x, py - JACK.y) < SNAP) { connect(); return }
      }
      setPlug({ x: 150, y: 96 }) // 못 꽂으면 다시 늘어진다
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // 케이블 경로 — 단자에서 플러그까지 늘어진 bezier.
  // 선은 플러그의 왼쪽 끝(케이블 입구)에 붙는다 — 측면 뷰에선 배럴 좌단, 연결 시엔 잭 보어.
  const sag = connected ? 14 : 40
  const tail = connected ? { x: plug.x, y: plug.y } : { x: plug.x - 18, y: plug.y }
  const d = `M ${ANCHOR.x} ${ANCHOR.y} C ${ANCHOR.x + (tail.x - ANCHOR.x) * 0.33} ${ANCHOR.y + sag}, ${ANCHOR.x + (tail.x - ANCHOR.x) * 0.67} ${tail.y + sag}, ${tail.x} ${tail.y}`
  const near = !connected && Math.hypot(plug.x - JACK.x, plug.y - JACK.y) < SNAP
  const cableColor = connected ? '#f97316' : near ? '#f9b27a' : '#9ba0a8'

  if (exiting) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none', display: 'flex' }}>
        {Array.from({ length: SLATS }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: 'linear-gradient(180deg, #f4f5f7 0%, #e7e9ed 100%)',
              borderRight: i < SLATS - 1 ? '1px solid #ffffff80' : 'none',
              animation: `slatOpen 760ms cubic-bezier(0.7,0,0.3,1) ${i * 55}ms forwards`,
            }}
          />
        ))}
        <style>{`@keyframes slatOpen { to { transform: translateY(-105%); } }`}</style>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'radial-gradient(120% 90% at 50% 40%, #f6f7f9 0%, #e3e5ea 78%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 미세 점 격자 — 알루미늄 위 패널 결 */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(#00000010 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(60% 55% at 50% 44%, #000 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(60% 55% at 50% 44%, #000 0%, transparent 100%)',
        }}
      />

      {/* 로고 — 뒤에 원형 라디얼 글로우(직사각 틀 방지). 점등은 2.2초에 걸쳐 차오른다. */}
      <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.45) 0%, rgba(249,115,22,0) 68%)',
            opacity: connected ? 1 : 0,
            transform: connected ? 'scale(1)' : 'scale(0.6)',
            transition: 'opacity 2200ms ease, transform 2200ms ease',
            pointerEvents: 'none',
          }}
        />
        <svg width="120" height="120" viewBox="0 0 64 64" style={{ position: 'relative' }}>
          <rect width="64" height="64" rx="14" fill="#fcfdfe" />
          <rect x="14.2" y="14" width="3.6" height="28" rx="1.8" fill="#c4c8d0" />
          <rect x="25.2" y="14" width="3.6" height="28" rx="1.8" fill="#c4c8d0" />
          <rect x="36.2" y="14" width="3.6" height="28" rx="1.8" fill="#c4c8d0" />
          <rect x="11.5" y="20" width="9" height="6" rx="1.6" fill="#1c1e24" />
          <rect x="22.5" y="30" width="9" height="6" rx="1.6" fill="#1c1e24" />
          <rect x="33.5" y="16" width="9" height="6" rx="1.6" fill="#1c1e24" />
          <circle cx="50" cy="42" r="9.6" fill="#1c1e24" />
          <path d="M 43.5 48.5 A 9.6 9.6 0 1 1 56.5 48.5" fill="none" stroke="#c4c8d0" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="50" y1="42" x2="50" y2="34.4" stroke="#fcfdfe" strokeWidth="1.8" strokeLinecap="round" />
          {/* 패치 점 — 2.2초에 걸쳐 회색에서 오렌지로 */}
          <g style={{ fill: connected ? '#f97316' : '#9ba0a8', transition: 'fill 2200ms ease' }}>
            <circle cx="16" cy="50" r="2.4" /><circle cx="24" cy="50" r="2.4" /><circle cx="32" cy="50" r="2.4" />
          </g>
        </svg>
      </div>

      <div style={{ marginTop: 20, fontSize: 28, fontWeight: 800, color: '#1c1e24', lineHeight: 1 }}>
        idea synthesizer
      </div>
      <div style={{ marginTop: 9, fontSize: 9, fontWeight: 600, letterSpacing: '0.34em', color: '#9ba0a8', textTransform: 'uppercase' }}>
        Generative Modular Workstation
      </div>

      {/* 패치 무대 — 케이블을 전원 잭에 꽂으면 부팅 */}
      <div ref={stageRef} style={{ position: 'relative', width: 480, height: 120, marginTop: 26, touchAction: 'none' }}>
        <svg width="480" height="120" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: connected ? 4 : 1 }}>
          <defs>
            {/* 금속 케이블 외피 — 검정 그림자 + 색 본체 + 흰 하이라이트 (실물 결) */}
            <radialGradient id="bootMetal" cx="40%" cy="34%" r="70%">
              <stop offset="0%" stopColor="#eef0f4" />
              <stop offset="38%" stopColor="#b8bcc4" />
              <stop offset="72%" stopColor="#6a6e76" />
              <stop offset="100%" stopColor="#2a2c32" />
            </radialGradient>
          </defs>
          {/* 케이블 — 3레이어 (그림자 / 색 본체 / 흰 하이라이트). 연결 시 2.2초에 걸쳐 오렌지로. */}
          <path d={d} fill="none" stroke="#0a0a10" strokeWidth="6" opacity="0.22" transform="translate(0 2)" strokeLinecap="round" />
          <path d={d} fill="none" stroke={cableColor} strokeWidth="4" strokeLinecap="round" style={{ transition: connected ? 'stroke 2200ms ease' : 'stroke 160ms' }} />
          <path d={d} fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.4" transform="translate(0 -1)" strokeLinecap="round" />
          {/* 고정 단자 — 금속 잭 (동심 단계) */}
          <circle cx={ANCHOR.x} cy={ANCHOR.y} r="8" fill="#3a3a42" />
          <circle cx={ANCHOR.x} cy={ANCHOR.y} r="6" fill="url(#bootMetal)" />
          <circle cx={ANCHOR.x} cy={ANCHOR.y} r="2.4" fill="#16181e" />
        </svg>

        {/* 전원 잭 (소켓) — 베벨 실버 소켓. 보어 중심이 플러그 중심(JACK.y)과 정확히 맞도록 -30 */}
        <div style={{ position: 'absolute', left: JACK.x - 30, top: JACK.y - 30, width: 60, textAlign: 'center', pointerEvents: 'none', zIndex: 2 }}>
          <svg width="60" height="60" viewBox="0 0 60 60" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
            <defs>
              <radialGradient id="jackRim" cx="38%" cy="32%" r="72%">
                <stop offset="0%" stopColor="#f2f4f7" />
                <stop offset="42%" stopColor="#c4c8d0" />
                <stop offset="76%" stopColor="#7a7e86" />
                <stop offset="100%" stopColor="#3a3e46" />
              </radialGradient>
              <radialGradient id="jackBore" cx="42%" cy="34%" r="70%">
                <stop offset="0%" stopColor="#5a5e66" />
                <stop offset="55%" stopColor="#2a2c32" />
                <stop offset="100%" stopColor="#101216" />
              </radialGradient>
            </defs>
            {/* 활성 글로우 링 */}
            <circle cx="30" cy="30" r="25" fill="none"
              stroke="#f97316" strokeWidth={near || connected ? 1.8 : 0}
              opacity={near || connected ? 0.9 : 0}
              style={{ transition: connected ? 'opacity 2200ms ease, stroke-width 2200ms ease' : 'opacity 160ms, stroke-width 160ms' }} />
            {/* 외곽 베벨 너트 (잭 패널 너트 — 위에서 본 동심) */}
            <circle cx="30" cy="30" r="21" fill="url(#jackRim)" stroke="#2a2c32" strokeWidth="0.8" />

            {connected ? (
              <>
                {/* 위에서 내려다본 — 플러그가 잭에 앉은 동심 어셈블리 */}
                {/* 널링 칼라 (위에서 본 원 + 방사 널링) */}
                <circle cx="30" cy="30" r="16" fill="url(#jackRim)" stroke="#3a3e46" strokeWidth="0.6" />
                {Array.from({ length: 36 }).map((_, k) => {
                  const a = (k / 36) * Math.PI * 2
                  return (
                    <line key={k}
                      x1={30 + Math.cos(a) * 13.5} y1={30 + Math.sin(a) * 13.5}
                      x2={30 + Math.cos(a) * 16} y2={30 + Math.sin(a) * 16}
                      stroke="#6a6e76" strokeWidth="0.6" opacity="0.6" />
                  )
                })}
                {/* 칼라 → 샤프트 스텝 */}
                <circle cx="30" cy="30" r="11" fill="url(#jackRim)" stroke="#3a3e46" strokeWidth="0.5" />
                {/* 샤프트 단면 (위에서 본 금속 원기둥 끝) */}
                <circle cx="30" cy="30" r="7" fill="url(#jackBore)" />
                <circle cx="30" cy="30" r="7" fill="none" stroke="#0a0a10" strokeWidth="0.8" opacity="0.5" />
                {/* 중심 — TS 팁 */}
                <circle cx="30" cy="30" r="2.4" fill="#16181e" />
                {/* 빛 반사 */}
                <circle cx="26.5" cy="26" r="3" fill="#ffffff" opacity="0.12" />
              </>
            ) : (
              <>
                {/* 비연결 — 빈 소켓 (보어 들여다봄) */}
                <circle cx="30" cy="30" r="15" fill="#4a4e56" />
                <circle cx="30" cy="30" r="14" fill="none" stroke="#1c1e24" strokeWidth="1" opacity="0.5" />
                <circle cx="30" cy="30" r="10.5" fill="url(#jackBore)" />
                <circle cx="30" cy="30" r="10.5" fill="none" stroke="#0a0a10" strokeWidth="1" opacity="0.6" />
              </>
            )}
          </svg>
          <div style={{ marginTop: 2, fontSize: 7.5, fontWeight: 800, letterSpacing: '0.18em', color: connected ? '#f97316' : '#8a8e96', transition: connected ? 'color 2200ms ease' : 'color 160ms' }}>
            POWER IN
          </div>
        </div>

        {/* 플러그 — 측면 뷰 (드래그 핸들). 연결 전에만 보인다; 꽂으면 잭이 위에서 본 뷰로 전환. */}
        {!connected && (
        <div
          onPointerDown={onPlugDown}
          style={{
            position: 'absolute',
            zIndex: 3,
            left: plug.x - 34, top: plug.y - 15,
            cursor: 'grab',
            touchAction: 'none',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
          }}
        >
          <svg width="68" height="30" viewBox="0 0 68 30" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="plugBarrelV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f2f4f7" />
                <stop offset="20%" stopColor="#d2d6dc" />
                <stop offset="50%" stopColor="#9498a0" />
                <stop offset="80%" stopColor="#c8ccd4" />
                <stop offset="100%" stopColor="#5a5e66" />
              </linearGradient>
            </defs>
            {/* 케이블 부트 (스트레인 릴리프) */}
            <path d="M 0 12 Q 6 11 12 9 L 18 9 L 18 21 L 12 21 Q 6 19 0 18 Z" fill="#3a3e46" />
            {/* 널링 그립 칼라 — 세로 홈 여러 줄 */}
            <rect x="16" y="5" width="20" height="20" rx="2.6" fill="url(#plugBarrelV)" stroke="#3a3e46" strokeWidth="0.7" />
            {[19, 22, 25, 28, 31, 34].map((gx) => (
              <line key={gx} x1={gx} y1="6.5" x2={gx} y2="23.5" stroke="#6a6e76" strokeWidth="0.6" opacity="0.65" />
            ))}
            {/* 스텝 링 (칼라 → 샤프트) */}
            <rect x="36" y="8" width="4" height="14" rx="1.2" fill="url(#plugBarrelV)" stroke="#3a3e46" strokeWidth="0.5" />
            {/* 샤프트 — 보어에 들어가는 금속 실린더 */}
            <rect x="40" y="9.5" width="22" height="11" rx="3" fill="url(#plugBarrelV)" stroke="#3a3e46" strokeWidth="0.5" />
            {/* 팁 — 둥근 끝 */}
            <circle cx="62" cy="15" r="4" fill="url(#plugBarrelV)" stroke="#3a3e46" strokeWidth="0.5" />
            {/* 샤프트 하이라이트 */}
            <rect x="42" y="11" width="22" height="1.4" rx="0.7" fill="#ffffff" opacity="0.5" />
          </svg>
        </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: connected ? '#f97316' : '#8a8e96', transition: 'color 200ms' }}>
        {connected ? '전원 인가 — 부팅 중…' : '케이블을 전원 잭에 연결하세요'}
      </div>

      <style>{`@keyframes logoOn {
        0% { filter: drop-shadow(0 6px 18px rgba(20,22,28,0.14)); }
        20% { filter: drop-shadow(0 0 26px rgba(249,115,22,0.5)); }
        55% { filter: drop-shadow(0 0 16px rgba(249,115,22,0.32)); }
        100% { filter: drop-shadow(0 0 22px rgba(249,115,22,0.4)); }
      }`}</style>
    </div>
  )
}

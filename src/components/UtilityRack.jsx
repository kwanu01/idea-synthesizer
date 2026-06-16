// 유틸리티 랙 — 하단 좁은 모듈 줄. 유로랙 케이스의 1U 타일 줄 결.
// PWR (백엔드 생존) · AGENT (평가 에이전트 교체) · LOG 콘솔 · 네임플레이트.
// 장식이 아니라 전부 실제 상태에 연결된 자리.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { metalPanel, INK, INK_MUTED, METAL } from '../lib/textures'
import { agentMeta, AXIS_PALETTE } from '../lib/agents'
import * as sound from '../lib/soundEngine'

// 스피커 아이콘 — on: 음파 + 앰버 점등 / off: ✕ + 잿빛 (확실한 온오프)
function SpeakerIcon({ on }) {
  const c = on ? '#1c1e24' : '#9ba0a8'
  return (
    <svg width="17" height="15" viewBox="0 0 17 15" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M2 5 H5 L9 2 V13 L5 10 H2 Z" fill={c} />
      {on ? (
        <g fill="none" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round">
          <path d="M11.5 5.2 A3 3 0 0 1 11.5 9.8" />
          <path d="M13.4 3.4 A5.6 5.6 0 0 1 13.4 11.6" />
        </g>
      ) : (
        <g stroke="#9ba0a8" strokeWidth="1.4" strokeLinecap="round">
          <line x1="11.5" y1="5" x2="15" y2="10" />
          <line x1="15" y1="5" x2="11.5" y2="10" />
        </g>
      )}
    </svg>
  )
}

function Tile({ children, width, grow = false, onClick, title }) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        width,
        flex: grow ? 1 : undefined,
        minWidth: 0,
        ...metalPanel,
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '0 10px',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 타일 볼트 2 개 (좌우) */}
      <Bolt side="left" />
      {children}
      <Bolt side="right" />
    </div>
  )
}

function Bolt({ side }) {
  return (
    <span
      style={{
        position: 'absolute',
        [side]: 3,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 38% 32%, #c8ccd4 0%, #9ba0a8 38%, #6a6e76 68%, #2a2c32 100%)',
        pointerEvents: 'none',
      }}
    />
  )
}

function TileLabel({ children }) {
  return (
    <span
      style={{
        fontSize: 7,
        fontWeight: 700,
        letterSpacing: '0.2em',
        color: INK_MUTED,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export default function UtilityRack({ backendOk = false, agentId = 'paik', logs = [], onAddData, onAgentOpinion }) {
  const meta = agentMeta(agentId)
  const latest = logs.length ? logs[logs.length - 1].text : ''
  const [logOpen, setLogOpen] = useState(false)
  const rackRef = useRef(null)
  const [anchor, setAnchor] = useState(null) // 콘솔 포털 위치 (랙 기준)
  useEffect(() => {
    if (!logOpen) return
    const place = () => {
      const r = rackRef.current?.getBoundingClientRect()
      if (r) setAnchor({ left: r.left, right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 6 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [logOpen])
  const [muted, setMutedState] = useState(sound.isMuted())
  const toggleMute = () => {
    const m = !muted
    sound.setMuted(m)
    setMutedState(m)
  }
  const scrollRef = useRef(null)
  useEffect(() => {
    if (logOpen && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [logOpen, logs.length])
  return (
    <div
      ref={rackRef}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 4,
        height: 34,
        flexShrink: 0,
        margin: '0 6px',
        zIndex: 1,
      }}
    >
      {/* PWR — 백엔드 생존 신호 */}
      <Tile width={104} title="백엔드 생존 신호">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: backendOk ? '#22c55e' : '#dc2626',
            border: `1px solid ${METAL.edge}`,
            flexShrink: 0,
          }}
        />
        <TileLabel>PWR</TileLabel>
      </Tile>

      {/* AGENT — 현재 장착된 평가 에이전트 (교체는 AGENT HEAD 의 EJECT) */}
      <Tile width={252} title={`${meta.fullName} — ${meta.subtitle}`}>
        <TileLabel>AGENT</TileLabel>
        <span
          style={{
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: 11,
            fontWeight: 700,
            color: '#06b6d4',
            letterSpacing: '0.08em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta.fullName}
        </span>
        <span style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
          {meta.axes.map((ax, i) => (
            <span
              key={i}
              title={ax}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: AXIS_PALETTE[i % AXIS_PALETTE.length],
                flexShrink: 0,
              }}
            />
          ))}
        </span>
      </Tile>

      {/* LOG — 커맨드 히스토리 콘솔 (CAD 결). 클릭 = 열림/닫힘. */}
      <Tile
        grow
        onClick={() => setLogOpen((v) => !v)}
        title={logOpen ? '콘솔 닫기' : '작업 기록 콘솔 열기 — 변형·합성·믹스다운의 히스토리'}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: INK_MUTED,
            flexShrink: 0,
            marginLeft: 8,
          }}
        >
          LOG
        </span>
        <span style={{ fontSize: 8, color: METAL.recess, flexShrink: 0 }}>{logOpen ? '▾' : '▴'}</span>
        <span
          key={latest}
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: 9.5,
            fontWeight: 600,
            color: latest ? '#b45309' : METAL.recess,
            letterSpacing: '0.03em',
            lineHeight: '34px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            animation: latest ? 'logIn 350ms ease' : 'none',
          }}
        >
          {latest || 'IDLE — 회로가 움직이면 여기에 기록된다'}
        </span>
        <style>{`@keyframes logIn { 0% { opacity: 0; transform: translateY(3px) } 100% { opacity: 1; transform: translateY(0) } }`}</style>
      </Tile>

      {/* 콘솔 패널 — body 포털. 케이블 오버레이(z:50)보다 위에 떠야 하므로
          랙 안이 아니라 최상위에 산다 (anchor 로 랙 위에 정렬). */}
      {logOpen && anchor && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: anchor.bottom,
            left: anchor.left,
            right: anchor.right,
            height: 200,
            background: '#16181e',
            border: `1px solid ${METAL.edge}`,
            borderRadius: 4,
            zIndex: 320,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            cursor: 'default',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 10px',
              background: 'linear-gradient(180deg, #f0f2f5 0%, #e3e5ea 100%)',
              borderBottom: `1px solid ${METAL.recess}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', color: '#2a2a32' }}>
              COMMAND HISTORY
            </span>
            <button
              onClick={() => setLogOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 9, fontWeight: 700, color: '#6a6a72', letterSpacing: '0.1em',
              }}
            >
              닫기 ✕
            </button>
          </div>
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '7px 10px',
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: 9.5,
              lineHeight: 1.8,
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: '#4a4e56' }}>기록 없음 — 분석·변형·합성이 흐르면 여기에 쌓인다.</div>
            ) : (
              logs.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, color: i === logs.length - 1 ? '#fbbf24' : '#8a8e96' }}>
                  <span style={{ flexShrink: 0, color: '#4a4e56' }}>
                    {new Date(l.time).toLocaleTimeString('ko-KR', { hour12: false })}
                  </span>
                  <span style={{ wordBreak: 'break-all' }}>{l.text}</span>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 노드 추가 — 사용자가 별도로 넣는 추가 텍스트. 떠다니는 개별 창(노드)이 된다. */}
      <Tile width={96} onClick={onAddData} title="내 텍스트를 새 노드로 추가 — 떠다니는 창, OUT 잭으로 회로에 꽂는다">
        <span style={{ fontSize: 11, fontWeight: 700, color: '#2a2a32', lineHeight: 1 }}>+</span>
        <TileLabel>노드 추가</TileLabel>
      </Tile>

      {/* 에이전트 피드백 — 장착된 에이전트가 본인 목소리로 아이디어에 건네는 말. */}
      <Tile width={112} onClick={onAgentOpinion} title={`${meta.fullName} 본인의 목소리로 아이디어에 피드백 (변형이 아니라 대화)`}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
        <TileLabel>에이전트 피드백</TileLabel>
      </Tile>

      {/* SOUND — 회로의 소리 (드론·틱·해결음·부팅음). 클릭 = 스피커 토글. */}
      <Tile
        width={108}
        onClick={toggleMute}
        title={muted ? '소리 켜기 — 회로의 상태가 소리가 된다' : '소리 끄기'}
      >
        <SpeakerIcon on={!muted} />
        <span
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: muted ? '#a0a3a8' : '#2a2a32',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          SOUND
        </span>
      </Tile>

      {/* 네임플레이트 */}
      <Tile width={300} title="Idea Synthesizer">
        <TileLabel>IDEA SYNTHESIZER</TileLabel>
        <span
          style={{
            fontSize: 7,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: METAL.recess,
            whiteSpace: 'nowrap',
          }}
        >
          MODULAR WORKSTATION · 2026
        </span>
      </Tile>

      {/* 블랭크 패널 (우측 끝) */}
      <Tile width={64} />
    </div>
  )
}

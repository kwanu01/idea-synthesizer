// AGENT HEAD — 신디사이저의 머리. 평가·분석의 기준이 되는 사상가 카드 슬롯.
// 실제 신디사이저의 보이스 카드/롬팩 교체 논리를 모방:
//   EJECT (카드가 위로 빠짐) → 빈 슬롯 (NO AGENT) → INSERT (새 카드 장착) → BOOT (축 LED 점등)
// 교체 중에는 모든 평가가 새 기준으로 다시 흐른다.

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { INK, INK_MUTED, METAL } from '../lib/textures'
import { AGENTS, agentMeta, nextAgentId, AXIS_PALETTE } from '../lib/agents'

const PHASE_MS = { eject: 550, empty: 500, insert: 550, boot: 950 }

export default function AgentHead({ agentId, onAgentChange, extraAgents = [], onAgentBuilt }) {
  const [phase, setPhase] = useState('idle') // idle | eject | empty | insert | boot
  const [libOpen, setLibOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const slotRef = useRef(null)
  const openLib = () => {
    const r = slotRef.current?.getBoundingClientRect()
    if (r) setAnchor({ left: r.left, top: r.bottom + 6 })
    setLibOpen(true)
  }
  const timers = useRef([])
  const meta = agentMeta(agentId, extraAgents)
  const allAgents = [...AGENTS, ...extraAgents]

  const swap = (targetId) => {
    if (phase !== 'idle') return
    const next = targetId || nextAgentId(agentId)
    if (next === agentId) return
    setPhase('eject')
    const later = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    later(PHASE_MS.eject, () => {
      onAgentChange(next) // 빈 슬롯 순간에 실제 교체
      setPhase('empty')
    })
    later(PHASE_MS.eject + PHASE_MS.empty, () => setPhase('insert'))
    later(PHASE_MS.eject + PHASE_MS.empty + PHASE_MS.insert, () => setPhase('boot'))
    later(
      PHASE_MS.eject + PHASE_MS.empty + PHASE_MS.insert + PHASE_MS.boot,
      () => setPhase('idle')
    )
  }

  // 카드 transform — eject 위로 사라짐 / insert 위에서 내려옴
  const cardStyle = {
    eject: { transform: 'translateY(-110%)', transition: `transform ${PHASE_MS.eject}ms cubic-bezier(0.5,0,0.9,0.4)` },
    empty: { transform: 'translateY(-110%)', transition: 'none' },
    insert: { transform: 'translateY(0)', transition: `transform ${PHASE_MS.insert}ms cubic-bezier(0.1,0.7,0.3,1)` },
    boot: { transform: 'translateY(0)' },
    idle: { transform: 'translateY(0)' },
  }[phase]

  const showCard = phase !== 'empty'
  const booting = phase === 'boot'

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
      {/* 슬롯 — 어두운 음각 자리 */}
      <div
        ref={slotRef}
        style={{
          position: 'relative',
          background: '#3a3a42',
          border: `1px solid ${METAL.edge}`,
          borderRadius: 4,
          padding: 3,
          overflow: 'hidden',
          boxShadow: 'inset 0 2px 3px rgba(10,10,16,0.6)',
        }}
      >
        {/* 빈 슬롯 — 접점 핀이 드러난다 (카트리지가 빠졌다는 물리적 증거) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: 14 }, (_, i) => (
              <span
                key={i}
                style={{
                  width: 4,
                  height: 12,
                  background: 'linear-gradient(180deg, #c8ccd4 0%, #6a6e76 100%)',
                  borderRadius: '0 0 1px 1px',
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.3em',
              color: '#8a8e96',
              textTransform: 'uppercase',
            }}
          >
            NO AGENT
          </span>
        </div>

        {/* 에이전트 카드 — 클릭 = 라이브러리 (직접 선택 + 관점 보기) */}
        {showCard && (
          <div
            key={agentId}
            onClick={() => phase === 'idle' && openLib()}
            title={`${meta.desc}\n\n[클릭] 에이전트 라이브러리 — 직접 선택`}
            style={{
              cursor: phase === 'idle' ? 'pointer' : 'default',
              position: 'relative',
              background: '#161820',
              border: '1px solid #2a2c32',
              borderRadius: 3,
              padding: '7px 9px 6px',
              ...cardStyle,
            }}
          >
            {/* 카드 상단 — 색 코드 + 그립 홈 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <span style={{ width: 8, height: 8, background: meta.color, flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: '#f0f0f2',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                }}
              >
                {meta.fullName}
              </span>
              {/* 그립 홈 3 줄 */}
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 14, height: 1.5, background: '#3a3a42' }} />
                ))}
              </span>
            </div>
            <div
              style={{
                fontSize: 8,
                letterSpacing: '0.1em',
                color: '#8a8e96',
                marginBottom: 5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {meta.subtitle} · {meta.axes.length} AXES
            </div>
            {/* 축 LED — 부팅 시 차례로 점등 */}
            <div style={{ display: 'flex', gap: 4 }}>
              {meta.axes.map((ax, i) => (
                <span
                  key={`${agentId}-${i}-${booting}`}
                  title={ax}
                  style={{
                    flex: 1,
                    height: 4,
                    background: AXIS_PALETTE[i % AXIS_PALETTE.length],
                    opacity: booting ? 0 : 1,
                    animation: booting
                      ? `agentBoot 160ms ${i * 90}ms steps(1) forwards`
                      : 'none',
                  }}
                />
              ))}
            </div>
            <style>{`@keyframes agentBoot { to { opacity: 1 } }`}</style>
          </div>
        )}
      </div>

      {/* 슬롯 하단 — 진행 상태 + EJECT 버튼. 무슨 일이 일어나는지 말로도 보인다. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: phase === 'idle' ? INK_MUTED : '#dc2626',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {{
            idle: 'AGENT HEAD · READY',
            eject: '▲ EJECTING CARTRIDGE…',
            empty: 'SLOT EMPTY',
            insert: `▼ LOADING ${meta.fullName}…`,
            boot: `BOOTING ${meta.fullName} — AXES ONLINE`,
          }[phase]}
        </span>
      </div>

      {/* 에이전트 선택 — body 포털 (어떤 스태킹 컨텍스트보다 위) */}
      {libOpen &&
        createPortal(
        <>
          <div
            onClick={() => setLibOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9990 }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: anchor?.left ?? 24,
              top: anchor?.top ?? 100,
              width: Math.min(640, window.innerWidth - (anchor?.left ?? 24) - 20),
              zIndex: 9991,
              maxHeight: Math.min(480, window.innerHeight - (anchor?.top ?? 100) - 20),
              overflowY: 'auto',
              background: '#fafbfc',
              border: '1px solid #c8cbd2',
              borderRadius: 6,
              padding: '10px 10px 6px',
              boxShadow: '0 10px 28px rgba(20,22,28,0.22)',
            }}
          >
            <div style={{ fontSize: 8.5, fontWeight: 600, color: INK_MUTED, marginBottom: 8 }}>
              에이전트 선택 — 분석·변형·평가의 기준이 통째로 바뀐다
            </div>
            {allAgents.map((a) => {
              const current = a.id === agentId
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    setLibOpen(false)
                    if (!current) swap(a.id)
                  }}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    background: '#161820',
                    border: `1px solid ${current ? a.color : '#2a2c32'}`,
                    borderRadius: 4,
                    padding: '11px 13px',
                    marginBottom: 8,
                    cursor: current ? 'default' : 'pointer',
                    opacity: current ? 1 : 0.92,
                  }}
                >
                  {/* 초상 — public/agents/photos/<id>.jpg 를 넣으면 표시 (없으면 이니셜) */}
                  <div
                    style={{
                      position: 'relative',
                      width: 64,
                      height: 64,
                      flexShrink: 0,
                      borderRadius: 4,
                      overflow: 'hidden',
                      background: '#2a2c32',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ position: 'absolute', fontSize: 22, fontWeight: 800, color: '#5a5e68' }}>
                      {a.fullName[0]}
                    </span>
                    <img
                      src={a.photo}
                      alt={a.fullName}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                      style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 9, height: 9, background: a.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#f0f0f2' }}>
                      {a.fullName}
                    </span>
                    <span style={{ fontSize: 8.5, color: '#8a8e96', letterSpacing: '0.06em' }}>
                      {a.subtitle}
                    </span>
                    {current && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 7.5,
                          fontWeight: 800,
                          letterSpacing: '0.2em',
                          color: a.color,
                        }}
                      >
                        ● LOADED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#b8bcc4', lineHeight: 1.55, wordBreak: 'keep-all' }}>
                    {a.desc}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                    {a.axes.map((ax, i) => (
                      <span
                        key={ax}
                        style={{
                          fontSize: 8,
                          fontWeight: 600,
                          color: '#0a0a10',
                          background: AXIS_PALETTE[i % AXIS_PALETTE.length],
                          borderRadius: 2,
                          padding: '1.5px 6px',
                          lineHeight: 1.4,
                        }}
                      >
                        {ax}
                      </span>
                    ))}
                  </div>
                  </div>
                </div>
              )
            })}

            {/* 내 글로 굽기 — 관객의 사유가 악기의 머리가 되는 자리 */}
            <BurnCard
              onBuilt={(summary) => {
                onAgentBuilt?.(summary)
                setLibOpen(false)
                swap(summary.id)
              }}
            />
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ── 내 글로 굽기 — 글을 붙여넣으면 build 파이프라인이 서버에서 돈다 ──
// 임베딩 → KMeans → gpt-4o 명명 → voice. 20~40초. 이 시간은 숨기지 않는다 —
// 카트리지가 구워지는 시간이고, 진행 라벨이 그 단계를 그대로 말한다.
function BurnCard({ onBuilt }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const burn = async () => {
    if (busy || !text.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch('/api/build-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'MY AGENT', text }),
      })
      if (r.status === 404) throw new Error('백엔드 재시작 필요 — python3 synth/server.py')
      const data = await r.json()
      if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`)
      setBusy(false)
      setOpen(false)
      setName('')
      setText('')
      onBuilt?.(data.agent)
    } catch (e) {
      setBusy(false)
      setErr(String(e.message || e))
    }
  }

  const field = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#0d0e13',
    border: '1px solid #2a2c32',
    borderRadius: 3,
    color: '#dde0e4',
    fontSize: 10.5,
    fontFamily: '"Share Tech Mono", ui-monospace, monospace',
    padding: '6px 8px',
    outline: 'none',
    resize: 'none',
  }

  return (
    <div
      style={{
        background: '#161820',
        border: '1px dashed #3a3e46',
        borderRadius: 4,
        padding: '11px 13px',
        marginBottom: 2,
      }}
    >
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          title="당신의 글(메모·일기·생각 8문장 이상)로 새 에이전트를 만든다 — 임베딩→클러스터→명명→어휘, 약 30초"
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 400, color: '#8a8e96', lineHeight: 1 }}>+</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#c8ccd4' }}>
              NEW AGENT — 내 글로 만들기
            </span>
            <span style={{ fontSize: 9, color: '#8a8e96', lineHeight: 1.4, wordBreak: 'keep-all' }}>
              당신의 사유가 이 악기의 머리가 된다
            </span>
          </span>
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="에이전트 이름 (예: 나, 2026 봄)"
            maxLength={24}
            disabled={busy}
            style={field}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'당신의 생각을 붙여넣으세요 — 메모, 일기, 작업 노트 무엇이든.\n최소 8문장. 문장이 많고 결이 다양할수록 좋은 축이 나옵니다.'}
            rows={6}
            disabled={busy}
            spellCheck={false}
            style={{ ...field, lineHeight: 1.55 }}
          />
          {err && (
            <div style={{ fontSize: 9, color: '#dc2626', lineHeight: 1.4, wordBreak: 'keep-all' }}>{err}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={burn}
              disabled={busy || !text.trim()}
              title="생성 시작 — 임베딩 → 클러스터링 → 축 명명 → 어휘 생성"
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.12em',
                fontFamily: 'inherit',
                color: busy ? '#f97316' : '#0a0a10',
                background: busy ? '#1c1e24' : '#f97316',
                border: '1px solid #f97316',
                borderRadius: 3,
                padding: '6px 14px',
                cursor: busy || !text.trim() ? 'default' : 'pointer',
                opacity: !text.trim() && !busy ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {busy ? 'BUILDING…' : '⊕ BUILD'}
            </button>
            {busy ? (
              <span style={{ fontSize: 8.5, color: '#8a8e96', lineHeight: 1.4 }}>
                임베딩 → 클러스터 → 명명 → 어휘 — 에이전트 생성 중 (약 30초)
              </span>
            ) : (
              <button
                onClick={() => { setOpen(false); setErr(null) }}
                style={{
                  fontSize: 9,
                  color: '#8a8e96',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                닫기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

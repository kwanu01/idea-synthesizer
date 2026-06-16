// OUTPUT 두 기둥 — 모든 뷰는 이펙터처럼 상단 잭 스트립을 가진 독립 모듈이다.
//
//   MONITOR (왼쪽)  : DIAGRAM (IN: 노드/이펙터 신호 — 꽂으면 그 신호만 포커스,
//                     비우면 전체 표시) + VISION (IN: OUTPUT 의 OUT — 패치가 전원)
//   OUTPUT  (오른쪽) : STATEMENT — IN (신호가 모이는 곳) · OUT (완성된 출력 송출).
//                     텍스트는 상하로 쭉. GEN 띠·SIG 카운터도 여기.
//
// 뷰가 창으로 떼어져도(float) 잭과 컨트롤은 랙에 남는다 — 케이블은 랙의 것이다.

import { useRef } from 'react'
import { METAL, INK_MUTED } from '../../lib/textures'
import RackModule from '../RackModule'
import Jack from '../parts/Jack'
import Diagram from '../Diagram'
import { diffNewWords } from '../../lib/diffWords'

// ── 공통 모듈 셸 — 잭 스트립(상단) + 라벨 밴드 + 본문 ──
function ModuleShell({ jacks = [], label, ko, buttons, children, style }) {
  const { flex, minHeight, height } = style || {}
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #c2c5cc',
        borderRadius: 3,
        overflow: 'hidden',
        flexShrink: height ? 0 : 1,
        flex,
        minHeight,
        height,
      }}
    >
      {/* 잭 스트립 — 잭이 있을 때만 (이펙터와 같은 문법: 둥근 잭 박스) */}
      {jacks.length > 0 && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 7px 3px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#3a3a42',
            borderRadius: 18,
            padding: '4px 12px 3px',
          }}
        >
          {jacks.map((j) => (
            <div key={j.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Jack id={j.id} size={20} onDragStart={j.onDown} onDragEnd={j.onUp} />
              <span
                style={{
                  fontSize: 6,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  color: '#c8c8d0',
                  fontFamily: '"Share Tech Mono", monospace',
                }}
              >
                {j.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* 라벨 밴드 — 패널 인쇄 (이펙터 라벨 밴드와 동일 문법) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          height: 20,
          flexShrink: 0,
          padding: '0 7px',
          background: 'linear-gradient(180deg, #f0f2f5 0%, #e3e5ea 100%)',
          borderBottom: '1px solid #cdd0d6',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
        <span
          style={{
            fontSize: 7.5,
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: '#2a2a32',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        {ko && (
          <span style={{ fontSize: 6.5, fontWeight: 600, color: '#8a8e96', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {ko}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          {buttons}
        </span>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}

export function PaneBtn({ children, onClick, title, active = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#dde0e5' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
      style={{
        background: active ? '#1c1e24' : 'transparent',
        border: `1px solid ${active ? '#1c1e24' : '#c2c5cc'}`,
        borderRadius: 2,
        color: active ? '#f97316' : '#52525c',
        cursor: 'pointer',
        fontSize: 7.5,
        fontWeight: 700,
        padding: '1px 5px',
        lineHeight: 1.4,
        letterSpacing: '0.06em',
        transition: 'background 120ms',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

// 비율 — 정사각 → 가로 → 세로 순환
const RATIO_LABEL = { square: '⬚ 1:1', wide: '▭ 16:9', tall: '▯ 9:16' }
const RATIO_NEXT = { square: 'wide', wide: 'tall', tall: 'square' }

// ── VISION 컨트롤 — 도크와 플로팅 창이 공유한다 ──
// ⟳ 시안 = 선언문에서 장면 후보 셋을 받는다 (이미지 생성은 카드 클릭에서).
export function VisionControls({ vision, visionConnected, onVisionCode, onVisionRatio, onRequestVisionOptions, agentName }) {
  const working = vision.optBusy || vision.busy
  const ratio = vision.ratio || 'square'
  return (
    <>
      <PaneBtn
        onClick={() => onVisionRatio?.(RATIO_NEXT[ratio])}
        title="생성 비율 — 정사각 / 가로 / 세로 (클릭해 전환)"
      >
        {RATIO_LABEL[ratio]}
      </PaneBtn>
      {[['aesthetic', '화풍'], ['thought', '사유']].map(([c, label]) => (
        <PaneBtn
          key={c}
          active={vision.code === c}
          onClick={() => onVisionCode?.(c)}
          title={
            c === 'aesthetic'
              ? `화풍 필터 — ${agentName} 작품의 화면 미감(색·빛·질감)으로 그린다`
              : `사유 필터 — ${agentName}의 사상(개념·태도)으로 장면을 구성한다`
          }
        >
          {label}
        </PaneBtn>
      ))}
      <PaneBtn
        onClick={visionConnected && !working ? onRequestVisionOptions : undefined}
        title={
          !visionConnected
            ? 'OUTPUT 의 OUT 잭을 VISUALIZE 의 IN 에 꽂아야 작동한다'
            : '구상 — 현재 출력(선언문)에서 장면 후보 셋을 받는다. 고른 장면만 이미지가 된다.'
        }
      >
        {vision.optBusy ? '…' : '⟳ 구상'}
      </PaneBtn>
      {vision.image && (
        <PaneBtn
          onClick={() => {
            const a = document.createElement('a')
            a.href = vision.image; a.download = `idea-synth-vision-${Date.now()}.png`
            document.body.appendChild(a); a.click(); a.remove()
          }}
          title="이미지를 PNG 로 저장"
        >
          ↓
        </PaneBtn>
      )}
    </>
  )
}

// ── 장면 시안 카드 ── (full: 라벨+장면+분위기 / compact: 라벨 칩)
function OptionCard({ o, i, selected, busy, compact, onClick }) {
  return (
    <button
      onClick={onClick}
      title={`${o.label} — ${o.scene}`}
      style={{
        flexShrink: 0, textAlign: 'left', cursor: 'pointer',
        background: selected ? '#1c1e24' : '#15171d',
        border: `1px solid ${selected ? '#f97316' : '#2a2e38'}`,
        borderRadius: 3, color: '#cfd3da', fontFamily: 'inherit',
        padding: compact ? '4px 8px' : '7px 9px',
        width: compact ? 'auto' : '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: compact ? 0 : 3,
        opacity: busy ? 0.5 : 1, transition: 'border-color 140ms, background 140ms',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = '#4a4e58' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = '#2a2e38' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em', color: '#eef0f4', whiteSpace: 'nowrap' }}>
          {o.label}
        </span>
        {busy && <span style={{ marginLeft: 'auto', fontSize: 7, color: '#f97316', fontFamily: '"Share Tech Mono", monospace' }}>RENDER…</span>}
      </span>
      {!compact && (
        <>
          <span style={{ fontSize: 8.5, lineHeight: 1.5, color: '#aab0ba', wordBreak: 'keep-all' }}>{o.scene}</span>
          {o.mood && (
            <span style={{ fontSize: 7, color: '#6f7480', fontFamily: '"Share Tech Mono", monospace', wordBreak: 'keep-all' }}>
              {o.mood}
            </span>
          )}
        </>
      )}
    </button>
  )
}

// ── VISION 본문 — 시안 카드 / 렌더 중 / 이미지. 도크·플로팅이 공유. ──
export function VisionBody({ vision, visionConnected, onRenderVision, onOpenVisionLightbox, cover = false }) {
  const { image, busy, optBusy, options = [], sel } = vision
  const hasOpts = options.length > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0e13', position: 'relative' }}>
      {/* 시안 카드 — 이미지 없으면 전면(세로 스택), 있으면 상단 칩 줄 */}
      {hasOpts && (
        <div
          style={
            image
              ? { display: 'flex', gap: 5, padding: '6px 8px', overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid #1c1e24' }
              : { display: 'flex', flexDirection: 'column', gap: 5, padding: 9, flex: 1, minHeight: 0, overflowY: 'auto' }
          }
        >
          {!image && (
            <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.16em', color: '#6f7480', fontFamily: '"Share Tech Mono", monospace', marginBottom: 1 }}>
              장면 구상 — 하나를 고르면 이미지가 된다
            </span>
          )}
          {options.map((o, i) => (
            <OptionCard
              key={i}
              o={o}
              i={i}
              compact={!!image}
              selected={sel === i}
              busy={busy && sel === i}
              onClick={() => !busy && onRenderVision?.(o, i)}
            />
          ))}
        </div>
      )}

      {/* 이미지 / 안내 — 시안 없거나 이미지 있을 때 */}
      {(image || !hasOpts) && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {image ? (
            <img
              src={image}
              alt="VISUALIZE 출력"
              onClick={() => onOpenVisionLightbox?.()}
              title="클릭 — 크게 보기"
              style={{
                width: cover ? '100%' : undefined, height: cover ? '100%' : undefined,
                maxWidth: cover ? undefined : '100%', maxHeight: cover ? undefined : '100%',
                objectFit: cover ? 'cover' : 'contain', cursor: 'pointer',
                opacity: busy ? 0.4 : 1, transition: 'opacity 300ms',
              }}
            />
          ) : (
            <span
              style={{
                fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', color: '#3a3e48',
                fontFamily: '"Share Tech Mono", monospace', textAlign: 'center',
                lineHeight: 2, padding: '0 16px', wordBreak: 'keep-all',
              }}
            >
              {!visionConnected
                ? 'OUTPUT 의 OUT → 이 모듈의 IN 을 패치하면 켜진다'
                : optBusy
                  ? '구상 중 — 장면 후보를 뽑는 중…'
                  : '⟳ 구상 — 선언문에서 장면 후보를 받는다'}
            </span>
          )}
          {(busy || optBusy) && (
            <span style={{ position: 'absolute', bottom: 8, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#f97316', animation: 'visionBlink 600ms steps(1) infinite' }} />
          )}
        </div>
      )}
      <style>{`@keyframes visionBlink { 50% { opacity: 0.2 } }`}</style>
    </div>
  )
}

// ════ 왼쪽 기둥 — MONITOR: DIAGRAM + VISION ════
export function MonitorColumn({
  nodes = [],
  edges = [],
  outputs = {},
  chainLens = {},
  qualityAvg = {},
  agentColor = '#fbbf24',
  focusIds = null,
  cables = [],
  windows,
  onFloat,
  onCloseWin,
  onOpenDiagram,
  vision,
  visionConnected,
  onVisionCode,
  onVisionRatio,
  onRenderVision,
  onRequestVisionOptions,
  onOpenVisionLightbox,
  agentName = '',
  onJackDown,
  onJackUp,
}) {
  const docked = (key) => windows[key] === 'docked'
  // 기둥에 도크된 뷰가 하나도 없으면 기둥 자체가 빠진다 → EFFECTORS 가 넓어진다
  if (!docked('diagram') && !docked('vision')) return null
  return (
    <RackModule title="MONITOR" width={274} style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', minHeight: 0 }}>
        {/* DIAGRAM — IN: 노드/이펙터 신호를 꽂으면 그 신호만 포커스 (모니터 셀렉터) */}
        {docked('diagram') && (
          <ModuleShell
            style={{ flex: 1.35, minHeight: 0 }}
            jacks={[]}
            label="DIAGRAM"
            buttons={
              <>
                <PaneBtn title="다이어그램 크게 — 원점 화면 (Esc 닫기)" onClick={onOpenDiagram}>⛶</PaneBtn>
                <PaneBtn title="창으로 띄우기" onClick={() => onFloat?.('diagram')}>⬈</PaneBtn>
                <PaneBtn title="닫기 (VIEW 메뉴에서 다시 열기)" onClick={() => onCloseWin?.('diagram')}>✕</PaneBtn>
              </>
            }
          >
            <Diagram
              nodes={nodes}
              edges={edges}
              outputs={outputs}
              chainLens={chainLens}
              qualityAvg={qualityAvg}
              agentColor={agentColor}
              focusIds={focusIds}
              cables={cables}
              big
            />
          </ModuleShell>
        )}

        {/* VISION — IN: OUTPUT 의 OUT 을 받는다. 패치가 전원. */}
        {docked('vision') && (
          <ModuleShell
            style={{ height: 252 }}
            jacks={[{ id: 'VISION-IN', label: 'IN', onDown: onJackDown, onUp: onJackUp }]}
            label="VISUALIZE"
            buttons={
              <>
                <VisionControls
                  vision={vision}
                  visionConnected={visionConnected}
                  onVisionCode={onVisionCode}
                  onVisionRatio={onVisionRatio}
                  onRequestVisionOptions={onRequestVisionOptions}
                  agentName={agentName}
                />
                <PaneBtn title="창으로 띄우기" onClick={() => onFloat?.('vision')}>⬈</PaneBtn>
                <PaneBtn title="닫기" onClick={() => onCloseWin?.('vision')}>✕</PaneBtn>
              </>
            }
          >
            <VisionBody
              vision={vision}
              visionConnected={visionConnected}
              onRenderVision={onRenderVision}
              onOpenVisionLightbox={onOpenVisionLightbox}
              cover
            />
          </ModuleShell>
        )}

      </div>
    </RackModule>
  )
}

// ── PANEL 본문 — 그래스호퍼 패널: 패치된 지점의 중간 내용 표시 (플로팅 창에서 공유) ──
export function PanelBody({ panelText = '', panelLabel = '', panelConnected = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#0e1014' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderBottom: '1px solid #23262e', flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', color: '#8a8e96', fontFamily: '"Share Tech Mono", monospace' }}>PANEL</span>
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: panelConnected ? '#f7b27a' : '#5a5e66', fontFamily: '"Share Tech Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {panelConnected ? (panelLabel || 'SIGNAL') : '미연결'}
        </span>
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px',
        fontFamily: '"Share Tech Mono", monospace', fontSize: 12, lineHeight: 1.6,
        color: panelText ? '#e6e9ef' : '#5a5e66', whiteSpace: 'pre-wrap', wordBreak: 'keep-all',
      }}>
        {panelConnected
          ? (panelText || '신호가 아직 비어 있다 — 회로가 정착하면 이 지점의 내용이 흐른다.')
          : '노드나 이펙터의 OUT 을 PANEL 의 IN 잭에 꽂으면, 그 지점에 흐르는 중간 내용이 여기 실시간으로 보인다. (그래스호퍼 패널) VENTURE 를 돌릴 때마다 이 내용이 그 도약의 실제 결과로 바뀐다.'}
      </div>
    </div>
  )
}

// ════ 오른쪽 기둥 — OUTPUT: STATEMENT (상하로 쭉) ════
export function OutputColumn({
  nodes = [],
  master = { statement: null, busy: false, error: null },
  audibleCount = 0,
  windows,
  onFloat,
  onCloseWin,
  onJackDown,
  onJackUp,
  onAgentFeedback,
  agentName = '',
  masterAlts = { busy: false, list: [] },
  onMasterVariations,
  onPickStatement,
  recomputing = false,
}) {
  const docked = windows.statement === 'docked'
  // 도크 해제 시 기둥 자체가 빠진다 → EFFECTORS 가 넓어진다
  if (!docked) return null
  return (
    <RackModule title="OUTPUT" width={256} style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', minHeight: 0 }}>
        <ModuleShell
          style={{ flex: 1, minHeight: 0 }}
          jacks={[
            { id: 'OUT-IN', label: 'IN', onDown: onJackDown, onUp: onJackUp },
            { id: 'OUT-SEND', label: 'OUT', onDown: onJackDown, onUp: onJackUp },
          ]}
          label={master.busy ? 'STATEMENT…' : 'STATEMENT'}
          buttons={
            <>
              {/* 재합성 펄스 — 조작 즉시 켜져 행동을 인정한다 (결과는 곧 따라온다) */}
              {recomputing && (
                <>
                  <style>{'@keyframes recompulse{50%{opacity:.2}}'}</style>
                  <span title="재합성 중 — 회로의 변화가 출력으로 흐르는 중"
                    style={{ width: 7, height: 7, borderRadius: '50%', background: '#f97316', animation: 'recompulse 560ms steps(1) infinite' }} />
                </>
              )}
              {/* SIG — 출력에 도달한 신호 수 */}
              <span
                title={`출력에 도달한 신호 ${audibleCount} / 전체 ${nodes.length}`}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 3,
                  fontFamily: '"DSEG7 Classic", monospace', fontStyle: 'italic',
                  fontSize: 10, color: audibleCount > 0 ? '#b45309' : '#a0a3a8',
                }}
              >
                {String(audibleCount).padStart(2, '0')}
                <span style={{ fontSize: 6, fontWeight: 700, letterSpacing: '0.1em', color: '#8a8e96', fontStyle: 'normal', fontFamily: 'inherit' }}>SIG</span>
              </span>
              <PaneBtn title="창으로 띄우기" onClick={() => onFloat?.('statement')}>⬈</PaneBtn>
              <PaneBtn title="닫기" onClick={() => onCloseWin?.('statement')}>✕</PaneBtn>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#161820' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 11px 9px' }}>
              {masterAlts.list.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', color: '#f7b27a', fontFamily: '"Share Tech Mono", monospace' }}>다른 종합 — 하나를 고른다</span>
                    <button onClick={() => onPickStatement?.(master.statement || '')} title="닫기" style={{ background: 'none', border: 'none', color: '#8a8e96', cursor: 'pointer', fontSize: 9 }}>✕</button>
                  </div>
                  {masterAlts.list.map((s, i) => (
                    <button key={i} onClick={() => onPickStatement?.(s)} title="이 종합을 채택"
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f97316' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2e323c' }}
                      style={{
                        textAlign: 'left', background: '#15171d', border: '1px solid #2e323c', borderRadius: 4,
                        color: '#dfe3ea', padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 11, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'keep-all',
                        transition: 'border-color 140ms',
                      }}>
                      {s.length > 200 ? s.slice(0, 200) + '…' : s}
                    </button>
                  ))}
                </div>
              ) : master.error ? (
                <p style={{ ...bodyText, color: '#dc2626' }}>{master.error}</p>
              ) : master.statement ? (
                <StatementBody statement={master.statement} busy={master.busy} />
              ) : (
                <p style={{ ...bodyText, color: '#4a4e56' }}>
                  {audibleCount ? (master.busy ? '' : '회로가 정착하면 선언문이 여기에 맺힌다.') : 'AWAITING SIGNAL — 출력에 연결된 신호가 없다'}
                </p>
              )}
            </div>
          </div>
        </ModuleShell>
      </div>
    </RackModule>
  )
}

// STATEMENT 본문 — 재합성될 때 바뀐 구간이 오렌지로 빛났다 잦아든다 (조작의 실감).
function StatementBody({ statement, busy }) {
  const prevRef = useRef('')
  const segsRef = useRef([{ text: statement, changed: false }])
  if (prevRef.current !== statement) {
    segsRef.current = diffNewWords(prevRef.current, statement)
    prevRef.current = statement
  }
  return (
    <p style={{ ...bodyText, opacity: busy ? 0.45 : 1 }}>
      {segsRef.current.map((seg, i) =>
        seg.changed ? (
          <span key={`${i}-${seg.text.length}`} style={{ animation: 'diffGlow 3.5s ease forwards', borderRadius: 2 }}>
            {seg.text}
          </span>
        ) : (
          seg.text
        )
      )}
      <style>{`@keyframes diffGlow {
        0% { background: rgba(249,115,22,0.45); color: #ffd9b8; }
        60% { background: rgba(249,115,22,0.18); }
        100% { background: transparent; color: inherit; }
      }`}</style>
    </p>
  )
}

const bodyText = {
  fontFamily: '"Share Tech Mono", ui-monospace, monospace',
  fontSize: 10.5,
  lineHeight: 1.65,
  letterSpacing: '0.02em',
  color: '#e6e8ee',
  whiteSpace: 'pre-wrap',
  wordBreak: 'keep-all',
  margin: 0,
  marginTop: 4,
  transition: 'opacity 250ms',
}

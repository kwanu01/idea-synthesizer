// INPUT 이펙터 — 에이전트 자리.
// 분석 전: textarea (placeholder = ver1 sampleConversation) + ANALYZE 푸시
// 분석 후: 노드 카드 리스트 (각 카드 우측 OUT 잭 — 이펙터로 패치)

import { useEffect, useRef } from 'react'
import { INK, INK_MUTED, METAL, metalPanel } from '../../lib/textures'
import RackModule from '../RackModule'
import Jack from '../parts/Jack'
import Knob from '../parts/Knob'
import AgentHead from '../AgentHead'

// 합성 모드 시그니처 색 (02_system_spec 고정)
const MODE_COLORS = {
  stacking: '#9ba0a8',
  carving: '#9ba0a8',
  modulation: '#9ba0a8',
  morphing: '#9ba0a8',
  fragmentation: '#9ba0a8',
  blending: '#9ba0a8',
}
const MODE_KO = {
  stacking: '쌓기',
  carving: '깎기',
  modulation: '변조',
  morphing: '변형',
  fragmentation: '분쇄',
  blending: '균형',
}

export default function InputEffector({
  text,
  onTextChange,
  onAnalyze,
  onLoadSample,
  onClear,
  analyzing,
  nodes = [],
  edges = [],
  onJackDown,
  onJackUp,
  onAddInput,
  agentId,
  onAgentChange,
  agentInfluence = 0,
  onAgentInfluence,
  onAutoPatch,
  patchPulse = false,
  extraAgents = [],
  onAgentBuilt,
  synthBusy = false,
  synthHasA = false,
  synthHasB = false,
  pendingImage = null,
  onImageSelect,
  onImageClear,
  onTransformImage,
  imgBusyIds = new Set(),
  onOpenLightbox,
}) {
  const analyzed = nodes.length > 0
  const imgInputRef = useRef(null)

  return (
    <RackModule title="INPUT" width={300} style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 8 }}>
        {/* 신디사이저의 머리 — 에이전트 카드 슬롯 */}
        <AgentHead
          agentId={agentId}
          onAgentChange={onAgentChange}
          extraAgents={extraAgents}
          onAgentBuilt={onAgentBuilt}
        />

        {/* 관점 주입 — 0이면 중립(유용한 변형), 올리면 장착 에이전트의 사유가 회로 전체에 섞인다.
            기본적으로 에이전트 목소리는 '피드백'에만. 변형에 관점을 더하려면 여기를 올린다. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '0 4px' }}>
          <Knob size={26} value={agentInfluence} onChange={onAgentInfluence} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', color: INK_MUTED }}>INFUSE</span>
            <span style={{ fontSize: 7.5, color: METAL.recess, wordBreak: 'keep-all', lineHeight: 1.3 }}>
              {agentInfluence < 0.02 ? '중립 — 변형에 에이전트 관점 없음' : `에이전트 관점 ${Math.round(agentInfluence * 100)}% 주입`}
            </span>
          </div>
        </div>

        {/* flex 높이 해소가 환경마다 흔들려서 — relative 박스 + absolute 채움으로
            스크롤 경계를 못 박는다. 안쪽 NodeList 가 확실히 넘쳐 스크롤된다. */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            {analyzed ? (
              <NodeList
                nodes={nodes}
                onJackDown={onJackDown}
                onJackUp={onJackUp}
                onTransformImage={onTransformImage}
                imgBusyIds={imgBusyIds}
                onOpenLightbox={onOpenLightbox}
              />
            ) : (
              <SourceText
                text={text}
                onTextChange={onTextChange}
                onImageDrop={onImageSelect}
              />
            )}
          </div>
        </div>

        {/* 이미지 신호 대기 칩 — 분석하면 이미지 노드가 된다 */}
        {!analyzed && pendingImage && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              background: '#161820', border: `1px solid ${METAL.edge}`,
              borderRadius: 3, padding: '5px 8px',
            }}
          >
            <img src={pendingImage} alt="입력 이미지" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 2 }} />
            <span style={{ flex: 1, fontSize: 8.5, color: '#9aa0aa', lineHeight: 1.4, wordBreak: 'keep-all' }}>
              이미지 신호 대기 — Analyze 하면 사고 단위로 분해된다
            </span>
            <button
              onClick={onImageClear}
              title="이미지 제거"
              style={{ background: 'none', border: 'none', color: '#8a8e96', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            onImageSelect?.(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        {/* SYNTH — 두 생각의 교배. 노드 OUT 둘을 꽂으면 자식 노드가 태어난다. */}
        {analyzed && (
          <SynthModule
            busy={synthBusy}
            hasA={synthHasA}
            hasB={synthHasB}
            onJackDown={onJackDown}
            onJackUp={onJackUp}
          />
        )}

        {/* 하단 — LOAD/CLEAR 좌측 (흐릿) · AUTO PATCH + ANALYZE/RESET 우측 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <MiniLink onClick={onLoadSample} disabled={analyzing} title='작품이 자기 자신을 설명하는 샘플 텍스트를 불러온다'>LOAD SAMPLE</MiniLink>
            {!analyzed && (
              <MiniLink onClick={() => imgInputRef.current?.click()} disabled={analyzing} title='이미지를 신호로 입력한다 — 분석하면 이미지가 사고 단위로 분해된다 (드래그 앤 드롭도 가능)'>LOAD IMAGE</MiniLink>
            )}
            <MiniLink onClick={onClear} disabled={analyzing} title='입력과 회로를 비운다'>CLEAR</MiniLink>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {analyzed && (
              <Pill onClick={onAutoPatch} pulse={patchPulse} title="내용에 맞는 이펙터로 자동 패치 — 누를 때마다 다른 회로 (손으로 꽂은 케이블은 보존)">
                Auto patch ⟳
              </Pill>
            )}
            {analyzed ? (
              <Pill primary onClick={onClear} title='분석 결과와 회로를 비우고 입력 화면으로'>Reset</Pill>
            ) : (
              <Pill primary onClick={onAnalyze} disabled={!text?.trim() || analyzing} title='입력 텍스트를 에이전트가 사고 단위(노드)와 관계로 분해한다 — AI 호출 1회'>
                {analyzing ? 'Analyzing…' : 'Analyze'}
              </Pill>
            )}
          </div>
        </div>
      </div>
    </RackModule>
  )
}

// ── 자리 ───────────────────────────────────────

// 애플 결 필 버튼 — primary = 검정, secondary = 헤어라인.
// pulse = 단계 점화에서 '다음 행동 하나'가 빛나는 자리 (시그널 오렌지 호흡).
function Pill({ children, onClick, primary = false, disabled = false, title, pulse = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.background = primary ? '#ea580c' : '#eef0f3'
        if (primary) e.currentTarget.style.borderColor = '#ea580c'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = primary ? '#1c1e24' : 'transparent'
        if (primary) e.currentTarget.style.borderColor = '#1c1e24'
      }}
      style={{
        transition: 'background 120ms, border-color 120ms',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'inherit',
        color: primary ? '#fff' : '#2a2a32',
        background: primary ? '#1c1e24' : 'transparent',
        border: primary ? '1px solid #1c1e24' : pulse ? '1px solid #f97316' : '1px solid #c2c5cc',
        borderRadius: 999,
        padding: '7px 14px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        animation: pulse ? 'pillPulse 1.6s ease-in-out infinite' : 'none',
      }}
    >
      {children}
      {pulse && (
        <style>{`@keyframes pillPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
          50% { box-shadow: 0 0 0 5px rgba(249,115,22,0.22); }
        }`}</style>
      )}
    </button>
  )
}

function MiniLink({ children, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.color = INK)}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.color = INK_MUTED)}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        textAlign: 'left',
        color: INK_MUTED,
        fontSize: 7.5,
        fontWeight: 600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        transition: 'color 120ms',
        lineHeight: 1.2,
      }}
    >
      {children}
    </button>
  )
}

// SYNTH 모듈 — 신디사이저의 본령: 두 신호를 섞어 새 신호를 만든다.
// 양쪽 입력이 차면 자동 점화, 입력 케이블은 합성에 소모된다.
function SynthModule({ busy, hasA, hasB, onJackDown, onJackUp }) {
  const status = busy
    ? '합성 중 — 새 생각이 맺힌다…'
    : hasA && hasB
      ? '점화'
      : hasA || hasB
        ? '신호 하나 더 — 합칠 상대를 꽂으세요'
        : '두 카드의 OUT 을 A·B 에 꽂으면 둘을 합친 생각이 나온다'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        flexShrink: 0,
        ...metalPanel,
        borderRadius: 3,
        padding: '6px 9px',
      }}
    >
      {/* 잭 strip — IN A · IN B */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: '#3a3a42',
          borderRadius: 9,
          padding: '5px 8px',
          flexShrink: 0,
        }}
      >
        {['A', 'B'].map((k) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Jack id={`SYNTH-IN_${k}`} size={20} onDragStart={onJackDown} onDragEnd={onJackUp} />
            <span style={{ ...jackLabel, color: '#c8c8d0' }}>{k}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: busy ? '#f97316' : hasA || hasB ? '#fbbf24' : '#9ba0a8',
              animation: busy ? 'synthBlink 600ms steps(1) infinite' : 'none',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: INK }}>SYNTH</span>
          <span style={{ fontSize: 7, fontWeight: 600, color: INK_MUTED }}>합성 — 두 생각을 하나로</span>
        </div>
        <span style={{ fontSize: 8, color: busy ? '#f97316' : INK_MUTED, lineHeight: 1.4, wordBreak: 'keep-all' }}>
          {status}
        </span>
      </div>
      <style>{`@keyframes synthBlink { 50% { opacity: 0.25 } }`}</style>
    </div>
  )
}

function SourceText({ text, onTextChange, onImageDrop }) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer?.files?.[0]
        if (f && f.type.startsWith('image/')) onImageDrop?.(f)
      }}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        background: '#161820',
        border: `1px solid ${METAL.edge}`,
        borderRadius: 3,
      }}
    >
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        spellCheck={false}
        placeholder="AI와 나눈 대화, 프로젝트 메모, 교수 피드백, 떠오른 문장들을 여기에 붙여넣으세요..."
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: '10px 12px',
          color: '#dde0e4',
          fontSize: 11,
          lineHeight: 1.5,
          fontFamily: '"Share Tech Mono", ui-monospace, Menlo, monospace',
          letterSpacing: '0.02em',
        }}
      />
    </div>
  )
}

// 노드 카드 리스트 — 각 카드 좌측 인덱스/제목/내용 + 우측 OUT 잭
function NodeList({ nodes, onJackDown, onJackUp, onTransformImage, imgBusyIds, onOpenLightbox }) {
  // 케이블·합성 잭 등이 휠을 가로채는 환경을 우회 — 리스트에 네이티브 휠 리스너를
  // 직접 달아, 휠이 이 영역에 닿으면 무조건 스크롤한다.
  const listRef = useRef(null)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const onWheel = (e) => {
      if (el.scrollHeight <= el.clientHeight) return
      el.scrollTop += e.deltaY
      e.preventDefault()
      e.stopPropagation()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  return (
    <div
      ref={listRef}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflowY: 'auto',
        paddingRight: 2,
      }}
    >
      {nodes.map((n, i) => (
        <NodeCard
          key={n.id}
          node={n}
          index={i}
          onJackDown={onJackDown}
          onJackUp={onJackUp}
          onTransformImage={onTransformImage}
          imgBusy={imgBusyIds?.has?.(n.id)}
          onOpenLightbox={onOpenLightbox}
        />
      ))}
    </div>
  )
}

function NodeCard({ node, index, onJackDown, onJackUp, onTransformImage, imgBusy, onOpenLightbox }) {
  // SYNTH 가 낳은 자식 노드 — 오렌지 띠 + 탄생 모션
  const born = !!node.synthesized
  const modeColor = born ? '#f97316' : MODE_COLORS[node.synthesisMode] || METAL.recess
  const modeKo = MODE_KO[node.synthesisMode] || node.synthesisMode
  const hasImage = !!node.image

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        flexShrink: 0,
        ...metalPanel,
        borderRadius: 3,
        overflow: 'hidden',
        minHeight: 60,
        animation: born ? 'nodeBorn 700ms cubic-bezier(0.2, 0.8, 0.3, 1)' : 'none',
      }}
    >
      {born && (
        <style>{`@keyframes nodeBorn {
          0% { opacity: 0; transform: translateY(10px) scale(0.96); box-shadow: 0 0 0 3px rgba(249,115,22,0.5); }
          60% { opacity: 1; box-shadow: 0 0 0 3px rgba(249,115,22,0.35); }
          100% { transform: translateY(0) scale(1); box-shadow: 0 0 0 0 rgba(249,115,22,0); }
        }`}</style>
      )}
      {/* 좌측 — 합성 모드 색띠 (SYNTH 자식은 오렌지 혈통 띠) */}
      <div style={{ width: 4, flexShrink: 0, background: modeColor }} />

      {/* SYNTH 자식 — 부모 케이블이 꽂히는 IN 잭 (혈통의 도착지) */}
      {born && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2,
            background: '#3a3a42', padding: '6px 5px', margin: 4, borderRadius: 9, flexShrink: 0,
          }}
        >
          <Jack id={`NODE-${node.id}-IN`} size={20} onDragStart={onJackDown} onDragEnd={onJackUp} />
          <span style={{ ...jackLabel, color: '#f9b27a' }}>혈통</span>
        </div>
      )}

      {/* 이미지 신호 — 썸네일 (클릭 = 원본/재합성 비교) + ⟳ IMG 재합성 */}
      {hasImage && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, padding: '5px 0 5px 6px', flexShrink: 0,
          }}
        >
          <img
            src={node.imageOut || node.image}
            alt={node.title}
            onClick={() => onOpenLightbox?.(node)}
            title="클릭 — 원본과 재합성 비교"
            style={{
              width: 46, height: 46, objectFit: 'cover', borderRadius: 2,
              border: node.imageOut ? '1px solid #f97316' : `1px solid ${METAL.recess}`,
              cursor: 'pointer',
              opacity: imgBusy ? 0.45 : 1,
              transition: 'opacity 200ms',
            }}
          />
          <button
            onClick={() => onTransformImage?.(node.id)}
            disabled={imgBusy}
            title="이미지 재합성 — 이 카드가 꽂힌 체인의 어휘(관점·제약·관계·에이전트)가 이미지를 변형한다. 약 20초."
            style={{
              fontSize: 6.5, fontWeight: 800, letterSpacing: '0.08em',
              fontFamily: 'inherit',
              color: imgBusy ? '#f97316' : '#52525c',
              background: 'none',
              border: `1px solid ${imgBusy ? '#f97316' : '#c2c5cc'}`,
              borderRadius: 2, padding: '1.5px 5px',
              cursor: imgBusy ? 'default' : 'pointer',
              lineHeight: 1.3,
              animation: imgBusy ? 'imgWork 700ms steps(1) infinite' : 'none',
            }}
          >
            {imgBusy ? 'PROC…' : '⟳ IMG'}
          </button>
          {imgBusy && <style>{`@keyframes imgWork { 50% { opacity: 0.4 } }`}</style>}
        </div>
      )}

      {/* 본문 — 인덱스 + type/mode 라벨 + 제목 + 내용 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          justifyContent: 'center',
          padding: '6px 6px 6px 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span
            style={{
              fontFamily: '"DSEG7 Classic", monospace',
              fontStyle: 'italic',
              fontSize: 10,
              color: '#dc2626',
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: INK,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
            title={node.title}
          >
            {node.title || node.id}
          </span>
        </div>

        {/* type · 합성 모드 — 모듈 스펙 라벨 줄 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              fontSize: 6.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: INK_MUTED,
              textTransform: 'uppercase',
              border: `1px solid ${METAL.recess}`,
              borderRadius: 2,
              padding: '1px 4px',
              lineHeight: 1.2,
            }}
          >
            {node.type}
          </span>
          <span
            style={{
              fontSize: 6.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: modeColor,
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}
            title={node.synthesisReason}
          >
            {node.synthesisMode} · {modeKo}
          </span>
        </div>

        <span
          style={{
            fontSize: 9,
            color: INK_MUTED,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={node.content}
        >
          {node.content || ''}
        </span>
      </div>

      {/* 우측 — 잭 strip (어두운 음각 자리, CLAUDE.md). OUT 잭만:
          노드는 소스, 신호는 여기서 이펙터로 흘러나간다. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          background: '#3a3a42',
          padding: '6px 5px',
          margin: 4,
          borderRadius: 9,
          flexShrink: 0,
        }}
      >
        <Jack
          id={`NODE-${node.id}-OUT`}
          size={22}
          onDragStart={onJackDown}
          onDragEnd={onJackUp}
        />
        <span style={{ ...jackLabel, color: '#c8c8d0' }}>OUT</span>
      </div>
    </div>
  )
}

const jackLabel = {
  fontSize: 6.5,
  fontWeight: 700,
  letterSpacing: '0.16em',
  color: INK_MUTED,
  textTransform: 'uppercase',
  lineHeight: 1,
  fontFamily: '"Share Tech Mono", monospace',
}

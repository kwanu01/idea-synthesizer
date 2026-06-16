// SPEC 의 10 이펙터 모듈. 공통 프레임(상단 잭 strip + 색띠 + 라벨) 위에
// 각자 다른 컨트롤 결.
//
// 잭 strip: SIG IN · SIG OUT · CV OUT (CONNECT 는 IN A · IN B · OUT · CV OUT)
// 각 노브 옆 작은 CV IN 잭

import { INK, INK_MUTED, METAL, metalPanel } from '../../lib/textures'
import MetalNoise from '../MetalNoise'
import Jack from '../parts/Jack'
import Knob from '../parts/Knob'
import PoolKnob from '../parts/PoolKnob'
import OPTION_POOLS from '../../../data/effector_options.json'

// 장착된 에이전트의 voice 풀 우선 — 노브가 그 사상가의 어휘로 돈다
function poolFor(voicePools, kind, knob) {
  return voicePools?.[kind]?.[knob] || OPTION_POOLS?.[kind]?.[knob] || []
}

// 이펙터 메타 (SPEC 02 일치) — ko 부제 + desc 는 hover 설명.
export const EFFECTORS = {
  perspective: {
    flow: ['WHO','STRENGTH','MIX'],
    oneLine: '다른 존재의 눈으로 아이디어를 다시 쓴다',
    label: 'PERSPECTIVE', ko: '관점 이동', color: '#9ba0a8', twoInput: false,
    desc: '아이디어를 다른 존재의 눈으로 다시 쓴다.\nWHO = 누구의 눈으로 · STRENGTH = 원문에서 얼마나 벗어날지 (연속)',
  },
  constrain: {
    flow: ['AXIS','STRICT','MIX'],
    oneLine: '제약을 걸어 아이디어를 단단하게 만든다',
    label: 'CONSTRAIN', ko: '제약', color: '#9ba0a8', twoInput: false,
    desc: '제약을 걸어 아이디어를 단단하게 만든다.\nAXIS = 어떤 제약 · STRICT = 권고 수준 ↔ 절대 타협 불가 (연속)',
  },
  contradict: {
    flow: ['ANGLE','INTENSITY','반박/옹호','MIX'],
    oneLine: '아이디어에 맞서는 반대 관점을 세운다',
    label: 'CONTRADICT', ko: '반박', color: '#9ba0a8', twoInput: false,
    desc: '아이디어에 정면으로 맞서는 반대 관점으로 다시 쓴다.\nVENTURE = 표면적 반박 → 근본 전복 · MIX = 원문 보존 ↔ 전면 변형',
  },
  consequence: {
    flow: ['DOMAIN','BRANCH','MIX'],
    oneLine: '결과로 뻗거나, 결론을 떠받칠 근거로 거슬러 오른다',
    label: 'INFER', ko: '추론', color: '#9ba0a8', twoInput: false,
    desc: '인과의 사슬을 양방향으로 추론한다.\nDIRECTION = 결과(입력→갈래) ↔ 근거(입력을 결론으로) · VENTURE = 가까운 추론 → 먼·숨은 추론',
  },
  abstraction: {
    flow: ['DIRECTION','INTENSITY','MIX'],
    oneLine: '추상의 사다리를 오르내린다',
    label: 'ABSTRACTION', ko: '추상화', color: '#9ba0a8', twoInput: false,
    desc: '추상의 사다리를 오르내린다.\nDIRECTION = 5단 (가장 구체 ↔ 가장 추상) · INTENSITY = 강도 (연속)',
  },
  connect: {
    flow: ['DOMAIN','DISTANCE','하나/여럿','MIX'],
    oneLine: '먼 분야와의 연결고리를 찾는다',
    label: 'CONNECT', ko: '연결', color: '#9ba0a8', twoInput: false,
    desc: '멀리 떨어진 분야와의 연결고리를 찾는다.\nDOMAIN = 어느 분야와 · DISTANCE = 연결의 거리 (연속) · 토글 = 연결 하나 ↔ 여럿',
  },
}

// ── 공통 프레임 ───────────────────────────────────────
// 각 이펙터 = 독립된 1U 모듈 패널. 자기 알루미늄 면 + 4 미니 나사 +
// 어두운 잭 strip + 색띠 + 검정 라벨 밴드 + 패널 인쇄 그래픽.

function MiniScrew({ pos }) {
  return (
    <span
      style={{
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: '50%',
        // 볼트 작은 radial — CLAUDE.md 예외 허용
        background:
          'radial-gradient(circle at 38% 32%, #c8ccd4 0%, #9ba0a8 38%, #6a6e76 68%, #2a2c32 100%)',
        zIndex: 2,
        pointerEvents: 'none',
        ...pos,
      }}
    />
  )
}


// 패널 인쇄 — 각 이펙터의 *작동을 상징하는* 글리프. (일자 통과·이름 라벨 폐기)
// 공통 골격: IN → [상징] → MIX(dry/wet 블렌드) → OUT. 가운데 글리프가 이펙터마다 다르다:
//   회전(시점) · 대립(반박/옹호) · 분기(결과) · 수렴(제약) · 사다리(추상) · 다리(연결).
const OP_WORD = {
  perspective: '회전', contradict: '대립', consequence: '분기',
  constrain: '수렴', abstraction: '추상', connect: '연결',
}
function FlowPrint({ kind, twoInput = false }) {
  const W = 200, H = 42, baseY = 23
  const handoffX = 122          // 글리프 → MIX 로 넘기는 지점
  const mixX = 150, outX = 192
  const ink = '#5f636b', wire = '#aab0b8', dry = '#c4c8d0', acc = '#b45309'
  const op = OP_WORD[kind] || ''

  const glyph = () => {
    switch (kind) {
      case 'perspective': // 시점 — 다른 존재의 눈, 그 시선이 다른 자리에서 들어온다
        return (
          <g fill="none" stroke={ink} strokeWidth="1">
            <path d={`M74 ${baseY} Q84 ${baseY - 7} 94 ${baseY} Q84 ${baseY + 7} 74 ${baseY} Z`} />
            <circle cx="84" cy={baseY} r="2.1" fill={ink} stroke="none" />
            <path d={`M106 ${baseY - 10} L95 ${baseY - 2}`} stroke={acc} />
            <path d={`M100 ${baseY - 10} L106 ${baseY - 10} L106 ${baseY - 4}`} stroke={acc} />
          </g>
        )
      case 'contradict': // 대립 — 두 힘이 정면 충돌 (반박 ↔ 옹호)
        return (
          <g strokeWidth="1" fill="none">
            <line x1="58" y1={baseY} x2="80" y2={baseY} stroke={ink} />
            <path d={`M76 ${baseY - 3} L80 ${baseY} L76 ${baseY + 3}`} stroke={ink} />
            <line x1="110" y1={baseY} x2="92" y2={baseY} stroke={acc} />
            <path d={`M96 ${baseY - 3} L92 ${baseY} L96 ${baseY + 3}`} stroke={acc} />
            <line x1="86" y1={baseY - 6} x2="86" y2={baseY + 6} stroke={acc} strokeWidth="0.9" />
          </g>
        )
      case 'consequence': // 추론 — 근거가 왼쪽에서 모이고, 결과가 오른쪽으로 갈라진다 (양방향)
        return (
          <g strokeWidth="1" fill="none">
            <circle cx="84" cy={baseY} r="2.1" fill={ink} stroke="none" />
            {[[112, baseY - 9], [114, baseY], [112, baseY + 9]].map(([ex, ey], i) => (
              <g key={'f' + i} stroke={acc}>
                <path d={`M86 ${baseY} Q100 ${baseY} ${ex} ${ey}`} />
                <path d={`M${ex - 4} ${ey - 2} L${ex} ${ey} L${ex - 4} ${ey + 2}`} />
              </g>
            ))}
            {[[56, baseY - 9], [56, baseY + 9]].map(([sx, sy], i) => (
              <path key={'b' + i} d={`M${sx} ${sy} Q70 ${baseY} 82 ${baseY}`} stroke={ink} />
            ))}
          </g>
        )
      case 'constrain': // 제약 — 통로가 좁아지며 단단해진다 (수렴 클램프)
        return (
          <g fill="none">
            <path d="M56 12 L108 20" stroke={ink} strokeWidth="1" />
            <path d={`M56 ${2 * baseY - 12} L108 ${2 * baseY - 20}`} stroke={ink} strokeWidth="1" />
            <line x1="56" y1={baseY} x2="112" y2={baseY} stroke={acc} strokeWidth="1" strokeDasharray="3 2" />
          </g>
        )
      case 'abstraction': // 추상 — 구체에서 추상으로 사다리를 오른다
        return (
          <polyline points={`56,${baseY + 9} 70,${baseY + 9} 70,${baseY + 3} 84,${baseY + 3} 84,${baseY - 3} 98,${baseY - 3} 98,${baseY - 9} 112,${baseY - 9}`}
            fill="none" stroke={acc} strokeWidth="1" />
        )
      case 'connect': // 연결 — 떨어진 둘이 다리로 이어져 하나가 된다
        return (
          <g fill="none" strokeWidth="1">
            <circle cx="8" cy={baseY - 7} r="2.3" fill={ink} stroke="none" />
            <circle cx="8" cy={baseY + 7} r="2.3" fill={ink} stroke="none" />
            <path d={`M10 ${baseY - 7} Q 70 ${baseY - 9} 100 ${baseY}`} stroke={ink} />
            <path d={`M10 ${baseY + 7} Q 70 ${baseY + 9} 100 ${baseY}`} stroke={acc} />
            <circle cx="100" cy={baseY} r="2.6" fill={acc} stroke="none" />
          </g>
        )
      default:
        return null
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '96%', height: 32, flexShrink: 0, opacity: 0.95 }}>
      {/* dry 바이패스 — 원본이 변형을 건너뛰고 MIX 로 (블렌드의 한 축) */}
      <path d={`M 8 ${baseY} C 20 5, ${mixX - 18} 5, ${mixX} ${baseY - 5}`}
        fill="none" stroke={dry} strokeWidth="1" strokeDasharray="2 2" />

      {/* IN — connect 는 글리프가 자체 입력을 그린다 */}
      {!twoInput && (
        <>
          <circle cx="8" cy={baseY} r="2.5" fill={ink} />
          <line x1="10" y1={baseY} x2="54" y2={baseY} stroke={wire} strokeWidth="1" />
        </>
      )}

      {glyph()}

      {/* 글리프 → MIX → OUT */}
      <line x1={handoffX} y1={baseY} x2={mixX} y2={baseY} stroke={wire} strokeWidth="1" />
      <line x1={mixX} y1={baseY} x2={outX} y2={baseY} stroke={wire} strokeWidth="1" />
      <g>
        <circle cx={mixX} cy={baseY} r="3.6" fill="#dee0e4" stroke={ink} strokeWidth="1" />
        <path d={`M ${mixX - 2} ${baseY} L ${mixX + 2} ${baseY} M ${mixX} ${baseY - 2} L ${mixX} ${baseY + 2}`}
          stroke={ink} strokeWidth="0.8" />
        <text x={mixX} y={baseY + 12} fontSize="5" fontWeight="700" fill={ink} textAnchor="middle">MIX</text>
      </g>
      <circle cx={outX} cy={baseY} r="2.5" fill={ink} />
      <path d={`M ${outX - 7} ${baseY - 2.5} L ${outX - 3} ${baseY} L ${outX - 7} ${baseY + 2.5}`}
        fill="none" stroke={wire} strokeWidth="1" />

      {/* 작동 이름 — 한 단어, 글리프 아래 (겹침 없음) */}
      <text x="84" y={H - 3} fontSize="6.5" fontWeight="800" fill={ink} textAnchor="middle" letterSpacing="0.16em">{op}</text>
    </svg>
  )
}

function EffectorFrame({ kind, children, isLast = false, bypass = false, onBypassToggle, active = false }) {
  const meta = EFFECTORS[kind]
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...metalPanel,
        borderRadius: 3,
        padding: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <MetalNoise />

      {/* 잭 strip — 어두운 음각 자리 (CLAUDE.md) */}
      <JackHeader kind={kind} />

      {/* 시그니처 색띠 */}
      <div
        style={{
          height: 3,
          margin: '3px 12px 0',
          background: meta.color,
          flexShrink: 0,
        }}
      />

      {/* 라벨 밴드 — 검정 띠. EN + KO 부제. 클릭 = bypass 토글, 우측 활성 LED.
          hover = 이 모듈이 데이터에 무슨 일을 하는지 설명. */}
      <div
        onClick={onBypassToggle}
        title={`${meta.desc}\n\n[클릭] ${bypass ? '신호 통과 재개' : 'bypass — 변형 없이 통과'}`}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'transparent',
          borderBottom: '1px solid #cdd0d6',
          padding: '4px 8px 5px',
          margin: '2px 8px 2px',
          cursor: 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* 활성 LED — 변형 처리 중이면 점멸 (지금 일하는 모듈이 보인다) */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: bypass ? '#3a3a42' : '#f97316',
            animation: active && !bypass ? 'fxWork 420ms steps(1) infinite' : 'none',
            flexShrink: 0,
          }}
        />
        {active && !bypass && <style>{`@keyframes fxWork { 50% { opacity: 0.2 } }`}</style>}
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.07em',
            color: '#2a2a32',
            textTransform: 'uppercase',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {meta.label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 7,
            fontWeight: 600,
            color: '#8a8e96',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {meta.ko}
        </span>
      </div>

      {/* 패널 인쇄 — 기능 한 줄 (한글) */}
      <div
        style={{
          margin: '0 8px 1px',
          flexShrink: 0,
          fontSize: 7.5,
          fontWeight: 600,
          color: '#52565e',
          lineHeight: 1.25,
          textAlign: 'center',
          wordBreak: 'keep-all',
        }}
      >
        {meta.oneLine}
      </div>

      {/* 패널 인쇄 — 작동 논리 회로도 */}
      <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <FlowPrint kind={kind} twoInput={meta.twoInput} />
      </div>

      {/* 컨트롤 자리. bypass 시 흐림. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: 2,
          padding: '1px 0 8px',
          overflow: 'hidden',
          opacity: bypass ? 0.35 : 1,
          transition: 'opacity 150ms',
          pointerEvents: bypass ? 'none' : 'auto',
        }}
      >
        {children}
      </div>

    </div>
  )
}

// 패널 인쇄 그래픽 — 모듈의 동작을 한 획으로 새긴다. 잉크 #8a8e96, stroke 모서리 있게.
function PanelGlyph({ kind }) {
  const S = { stroke: '#8a8e96', strokeWidth: 1.1, fill: 'none' }
  const glyphs = {
    // 한 점에서 다른 각도로 뻗는 두 시선
    perspective: (
      <g {...S}>
        <circle cx="8" cy="9" r="1.6" fill="#8a8e96" stroke="none" />
        <path d="M 9.5 8 L 32 3" />
        <path d="M 9.5 10 L 32 15" />
        <path d="M 29 1.5 L 32 3 L 29.5 5.5" />
        <path d="M 29.5 12.5 L 32 15 L 29 16.5" />
      </g>
    ),
    // 다른 두 도형이 같은 구조로 이어짐
    analogy: (
      <g {...S}>
        <circle cx="9" cy="9" r="4.5" />
        <rect x="26" y="4.5" width="9" height="9" />
        <path d="M 14 9 L 25 9" strokeDasharray="2 2" />
      </g>
    ),
    // 양쪽에서 조여드는 괄호
    constrain: (
      <g {...S}>
        <path d="M 12 2 L 8 2 L 8 16 L 12 16" />
        <path d="M 28 2 L 32 2 L 32 16 L 28 16" />
        <path d="M 14 9 L 26 9" />
        <path d="M 17 6.5 L 14 9 L 17 11.5" />
        <path d="M 23 6.5 L 26 9 L 23 11.5" />
      </g>
    ),
    // 정면 충돌하는 두 화살표
    contradict: (
      <g {...S}>
        <path d="M 4 9 L 17 9" />
        <path d="M 14 6.5 L 17 9 L 14 11.5" />
        <path d="M 36 9 L 23 9" />
        <path d="M 26 6.5 L 23 9 L 26 11.5" />
        <path d="M 20 4 L 20 14" strokeDasharray="1.5 1.5" />
      </g>
    ),
    // 한 줄기에서 갈라지는 분기
    consequence: (
      <g {...S}>
        <path d="M 5 9 L 16 9" />
        <path d="M 16 9 L 27 3.5 L 35 3.5" />
        <path d="M 16 9 L 27 9 L 35 9" />
        <path d="M 16 9 L 27 14.5 L 35 14.5" />
      </g>
    ),
    // 아래로 내려가는 뿌리
    genealogy: (
      <g {...S}>
        <path d="M 20 2 L 20 8" />
        <path d="M 20 8 L 11 12 L 11 16" />
        <path d="M 20 8 L 20 16" />
        <path d="M 20 8 L 29 12 L 29 16" />
      </g>
    ),
    // 동심 사각 — 같은 것의 다른 배율
    zoom: (
      <g {...S}>
        <rect x="8" y="3" width="24" height="12" />
        <rect x="14" y="6" width="12" height="6" />
        <path d="M 8 3 L 14 6 M 32 3 L 26 6 M 8 15 L 14 12 M 32 15 L 26 12" strokeWidth="0.7" />
      </g>
    ),
    // 구체(블록들)가 한 선으로 추상화됨
    abstraction: (
      <g {...S}>
        <rect x="6" y="11" width="5" height="5" />
        <rect x="13" y="11" width="5" height="5" />
        <rect x="20" y="11" width="5" height="5" />
        <path d="M 8 9 L 30 4" />
        <path d="M 27 2.5 L 30 4 L 27.5 6.5" />
      </g>
    ),
    // 멀리 떨어진 두 점의 연결
    connect: (
      <g {...S}>
        <circle cx="7" cy="13" r="2.4" />
        <circle cx="33" cy="5" r="2.4" />
        <path d="M 9 11.5 C 18 4 24 13 31 6.2" strokeDasharray="2.5 2" />
      </g>
    ),
    // 익숙한 형태가 뒤집힘
    defamiliarize: (
      <g {...S}>
        <path d="M 14 3 L 8 3 L 8 15 L 14 15 M 8 9 L 13 9" />
        <path d="M 26 3 L 32 3 L 32 15 L 26 15 M 32 9 L 27 9" transform="rotate(180 29 9)" />
        <path d="M 18 9 L 22 9" strokeWidth="0.7" strokeDasharray="1.5 1.5" />
      </g>
    ),
  }
  return (
    <svg
      viewBox="0 0 40 18"
      style={{ width: '100%', height: 13, flexShrink: 0, opacity: 0.85 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {glyphs[kind]}
    </svg>
  )
}

function JackHeader({ kind }) {
  const meta = EFFECTORS[kind]
  return (
    <div
      style={{
        background: '#3a3a42',
        borderRadius: 9,
        margin: '11px 6px 0',
        padding: '5px 4px 4px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: 2,
        boxShadow: 'inset 0 1px 0 rgba(10,10,16,0.6), inset 0 -1px 0 rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}
    >
      {meta.twoInput ? (
        <>
          <JackUnit label="A" jackId={`FX-${kind}-IN_A`} kind={kind} />
          <JackUnit label="B" jackId={`FX-${kind}-IN_B`} kind={kind} />
        </>
      ) : (
        <JackUnit label="IN" jackId={`FX-${kind}-IN`} kind={kind} />
      )}
      <JackUnit label="OUT" jackId={`FX-${kind}-OUT`} kind={kind} />
    </div>
  )
}

function JackUnit({ label, jackId }) {
  const bus = typeof window !== 'undefined' ? window.__jackBus : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Jack
        id={jackId}
        size={22}
        onDragStart={bus?.onDown}
        onDragEnd={bus?.onUp}
      />
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: '#c8c8d0',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  )
}

function KnobBlock({ label, size = 38, value, onChange, tip }) {
  return (
    <div title={tip} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Knob size={size} value={value} onChange={onChange} />
      <span style={miniLabel}>{label}</span>
    </div>
  )
}

// 연속 스펙트럼 노브 — 양극(low ↔ high) 사이를 연속으로 쓸어 위치를 정한다.
// 이산 리스트 선택(PoolKnob) 폐기. 노브 위치(%)가 백엔드에서 연속적으로 결과를 바꾼다.
function SpectrumKnob({ label, low, high, size = 52, value = 0.5, onChange }) {
  return (
    <div
      title={`${label} — '${low}' ↔ '${high}' 연속 축. 노브를 돌리면 위치(%)가 결과를 연속으로 바꾼다.`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}
    >
      <Knob size={size} value={value} onChange={onChange} />
      <span style={miniLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, maxWidth: 110 }}>
        <span style={{ fontSize: 6.5, fontWeight: 600, color: '#9097a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 48 }}>{low}</span>
        <span style={{ fontSize: 7, color: '#c2c5cc', flexShrink: 0 }}>↔</span>
        <span style={{ fontSize: 6.5, fontWeight: 600, color: '#9097a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 48 }}>{high}</span>
      </div>
    </div>
  )
}

// 얇은 가로 페이더 — 음각 슬롯 + 양쪽 눈금 + 납작한 사각 캡 (믹서 페이더 레퍼런스). N 스텝 스냅.
function Fader({ index = 0, steps = 2, onChange, leftLabel, rightLabel, width = 96 }) {
  const n = Math.max(2, steps)
  const idx = Math.max(0, Math.min(n - 1, Math.round(index || 0)))
  const H = 18, capW = 6, slotH = 2.5
  const travel = width - capW
  const pos = (idx / (n - 1)) * travel
  const apply = (clientX, rect) => {
    const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const nn = Math.round(r * (n - 1))
    if (nn !== idx) onChange?.(nn)
  }
  const onDown = (e) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    apply(e.clientX, rect)
    const mv = (ev) => apply(ev.clientX, rect)
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }
  const TICKS = 11
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div onPointerDown={onDown} title={leftLabel ? `${leftLabel} ↔ ${rightLabel}` : '좌우로 밀어 조절'}
        style={{ position: 'relative', width, height: H, cursor: 'ew-resize', touchAction: 'none', userSelect: 'none' }}>
        {Array.from({ length: TICKS }).flatMap((_, i) => {
          const x = capW / 2 + travel * (i / (TICKS - 1))
          return [
            <div key={'t' + i} style={{ position: 'absolute', left: x - 0.5, top: 0, width: 1, height: 5, background: '#9498a0', pointerEvents: 'none' }} />,
            <div key={'b' + i} style={{ position: 'absolute', left: x - 0.5, bottom: 0, width: 1, height: 5, background: '#9498a0', pointerEvents: 'none' }} />,
          ]
        })}
        {/* 음각 슬롯 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: H / 2 - slotH / 2, height: slotH, borderRadius: 1, background: 'linear-gradient(180deg,#0a0a10,#2a2c32)', pointerEvents: 'none' }} />
        {/* 납작한 사각 캡 */}
        <div style={{ position: 'absolute', left: pos, top: 1, width: capW, height: H - 2, borderRadius: 1.5, background: 'linear-gradient(180deg,#3a3c44,#16181e)', border: '1px solid #0a0a10', transition: 'left 120ms cubic-bezier(.3,1.2,.5,1)', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 2, bottom: 2, left: '50%', width: 1, marginLeft: -0.5, background: '#cfd2d8' }} />
        </div>
      </div>
      {(leftLabel || rightLabel) && (
        <div style={{ display: 'flex', width, justifyContent: 'space-between', padding: '0 1px' }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: idx === 0 ? INK : INK_MUTED }}>{leftLabel}</span>
          <span style={{ fontSize: 7, fontWeight: 700, color: idx === n - 1 ? INK : INK_MUTED }}>{rightLabel}</span>
        </div>
      )}
    </div>
  )
}

// SEED — 같은 VENTURE 강도에서 다른 추첨(변주)으로. 하단의 얇은 가로 페이더 (8 스텝).
function SeedFader({ state, onChange, width = 110 }) {
  const cur = ((Math.round(state?.vary || 0)) % 8 + 8) % 8
  return (
    <div title="SEED — 좌우로 밀어 같은 VENTURE 강도에서 다른 변주로 새로 뽑는다. 결과는 PANEL 로 확인."
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Fader index={cur} steps={8} width={width} onChange={(nn) => onChange?.('vary', nn)} />
      <span style={miniLabel}>SEED</span>
    </div>
  )
}

// DIRECTION — 추론 방향. 자기만의 ←→ 그래픽: 왼쪽 화살표=근거(거슬러), 오른쪽 화살표=결과(나아가).
// 근거→결과로 흐르는 인과 순서대로 근거가 왼쪽. 활성 방향의 화살표가 진해진다.
function DirArrow({ value = 0, onChange }) {
  const left = (value ?? 0) >= 0.5  // dir 1 = 근거(왼쪽), dir 0 = 결과(오른쪽)
  const W = 90, H = 14, cy = 7
  const A = '#2a2a32', M = '#b4b8bf'
  const lc = left ? A : M, rc = left ? M : A
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <g onClick={() => onChange?.(1)} style={{ cursor: 'pointer' }}>
          <rect x="0" y="0" width={W / 2} height={H} fill="transparent" />
          <line x1="9" y1={cy} x2={W / 2 - 1} y2={cy} stroke={lc} strokeWidth="1.6" />
          <path d={`M9 ${cy} l5 -4 M9 ${cy} l5 4`} stroke={lc} strokeWidth="1.6" fill="none" />
        </g>
        <g onClick={() => onChange?.(0)} style={{ cursor: 'pointer' }}>
          <rect x={W / 2} y="0" width={W / 2} height={H} fill="transparent" />
          <line x1={W / 2 + 1} y1={cy} x2={W - 9} y2={cy} stroke={rc} strokeWidth="1.6" />
          <path d={`M${W - 9} ${cy} l-5 -4 M${W - 9} ${cy} l-5 4`} stroke={rc} strokeWidth="1.6" fill="none" />
        </g>
      </svg>
      <div style={{ display: 'flex', width: W, justifyContent: 'space-between', padding: '0 2px' }}>
        <span style={{ fontSize: 7, fontWeight: 700, color: left ? INK : INK_MUTED }}>근거</span>
        <span style={{ fontSize: 7, fontWeight: 700, color: left ? INK_MUTED : INK }}>결과</span>
      </div>
    </div>
  )
}


const miniLabel = {
  fontSize: 7.5,
  fontWeight: 700,
  letterSpacing: '0.14em',
  color: INK_MUTED,
  textTransform: 'uppercase',
  lineHeight: 1,
}

// ── LEAP 노브 — 이 신디사이저의 심장. 돌릴수록 *상상 못 한 관점* 으로 도약한다 ──
// 관습(왼쪽) → 비약(오른쪽): 올릴수록 뻔한 해석을 버리고 측면 도약·전제 전복·분야 횡단으로
// 사용자가 미처 못 본 자리를 연다. 같은 위치 = 같은 도약(시드 고정). 결과는 PANEL 로 즉시 확인.
// 각 이펙터의 *고유한 도약 축*. 오른쪽으로 갈수록 그 이펙터 방식대로 더 의외의 자리로 간다.
// 극(low↔high)은 이펙터마다 다르다 (관습/비약 같은 범용 표현 폐기). 같은 위치 = 같은 도약(시드 고정).
function LeapKnob({ value = 0.3, onChange, size = 40, low = '익숙', high = '도약' }) {
  const v = Math.max(0, Math.min(1, value ?? 0.3))
  return (
    <div
      title={`${low} ↔ ${high} (${Math.round(v * 100)}%) — 오른쪽으로 갈수록 더 의외의 자리로 도약한다. 같은 위치는 같은 결과. 결과는 PANEL 로 확인.`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}
    >
      <Knob size={size} value={v} onChange={onChange} />
      <span style={{ ...miniLabel, color: '#c2762e' }}>VENTURE</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: 120 }}>
        <span style={{ fontSize: 6.5, fontWeight: 600, color: '#9097a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 52 }}>{low}</span>
        <span style={{ fontSize: 7, color: '#c2c5cc', flexShrink: 0 }}>↔</span>
        <span style={{ fontSize: 6.5, fontWeight: 600, color: '#9097a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 52 }}>{high}</span>
      </div>
    </div>
  )
}

// ── 6 이펙터 — 컨트롤은 백엔드 파라미터와 1:1, 죽은 노브 없음 ──
// 문법: 어휘 = PoolKnob · 연속(백엔드도 연속 반영) = Knob · 진짜 2택 = 토글.
// 가로 슬라이더 폐기 (2026-06-12) — 이산을 연속으로 위장하던 자리.

function bind(state, onChange, param) {
  return {
    value: state?.[param],
    onChange: (v) => onChange?.(param, v),
  }
}

function ControlRow({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, width: '100%' }}>
      {children}
    </div>
  )
}

// ⑂ 분만 버튼 — 신호의 출발 노드에서 새 생각(갈래/반대 관점)을 회로에 낳는다 (CONSEQUENCE·CONTRADICT 공용).
function SpawnButton({ can, busy, onClick, label, hintOn, hintOff }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
      <button
        onClick={can && !busy ? onClick : undefined}
        title={can ? hintOn : hintOff}
        onMouseEnter={(e) => { if (can && !busy) e.currentTarget.style.color = '#b45309' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = can ? '#8a6a3a' : '#b4b8c0' }}
        style={{
          background: 'none', border: 'none', padding: '1px 4px',
          color: can ? '#8a6a3a' : '#b4b8c0',
          cursor: can && !busy ? 'pointer' : 'default',
          fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 3,
        }}
      >
        <span style={{ fontSize: 9 }}>⑂</span>
        {busy ? '생성 중…' : label}
      </button>
    </div>
  )
}

export function Perspective({ isLast, state, onChange, onBypassToggle, voicePools, active, agentAxes }) {
  return (
    <EffectorFrame kind="perspective" isLast={isLast} bypass={state?._bypass} onBypassToggle={onBypassToggle} active={active}>
      {/* 관점 잭 윗줄(꽂으면 그 생각의 눈, 비우면 AI가 시점 명시). CHANNEL·MIX 아랫줄. */}
      <JackUnit label="관점" jackId="FX-perspective-IN_B" />
      <ControlRow>
        <LeapKnob low="익숙한 시선" high="이질적 존재" {...bind(state, onChange, 'leap')} />
        <KnobBlock label="MIX" size={48} tip="원문 보존 ↔ 전면 변형 — 신호의 DRY/WET" {...bind(state, onChange, 'mix')} />
      </ControlRow>
      <SeedFader state={state} onChange={onChange} />
    </EffectorFrame>
  )
}

export function Contradict({ isLast, state, onChange, onBypassToggle, voicePools, active }) {
  return (
    <EffectorFrame kind="contradict" isLast={isLast} bypass={state?._bypass} onBypassToggle={onBypassToggle} active={active}>
      {/* 항상 반박. 신호가 흐르면 출력 자체가 반대 관점이 된다 — 별도 버튼 없이 인라인 작동. */}
      <ControlRow>
        <LeapKnob low="표면적 반박" high="근본 전복" {...bind(state, onChange, 'leap')} />
        <KnobBlock label="MIX" size={48} tip="원문 보존 ↔ 전면 변형 — 신호의 DRY/WET" {...bind(state, onChange, 'mix')} />
      </ControlRow>
      <SeedFader state={state} onChange={onChange} />
    </EffectorFrame>
  )
}

export function Consequence({ isLast, state, onChange, onBypassToggle, voicePools, active }) {
  return (
    <EffectorFrame kind="consequence" isLast={isLast} bypass={state?._bypass} onBypassToggle={onBypassToggle} active={active}>
      {/* DIRECTION = 결과(입력→갈래) ↔ 근거(입력을 결론으로). 입력이 닿아 추론이 끝나면 갈래가 OUT 잭의 플로팅 창으로 자동으로 뜬다 (버튼 없음). */}
      <DirArrow {...bind(state, onChange, 'dir')} />
      <ControlRow>
        <LeapKnob low="가까운 추론" high="먼·숨은 추론" {...bind(state, onChange, 'leap')} />
        <KnobBlock label="MIX" size={48} tip="원문 보존 ↔ 전면 변형 — 신호의 DRY/WET" {...bind(state, onChange, 'mix')} />
      </ControlRow>
      <SeedFader state={state} onChange={onChange} />
    </EffectorFrame>
  )
}

export function Constrain({ isLast, state, onChange, onBypassToggle, voicePools, active, agentAxes }) {
  return (
    <EffectorFrame kind="constrain" isLast={isLast} bypass={state?._bypass} onBypassToggle={onBypassToggle} active={active}>
      {/* 제약 잭 윗줄(조건을 꽂거나, 비우면 AI가 도발적 제약 명시). CHANNEL·MIX 아랫줄. */}
      <JackUnit label="제약" jackId="FX-constrain-IN_B" />
      <ControlRow>
        <LeapKnob low="현실적 제약" high="극단적 제약" {...bind(state, onChange, 'leap')} />
        <KnobBlock label="MIX" size={48} tip="원문 보존 ↔ 전면 변형 — 신호의 DRY/WET" {...bind(state, onChange, 'mix')} />
      </ControlRow>
      <SeedFader state={state} onChange={onChange} />
    </EffectorFrame>
  )
}

export function Abstraction({ isLast, state, onChange, onBypassToggle, voicePools, active }) {
  return (
    <EffectorFrame kind="abstraction" isLast={isLast} bypass={state?._bypass} onBypassToggle={onBypassToggle} active={active}>
      {/* DIRECTION = 구체(장면)↔추상(원리), 윗줄. CHANNEL·MIX 아랫줄. */}
      <SpectrumKnob label="DIRECTION" low="구체" high="추상" size={40} {...bind(state, onChange, 'direction')} />
      <ControlRow>
        <KnobBlock label="MIX" size={48} tip="원문 보존 ↔ 전면 변형 — 신호의 DRY/WET" {...bind(state, onChange, 'mix')} />
      </ControlRow>
      <SeedFader state={state} onChange={onChange} />
    </EffectorFrame>
  )
}

export function Connect({ isLast, state, onChange, onBypassToggle, voicePools, active, agentAxes }) {
  return (
    <EffectorFrame kind="connect" isLast={isLast} bypass={state?._bypass} onBypassToggle={onBypassToggle} active={active}>
      {/* 연결 잭 윗줄(대상을 꽂거나, 비우면 AI가 의외의 분야 명시). CHANNEL·MIX 아랫줄. */}
      <JackUnit label="연결" jackId="FX-connect-IN_B" />
      <ControlRow>
        <LeapKnob low="인접 분야" high="먼 분야" {...bind(state, onChange, 'leap')} />
        <KnobBlock label="MIX" size={48} tip="원문 보존 ↔ 전면 변형 — 신호의 DRY/WET" {...bind(state, onChange, 'mix')} />
      </ControlRow>
      <SeedFader state={state} onChange={onChange} />
    </EffectorFrame>
  )
}

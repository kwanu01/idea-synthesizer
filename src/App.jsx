import { useEffect, useRef, useState } from 'react'
import { sampleConversation } from './lib/sampleData'
import TopBar from './components/TopBar'
import RackRail from './components/RackRail'
import UtilityRack from './components/UtilityRack'
import CableLayer from './components/parts/CableLayer'
import Jack from './components/parts/Jack'
import MetalNoise from './components/MetalNoise'
import InputEffector from './components/effectors/InputEffector'
import { EFFECTORS } from './components/effectors/EffectorModules'
import EffectorPanel from './components/effectors/EffectorPanel'
import { MonitorColumn, OutputColumn, VisionControls, VisionBody, PanelBody } from './components/effectors/OutputModule'
import { metalBackground, INK } from './lib/textures'
import { validateCable } from './lib/jacks'
import { RELATIONS, relationColor, DEFAULT_COLOR } from './lib/relations'
import CableMenu from './components/parts/CableMenu'
import { chainForNode, signalPath } from './lib/chain'
import { useDebounce } from './lib/useDebounce'
import { defaultEffectorState, sanitizeEffectorState } from './lib/effectorDefaults'
import { agentMeta, metaFromSummary, isKnownAgentId } from './lib/agents'
import Diagram, { exportDiagramPng } from './components/Diagram'
import Window from './components/Window'
import HelpOverlay from './components/HelpOverlay'
import BootScreen from './components/BootScreen'
import * as sound from './lib/soundEngine'

// 플로팅 창 안의 잭 스트립 — 떼어진 뷰도 잭을 가지므로 케이블이 창을 따라온다.
// 케이블 본선은 창 뒤로 숨지만, 연결된 잭엔 '앞에서 들어온 플러그' 표시를 띄운다.
function FloatJacks({ jacks, cables, onDown, onUp }) {
  const connColor = (id) => {
    const c = cables.find((cb) => cb.from === id || cb.to === id)
    if (!c) return null
    return c.relation ? relationColor(c.relation) : DEFAULT_COLOR
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '5px 10px',
        background: 'linear-gradient(180deg, #f0f2f5 0%, #e3e5ea 100%)',
        borderBottom: '1px solid #cdd0d6',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#3a3a42', borderRadius: 16, padding: '4px 12px 6px' }}>
        {jacks.map((j) => {
          const col = connColor(j.id)
          return (
            <div key={j.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ position: 'relative' }}>
                <Jack id={j.id} size={18} onDragStart={onDown} onDragEnd={onUp} />
                {/* 연결 표시 — 잭 위에 꽂힌 플러그 점 */}
                {col && (
                  <span
                    style={{
                      position: 'absolute', left: '50%', top: '50%',
                      width: 8, height: 8, borderRadius: '50%',
                      transform: 'translate(-50%,-50%)',
                      background: col, border: '1px solid #0a0a10',
                      boxShadow: `0 0 5px ${col}`,
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
              <span style={{ fontSize: 6, fontWeight: 700, letterSpacing: '0.16em', color: col ? '#f0f0f2' : '#c8c8d0', fontFamily: '"Share Tech Mono", monospace' }}>
                {j.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// dataURL 을 파일로 저장 (VISION 이미지·다이어그램 캡처 공용)
function downloadDataUrl(url, name) {
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// 잭의 소스 텍스트 해석 — NODE-<id>-OUT 이면 그 노드의 출력/본문 (CONNECT IN_B 용)
function resolveSourceText(fromJack, nodes, outputs, branchMap) {
  if (!fromJack) return ''
  if (fromJack.startsWith('NODE-') && fromJack.endsWith('-OUT')) {
    const id = fromJack.slice(5, fromJack.length - 4)
    const n = nodes.find((x) => x.id === id)
    if (!n) return ''
    return (outputs[id]?.finalText || n.content || n.title || '').trim()
  }
  // INFER 갈래 창의 OUT — 그 갈래 텍스트가 신호로 흐른다
  if (branchMap && fromJack.startsWith('IWIN-') && fromJack.endsWith('-OUT')) {
    const b = branchMap[fromJack]
    if (b) return (b.content || b.title || '').trim()
  }
  return ''
}

// 단계 점화 — 전원 꺼진 모듈의 톤. 신호가 닿으면 부드럽게 켜진다.
function stageDim(off) {
  return {
    transition: 'opacity 700ms ease, filter 700ms ease',
    ...(off
      ? { opacity: 0.35, filter: 'saturate(0.5)', pointerEvents: 'none' }
      : { opacity: 1, filter: 'none' }),
  }
}

// 파일 다운로드 헬퍼
function download(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function App() {
  const [health, setHealth] = useState(null)
  const [text, setText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [agentId, setAgentId] = useState('paik')
  // 에이전트 관점 주입량 (0~1) — 기본 0(중립). 올리면 장착 에이전트의 사유가 변형·종합에 섞인다.
  const [agentInfluence, setAgentInfluence] = useState(0)

  // 워크스테이션 창 상태 — 각 뷰는 docked(우측 도크) | float(떼어진 창) | closed.
  // 뷰는 셋: DIAGRAM (데이터 필드) · VISION (이미지 생성) · STATEMENT.
  const [windows, setWindows] = useState({ diagram: 'docked', vision: 'docked', statement: 'docked', agentfb: 'closed' })
  const setWin = (key, mode) => setWindows((w) => ({ ...w, [key]: mode }))

  // 외부 텍스트 입력 모듈 — 각자 떠다니는 창. OUT 잭으로 회로에 패치된다.
  const [manualInputs, setManualInputs] = useState([]) // [{ id, text, title }]
  const onAddInput = () => {
    const id = 'm' + Date.now().toString(36)
    setManualInputs((arr) => [...arr, { id, text: '', title: '외부 입력' }])
  }
  const setInputText = (id, text) => setManualInputs((arr) => arr.map((m) => (m.id === id ? { ...m, text } : m)))
  const removeInput = (id) => {
    setManualInputs((arr) => arr.filter((m) => m.id !== id))
    setCables((prev) => prev.filter((c) => !c.from.includes(`NODE-${id}-`) && !c.to.includes(`NODE-${id}-`)))
  }

  // 에이전트의 한 마디 — 이펙터(변형)와 달리, 에이전트 본인이 자기 말투로 아이디어에 말을 건다.
  const [agentFb, setAgentFb] = useState({ busy: false, text: '', label: '' })
  const onAgentFeedback = async () => {
    const src = (master.statement || text || (nodes[0]?.content) || '').trim()
    if (!src) { setTelemetry('에이전트 피드백 — 먼저 아이디어를 입력하거나 회로를 돌리세요.'); return }
    setWin('agentfb', 'float')
    setAgentFb((s) => ({ ...s, busy: true }))
    try {
      const r = await fetch('/api/agent-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: src, agentId }),
      })
      if (r.status === 404) throw new Error('백엔드 재시작 필요 — python3 synth/server.py')
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setAgentFb({ busy: false, text: data.feedback, label: data.agentLabel || '' })
    } catch (e) {
      setAgentFb({ busy: false, text: `(${String(e.message || e)})`, label: '' })
    }
  }

  // VISION — 출력(선언문)을 이미지로 생성. 에이전트의 시각 코드가 필터.
  const [vision, setVision] = useState({ image: null, busy: false, code: 'aesthetic', options: [], optBusy: false, sel: null, ratio: 'square', history: [] })
  const RATIO_SIZE = { square: '1024x1024', wide: '1536x1024', tall: '1024x1536' }
  const [visionLightbox, setVisionLightbox] = useState(false)

  // INFER 갈래 플로팅 창 — 일찍 선언(태스크·패널 빌드가 이 아래에서 갈래를 소스로 참조한다)
  const [cqBusy, setCqBusy] = useState(false)
  const [inferWins, setInferWins] = useState([])
  const inferSigRef = useRef('')
  // 안정적인 INFER 갈래 bid — 노브(mix·leap·dir)만 바꿔 재추론할 때 같은 bid 를 유지해
  // 창 위치와 하류(IWIN-OUT→OUT-IN) 케이블이 끊기지 않게 한다. 소스가 사라지면 null.
  const cqBidRef = useRef(null)
  const inferBranchMap = {}
  inferWins.forEach((w) => w.branches.forEach((b) => { inferBranchMap[`IWIN-${b.bid}-OUT`] = b }))

  // 부팅 화면 — 처음 접속했을 때 만나는 전원 화면 (매 로드마다)
  const [booted, setBooted] = useState(false)
  const [utilityVisible, setUtilityVisible] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false) // PANEL — 그래스호퍼식 중간 확인 창 (필요할 때 띄운다)
  const fileInputRef = useRef(null)

  // 사용자가 직접 구운 에이전트들 — 백엔드 GET /api/agents 에서
  const [extraAgents, setExtraAgents] = useState([])
  const refreshAgents = () => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((d) => {
        const users = (d.agents || []).filter((a) => a.user).map(metaFromSummary)
        setExtraAgents(users)
      })
      .catch(() => {})
  }
  useEffect(refreshAgents, [])
  // 굽기 직후 — 목록 fetch 를 기다리지 않고 즉시 장착 가능하게
  const onAgentBuilt = (summary) => {
    const meta = metaFromSummary(summary)
    setExtraAgents((prev) => [...prev.filter((a) => a.id !== meta.id), meta])
  }
  const curMeta = agentMeta(agentId, extraAgents)

  // 장착된 에이전트 문서 — voice 풀(이펙터 어휘)을 프론트에 공급
  const [agentDoc, setAgentDoc] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/agents/${agentId}.agent.json`)
      .then((r) => r.json())
      .then((doc) => { if (!cancelled) setAgentDoc(doc) })
      .catch(() => { if (!cancelled) setAgentDoc(null) })
    return () => { cancelled = true }
  }, [agentId])
  const voicePools = agentDoc?.voice?.pools || null

  // MASTER — 회로 전체의 믹스다운 STATEMENT
  const [master, setMaster] = useState({ statement: null, busy: false, error: null })

  // ── 이미지 입력 — 이미지도 신호다 ──
  const [pendingImage, setPendingImage] = useState(null) // dataURL (분석 대기)
  const [imgBusyIds, setImgBusyIds] = useState(() => new Set())
  const [lightbox, setLightbox] = useState(null) // { node } — 원본/변형 비교

  // 파일 → 768px 이하로 다운스케일한 dataURL (vision 비용·전송량 절약)
  const onImageSelect = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const img = new Image()
    img.onload = () => {
      const MAX = 768
      const k = Math.min(1, MAX / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      setPendingImage(c.toDataURL('image/jpeg', 0.85))
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  // 텔레메트리 — 기계가 한 일의 기록 (유틸리티 랙 LOG 콘솔, CAD 커맨드 히스토리 결)
  const [logs, setLogs] = useState([])
  const setTelemetry = (text) =>
    setLogs((prev) => [...prev.slice(-99), { time: Date.now(), text }])

  // DIAGRAM 오버레이 — 회로를 화면 중앙에 크게 펼치는 원점 화면
  const [diagramOpen, setDiagramOpen] = useState(false)
  useEffect(() => {
    if (!diagramOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setDiagramOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [diagramOpen])

  // 케이블 시스템
  const [cables, setCables] = useState([])
  const [dragging, setDragging] = useState(null)

  // OUTPUT — 노드별 결과 { [nodeId]: { finalText, stages, busy, error } }
  const [outputs, setOutputs] = useState({})

  // 케이블 컨텍스트 메뉴 — { cableId, x, y } 또는 null
  const [cableMenu, setCableMenu] = useState(null)

  // 이펙터 컨트롤 state — { perspective: { who, time, strength }, ... }
  const [effectorState, setEffectorState] = useState(() => defaultEffectorState())
  const onControlChange = (kind, param, value) => {
    if (typeof value === 'number') sound.tick(value) // 노브의 촉감 — 짧은 틱
    setEffectorState((s) => ({
      ...s,
      [kind]: { ...(s[kind] || {}), [param]: value },
    }))
  }

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }))
  }, [])

  // 부팅 = 완전 초기화. 새로고침하면 즉시 비운 상태에서 부팅 화면으로 시작한다.
  // (세션 복원·자동 저장 폐기 — 이전 데이터가 배경에 남아 소리·드론이 새는 일이 없게.)
  useEffect(() => {
    try { localStorage.removeItem('idea-synth-v1') } catch (e) { /* ignore */ }
  }, [])

  // 자석 스냅 — 포인터 근처의 호환 가능한 잭을 찾는다 (반경 30px)
  const findSnapJack = (fromId, x, y, curCables) => {
    let best = null
    let bestD = 30
    document.querySelectorAll('[data-jack-id]').forEach((el) => {
      const id = el.getAttribute('data-jack-id')
      if (!id || id === fromId) return
      const r = el.getBoundingClientRect()
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y)
      if (d < bestD && validateCable(fromId, id, curCables).ok) {
        bestD = d
        best = id
      }
    })
    return best
  }

  // 드래그 중 마우스 추적 + 놓으면 자석 스냅으로 연결 (잭 정중앙이 아니어도)
  useEffect(() => {
    if (!dragging) return
    const move = (e) => {
      setDragging((d) => (d ? { ...d, mouseX: e.clientX, mouseY: e.clientY } : null))
    }
    const up = (e) => {
      setDragging((d) => {
        if (d) {
          setCables((prev) => {
            const snap = findSnapJack(d.fromId, e.clientX, e.clientY, prev)
            if (!snap) return prev
            const v = validateCable(d.fromId, snap, prev)
            if (!v.ok) return prev
            return [
              ...prev,
              {
                id: `c-${Date.now()}`,
                from: v.normalized.from,
                to: v.normalized.to,
                kind: v.normalized.kind,
                sagFactor: 0.9 + Math.random() * 0.4,
                driftFactor: (Math.random() * 2 - 1) * 0.8,
                relation: 'transfer',
              },
            ]
          })
        }
        return null
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [!!dragging])

  // 분석 요청 서명 — 세대 이동 등으로 invalidate 되면 낡은 응답은 버린다.
  // (GEN 을 옮긴 뒤 도착한 이전 세대의 분석이 화면을 덮어쓰는 레이스 방지)
  const analyzeSeqRef = useRef(0)

  async function analyze(overrideText) {
    const src = typeof overrideText === 'string' ? overrideText : text
    if ((!src.trim() && !pendingImage) || analyzing) return
    const seq = ++analyzeSeqRef.current
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      // 이미지가 있으면 vision 분해 경로 — 이미지도 사고 단위가 된다
      const route = pendingImage ? '/api/analyze-image' : '/api/analyze'
      const payload = pendingImage
        ? { image: pendingImage, text: src, agentId }
        : { text: src, agentId }
      const r = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (r.status === 404 && pendingImage) throw new Error('백엔드 재시작 필요 — python3 synth/server.py')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      if (seq !== analyzeSeqRef.current) return // 낡은 응답 — 폐기
      if (data.error) throw new Error(data.error)
      // 이미지 노드에 썸네일 부착
      if (pendingImage && data.nodes?.length && data.imageNodeIndex != null) {
        data.nodes[data.imageNodeIndex] = { ...data.nodes[data.imageNodeIndex], image: pendingImage }
      }
      console.log('[analyze] 응답', data)
      setResult(data)
      setPendingImage(null)
      sound.analyzeDone(data.nodes?.length || 0)

      // 신호 흐름은 노드 → 이펙터 → OUTPUT. 노드끼리의 자동 케이블은
      // chainForNode 가 무시하는 죽은 갈래라 엉킴만 만든다 → 자동으로 깔지 않음.
      // 사용자가 NODE-OUT 을 이펙터 IN 에 직접 꽂아 체인을 만든다.
      // (LLM relation 그래프는 result.edges 에 그대로 남아 edgeCount 등에 쓰임.)
      setCables([])
    } catch (e) {
      if (seq !== analyzeSeqRef.current) return
      console.error('[analyze] 실패', e)
      setError(String(e))
    } finally {
      if (seq === analyzeSeqRef.current) setAnalyzing(false)
    }
  }

  // 잭 드래그 콜백 — OUT→IN 방향성·잭 종류·다중 제한 검증 (lib/jacks.js)
  const onJackDown = (jackId, e) => {
    setDragging({ fromId: jackId, mouseX: e.clientX, mouseY: e.clientY })
  }
  const onJackUp = (jackId) => {
    if (dragging) {
      const v = validateCable(dragging.fromId, jackId, cables)
      if (v.ok) {
        setCables((prev) => [
          ...prev,
          {
            id: `c-${Date.now()}`,
            from: v.normalized.from,
            to: v.normalized.to,
            kind: v.normalized.kind,
            // 늘어짐 다양화 — 1.0 (지금이 최소) ~ 2.5 (더 늘어짐)
            sagFactor: 0.9 + Math.random() * 0.4,
            // 좌·우 자연스러운 휨 (-1 ~ 1) — 진짜 전선 결
            driftFactor: (Math.random() * 2 - 1) * 0.8,
            // 신호 케이블의 기본 관계 = '흐름' (transfer). 케이블은 늘 신호가 흐르는 것;
            // '미정' 이라는 빈 상태는 없앤다. 더 구체적 관계는 케이블 클릭으로 지정.
            relation: 'transfer',
          },
        ])
        sound.patch() // 잭에 케이블이 꽂히는 손맛
      } else {
        console.log('[cable] 거절:', v.reason, dragging.fromId, '→', jackId)
      }
    }
    setDragging(null)
  }

  const analyzedNodes = result?.nodes ?? []
  // 외부 텍스트 입력 — 떠다니는 모듈. 분석 노드 뒤에 붙어 회로에 소스로 합류한다(엣지 인덱스 보존).
  const nodes = manualInputs.length
    ? [...analyzedNodes, ...manualInputs.map((m) => ({ id: m.id, type: 'Observation', title: m.title || '외부 입력', content: m.text, manual: true }))]
    : analyzedNodes
  const edges = result?.edges ?? []
  const nodeCount = nodes.length
  const edgeCount = edges.length

  // DIAGRAM 용 합성 그래프 — analyze 노드/엣지에 INFER·CONTRADICT 갈래(IWIN)와
  // 그 부모→갈래 연결을 더해 회로 전체가 한 화면에 보이게 한다 (엣지는 인덱스 기준).
  const diagramNodes = [...nodes]
  const diagramEdges = [...edges]
  inferWins.forEach((w) => {
    (w.branches || []).forEach((b) => {
      const childIdx = diagramNodes.length
      diagramNodes.push({ id: `iwin-${b.bid}`, type: 'Insight', title: b.title, content: b.content, synthesized: true })
      ;(w.srcIds || []).forEach((sid) => {
        const pIdx = diagramNodes.findIndex((n) => n.id === sid)
        if (pIdx >= 0) diagramEdges.push({ from: pIdx, to: childIdx, relationType: w.relation || 'derives' })
      })
    })
  })

  // 신호 경로 — OUT 버스(OUT-IN)에 닿은 신호만 출력이 된다.
  // paths[id] = { chain, audible }. audible=false 노드는 무음 (출력 없음).
  const paths = {}
  nodes.forEach((n) => { paths[n.id] = signalPath(n.id, cables) })

  // 드라이 직결 — NODE-OUT → OUT-IN (이펙터 없이, 또는 전부 bypass)
  const dryIds = []
  // 노드 → 이펙터 체인 → API 요청 바디 (실제 합성에 들어가는 입력)
  const tasks = []
  nodes.forEach((n) => {
    const p = paths[n.id]
    if (!p.audible) return // 버스 미도달 — 들리지 않는다
    const chain = p.chain.filter((c) => !effectorState[c.kind]?._bypass)
    if (!chain.length) {
      dryIds.push(n.id)
      return
    }
    const body = {
      text: n.content || n.title || '',
      agentId, // 장착된 에이전트가 이펙터의 어휘·관점을 공급
      agentInfluence, // 0 = 중립, 올리면 에이전트 관점이 변형에 섞인다
      effects: chain.map((c, i) => {
        // _bypass 같은 메타 키 제외, 컨트롤 값만 넘김
        const raw = effectorState[c.kind] || {}
        const controls = Object.fromEntries(
          Object.entries(raw).filter(([k]) => !k.startsWith('_'))
        )
        // relation 포함 — 케이블의 관계가 변형의 방향이 된다 (서명에도 포함되어
        // 관계를 바꾸면 해당 체인만 재합성된다)
        const eff = { id: `${c.effectorId}-${i}`, kind: c.kind, controls, relation: c.relation }
        // 두 번째 입력(IN_B) — 노드를 조건으로 주입: PERSPECTIVE 관점·CONSTRAIN 제약·CONNECT 다리
        if (c.kind === 'connect' || c.kind === 'constrain' || c.kind === 'perspective') {
          const bCable = cables.find((cb) => cb.to === `${c.effectorId}-IN_B`)
          if (bCable) {
            const bText = resolveSourceText(bCable.from, nodes, outputs, inferBranchMap)
            if (bText) eff.inputB = bText
          }
        }
        return eff
      }),
    }
    tasks.push({ node: n, body, sig: JSON.stringify(body) })
  })

  // 노드별 체인 길이 (DIAGRAM 이 먹는 데이터)
  const chainLens = {}
  tasks.forEach((t) => { chainLens[t.node.id] = t.body.effects.length })

  // ── PANEL (그래스호퍼 패널) — PANEL-IN 에 꽂힌 지점의 *중간 내용* 을 실시간 해석 ──
  const panelCable = cables.find((c) => c.to === 'PANEL-IN')
  const panelSource = panelCable?.from || null
  const panelText = (() => {
    if (!panelSource) return ''
    if (panelSource.startsWith('IWIN-') && inferBranchMap[panelSource]) {
      const b = inferBranchMap[panelSource]
      return (b.content || b.title || '')
    }
    if (panelSource.startsWith('NODE-') && panelSource.endsWith('-OUT')) {
      const id = panelSource.slice(5, panelSource.length - 4)
      const n = nodes.find((x) => x.id === id)
      return n ? (outputs[id]?.finalText || n.content || n.title || '') : ''
    }
    const m = panelSource.match(/^FX-(.+)-OUT$/)
    if (m) {
      const kind = m[1]
      for (const n of nodes) {
        const chain = (paths[n.id]?.chain || []).filter((c) => !effectorState[c.kind]?._bypass)
        const idx = chain.findIndex((c) => c.kind === kind)
        if (idx >= 0) {
          const o = outputs[n.id]
          if (o?.busy) return '재합성 중…'
          return (o?.stages?.[idx]?.text) || ''
        }
      }
    }
    return ''
  })()
  // 패널이 가리키는 지점의 이름표 (어디를 보고 있는지)
  const panelLabel = (() => {
    if (!panelSource) return ''
    if (panelSource.startsWith('IWIN-')) return 'INFER 갈래'
    if (panelSource.startsWith('NODE-')) {
      const id = panelSource.slice(5, panelSource.length - 4)
      const n = nodes.find((x) => x.id === id)
      return n ? `NODE · ${n.title || ''}` : ''
    }
    const m = panelSource.match(/^FX-(.+)-OUT$/)
    return m ? `${m[1].toUpperCase()} OUT` : ''
  })()

  // 케이블별 홉 번호 — 모든 신호 케이블에 일관되게 매긴다 (BFS 깊이).
  // 규칙: 배지 = 출발지에서 이 케이블까지 거친 이펙터 홉 수. 노드/이펙터 OUT 에서
  // 나가는 케이블은 분기·곁가지(IN_B)·종단(OUT-IN) 가릴 것 없이 전부 번호가 붙는다.
  const cableSeq = {}
  const outDepth = new Map() // OUT 잭 id → 깊이 (노드 = 0)
  nodes.forEach((n) => outDepth.set(`NODE-${n.id}-OUT`, 0))
  for (let pass = 0; pass < 12; pass++) {
    cables.forEach((cb) => {
      const d = outDepth.get(cb.from)
      if (d === undefined) return
      if (cableSeq[cb.id] === undefined) cableSeq[cb.id] = d + 1
      if (cb.to.startsWith('FX-')) {
        const outJ = cb.to.slice(0, cb.to.lastIndexOf('-')) + '-OUT'
        const prev = outDepth.get(outJ)
        if (prev === undefined || prev > d + 1) outDepth.set(outJ, d + 1)
      }
    })
  }

  // 재호출 트리거 = 실제로 보낼 바디들의 서명 + 가청 집합.
  // 어떤 노드 체인에도 안 꽂힌(또는 bypass 된) 이펙터를 만지면 어떤 바디도
  // 안 바뀌므로 트리거가 그대로 → 출력이 흔들리지 않는다.
  const trigger = JSON.stringify([
    tasks.map((t) => [t.node.id, t.sig]).sort(),
    [...dryIds].sort(),
  ])
  const debouncedTrigger = useDebounce(trigger, 480)
  // 연주의 손맛 — 조작 즉시 '재합성 대기' 상태. 결과(AI)가 오기 전에 행동이 인정된다.
  const pending = trigger !== debouncedTrigger && tasks.length > 0

  // 노드별 마지막 전송 서명 — 바디가 바뀐 노드만 다시 POST.
  // (한 노드를 바꿔도 나머지 노드 출력은 재호출 없이 보존)
  const sentSigRef = useRef({})

  useEffect(() => {
    // 출력 = 가청 신호만 (OUT 버스 도달). 사라진 노드·버스에서 뽑힌 노드는 정리.
    const audibleIds = new Set([...tasks.map((t) => t.node.id), ...dryIds])
    setOutputs((prev) => {
      let changed = false
      const next = {}
      for (const id of Object.keys(prev)) {
        if (audibleIds.has(id)) next[id] = prev[id]
        else changed = true
      }
      return changed ? next : prev
    })
    // 체인이 풀린 자리는 서명 정리 → 다시 꽂으면 재호출
    const liveIds = new Set(tasks.map((t) => t.node.id))
    for (const id of Object.keys(sentSigRef.current)) {
      if (!liveIds.has(id)) delete sentSigRef.current[id]
    }

    // 드라이 직결 — NODE-OUT → OUT-IN. 변형 없이 본문이 그대로 출력된다.
    setOutputs((prev) => {
      let changed = false
      const next = { ...prev }
      for (const n of nodes) {
        if (!dryIds.includes(n.id)) continue
        const dry = n.content || n.title || ''
        const cur = prev[n.id]
        if (!cur || !cur.passthrough || cur.finalText !== dry) {
          next[n.id] = { finalText: dry, stages: [], busy: false, error: null, passthrough: true }
          changed = true
        }
      }
      return changed ? next : prev
    })

    // 서명이 바뀐 노드만 호출
    const todo = tasks.filter((t) => sentSigRef.current[t.node.id] !== t.sig)
    if (!todo.length) return

    setOutputs((prev) => {
      const next = { ...prev }
      todo.forEach((t) => {
        next[t.node.id] = { ...(prev[t.node.id] || {}), busy: true }
      })
      return next
    })

    let cancelled = false
    let arrivedThisBatch = false // 도착음은 배치당 한 번만 — 노드마다 다른 음이 겹쳐 '두 소리'로 들리던 문제 제거
    todo.forEach(async (t) => {
      const t0 = performance.now()
      try {
        const r = await fetch('/api/apply-effects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(t.body),
        })
        const data = await r.json()
        if (cancelled) return
        sentSigRef.current[t.node.id] = t.sig
        setOutputs((prev) => ({
          ...prev,
          [t.node.id]: {
            finalText: data.finalText || data.error || '(빈 결과)',
            stages: data.stages || [],
            busy: false,
            error: data.error || null,
          },
        }))
        // 텔레메트리 — 방금 무슨 변형이 흘렀는지 (이펙터·채널 포함)
        const chainStr = t.body.effects
          .map((e) => `${e.kind.toUpperCase()}·VEN${Math.round((e.controls?.leap ?? 0) * 100)}`)
          .join('→')
        const picked = (data.stages || [])
          .flatMap((st) => Object.values(st.selected || {}))
          .map((s) => s?.label)
          .filter((l) => l && !String(l).includes('%'))[0]
        setTelemetry(
          `FX ${chainStr}  ${((performance.now() - t0) / 1000).toFixed(1)}s — "${t.node.title}" 재합성${picked ? ` · ${picked}` : ''}`
        )
        if (!arrivedThisBatch) { arrivedThisBatch = true; sound.arrive(nodes.findIndex((n) => n.id === t.node.id)) }
      } catch (e) {
        if (cancelled) return
        setOutputs((prev) => ({
          ...prev,
          [t.node.id]: { finalText: null, busy: false, error: String(e) },
        }))
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTrigger, result])

  // ── quality → 시각 회로 ──────────────────────────────
  // OUTPUT 의 finalText 가 확정될 때마다 에이전트 평가를 호출하고,
  // 점수는 *절대 텍스트로 노출하지 않는다* — OutputModule 의 LED 래더가
  // 축별 점수를 단계적 광량(켜진 칸 수)으로만 번역한다.
  const qualityInflight = useRef(new Set())
  useEffect(() => {
    const jobs = []
    for (const [nodeId, out] of Object.entries(outputs)) {
      if (!out?.finalText || out.busy || out.error) continue
      const key = `${agentId}|${out.finalText}`
      if (out.qualityKey === key) continue
      if (qualityInflight.current.has(`${nodeId}|${key}`)) continue
      jobs.push({ nodeId, text: out.finalText, key })
    }
    if (!jobs.length) return
    jobs.forEach(async ({ nodeId, text: qText, key }) => {
      qualityInflight.current.add(`${nodeId}|${key}`)
      try {
        const r = await fetch('/api/quality', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: qText, agentId }),
        })
        const data = await r.json()
        setOutputs((prev) => {
          const cur = prev[nodeId]
          // 그 사이 출력이 바뀌었으면 버린다 (낡은 평가)
          if (!cur || `${agentId}|${cur.finalText}` !== key) return prev
          return {
            ...prev,
            [nodeId]: {
              ...cur,
              quality: data.error ? null : { scores: data.scores, axes: data.axes },
              qualityKey: key,
            },
          }
        })
      } catch (e) {
        console.warn('[quality] 실패', e)
      } finally {
        qualityInflight.current.delete(`${nodeId}|${key}`)
      }
    })
  }, [outputs, agentId])

  // AUTO PATCH — 내용 기반 자동 패치 + 누를 때마다 다른 회로 (리롤).
  // 기본은 노드의 추천 이펙터, 일부는 이웃 이펙터로 흔들고, 가끔 2단 체인을 건다.
  // 이펙터 6 종 확정 (2026-06-12) — 겹치는 4 종 폐기:
  // analogy→connect · zoom→abstraction · genealogy/defamiliarize→perspective
  const FX_KINDS = ['perspective', 'contradict', 'consequence', 'constrain', 'abstraction', 'connect']
  const onAutoPatch = () => {
    setCables((prev) => {
      // 이전 자동 패치는 걷어낸다 — 손으로 꽂은 케이블만 보존
      const next = prev.filter((c) => !c.id.startsWith('c-auto'))
      // 자동 패치는 관계도 기계가 정한다 — 케이블마다 랜덤 관계(색).
      // (손으로 꽂은 케이블은 여전히 미정 회색에서 시작 — 사용자가 지정)
      const RELS = Object.keys(RELATIONS)
      const mkCable = (id, from, to) => {
        const v = validateCable(from, to, next)
        if (!v.ok) return false
        next.push({
          id,
          from: v.normalized.from,
          to: v.normalized.to,
          kind: v.normalized.kind,
          sagFactor: 0.9 + Math.random() * 0.4,
          driftFactor: (Math.random() * 2 - 1) * 0.8,
          relation: RELS[(Math.random() * RELS.length) | 0],
        })
        return true
      }
      nodes.forEach((n, i) => {
        // 이미 버스에 닿은 수동 회로는 보존
        if (signalPath(n.id, next).audible) return
        const stamp = `${Date.now()}-${i}`
        const manual = chainForNode(n.id, next)
        let lastKind = manual.length ? manual[manual.length - 1].kind : null

        if (!manual.length) {
          // 추천 70% · 이웃 30% — 누를 때마다 다른 회로
          let kind = n.effectorKind && Math.random() < 0.7
            ? n.effectorKind
            : FX_KINDS[(Math.random() * FX_KINDS.length) | 0]
          if (!mkCable(`c-auto-${stamp}`, `NODE-${n.id}-OUT`, `FX-${kind}-IN`)) return
          lastKind = kind
          // 35% 확률로 2단 체인 — 다른 이펙터로 이어 꽂기
          if (Math.random() < 0.35) {
            const pool = FX_KINDS.filter((k) => k !== kind)
            const second = pool[(Math.random() * pool.length) | 0]
            if (mkCable(`c-auto-${stamp}-2`, `FX-${kind}-OUT`, `FX-${second}-IN`)) {
              lastKind = second
            }
          }
        }
        // 종단 — 신호는 OUT 버스에 닿아야 들린다
        if (lastKind) mkCable(`c-auto-${stamp}-out`, `FX-${lastKind}-OUT`, 'OUT-IN')
      })
      return next
    })
  }

  // ── SYNTH — 두 노드의 교배. 양쪽 입력이 차면 합성이 점화된다 ──
  // 입력 케이블은 합성에 소모되고, 자식 노드가 회로에 태어난다.
  const [synthBusy, setSynthBusy] = useState(false)
  const synthSigRef = useRef('') // 마지막 시도 서명 — 실패 시 같은 패치의 무한 재시도 방지
  const synthA = cables.find((c) => c.to === 'SYNTH-IN_A')
  const synthB = cables.find((c) => c.to === 'SYNTH-IN_B')
  useEffect(() => {
    if (!synthA || !synthB || synthBusy) return
    const nodeOf = (cable) => {
      const nid = cable.from.slice('NODE-'.length, cable.from.lastIndexOf('-'))
      return nodes.find((n) => n.id === nid)
    }
    const na = nodeOf(synthA)
    const nb = nodeOf(synthB)
    if (!na || !nb || na.id === nb.id) return
    const sig = `${na.id}|${nb.id}|${agentId}`
    if (synthSigRef.current === sig) return
    synthSigRef.current = sig
    setSynthBusy(true)
    const t0 = performance.now()
    // 두 입력 케이블의 관계가 합성의 방식을 정한다 (충돌 = 변증법적 종합)
    const rel = synthA.relation === synthB.relation ? synthA.relation : (synthA.relation || synthB.relation)
    fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        a: { title: na.title, type: na.type, text: na.content || na.title },
        b: { title: nb.title, type: nb.type, text: nb.content || nb.title },
        relation: rel,
        agentId,
      }),
    })
      .then((r) => {
        if (r.status === 404) throw new Error('백엔드 재시작 필요 — python3 synth/server.py')
        return r.json()
      })
      .then((data) => {
        if (data.error) throw new Error(data.error)
        const child = data.node
        setResult((prev) => {
          if (!prev) return prev
          const ia = prev.nodes.findIndex((n) => n.id === na.id)
          const ib = prev.nodes.findIndex((n) => n.id === nb.id)
          const nodes2 = [...prev.nodes, child]
          const edges2 = [...(prev.edges || [])]
          const ic = nodes2.length - 1
          if (ia >= 0) edges2.push({ from: ia, to: ic, relationType: 'derives' })
          if (ib >= 0) edges2.push({ from: ib, to: ic, relationType: 'derives' })
          return { ...prev, nodes: nodes2, edges: edges2 }
        })
        // 케이블이 SYNTH 에서 자식 노드로 옮겨 붙는다 — 부모 → 자식의 혈통이
        // 회로 위에 그대로 보인다 (자식 카드의 IN 잭으로, 관계 = 분기).
        setCables((prev) => [
          ...prev.filter((c) => c.to !== 'SYNTH-IN_A' && c.to !== 'SYNTH-IN_B'),
          ...[synthA, synthB].map((sc, k) => ({
            id: `c-syn-${Date.now()}-${k}`,
            from: sc.from,
            to: `NODE-${child.id}-IN`,
            kind: 'signal',
            sagFactor: 0.9 + Math.random() * 0.4,
            driftFactor: (Math.random() * 2 - 1) * 0.8,
            relation: 'derives',
          })),
        ])
        synthSigRef.current = ''
        setTelemetry(
          `SYNTH  ${((performance.now() - t0) / 1000).toFixed(1)}s — "${na.title}" × "${nb.title}" → 새 카드 "${child.title}"`
        )
        sound.synthBirth()
      })
      .catch((e) => {
        setTelemetry(`SYNTH 실패 — ${String(e.message || e)}`)
      })
      .finally(() => setSynthBusy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cables, synthBusy])

  // ── INFER 갈래 — OUT 잭에서 이어진 *플로팅 창* 으로 (입력 패널 노드로 들어가지 않는다) ──
  // 입력이 INFER 에 닿아 추론이 끝나면 자동으로 갈래 창들이 OUT 잭에서 떠오른다.
  // (cqBusy·inferWins·inferSigRef 는 위에서 선언됨 — 갈래를 소스로 참조하려고 일찍 선언.)
  // 한 OUT 잭 → 거슬러 올라가 출발 노드 id 를 찾는다 (이펙터 체인을 통과해도 추적).
  const traceCqSource = (fromJack) => {
    let cur = fromJack
    for (let i = 0; i < 16; i++) {
      if (cur.startsWith('NODE-') && cur.endsWith('-OUT')) return cur.slice(5, cur.length - 4)
      if (!cur.startsWith('FX-')) return null
      const mod = cur.slice(0, cur.lastIndexOf('-'))
      const inCable = cables.find((c) => c.to === `${mod}-IN` || c.to === `${mod}-IN_A`)
      if (!inCable) return null
      cur = inCable.from
    }
    return null
  }
  // INFER IN 에 닿은 *모든* 케이블의 소스 노드를 모아 하나로 합쳐 추론한다.
  // (find 로 첫 케이블만 잡던 옛 동작 → 입력을 더 꽂아도 무시되던 문제 해소.)
  const cqSourceIds = [...new Set(
    cables.filter((c) => c.to === 'FX-consequence-IN').map((c) => traceCqSource(c.from)).filter(Boolean)
  )].sort()
  // 자동 발사 — 합쳐진 입력 텍스트 + 방향/도약/믹스/변주 서명이 바뀌면 한 번만 추론한다.
  const cqSrcParts = cqSourceIds
    .map((id) => (outputs[id]?.finalText || nodes.find((n) => n.id === id)?.content || '').trim())
    .filter(Boolean)
  const cqSrcText = cqSrcParts.join('\n\n')
  const cqMix = (effectorState.consequence?.mix) ?? 0.5
  const cqLeap = (effectorState.consequence?.leap) ?? 0
  const cqDir = ((effectorState.consequence?.dir) ?? 0) >= 0.5 ? 'backward' : 'forward'
  const cqSig = cqSourceIds.length && cqSrcText
    ? `${cqSourceIds.join(',')}|${cqDir}|${cqLeap}|${cqMix}|${effectorState.consequence?.vary ?? 0}|${cqSrcText.slice(0, 120)}`
    : ''
  const clearWinCables = (prev, fromJack) => prev.filter((c) => !(c.from === fromJack && c.to.startsWith('IWIN-')))
  useEffect(() => {
    if (!cqSig) {
      if (!cqSourceIds.length) { setInferWins((p) => p.filter((w) => w.eff !== 'consequence')); inferSigRef.current = ''; cqBidRef.current = null; setCables((prev) => clearWinCables(prev, 'FX-consequence-OUT')) }
      return
    }
    if (cqSig === inferSigRef.current || cqBusy) return
    inferSigRef.current = cqSig
    const srcNodes = cqSourceIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean)
    if (!srcNodes.length) return
    // 여러 입력이면 종합임을 제목에 드러낸다
    const srcTitle = srcNodes.length > 1
      ? `입력 ${srcNodes.length}개 종합`
      : (srcNodes[0].title || '')
    setCqBusy(true)
    const t0 = performance.now()
    const backward = cqDir === 'backward'
    // 첫 추론이면 새 창, 노브만 바꿔 재추론하면 *같은 bid 를 재사용* —
    // 창 위치와 사용자가 꽂은 하류 케이블(IWIN-OUT→OUT-IN)이 보존된다.
    const reuse = cqBidRef.current != null
    const winId = reuse ? null : `inf${Date.now().toString(36)}`
    const bid = reuse ? cqBidRef.current : `${winId}-0`
    fetch('/api/consequence-split', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cqSrcText, agentId, leap: cqLeap, mix: cqMix, direction: cqDir }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        const k = (data.nodes || [])[0]
        if (!k) throw new Error('갈래 없음')
        const branch = { bid, title: k.title, content: k.content }
        const rel = backward ? 'supports' : 'derives'
        const label = backward ? '근거' : '결과'
        setInferWins((p) => {
          const has = p.some((w) => w.eff === 'consequence')
          if (has) {
            // 내용만 갱신 — id·bid 유지 (창·케이블 보존)
            return p.map((w) => w.eff === 'consequence'
              ? { ...w, label, srcTitle, branches: [branch], relation: rel, srcIds: cqSourceIds }
              : w)
          }
          return [...p, { id: winId, eff: 'consequence', fromJack: 'FX-consequence-OUT', label, srcTitle, branches: [branch], relation: rel, srcIds: cqSourceIds }]
        })
        cqBidRef.current = bid
        // 새로 태어날 때만 INFER-OUT→갈래 케이블을 깐다. 재추론은 케이블을 건드리지 않는다.
        if (!reuse) {
          setCables((prev) => [
            ...clearWinCables(prev, 'FX-consequence-OUT'),
            { id: `c-${bid}`, from: 'FX-consequence-OUT', to: `IWIN-${bid}-IN`, kind: 'signal', sagFactor: 0.8, driftFactor: 0, relation: rel },
          ])
        }
        setTelemetry(`INFER ${label}  ${((performance.now() - t0) / 1000).toFixed(1)}s — "${srcTitle}"${reuse ? ' (갱신)' : ' → 갈래 창'}`)
        sound.synthBirth()
      })
      .catch((e) => setTelemetry(`INFER 실패 — ${String(e.message || e)}`))
      .finally(() => setCqBusy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cqSig])

  // ── CONTRADICT — 반대 관점도 OUT 잭의 플로팅 창으로 (INFER 와 일관). 자동 발사. ──
  const [ctBusy, setCtBusy] = useState(false)
  const ctSigRef = useRef('')
  const ctCable = cables.find((c) => c.to === 'FX-contradict-IN')
  const ctSourceId = (() => {
    if (!ctCable) return null
    let cur = ctCable.from
    for (let i = 0; i < 16; i++) {
      if (cur.startsWith('NODE-') && cur.endsWith('-OUT')) return cur.slice(5, cur.length - 4)
      if (!cur.startsWith('FX-')) return null
      const mod = cur.slice(0, cur.lastIndexOf('-'))
      const inCable = cables.find((c) => c.to === `${mod}-IN` || c.to === `${mod}-IN_A`)
      if (!inCable) return null
      cur = inCable.from
    }
    return null
  })()
  const ctSrcText = ctSourceId ? (outputs[ctSourceId]?.finalText || nodes.find((n) => n.id === ctSourceId)?.content || '').trim() : ''
  const ctSig = ctSourceId && ctSrcText
    ? `${ctSourceId}|${effectorState.contradict?.leap ?? 0}|${effectorState.contradict?.vary ?? 0}|${ctSrcText.slice(0, 80)}`
    : ''
  useEffect(() => {
    if (!ctSig) {
      if (!ctSourceId) { setInferWins((p) => p.filter((w) => w.eff !== 'contradict')); ctSigRef.current = ''; setCables((prev) => clearWinCables(prev, 'FX-contradict-OUT')) }
      return
    }
    if (ctSig === ctSigRef.current || ctBusy) return
    ctSigRef.current = ctSig
    const src = nodes.find((n) => n.id === ctSourceId)
    if (!src) return
    setCtBusy(true)
    const t0 = performance.now()
    const winId = `ct${Date.now().toString(36)}`
    fetch('/api/contradict-split', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: ctSrcText, agentId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        const kids = (data.nodes || []).slice(0, 1).map((k, i) => ({ bid: `${winId}-${i}`, title: k.title, content: k.content }))
        setInferWins((p) => [...p.filter((w) => w.eff !== 'contradict'),
          { id: winId, eff: 'contradict', fromJack: 'FX-contradict-OUT', label: '반대 관점', srcTitle: src.title, branches: kids, relation: 'contradicts', srcIds: [ctSourceId] }])
        setCables((prev) => [
          ...clearWinCables(prev, 'FX-contradict-OUT'),
          ...kids.map((b) => ({ id: `c-${b.bid}`, from: 'FX-contradict-OUT', to: `IWIN-${b.bid}-IN`, kind: 'signal', sagFactor: 0.8, driftFactor: 0, relation: 'contradicts' })),
        ])
        setTelemetry(`CONTRADICT  ${((performance.now() - t0) / 1000).toFixed(1)}s — "${src.title}" → 반대 관점 ${kids.length}개 창`)
        sound.synthBirth()
      })
      .catch((e) => setTelemetry(`CONTRADICT 실패 — ${String(e.message || e)}`))
      .finally(() => setCtBusy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctSig])

  // ── 이미지 재합성 — 그 노드의 체인 어휘가 이미지를 변형한다 ──
  // 비용이 큰 신호라 자동이 아니라 명시적 행동(⟳ IMG)에만 호출된다.
  const onTransformImage = async (nodeId) => {
    const n = nodes.find((x) => x.id === nodeId)
    if (!n?.image || imgBusyIds.has(nodeId)) return
    const p = signalPath(nodeId, cables)
    const chain = p.chain.filter((c) => !effectorState[c.kind]?._bypass)
    if (!chain.length) {
      setTelemetry('IMG — 체인이 없습니다. 카드 OUT 을 이펙터에 꽂은 뒤 재합성하세요.')
      return
    }
    const effects = chain.map((c, i) => {
      const raw = effectorState[c.kind] || {}
      const controls = Object.fromEntries(
        Object.entries(raw).filter(([k]) => !k.startsWith('_'))
      )
      return { id: `${c.effectorId}-${i}`, kind: c.kind, controls, relation: c.relation }
    })
    setImgBusyIds((prev) => new Set(prev).add(nodeId))
    const t0 = performance.now()
    try {
      const r = await fetch('/api/transform-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: n.image, effects, agentId }),
      })
      if (r.status === 404) throw new Error('백엔드 재시작 필요 — python3 synth/server.py')
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setResult((prev) =>
        prev
          ? { ...prev, nodes: prev.nodes.map((x) => (x.id === nodeId ? { ...x, imageOut: data.image } : x)) }
          : prev
      )
      setTelemetry(
        `IMG ${chain.map((c) => c.kind.toUpperCase()).join('→')}  ${((performance.now() - t0) / 1000).toFixed(1)}s — 이미지 재합성 완료`
      )
      sound.arrive(2)
    } catch (e) {
      setTelemetry(`IMG 실패 — ${String(e.message || e)}`)
    } finally {
      setImgBusyIds((prev) => {
        const s2 = new Set(prev)
        s2.delete(nodeId)
        return s2
      })
    }
  }

  // ── VISION 렌더 — 출력(선언문)을 선택된 시각 코드로 이미지화 ──
  // OUT-SEND → VISION-IN 케이블이 전원이고, 호출은 명시적 ⟳ 렌더 버튼에만.
  const visionConnected = cables.some((c) => c.to === 'VISION-IN' && c.from === 'OUT-SEND')

  // ⟳ 구상 — 선언문을 그대로 보내지 않고, 장면 후보 셋을 먼저 받아 던진다.
  const onRequestVisionOptions = async () => {
    if (!visionConnected || vision.optBusy || vision.busy) return
    if (!master.statement) {
      setTelemetry('VISION — 아직 출력(선언문)이 없습니다. 회로가 정착하면 구상을 받으세요.')
      return
    }
    setVision((v) => ({ ...v, optBusy: true, options: [], sel: null }))
    const t0 = performance.now()
    try {
      const r = await fetch('/api/vision-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: master.statement, agentId, code: vision.code }),
      })
      if (r.status === 404) throw new Error('백엔드 재시작 필요 — python3 synth/server.py')
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setVision((v) => ({ ...v, options: data.options || [], optBusy: false }))
      setTelemetry(
        `VISION 구상 ${((performance.now() - t0) / 1000).toFixed(1)}s — ${(data.options || []).length}개 장면 후보 · ${vision.code === 'aesthetic' ? '화풍' : '사유'} 코드`
      )
      sound.visionDone()
    } catch (e) {
      setVision((v) => ({ ...v, optBusy: false }))
      setTelemetry(`VISION 구상 실패 — ${String(e.message || e)}`)
    }
  }

  // 고른 시안(option)으로만 이미지를 생성한다.
  const onRenderVision = async (option, idx) => {
    if (!visionConnected || vision.busy || !option) return
    if (!master.statement) return
    setVision((v) => ({ ...v, busy: true, sel: idx ?? null }))
    const t0 = performance.now()
    try {
      const r = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: master.statement, agentId, code: vision.code, option, size: RATIO_SIZE[vision.ratio] || '1024x1024' }),
      })
      if (r.status === 404) throw new Error('백엔드 재시작 필요 — python3 synth/server.py')
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      const entry = { image: data.image, label: option.label, code: vision.code, ratio: vision.ratio, ts: Date.now() }
      setVision((v) => ({ ...v, image: data.image, busy: false, history: [...v.history, entry].slice(-12) }))
      setTelemetry(
        `VISION  ${((performance.now() - t0) / 1000).toFixed(1)}s — '${option.label}' 시안을 ${vision.code === 'aesthetic' ? '화풍' : '사유'} 코드로 이미지화`
      )
      sound.visionDone()
    } catch (e) {
      setVision((v) => ({ ...v, busy: false }))
      setTelemetry(`VISION 실패 — ${String(e.message || e)}`)
    }
  }

  // MASTER — 버튼 없음. 회로 내용이 정착하면 자동 렌더된다.
  const runMaster = async (parts) => {
    setMaster((m) => ({ ...m, busy: true, error: null }))
    const t0 = performance.now()
    try {
      const r = await fetch('/api/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, parts, agentId, agentInfluence }),
      })
      if (r.status === 404) {
        throw new Error('백엔드 재시작 필요 — python3 synth/server.py 다시 실행')
      }
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setMaster({ statement: data.statement, busy: false, error: null })
      setTelemetry(`MASTER  ${((performance.now() - t0) / 1000).toFixed(1)}s — 갈래 ${parts.length}개 믹스다운 → 선언문 갱신`)
      sound.masterResolve()
    } catch (e) {
      setMaster((m) => ({ ...m, busy: false, error: String(e) }))
    }
  }

  // 자동 렌더 — 모든 변형이 끝나고(busy 없음) 내용 서명이 바뀌면 1.6초 뒤 믹스다운.
  const masterSigRef = useRef('')
  const masterTimerRef = useRef(null)
  useEffect(() => {
    if (Object.values(outputs).some((o) => o?.busy)) return
    // 갈래가 *어떤 관계로* 출력에 닿았는지 — 종단 케이블의 관계를 함께 싣는다 (master 가 구조를 읽게).
    const relLabel = (rel) => RELATIONS[rel]?.label || ''
    // *현재* OUTPUT 버스에 닿은 노드만 합산한다 (연결 끊긴 옛 출력이 섞여 장문이 되던 문제 차단).
    const nodeParts = nodes
      .filter((n) => outputs[n.id]?.finalText && paths[n.id]?.audible)
      .map((n) => {
        const ch = paths[n.id].chain
        const exitJack = ch.length ? `${ch[ch.length - 1].effectorId}-OUT` : `NODE-${n.id}-OUT`
        const term = cables.find((c) => c.from === exitJack && c.to === 'OUT-IN')
        return { title: n.title, type: n.type, text: outputs[n.id].finalText, relation: relLabel(term?.relation) }
      })
    // INFER 갈래 — 그 OUT 이 OUTPUT(OUT-IN) 에 꽂혀 있으면 STATEMENT 에 합산된다
    const branchParts = inferWins.flatMap((w) => w.branches
      .filter((b) => cables.some((c) => c.from === `IWIN-${b.bid}-OUT` && c.to === 'OUT-IN'))
      .map((b) => {
        const term = cables.find((c) => c.from === `IWIN-${b.bid}-OUT` && c.to === 'OUT-IN')
        return { title: b.title, type: 'Insight', text: b.content, relation: relLabel(term?.relation) }
      }))
    const parts = [...nodeParts, ...branchParts]
    if (!parts.length) return
    // agentInfluence·관계 포함 — 주입량이나 케이블 관계만 바꿔도 master 가 다시 종합되게 (드라이 회로에서도 STATEMENT 가 반응).
    const sig = `${agentId}|inf${agentInfluence}|${parts.map((p) => `${p.relation}:${p.text}`).join('§')}`
    if (sig === masterSigRef.current) return
    clearTimeout(masterTimerRef.current)
    masterTimerRef.current = setTimeout(() => {
      masterSigRef.current = sig
      runMaster(parts)
    }, 1600)
    return () => clearTimeout(masterTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputs, agentId, result, agentInfluence, cables, inferWins])

  // 종합 변주 — 같은 회로의 서로 다른 종합 여러 안 (비교·선택). 조합의 복리.
  const [masterAlts, setMasterAlts] = useState({ busy: false, list: [] })
  const onMasterVariations = async () => {
    const parts = nodes
      .filter((n) => outputs[n.id]?.finalText)
      .map((n) => ({ title: n.title, type: n.type, text: outputs[n.id].finalText }))
    if (!parts.length && !text.trim()) { setTelemetry('종합할 회로가 없습니다.'); return }
    setMasterAlts({ busy: true, list: [] })
    const t0 = performance.now()
    try {
      const r = await fetch('/api/master-variations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, parts, agentId, agentInfluence, n: 3 }),
      })
      if (r.status === 404) throw new Error('백엔드 재시작 필요 — python3 synth/server.py')
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setMasterAlts({ busy: false, list: d.statements || [] })
      setTelemetry(`종합 변주  ${((performance.now() - t0) / 1000).toFixed(1)}s — ${(d.statements || []).length}안 비교`)
    } catch (e) {
      setMasterAlts({ busy: false, list: [] })
      setTelemetry(`종합 변주 실패 — ${String(e.message || e)}`)
    }
  }
  const onPickStatement = (s) => {
    setMaster((m) => ({ ...m, statement: s }))
    masterSigRef.current = `picked|${s.slice(0, 24)}` // 자동 재렌더가 덮어쓰지 않게
    setMasterAlts({ busy: false, list: [] })
  }

  // 노드별 평가 평균 광량 (DIAGRAM 의 노드 밝기가 먹는 값)
  const qualityAvg = {}
  for (const [nid, out] of Object.entries(outputs)) {
    const scores = out?.quality?.scores
    if (!scores) continue
    const vals = Object.values(scores)
    if (!vals.length) continue
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    qualityAvg[nid] = Math.max(0, Math.min(1, (mean - 0.12) / 0.4))
  }

  // ── 워크스테이션 메뉴 액션 ──────────────────────────
  const sessionJson = () =>
    JSON.stringify({ cables, text, result, outputs, effectorState, agentId }, null, 2)

  const onOpenSessionFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result)
        if (typeof s.text === 'string') setText(s.text)
        setResult(s.result || null)
        setCables(Array.isArray(s.cables) ? s.cables : [])
        setOutputs(s.outputs && typeof s.outputs === 'object' ? s.outputs : {})
        if (s.effectorState) setEffectorState(sanitizeEffectorState({ ...defaultEffectorState(), ...s.effectorState }))
        if (isKnownAgentId(s.agentId, extraAgents)) setAgentId(s.agentId)
        setError(null)
      } catch (err) {
        setError('세션 파일을 읽지 못했습니다')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const exportReport = () => {
    const meta = curMeta
    const lines = []
    lines.push(`# Idea Synthesizer — 세션 리포트`)
    lines.push('')
    lines.push(`- 날짜: ${new Date().toLocaleString('ko-KR')}`)
    lines.push(`- 에이전트: ${meta.fullName} (${meta.subtitle})`)
    lines.push('')
    if (text.trim()) {
      lines.push(`## 입력`)
      lines.push('')
      lines.push(text.trim())
      lines.push('')
    }
    if (nodes.length) {
      lines.push(`## 아이디어 (${nodes.length})`)
      lines.push('')
      nodes.forEach((n, i) => {
        lines.push(`### ${String(i + 1).padStart(2, '0')} · ${n.title}  \`${n.type}\` \`${n.synthesisMode}\``)
        lines.push('')
        lines.push(n.content || '')
        lines.push('')
      })
    }
    if (edges.length) {
      lines.push(`## 관계 다이어그램`)
      lines.push('')
      lines.push('```mermaid')
      lines.push('graph LR')
      nodes.forEach((n, i) => {
        const title = (n.title || '').replace(/[\[\]"]/g, ' ')
        lines.push(`  N${i}["${String(i + 1).padStart(2, '0')} ${title}"]`)
      })
      edges.forEach((e) => {
        lines.push(`  N${e.from} -->|${e.relationType}| N${e.to}`)
      })
      lines.push('```')
      lines.push('')
      lines.push(
        edges
          .map((e) => `- ${nodes[e.from]?.title} —(${e.relationType})→ ${nodes[e.to]?.title}`)
          .join('\n')
      )
      lines.push('')
    }
    if (master.statement) {
      lines.push(`## STATEMENT — 마스터 출력`)
      lines.push('')
      lines.push(master.statement)
      lines.push('')
    }
    const transformed = nodes.filter((n) => outputs[n.id]?.finalText)
    if (transformed.length) {
      lines.push(`## 변형 결과`)
      lines.push('')
      transformed.forEach((n, i) => {
        const out = outputs[n.id]
        const chain = (out.stages || []).map((s) => s.kind.toUpperCase()).join(' → ')
        lines.push(`### ${n.title}${chain ? `  \`${chain}\`` : '  `DRY`'}`)
        lines.push('')
        lines.push(out.finalText)
        lines.push('')
      })
    }
    download(`idea-synth-report-${Date.now()}.md`, lines.join('\n'), 'text/markdown')
  }

  // ── 단계 점화 — 어느 순간에도 '다음 행동'이 하나만 빛난다 ──
  // 1 = 입력 전 (INPUT 만 살아 있음) · 2 = 분석 후 (AUTO PATCH 가 빛남) · 3 = 회로 가동
  const stage = nodes.length === 0 ? 1 : cables.length === 0 ? 2 : 3

  // 첫 신호가 OUT 버스에 닿는 순간 — 닫혀 있던 다이어그램·STATEMENT 가 도크에서 깨어난다.
  const audibleCount = Object.keys(outputs).length
  const prevAudibleRef = useRef(0)
  useEffect(() => {
    if (prevAudibleRef.current === 0 && audibleCount > 0) {
      setWindows((w) => ({
        ...w,
        diagram: w.diagram === 'closed' ? 'docked' : w.diagram,
        statement: w.statement === 'closed' ? 'docked' : w.statement,
      }))
    }
    prevAudibleRef.current = audibleCount
  }, [audibleCount])

  // 드라이 직결(이펙터 없이 출력에 바로 꽂은 신호)도 출력 도달 순간 도착음을 낸다.
  // (이펙터 체인은 apply-effects 완료 시 arrive 가 울리지만, 드라이는 AI 호출이 없어 누락됐다.)
  const drySigStr = dryIds.join(',')
  const dryAudibleRef = useRef('')
  useEffect(() => {
    const prev = new Set(dryAudibleRef.current ? dryAudibleRef.current.split(',') : [])
    const grew = dryIds.some((id) => id && !prev.has(id))
    dryAudibleRef.current = drySigStr
    if (grew && booted) sound.arrive(0)
  }, [drySigStr])

  // ── 사운드 — 회로의 상태가 소리가 된다 (전부 실제 이벤트 구동) ──
  useEffect(() => { sound.setDrone(nodes.length) }, [nodes.length])
  // 에이전트 교체 시 부팅음 — 부팅(POWER) 이후의 실제 교체에만.
  // 세션 복원이 agentId 를 바꾸는 건 부팅 전이라 booted=false → 무음 (시스템 부팅음과 겹침 방지).
  useEffect(() => {
    if (!booted) return
    let h = 0
    for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0
    sound.agentBoot(Math.abs(h))
  }, [agentId])
  const anyBusy = Object.values(outputs).some((o) => o?.busy) || synthBusy || master.busy
  useEffect(() => { sound.setWorking(anyBusy) }, [anyBusy])


  const menuActions = {
    // FILE — 세션과 산출물
    fileNew: () => onReset(),
    fileOpenSession: () => fileInputRef.current?.click(),
    fileSaveSession: () => download(`idea-synth-session-${Date.now()}.json`, sessionJson(), 'application/json'),
    fileExportReport: exportReport,
    fileExportDiagram: () => exportDiagramPng(),
    fileCopyStatement: () => master.statement && navigator.clipboard?.writeText(master.statement),
    hasStatement: !!master.statement,
    // EDIT — 회로 조작
    editAutoPatch: onAutoPatch,
    editClearCables: () => setCables([]),
    editResetControls: () => setEffectorState(defaultEffectorState()),
    editReanalyze: () => analyze(),
    canEdit: nodes.length > 0,
    // VIEW — 뷰 토글 (닫힘 ↔ 도크)
    windows,
    toggleWin: (key) => setWin(key, windows[key] === 'closed' ? 'docked' : 'closed'),
    windowToggleUtility: () => setUtilityVisible((v) => !v),
    utilityVisible,
    openDiagram: () => setDiagramOpen(true),
    canDiagram: nodes.length > 0,
    // WINDOW — 창 띄우기/모으기
    floatWin: (key) => setWin(key, 'float'),
    dockAll: () => setWindows({ diagram: 'docked', vision: 'docked', statement: 'docked' }),
    windowFullscreen: () => {
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen?.()
    },
    helpOpen: () => setHelpOpen(true),
    openPanel: () => setPanelOpen(true),
  }

  const onLoadSample = () => {
    setText(sampleConversation)
    setResult(null)
    setError(null)
  }
  const onClear = () => {
    // textarea 를 완전히 비움. placeholder 자리에 안내 박힘.
    setText('')
    setResult(null)
    setError(null)
  }
  // 초기화 — TopBar 의 idea synthesizer 클릭 시
  const onReset = () => {
    setText('')
    setResult(null)
    setError(null)
    setCables([])
    setOutputs({})
    setEffectorState(defaultEffectorState())
    setCableMenu(null)
    setDragging(null)
    setMaster({ statement: null, busy: false, error: null })
    masterSigRef.current = ''
    sentSigRef.current = {}
  }

  // ── 실감 — 지금 신호가 흐르는 케이블 (펄스) + 일하는 이펙터 (LED 점멸) ──
  const activeCableIds = new Set()
  nodes.forEach((n) => {
    if (!outputs[n.id]?.busy) return
    let cur = `NODE-${n.id}-OUT`
    for (let i = 0; i < 12; i++) {
      const toBus = cables.find((cb) => cb.from === cur && cb.to === 'OUT-IN')
      if (toBus) { activeCableIds.add(toBus.id); break }
      const c = cables.find((cb) => cb.from === cur && cb.to.startsWith('FX-'))
      if (!c) break
      activeCableIds.add(c.id)
      cur = c.to.slice(0, c.to.lastIndexOf('-')) + '-OUT'
    }
  })
  if (synthBusy) {
    if (synthA) activeCableIds.add(synthA.id)
    if (synthB) activeCableIds.add(synthB.id)
  }
  const busyKinds = new Set(
    tasks.filter((t) => outputs[t.node.id]?.busy).flatMap((t) => t.body.effects.map((e) => e.kind))
  )

  // 다이어그램 포커스 — DIAGRAM-IN 에 꽂힌 신호만 강조해 보여준다 (비우면 전체 = 모니터 기본값)
  const diagramFocusIds = (() => {
    const focus = new Set()
    cables
      .filter((c) => c.to === 'DIAGRAM-IN')
      .forEach((c) => {
        if (c.from.startsWith('NODE-')) {
          focus.add(c.from.slice('NODE-'.length, c.from.lastIndexOf('-')))
        } else if (c.from.startsWith('FX-')) {
          const kind = c.from.slice('FX-'.length, c.from.lastIndexOf('-'))
          nodes.forEach((n) => {
            if (paths[n.id]?.chain.some((h) => h.kind === kind)) focus.add(n.id)
          })
        }
      })
    return focus.size ? focus : null
  })()

  // ── 풀블리드 — 케이스 프레임 폐기 (2026-06-12). 화면 전체가 워크스테이션이다.
  return (
    <div
      onPointerDownCapture={() => sound.unlock()}
      style={{
        position: 'relative',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        color: INK,
        display: 'flex',
        flexDirection: 'column',
        ...metalBackground,
      }}
    >
      <MetalNoise />

      <TopBar
        backendOk={health?.ok}
        error={error}
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        analyzing={analyzing}
        onTitleClick={onReset}
        menuActions={menuActions}
      />

      {/* 세션 열기 — 숨은 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={onOpenSessionFile}
      />

      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}

      {/* 케이블 overlay */}
      <CableLayer
        cables={cables}
        cableSeq={cableSeq}
        activeIds={activeCableIds}
        dragging={dragging}
        onCableClick={(id, e) => {
          setCableMenu({ cableId: id, x: e.clientX, y: e.clientY })
        }}
        onCableAdjust={(id, sagPx, driftPx) => {
          setCables((prev) =>
            prev.map((c) => (c.id === id ? { ...c, sagPx, driftPx } : c))
          )
        }}
      />

      {/* 케이블 컨텍스트 메뉴 — 연결 정보 + 관계 지정 + 삭제 */}
      {cableMenu && (() => {
        const cable = cables.find((c) => c.id === cableMenu.cableId)
        const describeJack = (jackId = '') => {
          if (jackId === 'OUT-IN') return 'OUTPUT 입력'
          if (jackId === 'OUT-SEND') return 'OUTPUT 출력'
          if (jackId === 'VISION-IN') return 'VISUALIZE'
          if (jackId === 'DIAGRAM-IN') return 'DIAGRAM 포커스'
          if (jackId.startsWith('SYNTH-')) return 'SYNTH'
          if (jackId.startsWith('NODE-')) {
            const nodeId = jackId.slice('NODE-'.length, jackId.lastIndexOf('-'))
            return nodes.find((n) => n.id === nodeId)?.title || '아이디어'
          }
          if (jackId.startsWith('FX-')) {
            const kind = jackId.slice('FX-'.length, jackId.lastIndexOf('-'))
            return EFFECTORS[kind]?.label || kind.toUpperCase()
          }
          return jackId
        }
        return cable ? (
          <CableMenu
            x={cableMenu.x}
            y={cableMenu.y}
            current={cable.relation}
            info={{
              from: describeJack(cable.from),
              to: describeJack(cable.to),
              seq: cableSeq[cable.id] ?? null,
            }}
          onSelect={(rel) => {
            sound.tick(0.5) // 관계 전환의 촉각
            setCables((prev) =>
              prev.map((c) =>
                c.id === cableMenu.cableId ? { ...c, relation: rel } : c
              )
            )
            setCableMenu(null)
          }}
          onDelete={() => {
            setCables((prev) => prev.filter((c) => c.id !== cableMenu.cableId))
            setCableMenu(null)
          }}
          onClose={() => setCableMenu(null)}
          />
        ) : null
      })()}

      {/* 상단 랙 레일 */}
      <div style={{ height: 5, flexShrink: 0 }} />
      <RackRail />

      {/* 좌·중·우 3 자리 — 100vh 안에 욱여넣음 */}
      <main
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: 4,
          padding: '4px 6px',
          alignItems: 'stretch',
          boxSizing: 'border-box',
          zIndex: 1,
        }}
      >
        <InputEffector
          text={text}
          onTextChange={setText}
          onAnalyze={analyze}
          onLoadSample={onLoadSample}
          onClear={onClear}
          analyzing={analyzing}
          nodes={analyzedNodes}
          edges={edges}
          onAddInput={onAddInput}
          onJackDown={onJackDown}
          onJackUp={onJackUp}
          agentId={agentId}
          onAgentChange={setAgentId}
          agentInfluence={agentInfluence}
          onAgentInfluence={setAgentInfluence}
          onAutoPatch={onAutoPatch}
          patchPulse={stage === 2}
          extraAgents={extraAgents}
          onAgentBuilt={onAgentBuilt}
          synthBusy={synthBusy}
          synthHasA={!!synthA}
          synthHasB={!!synthB}
          pendingImage={pendingImage}
          onImageSelect={onImageSelect}
          onImageClear={() => setPendingImage(null)}
          onTransformImage={onTransformImage}
          imgBusyIds={imgBusyIds}
          onOpenLightbox={(node) => setLightbox({ node })}
        />

        {/* 단계 점화 — 분석 전에는 이펙터·OUTPUT 이 전원 꺼진 톤. 신호가 닿으면 켜진다. */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', ...stageDim(stage === 1) }}>
          <EffectorPanel
            onJackDown={onJackDown}
            onJackUp={onJackUp}
            effectorState={effectorState}
            onControlChange={onControlChange}
            voicePools={voicePools}
            busyKinds={busyKinds}
            agentAxes={curMeta.axes || []}
          />
        </div>

        {/* OUTPUT 기둥 — EFFECTORS 바로 옆 (케이블이 여기서 끝나 모니터를 덜 가린다) */}
        <div style={{ flexShrink: 0, display: 'flex', ...stageDim(stage === 1) }}>
          <OutputColumn
            nodes={nodes}
            master={master}
            audibleCount={audibleCount}
            windows={windows}
            onFloat={(k) => setWin(k, 'float')}
            onCloseWin={(k) => setWin(k, 'closed')}
            onJackDown={onJackDown}
            onJackUp={onJackUp}
            onAgentFeedback={onAgentFeedback}
            agentName={curMeta.fullName}
            masterAlts={masterAlts}
            onMasterVariations={onMasterVariations}
            onPickStatement={onPickStatement}
            recomputing={pending || anyBusy}
          />
        </div>

        {/* MONITOR 기둥 — 가장 오른쪽 (케이블이 거의 닿지 않아 시각화가 깨끗하다) */}
        <div style={{ flexShrink: 0, display: 'flex', ...stageDim(stage === 1) }}>
          <MonitorColumn
            nodes={diagramNodes}
            edges={diagramEdges}
            outputs={outputs}
            chainLens={chainLens}
            qualityAvg={qualityAvg}
            agentColor={curMeta.color}
            focusIds={diagramFocusIds}
            cables={cables}
            windows={windows}
            onFloat={(k) => setWin(k, 'float')}
            onCloseWin={(k) => setWin(k, 'closed')}
            onOpenDiagram={() => setDiagramOpen(true)}
            vision={vision}
            visionConnected={visionConnected}
            onVisionCode={(c) => setVision((v) => ({ ...v, code: c, options: [], sel: null }))}
            onVisionRatio={(r) => setVision((v) => ({ ...v, ratio: r }))}
            onRenderVision={onRenderVision}
            onRequestVisionOptions={onRequestVisionOptions}
            onOpenVisionLightbox={() => setVisionLightbox(true)}
            agentName={curMeta.fullName}
            onJackDown={onJackDown}
            onJackUp={onJackUp}
          />
        </div>
      </main>


      {/* ── 플로팅 창들 — 떼서 키우고 옮긴다 ── */}
      {windows.diagram === 'float' && (
        <Window
          title="DIAGRAM — 회로의 시스템 다이어그램"
          initialX={200} initialY={80} initialW={620} initialH={460}
          onClose={() => setWin('diagram', 'closed')}
          onDock={() => setWin('diagram', 'docked')}
        >
          {(w, h) => (
            <div style={{ height: h }}>
              <Diagram
                nodes={diagramNodes}
                edges={diagramEdges}
                outputs={outputs}
                chainLens={chainLens}
                qualityAvg={qualityAvg}
                agentColor={curMeta.color}
                cables={cables}
                big
              />
            </div>
          )}
        </Window>
      )}
      {windows.vision === 'float' && (
        <Window
          title={`VISUALIZE — ${vision.code === 'aesthetic' ? '화풍 코드' : '사유 코드'} · ${curMeta.fullName}`}
          initialX={300} initialY={100} initialW={520} initialH={560}
          onClose={() => setWin('vision', 'closed')}
          onDock={() => setWin('vision', 'docked')}
        >
          {(w, h) => (
            <div style={{ height: h, display: 'flex', flexDirection: 'column' }}>
              <FloatJacks jacks={[{ id: 'VISION-IN', label: 'IN' }]} cables={cables} onDown={onJackDown} onUp={onJackUp} />
              {/* 컨트롤 — 창으로 떼어져도 조작은 함께 간다 */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px',
                  background: 'linear-gradient(180deg, #f0f2f5 0%, #e3e5ea 100%)',
                  borderBottom: '1px solid #cdd0d6', flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 7, fontWeight: 600, color: '#8a8e96', marginRight: 'auto' }}>
                  필터 — 화풍: 화면의 미감 / 사유: 사상으로 장면 구성
                </span>
                <VisionControls
                  vision={vision}
                  visionConnected={visionConnected}
                  onVisionCode={(c) => setVision((v) => ({ ...v, code: c, options: [], sel: null }))}
                  onVisionRatio={(r) => setVision((v) => ({ ...v, ratio: r }))}
                  onRequestVisionOptions={onRequestVisionOptions}
                  agentName={curMeta.fullName}
                />
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <VisionBody
                  vision={vision}
                  visionConnected={visionConnected}
                  onRenderVision={onRenderVision}
                  onOpenVisionLightbox={() => setVisionLightbox(true)}
                />
              </div>
            </div>
          )}
        </Window>
      )}
      {/* PANEL — 그래스호퍼식 중간 확인 창. 필요할 때 띄워, IN 잭에 회로의 어떤 OUT 이든 꽂아 중간 내용을 본다. */}
      {panelOpen && (
        <Window
          title="PANEL — 중간 확인"
          initialX={360} initialY={130} initialW={420} initialH={340}
          onClose={() => setPanelOpen(false)}
        >
          {(w, h) => (
            <div style={{ height: h, display: 'flex', flexDirection: 'column' }}>
              <FloatJacks jacks={[{ id: 'PANEL-IN', label: 'IN' }]} cables={cables} onDown={onJackDown} onUp={onJackUp} />
              <div style={{ flex: 1, minHeight: 0 }}>
                <PanelBody panelText={panelText} panelLabel={panelLabel} panelConnected={!!panelSource} />
              </div>
            </div>
          )}
        </Window>
      )}
      {/* INFER 갈래 — OUT 잭에서 떠오른 플로팅 창들 (입력 패널 노드로는 들어가지 않는다). */}
      {inferWins.flatMap((w) =>
        w.branches.map((b, bi) => (
          <Window
            key={b.bid}
            title={`${w.eff === 'contradict' ? 'CONTRADICT' : 'INFER'} · ${w.label} ${bi + 1}/${w.branches.length} — ${w.srcTitle || ''}`}
            belowCables
            initialX={300 + bi * 168} initialY={430 + (bi % 2) * 40} initialW={300} initialH={188}
            onClose={() => {
              // consequence 창을 닫으면 bid·서명을 리셋 — 노브를 다시 만지면 새 창으로 깨끗이 태어난다.
              if (w.eff === 'consequence') { cqBidRef.current = null; inferSigRef.current = '' }
              setInferWins((prev) => prev
                .map((x) => x.id === w.id ? { ...x, branches: x.branches.filter((bb) => bb.bid !== b.bid) } : x)
                .filter((x) => x.branches.length))
              setCables((prev) => prev.filter((c) => !c.to.startsWith(`IWIN-${b.bid}-`) && !c.from.startsWith(`IWIN-${b.bid}-`)))
            }}
          >
            {(ww, hh) => {
              // 이 갈래의 소스(이펙터)가 재합성 중이면 창도 재합성 상태 — 입력·노브를
              // 바꾸면 즉시 켜지고, 새 결과가 b.content 로 갈리면 글로우로 갱신을 알린다.
              const winBusy = w.eff === 'contradict' ? ctBusy : cqBusy
              return (
              <div style={{ height: hh, display: 'flex', flexDirection: 'column' }}>
                {/* 잭 — IN 은 INFER OUT 에서 자동 연결, OUT 은 끌어내 다른 데로 */}
                <FloatJacks
                  jacks={[{ id: `IWIN-${b.bid}-IN`, label: 'IN' }, { id: `IWIN-${b.bid}-OUT`, label: 'OUT' }]}
                  cables={cables} onDown={onJackDown} onUp={onJackUp}
                />
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '9px 12px', background: '#0e120c', color: '#dbe9c8', fontFamily: '"Share Tech Mono", monospace', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'keep-all', position: 'relative' }}>
                  <style>{'@keyframes iwinPulse{50%{opacity:.2}}@keyframes iwinGlow{0%{background:rgba(158,255,94,.16)}100%{background:transparent}}'}</style>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', color: '#9eff5e', marginBottom: 7 }}>
                    {/* 재합성 펄스 — 소스가 갱신 중임을 알린다 */}
                    {winBusy && <span title="재합성 중 — 입력·노브의 변화가 이 갈래로 흐르는 중"
                      style={{ width: 6, height: 6, borderRadius: '50%', background: '#9eff5e', animation: 'iwinPulse 560ms steps(1) infinite', flex: 'none' }} />}
                    <span>{winBusy ? '재합성 중…' : `${w.label} · ${b.title}`}</span>
                  </div>
                  {/* 새 결과가 도착하면(bid+content 키) 한번 글로우 — 갱신을 눈으로 확인 */}
                  <div key={`${b.bid}:${(b.content || '').length}`}
                    style={{ animation: winBusy ? 'none' : 'iwinGlow 900ms ease-out 1', borderRadius: 3, opacity: winBusy ? 0.4 : 1, transition: 'opacity 200ms' }}>
                    {b.content}
                  </div>
                </div>
              </div>
              )
            }}
          </Window>
        ))
      )}
      {windows.statement === 'float' && (
        <Window
          title="STATEMENT — 마스터 출력"
          initialX={340} initialY={160} initialW={460} initialH={380}
          onClose={() => setWin('statement', 'closed')}
          onDock={() => setWin('statement', 'docked')}
        >
          {(w, h) => (
            <div style={{ height: h, display: 'flex', flexDirection: 'column' }}>
              <FloatJacks
                jacks={[{ id: 'OUT-IN', label: 'IN' }, { id: 'OUT-SEND', label: 'OUT' }]}
                cables={cables}
                onDown={onJackDown}
                onUp={onJackUp}
              />
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  background: '#161820',
                  padding: '10px 14px',
                  fontFamily: '"Share Tech Mono", ui-monospace, monospace',
                  fontSize: 11.5,
                  lineHeight: 1.7,
                  color: master.error ? '#dc2626' : '#e6e8ee',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'keep-all',
                }}
              >
                {master.error || master.statement || (master.busy ? 'RENDERING…' : 'AWAITING SIGNAL')}
              </div>
            </div>
          )}
        </Window>
      )}

      {/* ── 에이전트의 한 마디 — 본인의 목소리로 거는 피드백 (NJP in my pocket 결) ── */}
      {windows.agentfb === 'float' && (
        <Window
          title={`${curMeta.fullName} — 피드백`}
          initialX={360} initialY={180} initialW={440} initialH={300}
          onClose={() => setWin('agentfb', 'closed')}
        >
          {(w, h) => (
            <div style={{ height: h, display: 'flex', flexDirection: 'column', background: '#16140f' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderBottom: '1px solid #2c2a22', flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#e8c98a', fontFamily: '"Share Tech Mono", monospace' }}>
                  {(agentFb.label || curMeta.fullName).toUpperCase()}
                </span>
                <button
                  onClick={onAgentFeedback}
                  disabled={agentFb.busy}
                  title="다시 — 한 번 더 한 마디"
                  style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #4a4636', borderRadius: 3, color: '#caa765', cursor: agentFb.busy ? 'default' : 'pointer', fontSize: 9, fontWeight: 700, padding: '2px 8px', fontFamily: 'inherit' }}
                >
                  {agentFb.busy ? '…' : '⟳ 다시'}
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', fontSize: 13.5, lineHeight: 1.85, color: '#f0e6d2', whiteSpace: 'pre-wrap', wordBreak: 'keep-all', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
                {agentFb.busy && !agentFb.text ? '…' : (agentFb.text || '아이디어를 보고 한 마디 건넬게.')}
              </div>
            </div>
          )}
        </Window>
      )}

      {/* ── 외부 입력 모듈 — 떠다니는 텍스트 소스. OUT 잭으로 회로에 합류한다 ── */}
      {manualInputs.map((m, i) => (
        <Window
          key={m.id}
          title="추가 노드"
          initialX={150 + i * 26} initialY={120 + i * 26} initialW={300} initialH={210}
          onClose={() => removeInput(m.id)}
        >
          {(w, h) => (
            <div style={{ height: h, display: 'flex', flexDirection: 'column', background: '#14161c' }}>
              <FloatJacks jacks={[{ id: `NODE-${m.id}-OUT`, label: 'OUT' }]} cables={cables} onDown={onJackDown} onUp={onJackUp} />
              <textarea
                value={m.text}
                onChange={(e) => setInputText(m.id, e.target.value)}
                placeholder="아이디어·자료 텍스트를 입력 — OUT 을 이펙터·SYNTH 에 꽂으면 회로의 신호가 된다"
                style={{
                  flex: 1, minHeight: 0, resize: 'none', background: '#0e1014', color: '#e6e8ee',
                  border: 'none', outline: 'none', padding: '10px 12px', fontSize: 12, lineHeight: 1.6,
                  fontFamily: '"Helvetica Neue", Arial, sans-serif', wordBreak: 'keep-all',
                }}
              />
            </div>
          )}
        </Window>
      ))}

      {/* ── VISION 라이트박스 — 생성 이미지 크게 보기 ── */}
      {visionLightbox && vision.image && (
        <div
          onClick={() => setVisionLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(8,9,12,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 10,
          }}
        >
          <img
            src={vision.image}
            alt="VISUALIZE 출력"
            style={{ maxWidth: '74vw', maxHeight: vision.history.length > 1 ? '62vh' : '74vh', border: '1px solid #3a3e46' }}
          />
          {/* 생성 이력 갤러리 — 렌더한 이미지들을 모아 되돌리기·비교 */}
          {vision.history.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', gap: 6, maxWidth: '74vw', overflowX: 'auto', padding: '2px 2px 4px' }}
            >
              {[...vision.history].reverse().map((h) => {
                const cur = h.image === vision.image
                return (
                  <img
                    key={h.ts}
                    src={h.image}
                    alt={h.label}
                    title={`${h.label} · ${h.code === 'aesthetic' ? '화풍' : '사유'}`}
                    onClick={() => setVision((v) => ({ ...v, image: h.image }))}
                    style={{
                      height: 64, width: 64, objectFit: 'cover', cursor: 'pointer', flexShrink: 0,
                      border: `1.5px solid ${cur ? '#f97316' : '#3a3e46'}`,
                      opacity: cur ? 1 : 0.6, transition: 'opacity 140ms, border-color 140ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1 }}
                    onMouseLeave={(e) => { if (!cur) e.currentTarget.style.opacity = 0.6 }}
                  />
                )
              })}
            </div>
          )}
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#9aa0aa', fontFamily: '"Share Tech Mono", monospace' }}>
              VISUALIZE — {vision.code === 'aesthetic' ? '화풍 코드' : '사유 코드'} · {curMeta.fullName}
            </span>
            <button
              onClick={() => downloadDataUrl(vision.image, `idea-synth-vision-${Date.now()}.png`)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#f0f2f5' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3a3e46'; e.currentTarget.style.color = '#9aa0aa' }}
              title="이미지를 PNG 로 저장"
              style={{
                background: 'transparent', border: '1px solid #3a3e46', borderRadius: 3, cursor: 'pointer',
                color: '#9aa0aa', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                padding: '4px 12px', fontFamily: '"Share Tech Mono", monospace', transition: 'color 140ms, border-color 140ms',
              }}
            >
              ↓ 저장
            </button>
          </div>
        </div>
      )}

      {/* ── 이미지 라이트박스 — 원본 vs 재합성 비교 ── */}
      {lightbox && (() => {
        const ln = nodes.find((x) => x.id === lightbox.node.id) || lightbox.node
        return (
          <div
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: 'rgba(8,9,12,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
            }}
          >
            {[['원본 신호', ln.image], ...(ln.imageOut ? [['재합성', ln.imageOut]] : [])].map(([label, src]) => (
              <figure key={label} style={{ margin: 0, textAlign: 'center' }}>
                <img
                  src={src}
                  alt={label}
                  style={{
                    maxWidth: ln.imageOut ? '42vw' : '70vw',
                    maxHeight: '72vh',
                    border: `1px solid ${label === '재합성' ? '#f97316' : '#3a3e46'}`,
                    display: 'block',
                  }}
                />
                <figcaption
                  style={{
                    marginTop: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
                    color: label === '재합성' ? '#f97316' : '#9aa0aa',
                    fontFamily: '"Share Tech Mono", monospace',
                  }}
                >
                  {label.toUpperCase ? label : label} {label === '재합성' ? '— 체인의 어휘가 변형' : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        )
      })()}

      {/* ── 관계 다이어그램 — 사고의 원점 화면. 프로젝트가 시작되는 제도판 ── */}
      {diagramOpen && (
        <div
          onClick={() => setDiagramOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            background: 'rgba(10,11,14,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 'min(94vw, 1560px)',
              height: 'min(90vh, 940px)',
              background: '#14161c',
              border: '1px solid #2a2c32',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 다이어그램 헤더 — 라이트 크롬 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 32,
                flexShrink: 0,
                padding: '0 12px',
                background: 'linear-gradient(180deg, #f6f7f9 0%, #e9ebef 100%)',
                borderBottom: '1px solid #d2d5db',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', color: '#2a2a32' }}>
                DIAGRAM
              </span>
              <span style={{ fontSize: 9, color: '#8a8e96' }}>
                회로의 원점 — 라벨 드래그 = 배치 · 휠 = 확대 · 호버 = 정보 · 더블클릭 = 전체 보기
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: '"Share Tech Mono", monospace', color: '#6a6a72' }}>
                NODES {String(nodes.length).padStart(2, '0')} · EDGES {String(edges.length).padStart(2, '0')}
              </span>
              <button
                onClick={() => setDiagramOpen(false)}
                title="닫기 (Esc)"
                style={{
                  background: 'none', border: '1px solid #c2c5cc', borderRadius: 3,
                  fontSize: 9, fontWeight: 700, color: '#52525c', cursor: 'pointer', padding: '2px 8px',
                }}
              >
                닫기 ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Diagram
                nodes={diagramNodes}
                edges={diagramEdges}
                qualityAvg={qualityAvg}
                outputs={outputs}
                chainLens={chainLens}
                agentColor={curMeta.color}
                cables={cables}
                big
              />
            </div>
          </div>
        </div>
      )}

      {/* 하단 랙 레일 + 유틸리티 랙 */}
      <RackRail />
      {utilityVisible && (
        <>
          <div style={{ height: 4, flexShrink: 0 }} />
          <UtilityRack backendOk={health?.ok} agentId={agentId} logs={logs} onAddData={onAddInput} onAgentOpinion={onAgentFeedback} />
        </>
      )}
      <div style={{ height: 5, flexShrink: 0 }} />

      {/* 부팅 화면 — 케이블을 전원 잭에 꽂으면 입장. 데이터는 이미 초기 상태. */}
      {!booted && <BootScreen onEnter={() => setBooted(true)} />}
    </div>
  )
}

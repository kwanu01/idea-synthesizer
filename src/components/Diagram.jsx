// DIAGRAM — 데이터 필드. 이 작품의 메인 미디어아트 화면.
// 료지 이케다의 결: 흑백의 정밀함, 미세한 선·점의 밀도, 마이크로 타이포, 절제된 색.
//
// 모든 선은 실데이터다 —
//   버스트  = 사고 단위. 본문의 글자 하나하나가 방사선 하나가 된다
//             (각도 = 글자 위치, 길이 = 글자 코드). 텍스트가 바뀌면 형태가 바뀐다.
//   밝기    = 에이전트의 평가 (빛) · 끝점 입자 = 글자의 자리
//   섬유 다발 = 관계. 수십 가닥의 미세 곡선 (가운데 한 가닥만 관계색)
//   재계산  = 변형 중 — 선들이 지직거리며 재배열된다. 도착 = 버스트가 확장했다 수렴.
//   적색 +  = SYNTH 로 태어난 생각 (이케다의 적색 마커)
//
// 조작: 휠/핀치 = 줌 · 빈 곳 드래그 = 팬 · 버스트 드래그 = 배치 · 호버 = 정보 카드 ·
//       더블클릭 = 전체 보기.

import { useEffect, useRef, useState } from 'react'

const TYPE_META = {
  Question:    { ko: '질문', color: '#22d3ee' },
  Observation: { ko: '관찰', color: '#84cc16' },
  Hypothesis:  { ko: '가설', color: '#fbbf24' },
  Insight:     { ko: '통찰', color: '#ec4899' },
  Decision:    { ko: '결정', color: '#f97316' },
}
const REL = {
  supports:    { color: '#84cc16', label: '뒷받침' },
  contradicts: { color: '#f43f5e', label: '충돌' },
  extends:     { color: '#22d3ee', label: '발전' },
  derives:     { color: '#a855f7', label: '분기' },
}
const FALLBACK = { ko: '', color: '#8a8e96' }
const IKEDA_RED = '#ff2a2a'
const FX_KO = {
  perspective: '관점', contradict: '반박', consequence: '결과',
  constrain: '제약', abstraction: '추상', connect: '연결',
}

// ── 배경 데이터 프로파일 — 회로 실데이터를 폭(시간축) 방향 128 컬럼으로 굽는다 ──
// R = 신호 세기(품질·가청·체인 + 글자코드 잔결), G = 피치(그 시간대 가장 강한 노드의 값).
// 노드/품질/채널이 바뀌면 프로파일이 바뀌고 → 배경 그래픽이 실제로 그 데이터로 움직인다.
function buildSignalProfile(d, buf, N) {
  const ns = (d && d.nodes) || []
  for (let c = 0; c < N; c++) { buf[c * 4] = 0; buf[c * 4 + 1] = 0; buf[c * 4 + 2] = 0; buf[c * 4 + 3] = 255 }
  if (!ns.length) return
  const outputs = d.outputs || {}, qa = d.qualityAvg || {}, cl = d.chainLens || {}, edges = d.edges || []
  const cxOf = (i) => (i + 0.5) / ns.length
  // R = 노드 세기 밴드 · G = 피크 · B = 관계 밀도(엣지가 잇는 구간 + busy 펄스 플래그)
  for (let c = 0; c < N; c++) {
    const x = c / (N - 1)
    let amp = 0, pit = 0
    for (let i = 0; i < ns.length; i++) {
      const n = ns[i]
      const q = qa[n.id] ?? 0
      const aud = outputs[n.id] ? 1 : 0
      const chain = cl[n.id] || 0
      const e = (aud ? 0.45 : 0.13) + q * 0.5 + Math.min(0.25, chain * 0.08)
      const dx = (x - cxOf(i)) / (0.34 / ns.length + 0.03)
      const g = Math.exp(-dx * dx)
      const txt = (n.title || '') + (n.content || '')
      const L = txt.length || 1
      const ch = txt.charCodeAt(Math.floor(x * (L - 1) + i) % L) || 32
      amp += g * e * (0.6 + 0.4 * Math.sin(ch * 0.4 + x * 30))
      if (g * e > pit) pit = g * e
    }
    buf[c * 4] = Math.max(0, Math.min(255, amp * 230))
    buf[c * 4 + 1] = Math.max(0, Math.min(255, pit * 255))
  }
  // 관계(엣지) — 잇는 두 노드의 x 구간을 B 에 밝힌다. 관계가 바뀌면 배경 띠가 바뀐다 (동적).
  const rel = new Float32Array(N)
  edges.forEach((ed) => {
    const ai = ed.from, bi = ed.to
    if (ai == null || bi == null || ai >= ns.length || bi >= ns.length) return
    const xa = cxOf(ai), xb = cxOf(bi)
    const lo = Math.min(xa, xb), hi = Math.max(xa, xb)
    const busy = (outputs[ns[ai].id]?.busy || outputs[ns[bi].id]?.busy) ? 1 : 0
    const w = 0.45 + busy * 0.5
    for (let c = 0; c < N; c++) {
      const x = c / (N - 1)
      if (x >= lo - 0.01 && x <= hi + 0.01) rel[c] += w
    }
  })
  for (let c = 0; c < N; c++) buf[c * 4 + 2] = Math.max(0, Math.min(255, rel[c] * 130))
}

// 활성 Diagram 인스턴스가 등록하는 고해상 캡처 함수 (전체를 맞춰 큰 캔버스에 재렌더).
let __boardCapture = null

// FILE 메뉴 — 다이어그램 캡처. 고해상 재렌더가 가능하면 그걸로, 아니면 화면 캔버스 폴백.
export function exportDiagramPng() {
  let url = null
  if (typeof __boardCapture === 'function') {
    try { url = __boardCapture() } catch { url = null }
  }
  if (!url) {
    const c = document.querySelector('canvas[data-liveboard]')
    if (c) url = c.toDataURL('image/png')
  }
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = `idea-synth-diagram-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function Diagram({
  nodes = [],
  edges = [],
  outputs = {},
  chainLens = {},
  qualityAvg = {},
  agentColor = '#fbbf24',
  height = 190,
  big = false,
  focusIds = null, // Set — DIAGRAM-IN 에 꽂힌 신호만 강조 (null = 전체)
  cables = [],     // 케이블 그래프 — 이펙터 라우팅 오버레이용
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const glRef = useRef(null)
  const [hover, setHover] = useState(null)

  const simRef = useRef({
    pts: new Map(),     // id → {x,y,vx,vy,pin,rot}
    cam: { s: 1, ox: 0, oy: 0 },
    autoFit: true,
    flashes: [],        // {id,t0}
    prevText: new Map(),
    drag: null,
  })
  const dataRef = useRef({})
  dataRef.current = { nodes, edges, outputs, chainLens, qualityAvg, agentColor, focusIds, cables }

  // ── 배경 오로라 — WebGL 프래그먼트 셰이더 (FBM 노이즈 + 도메인 워핑) ──
  // 2D 그라데이션으론 못 내는 유기적 네뷸라. 데이터 활동량(energy)이 밝기·색에 반영된다.
  useEffect(() => {
    const cv = glRef.current, wrap = wrapRef.current
    if (!cv || !wrap) return
    const gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: false })
    if (!gl) return
    const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }`
    const fs = `
      precision highp float;
      uniform vec2 u_res; uniform float u_time; uniform float u_energy; uniform float u_flow;
      uniform sampler2D u_data;   // 회로 실데이터 프로파일 (R=신호세기, G=피치) — 폭 방향 = 시간축
      float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
      float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.03+vec2(1.3,-0.7); a*=0.5;} return v; }
      vec3 hue2rgb(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.0)-3.0)-1.0,0.0,1.0); }
      void main(){
        vec2 uv = gl_FragCoord.xy/u_res.xy;
        float asp = u_res.x/u_res.y;
        float en = clamp(u_energy, 0.0, 1.5);
        // ════ 데이터가 *주도하는* 세로 필드 — 노드=세로 기둥, 관계=라임 띠, 활동에 따라 펄스·흐름 ════
        // x = 회로 축(스크롤 없음): 데이터가 바뀌면 기둥·띠가 그 자리에서 살아 움직인다.
        vec4 D = texture2D(u_data, vec2(uv.x, 0.5));
        float sig = D.r;   // 노드 세기
        float pit = D.g;   // 피크
        float rel = D.b;   // 관계(엣지) 밀도

        // 세로 결 텍스처 — *위에서 아래로* 흐른다 (uv.y + time → 패턴이 하강)
        // 흐름 속도는 관계 밀도(u_flow)에 연동 — 관계가 많을수록 데이터가 더 빠르게 쏟아진다.
        float fl = 0.18 + 0.55 * u_flow;
        float streak = fbm(vec2(uv.x * 26.0, uv.y * 0.5 + u_time * fl));
        float fine = fbm(vec2(uv.x * 90.0, uv.y * 0.22 + u_time * (0.4 + 0.6 * u_flow)));

        // ── 색이 데이터에 따라 극적으로 — 활동량·관계·신호가 hue 를 크게 돌린다 ──
        // 정적: 깊은 인디고(0.62). 활동↑ → 시안·마젠타로 회전, 관계↑ → 초록으로, 신호↑ → 더 밝게.
        float H = 0.62 + en * 0.45 - rel * 0.34 + sig * 0.12 + 0.02 * sin(u_time * 0.25);
        vec3 hueCol = hue2rgb(H);
        vec3 col = mix(vec3(0.04, 0.04, 0.085), hueCol * 0.18, 0.5);  // 깊은 베이스(틴트)

        // 노드 기둥 — sig 가 강한 x 에 hue 색 세로 기둥. 진하고 또렷하게.
        float nodePulse = 0.7 + 0.3 * sin(u_time * 2.0 + uv.x * 22.0);
        float band = sig * (0.5 + 0.55 * streak) * nodePulse;
        col += hueCol * band * 1.35;
        // 밝은 기둥 끝 — 강한 노드는 흰빛으로 솟는다
        col += mix(hueCol, vec3(1.0), 0.5) * smoothstep(0.5, 1.0, sig) * (0.5 + 0.5 * streak);

        // 관계 띠 — rel 컬럼이 라임으로 숨쉬며 *아래로* 흐른다 (관계가 강할수록 전체 hue 도 초록으로 당겨짐)
        float relPulse = 0.5 + 0.5 * sin(u_time * 1.8 + uv.y * 12.0);
        col += vec3(0.40, 0.95, 0.46) * rel * (0.45 + 0.75 * relPulse) * (0.45 + 0.6 * streak) * 1.4;
        // 떨어지는 데이터 줄기 — 강한 컬럼에서 짧은 밝은 마디가 위→아래로 흐른다 (관계 밀도에 가속)
        float fall = fract(uv.y * 3.0 + u_time * (0.55 + 0.85 * u_flow));
        col += mix(hueCol, vec3(0.6, 1.0, 0.7), rel) * smoothstep(0.86, 1.0, fall) * (sig + rel) * 0.35;

        // 흐르는 스캔 하이라이트 — 밝은 띠가 가로로 지난다
        float scan = smoothstep(0.10, 0.0, abs(fract(uv.x - u_time * 0.04) - 0.5));
        col += hueCol * scan * (0.18 + 0.4 * en);

        // 하강 난류 + 가는 세로 주사선 + 그레인 + 전체 레벨
        float turb = fbm(vec2(uv.x * 12.0, uv.y * 0.6 + u_time * (0.14 + 0.5 * en)));
        col += hueCol * 0.12 * turb * (0.35 + en);
        col *= 0.92 + 0.08 * sin(uv.x * u_res.x * 0.6);
        col += (hash(gl_FragCoord.xy + floor(u_time * 10.0)) - 0.5) * 0.02;
        col *= 0.82 + 0.45 * en;
        // 아래로 갈수록 쭉 빠지며 사라진다 — 떨어지는 흐름이 바닥에서 소멸 (uv.y=0 = 화면 하단)
        col *= 0.06 + 0.94 * smoothstep(0.0, 0.62, uv.y);
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs))
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uEnergy = gl.getUniformLocation(prog, 'u_energy')
    const uFlow = gl.getUniformLocation(prog, 'u_flow')
    // ── 데이터 텍스처 — 회로의 신호 프로파일을 폭(시간축) 방향으로 담는다 (128 컬럼) ──
    const uData = gl.getUniformLocation(prog, 'u_data')
    const NSAMP = 128
    const dataBuf = new Uint8Array(NSAMP * 4)
    for (let i = 0; i < NSAMP; i++) dataBuf[i * 4 + 3] = 255
    const dataTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, dataTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT) // 시간축 — 흐름이 끊김없이 순환
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NSAMP, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, dataBuf)
    gl.uniform1i(uData, 0)
    let energy = 0.2, flow = 0.2, raf2, t0 = performance.now()
    const render = () => {
      const r = wrap.getBoundingClientRect()
      const dpr = Math.min(1.5, window.devicePixelRatio || 1)
      const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr))
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h) }
      // 데이터 활동량 → energy (가청 노드·평가·busy)
      const d = dataRef.current
      let target = 0.15
      const ns = d.nodes || []
      if (ns.length) {
        let aud = 0, q = 0, busy = 0
        ns.forEach((n) => { const o = d.outputs[n.id]; if (o) aud++; if (o?.busy) busy++; q += d.qualityAvg[n.id] || 0 })
        target = Math.min(1, 0.15 + (aud / ns.length) * 0.4 + (q / ns.length) * 0.5 + (busy ? 0.25 : 0))
      }
      energy += (target - energy) * 0.04
      // 관계 밀도 → 흐름 속도. 노드당 엣지 수가 많을수록 데이터가 빠르게 하강한다.
      const eds = d.edges || []
      const flowTarget = ns.length ? Math.min(1, (eds.length / ns.length) * 0.6) : 0.1
      flow += (flowTarget - flow) * 0.03
      // 실데이터 → 신호 프로파일 (R=세기, G=피치). 노드가 시간축에 펼쳐지고, 글자코드가 잔결을 만든다.
      buildSignalProfile(d, dataBuf, NSAMP)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, dataTex)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NSAMP, 1, gl.RGBA, gl.UNSIGNED_BYTE, dataBuf)
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uTime, (performance.now() - t0) / 1000)
      gl.uniform1f(uEnergy, energy)
      gl.uniform1f(uFlow, flow)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf2 = requestAnimationFrame(render)
    }
    raf2 = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    const sim = simRef.current
    let raf
    let W = 0
    let H = 0

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      W = Math.max(50, r.width)
      H = Math.max(50, r.height)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const coreOf = (n) => 7 + Math.min(7, (n.content || '').length * 0.04)

    const step = () => {
      const { nodes, edges, outputs, chainLens, qualityAvg, agentColor, focusIds, cables } = dataRef.current
      const t = performance.now() / 1000
      const pts = sim.pts

      // ── 스폰/정리 ──
      const ids = new Set(nodes.map((n) => n.id))
      nodes.forEach((n, i) => {
        if (!pts.has(n.id)) {
          const a = (i / Math.max(1, nodes.length)) * Math.PI * 2
          // 자전 없음 — 이케다의 강체성. 방향은 id 해시로 고정.
          let h = 0
          for (let k = 0; k < n.id.length; k++) h = (h * 31 + n.id.charCodeAt(k)) | 0
          pts.set(n.id, {
            x: Math.cos(a) * 110 + (Math.random() - 0.5) * 30,
            y: Math.sin(a) * 110 + (Math.random() - 0.5) * 30,
            vx: 0, vy: 0, pin: false,
            rot: (Math.abs(h) % 628) / 100,
          })
        }
      })
      for (const id of pts.keys()) if (!ids.has(id)) pts.delete(id)

      // ── 도착 감지 ──
      nodes.forEach((n) => {
        const out = outputs[n.id]
        if (!out?.finalText || out.busy) return
        const prev = sim.prevText.get(n.id)
        if (prev !== undefined && prev !== out.finalText) {
          sim.flashes.push({ id: n.id, t0: t })
        }
        sim.prevText.set(n.id, out.finalText)
      })
      sim.flashes = sim.flashes.filter((f) => t - f.t0 < 0.8)
      const flashOf = (id) => sim.flashes.find((f) => f.id === id)

      // ── 포스 (정돈된 그래프 — 또렷한 간격·연결 군집·안정 정착) ──
      const arr = nodes.map((n) => ({ n, p: pts.get(n.id) })).filter((x) => x.p)
      // 차수(연결 수) — 허브일수록 더 큰 자리를 차지한다 (겹침 방지)
      const fdeg = new Map()
      edges.forEach((e) => {
        const a = nodes[e.from]?.id, b = nodes[e.to]?.id
        if (a) fdeg.set(a, (fdeg.get(a) || 0) + 1)
        if (b) fdeg.set(b, (fdeg.get(b) || 0) + 1)
      })
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const A = arr[i].p, B = arr[j].p
          let dx = A.x - B.x, dy = A.y - B.y
          const d2 = dx * dx + dy * dy + 1
          // 강한 반발 + 차수 가중 → 노드(특히 허브)가 겹치지 않고 또렷이 벌어진다
          const w = 1 + 0.3 * ((fdeg.get(arr[i].n.id) || 0) + (fdeg.get(arr[j].n.id) || 0))
          const f = (13000 * w) / d2  // 박스(라벨)가 겹치지 않게 충분히 벌린다
          const d = Math.sqrt(d2)
          dx /= d; dy /= d
          if (!A.pin) { A.vx += dx * f * 0.016; A.vy += dy * f * 0.016 }
          if (!B.pin) { B.vx -= dx * f * 0.016; B.vy -= dy * f * 0.016 }
        }
      }
      // 엣지 스프링 — 연결된 생각끼리 일정 거리(rest)로 뭉쳐 군집이 또렷해진다
      edges.forEach((e) => {
        const A = pts.get(nodes[e.from]?.id), B = pts.get(nodes[e.to]?.id)
        if (!A || !B) return
        const dx = B.x - A.x, dy = B.y - A.y
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01
        const f = (d - 240) * 0.006
        if (!A.pin) { A.vx += (dx / d) * f; A.vy += (dy / d) * f }
        if (!B.pin) { B.vx -= (dx / d) * f; B.vy -= (dy / d) * f }
      })
      arr.forEach(({ p }) => {
        if (p.pin) return
        p.vx -= p.x * 0.0006   // 가운데로 모으는 약한 중력 (전체가 흩어지지 않게)
        p.vy -= p.y * 0.0006
        p.vx *= 0.84; p.vy *= 0.84
        p.x += p.vx; p.y += p.vy
        // 정착 — 거의 멈추면 완전히 멈춘다 (미세 떨림 제거 → 읽기 안정)
        if (Math.abs(p.vx) < 0.025 && Math.abs(p.vy) < 0.025) { p.vx = 0; p.vy = 0 }
      })

      // ── 카메라 ──
      if (sim.autoFit && arr.length) {
        const xs = arr.map((a) => a.p.x), ys = arr.map((a) => a.p.y)
        const pad = 120
        const bx = Math.min(...xs) - pad, by = Math.min(...ys) - pad
        const bw = Math.max(...xs) - bx + pad, bh = Math.max(...ys) - by + pad
        // 캡처 시엔 화면 가장자리 여백(M px)을 둬 마이크로 타이포 라벨이 잘리지 않게.
        const M = sim.fitMargin || 0
        const s = Math.min((W - 2 * M) / bw, (H - 2 * M) / bh)
        const tx = W / 2 - (bx + bw / 2) * s
        const ty = H / 2 - (by + bh / 2) * s
        const lerp = sim.snapFit ? 1 : 0.1
        sim.cam.s += (s - sim.cam.s) * lerp
        sim.cam.ox += (tx - sim.cam.ox) * lerp
        sim.cam.oy += (ty - sim.cam.oy) * lerp
      }
      const { s, ox, oy } = sim.cam
      const w2s = (x, y) => [x * s + ox, y * s + oy]

      // ── 옵시디언식 포커스 + 차수(연결 수) ──
      // 노드에 호버하면 그 노드와 직접 연결된 이웃만 또렷, 나머지는 잦아든다.
      const hoverId = sim.hoverId
      let neigh = null
      if (hoverId != null && pts.has(hoverId)) {
        neigh = new Set([hoverId])
        edges.forEach((e) => {
          const a = nodes[e.from]?.id, b = nodes[e.to]?.id
          if (a === hoverId && b != null) neigh.add(b)
          if (b === hoverId && a != null) neigh.add(a)
        })
      }
      // 포커스 보간 — 켜고 끌 때 부드럽게 (이케다의 강체성 안에서 최소한의 전이)
      sim.focusK = (sim.focusK || 0) + ((neigh ? 1 : 0) - (sim.focusK || 0)) * 0.18
      const dimOf = (id) => {
        if (!neigh) return 1
        const on = neigh.has(id) ? 1 : 0.1
        return 1 + (on - 1) * sim.focusK
      }

      // ════ 그리기 — 데이터 캔버스는 *투명* 하게 비운다. 배경(오로라)은 뒤의 WebGL 셰이더가 그린다. ════
      ctx.clearRect(0, 0, W, H)

      // ── 라벨 박스 겹침 해소 (스크린 공간) ──
      // 박스는 화면 고정 크기(줌과 무관)라, 월드 반발만으론 라벨끼리 겹친다.
      // 각 박스의 실제 화면 사각형을 재고, 겹치면 최소 분리축으로 밀어낸 뒤 월드 좌표에 되먹인다.
      // 마지막에 뷰포트 안으로 클램프 → 가장자리에서 글자가 잘리지 않는다.
      {
        ctx.font = '700 10px "Share Tech Mono", monospace'
        const MX = 10
        const rects = arr.map(({ n, p }) => {
          const ttl = (n.title || '')
          const title = ttl.length > 22 ? ttl.slice(0, 21) + '…' : ttl
          const tw = ctx.measureText(title.toUpperCase()).width
          const bw = Math.max(60, tw + 28)
          const [sx, sy] = w2s(p.x, p.y)
          return { p, halfW: bw / 2 + 8, halfH: 12 + 9, sx, sy } // +상단 번호 여유
        })
        for (let iter = 0; iter < 5; iter++) {
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const A = rects[i], B = rects[j]
              const ovx = (A.halfW + B.halfW) - Math.abs(A.sx - B.sx)
              const ovy = (A.halfH + B.halfH) - Math.abs(A.sy - B.sy)
              if (ovx > 0 && ovy > 0) {
                if (ovx < ovy) {
                  const push = ((A.sx <= B.sx ? -1 : 1) * ovx) / 2
                  if (!A.p.pin) A.sx += push
                  if (!B.p.pin) B.sx -= push
                } else {
                  const push = ((A.sy <= B.sy ? -1 : 1) * ovy) / 2
                  if (!A.p.pin) A.sy += push
                  if (!B.p.pin) B.sy -= push
                }
              }
            }
          }
        }
        rects.forEach((R) => {
          R.sx = Math.max(R.halfW + MX, Math.min(W - R.halfW - MX, R.sx))
          R.sy = Math.max(R.halfH + MX, Math.min(H - R.halfH - MX, R.sy))
          if (!R.p.pin) {
            const tx = (R.sx - ox) / s, ty = (R.sy - oy) / s
            R.p.x += (tx - R.p.x) * 0.5 // 댐핑 — 오토핏과 다투지 않게 부드럽게 수렴
            R.p.y += (ty - R.p.y) * 0.5
          }
        })
      }

      // ── 관계 — 정연한 흑백 선 네트워크 (시스템 다이어그램 결) ──
      // 색 대신 *선의 결*(점선 패턴)으로 관계를 구분한다. 흐름의 작은 백색 점 하나로 생동.
      const DASH = { contradicts: [5, 4], derives: [2, 4], extends: [10, 5], supports: [], transfer: [] }
      edges.forEach((e, ei) => {
        const na = nodes[e.from], nb = nodes[e.to]
        const A = na && pts.get(na.id), B = nb && pts.get(nb.id)
        if (!A || !B) return
        const [ax, ay] = w2s(A.x, A.y)
        const [bx, by] = w2s(B.x, B.y)
        const busyEdge = outputs[na.id]?.busy || outputs[nb.id]?.busy
        const edgeHot = !neigh || na.id === hoverId || nb.id === hoverId
        const dim = edgeHot ? 1 : (1 + (0.12 - 1) * sim.focusK)
        // 약한 곡률 — 직선 다발의 평면감 대신 정연한 베지어 (제어점은 수직 오프셋)
        const mx = (ax + bx) / 2, my = (ay + by) / 2
        const ex = bx - ax, ey = by - ay
        const elen = Math.hypot(ex, ey) || 1
        const nx = -ey / elen, ny = ex / elen
        const sag = Math.min(26, elen * 0.12) * (ei % 2 ? 1 : -1)
        const cxp = mx + nx * sag, cyp = my + ny * sag
        const drawCurve = () => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cxp, cyp, bx, by); ctx.stroke() }
        // 라임 추적 벡터 — CV 트래킹 라인 결. 옅은 초록 글로우 + 가는 라임 코어선.
        ctx.lineCap = 'butt'
        ctx.setLineDash([])
        ctx.strokeStyle = `rgba(150,230,80,${(busyEdge ? 0.14 : 0.06) * dim})`
        ctx.lineWidth = (busyEdge ? 4 : 3)
        drawCurve()
        ctx.setLineDash(DASH[e.relationType] || [])
        ctx.strokeStyle = `rgba(178,240,74,${(edgeHot ? 0.85 : 0.4) * dim})`
        ctx.lineWidth = (e.relationType === 'supports' ? 1.3 : 0.9) * (neigh && edgeHot ? 1.4 : 1)
        drawCurve()
        ctx.setLineDash([])
        // 신호 흐름 — 베지어를 타는 코멧(머리+꼬리 3비드)
        {
          const head = (t * (busyEdge ? 1.2 : 0.4) + ei * 0.3) % 1
          for (let k = 0; k < 3; k++) {
            const u = head - k * 0.05
            if (u < 0) continue
            const omu = 1 - u
            const px = omu * omu * ax + 2 * omu * u * cxp + u * u * bx
            const py = omu * omu * ay + 2 * omu * u * cyp + u * u * by
            const aa = (busyEdge ? 0.95 : 0.6) * dim * (1 - k * 0.32)
            const sz = (busyEdge ? 2.4 : 1.6) * (1 - k * 0.22)
            ctx.fillStyle = `rgba(210,255,140,${aa})`
            ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2); ctx.fill()
          }
        }
        // 관계 라벨 — 항상 보인다 (데이터 관계 분석 전면화). 라임 모노, 베지어 중점.
        const labelHot = neigh && edgeHot
        const rl = REL[e.relationType]?.label
        if (rl) {
          const mxp = 0.25 * ax + 0.5 * cxp + 0.25 * bx
          const myp = 0.25 * ay + 0.5 * cyp + 0.25 * by
          ctx.font = '700 8px "Share Tech Mono", monospace'
          ctx.globalAlpha = (labelHot ? 1 : (s > 1.0 ? Math.min(1, (s - 1.0) * 2) : 0.55)) * dim
          ctx.fillStyle = 'rgba(196,242,128,0.95)'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(rl, mxp, myp - 5)
          ctx.globalAlpha = 1
        }
      })

      // ── 버스트 — 글자 하나 = 선 하나 ──
      // 깊이 순 그리기 — 해소도 낮은(뒤) 노드부터, 또렷한(앞) 노드를 위에 올린다 (페인터 알고리즘).
      const nearOf = (nn) => {
        const o = outputs[nn.id]; const qq = qualityAvg[nn.id] ?? 0; const cc = chainLens[nn.id] || 0
        return Math.min(1, (o ? 0.42 : 0.1) + qq * 0.4 + Math.min(0.2, cc * 0.07))
      }
      arr.sort((a, b) => nearOf(a.n) - nearOf(b.n))
      arr.forEach(({ n, p }) => {
        const tm = TYPE_META[n.type] || FALLBACK
        const out = outputs[n.id]
        const busy = !!out?.busy
        const audible = !!out
        const q = qualityAvg[n.id] ?? 0
        const chainN = chainLens[n.id] || 0
        const [x, y] = w2s(p.x, p.y)
        // 공간 깊이 — 해소도(가청+평가+체인)가 노드의 밝기를 끌어올린다.
        const near = Math.min(1, (audible ? 0.42 : 0.1) + q * 0.4 + Math.min(0.2, chainN * 0.07))
        const fl = flashOf(n.id)
        const hd = dimOf(n.id)               // 호버 포커스 — 이웃 밖이면 잦아든다
        const isHovered = n.id === hoverId
        // 밝기 = 평가의 빛 + 가청 여부 + 깊이. DIAGRAM-IN 포커스 밖이면 가라앉는다. 호버 포커스도 곱한다.
        const focused = !focusIds || focusIds.has(n.id)
        const bright = ((audible ? 0.55 : 0.22) + q * 0.45) * (0.7 + near * 0.5) * (focused ? 1 : 0.18) * hd

        // ════ 번호 라벨 박스 (정밀 흑백 시스템 다이어그램) ════
        {
          const num = nodes.findIndex((nn) => nn.id === n.id) + 1
          let hsh = 0; const _id = String(n.id); for (let _i = 0; _i < _id.length; _i++) hsh = (hsh * 31 + _id.charCodeAt(_i)) | 0
          const numStr = ((Math.abs(hsh) % 9000000 + 1000000) / 100).toFixed(1)  // 레퍼런스의 프레임 카운터 결
          const a = ((audible ? 0.82 : 0.42) + q * 0.20) * (focused ? 1 : 0.28) * hd
          const FRAME = audible ? '178,240,74' : '150,154,164'   // 가청 = 라임(CV 트래킹 마커), 무음 = 회색
          const title = (n.title || '').length > 20 ? n.title.slice(0, 19) + '…' : (n.title || '')
          ctx.font = '700 10px "Share Tech Mono", monospace'
          const tw = ctx.measureText(title.toUpperCase()).width
          const bw = Math.round(Math.max(62, tw + 30)), bh = 24
          const bxx = Math.round(x - bw / 2), byy = Math.round(y - bh / 2)
          const pulse = busy ? (0.62 + 0.38 * Math.sin(t * 6)) : 1
          // 본체 — 차분한 다크 채움 + (활성) 라임 글로우
          if (audible) {
            ctx.save()
            ctx.shadowColor = `rgba(178,240,74,${0.42 * bright * pulse})`
            ctx.shadowBlur = 12 * (0.4 + bright)
            ctx.fillStyle = `rgba(12,16,13,${0.72 * hd})`
            ctx.fillRect(bxx, byy, bw, bh)
            ctx.restore()
          } else {
            ctx.fillStyle = `rgba(10,12,15,${0.5 * hd})`
            ctx.fillRect(bxx, byy, bw, bh)
          }
          // 외곽 프레임 — CV 트래킹 마커
          if (!audible) ctx.setLineDash([3, 3])
          ctx.strokeStyle = `rgba(${FRAME},${audible ? a : 0.5 * hd})`
          ctx.lineWidth = isHovered ? 1.6 : (busy ? 1.4 * pulse : 1)
          ctx.strokeRect(bxx + 0.5, byy + 0.5, bw - 1, bh - 1)
          ctx.setLineDash([])
          // 좌상단 인덱스 탭
          ctx.fillStyle = `rgba(${FRAME},${Math.min(1, a + 0.05)})`
          ctx.fillRect(bxx, byy - 9, 17, 9)
          ctx.font = '800 8px "Share Tech Mono", monospace'
          ctx.fillStyle = 'rgba(8,12,8,0.95)'
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
          ctx.fillText(String(num).padStart(2, '0'), bxx + 4, byy - 2)
          // 우상단 커넥터 원
          ctx.beginPath(); ctx.arc(bxx + bw - 7, byy + 7, 3.5, 0, Math.PI * 2)
          ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${FRAME},${a})`; ctx.stroke()
          if (n.synthesized) { ctx.fillStyle = `rgba(${FRAME},${a})`; ctx.beginPath(); ctx.arc(bxx + bw - 7, byy + 7, 1.5, 0, Math.PI * 2); ctx.fill() }
          // 제목 (밝은 모노)
          ctx.font = '700 10px "Share Tech Mono", monospace'
          ctx.fillStyle = `rgba(238,244,236,${Math.min(1, a + 0.14)})`
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
          ctx.fillText(title.toUpperCase(), bxx + 9, y + 1)
          // 옆에 프레임 카운터식 숫자 (레퍼런스 결)
          ctx.font = '700 8px "Share Tech Mono", monospace'
          ctx.fillStyle = `rgba(${FRAME},${0.72 * a})`
          ctx.fillText(numStr, bxx + bw + 5, y + 1)
          // 평가의 빛 — 하단 눈금
          if (audible && q > 0.03) {
            const maxSeg = Math.floor((bw - 12) / 5)
            const seg = Math.max(1, Math.round(q * maxSeg))
            ctx.fillStyle = `rgba(178,240,74,${0.8 * hd})`
            for (let k = 0; k < seg; k++) ctx.fillRect(bxx + 4 + k * 5, byy + bh - 3.5, 3, 1.6)
          }
          // 도착 플래시
          if (fl) { const u = (t - fl.t0) / 0.8; ctx.strokeStyle = `rgba(210,255,140,${(1 - u) * 0.85})`; ctx.lineWidth = 1.5; ctx.strokeRect(bxx - 3, byy - 3, bw + 6, bh + 6) }
          // ── CV 데이터 태그 — 박스 아래 마이크로 모노 분석 수치 (실데이터: 타입·글자수·체인 수) ──
          // 레퍼런스의 트래킹 주석 결. 품질 점수는 절대 노출 X — 글자 수·체인 수만.
          if (big || s > 0.55) {
            const charN = (out?.finalText || n.content || n.title || '').length
            const tagY = byy + bh + 7
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
            // 타입 색 점
            ctx.globalAlpha = (focused ? 0.9 : 0.3) * hd
            ctx.fillStyle = tm.color
            ctx.fillRect(bxx, tagY - 3.5, 3, 3)
            ctx.globalAlpha = 1
            // 수치 — 라임/회색 (가청 여부 따라)
            ctx.font = '700 7px "Share Tech Mono", monospace'
            ctx.fillStyle = `rgba(${FRAME},${(focused ? 0.78 : 0.3) * hd})`
            const tag = `${tm.ko} · ${charN}ch${chainN ? ` · ×${chainN}fx` : ''}${n.synthesized ? ' · SYN' : ''}`
            ctx.fillText(tag, bxx + 6, tagY)
          }
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
        }
      })

      // ── 이펙터 라우팅 오버레이 — 신호가 어떤 이펙터를 거쳐 출력에 닿는지 한눈에 ──
      // 케이블 그래프에서 이펙터 모듈과 흐름(node→fx→fx→OUT)을 주황 라우팅으로 그린다.
      if (cables && cables.length) {
        const modOf = (j) => (j && j.startsWith('FX-')) ? j.slice(0, j.lastIndexOf('-')) : null
        const nodePos = (id) => { const p = pts.get(id); return p ? w2s(p.x, p.y) : null }
        const nidOf = (j) => j.slice(5, j.lastIndexOf('-'))
        const mods = new Set()
        cables.forEach((c) => { const a = modOf(c.from), b = modOf(c.to); if (a) mods.add(a); if (b) mods.add(b) })
        if (mods.size) {
          const outAnchor = [W * 0.5, H - (big ? 34 : 22)]
          const fxPos = new Map()
          mods.forEach((m) => {
            const acc = []
            cables.forEach((c) => {
              const fm = modOf(c.from), tm2 = modOf(c.to)
              if (tm2 === m && c.from.startsWith('NODE-')) { const sp = nodePos(nidOf(c.from)); if (sp) acc.push(sp) }
              if (fm === m && c.to.startsWith('NODE-')) { const sp = nodePos(nidOf(c.to)); if (sp) acc.push(sp) }
              if (fm === m && c.to === 'OUT-IN') acc.push(outAnchor)
            })
            if (acc.length) fxPos.set(m, [acc.reduce((s, p) => s + p[0], 0) / acc.length, acc.reduce((s, p) => s + p[1], 0) / acc.length])
          })
          mods.forEach((m) => { if (!fxPos.has(m)) fxPos.set(m, outAnchor) })
          for (let it = 0; it < 2; it++) {
            mods.forEach((m) => {
              const acc = [fxPos.get(m)]
              cables.forEach((c) => {
                const fm = modOf(c.from), tm2 = modOf(c.to)
                if (tm2 === m && fm && fxPos.has(fm)) acc.push(fxPos.get(fm))
                if (fm === m && tm2 && fxPos.has(tm2)) acc.push(fxPos.get(tm2))
              })
              const mx = acc.reduce((s, p) => s + p[0], 0) / acc.length
              const my = acc.reduce((s, p) => s + p[1], 0) / acc.length
              const cur = fxPos.get(m)
              fxPos.set(m, [(cur[0] + mx) / 2, (cur[1] + my) / 2])
            })
          }
          const jackPos = (j) => {
            if (j === 'OUT-IN' || j === 'OUT-SEND') return outAnchor
            if (j.startsWith('NODE-')) return nodePos(nidOf(j))
            const m = modOf(j); return m ? fxPos.get(m) : null
          }
          // 흐름선 — 휘어진 케이블(직선 부채꼴 폐기) + 흐르는 빛 입자로 방향·생동을
          cables.forEach((c, ci) => {
            if (!modOf(c.from) && !modOf(c.to) && c.to !== 'OUT-IN') return
            const A = jackPos(c.from), B = jackPos(c.to)
            if (!A || !B) return
            const dx = B[0] - A[0], dy = B[1] - A[1]
            const len = Math.hypot(dx, dy) + 0.01
            const nx = -dy / len, ny = dx / len
            const bow = (ci % 2 ? 1 : -1) * Math.min(46, len * 0.2)
            const cx = (A[0] + B[0]) / 2 + nx * bow, cy = (A[1] + B[1]) / 2 + ny * bow
            ctx.strokeStyle = 'rgba(236,239,245,0.4)'
            ctx.lineWidth = 1.1
            ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(cx, cy, B[0], B[1]); ctx.stroke()
            // 흐르는 빛 입자 — 신호가 이 방향으로 흐른다 (연주감)
            const u = (t * 0.5 + ci * 0.31) % 1, m1 = 1 - u
            const px = m1 * m1 * A[0] + 2 * m1 * u * cx + u * u * B[0]
            const py = m1 * m1 * A[1] + 2 * m1 * u * cy + u * u * B[1]
            ctx.fillStyle = 'rgba(255,255,255,0.8)'
            ctx.fillRect(px - 1, py - 1, 2, 2)
          })
          // 이펙터 배지 — 마름모 + 한글 약칭
          mods.forEach((m) => {
            const pos = fxPos.get(m); if (!pos) return
            const [bx, by] = pos
            const r = 7
            ctx.fillStyle = 'rgba(8,9,12,0.6)'
            ctx.strokeStyle = 'rgba(236,239,245,0.85)'
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(bx, by - r); ctx.lineTo(bx + r, by); ctx.lineTo(bx, by + r); ctx.lineTo(bx - r, by); ctx.closePath(); ctx.fill(); ctx.stroke()
            ctx.fillStyle = 'rgba(236,239,245,0.9)'
            ctx.font = '700 7px "Share Tech Mono", monospace'
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(FX_KO[m.slice(3)] || m.slice(3, 5), bx, by + 14)
          })
          // OUT 종단
          ctx.strokeStyle = 'rgba(236,239,245,0.9)'
          ctx.lineWidth = 1.3
          ctx.beginPath(); ctx.arc(outAnchor[0], outAnchor[1], 7, 0, Math.PI * 2); ctx.stroke()
          ctx.fillStyle = 'rgba(236,239,245,0.95)'; ctx.font = '700 8px "Share Tech Mono", monospace'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('OUT', outAnchor[0], outAnchor[1] + 15)
        }
      }

      // ── 계측기 프레임 — 눈금자 + 영점 십자 + 상태 리드아웃 (전부 실데이터) ──
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      for (let gx = ox % (50 * s); gx < W; gx += 50 * s) {
        if (50 * s < 14) break
        ctx.moveTo(gx, 0); ctx.lineTo(gx, 4)
      }
      for (let gy = oy % (50 * s); gy < H; gy += 50 * s) {
        if (50 * s < 14) break
        ctx.moveTo(0, gy); ctx.lineTo(4, gy)
      }
      ctx.stroke()
      // 월드 영점 십자
      {
        const [zx, zy] = w2s(0, 0)
        if (zx > -10 && zx < W + 10 && zy > -10 && zy < H + 10) {
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'
          ctx.beginPath()
          ctx.moveTo(zx - 7, zy); ctx.lineTo(zx + 7, zy)
          ctx.moveTo(zx, zy - 7); ctx.lineTo(zx, zy + 7)
          ctx.stroke()
        }
      }
      // 리드아웃 — 배율·노드·관계 수 (품질 점수 아님)
      ctx.font = '400 7.5px "Share Tech Mono", monospace'
      ctx.fillStyle = 'rgba(140,148,164,0.7)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(
        `×${s.toFixed(2)}  N=${String(nodes.length).padStart(2, '0')}  E=${String(edges.length).padStart(2, '0')}`,
        W - 8, H - 7
      )

      // ── 블룸 — 흑백 다이어그램은 크리스프해야 하므로 기본 OFF (sim.bloom===true 일 때만). ──
      if (sim.bloom === true) {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0) // 백킹 픽셀 기준 — 변환 무시
        ctx.globalCompositeOperation = 'lighter'
        ctx.filter = 'blur(2.5px)'
        ctx.globalAlpha = 0.30
        ctx.drawImage(canvas, 0, 0)
        ctx.filter = 'blur(6px)'
        ctx.globalAlpha = 0.16
        ctx.drawImage(canvas, 0, 0)
        ctx.restore()
        ctx.filter = 'none'
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      }

      // ── 비네팅 — 가장자리를 가라앉혀 데이터에 깊이를 준다 (광원 글로우 아님, 단순 감광).
      {
        const cx = W / 2, cy = H / 2
        const vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.32, cx, cy, Math.max(W, H) * 0.72)
        vg.addColorStop(0, 'rgba(0,0,0,0)')
        vg.addColorStop(1, 'rgba(0,0,0,0.42)')
        ctx.fillStyle = vg
        ctx.fillRect(0, 0, W, H)
      }
    }
    const loop = () => { step(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)

    // ── 고해상 캡처 — 화면의 작은 캔버스가 아니라, 전체를 맞춰 큰 오프스크린에 다시 그린다 ──
    const capture = () => {
      const { nodes } = dataRef.current
      if (!nodes.length) return null
      const save = {
        W, H, bw: canvas.width, bh: canvas.height,
        cssW: canvas.style.width, cssH: canvas.style.height,
        cam: { ...sim.cam }, autoFit: sim.autoFit, hoverId: sim.hoverId,
        fitMargin: sim.fitMargin, snapFit: sim.snapFit,
      }
      const pins = new Map()
      for (const [id, p] of sim.pts) { pins.set(id, p.pin); p.pin = true } // 레이아웃 동결
      // 현재 뷰 비율 유지, 긴 변 2400 · 백킹 2x → 최대 4800px
      const aspect = (save.W || 4) / (save.H || 3)
      const longSide = 2400
      const eW = aspect >= 1 ? longSide : Math.round(longSide * aspect)
      const eH = aspect >= 1 ? Math.round(longSide / aspect) : longSide
      const edpr = 2
      W = eW; H = eH
      canvas.width = eW * edpr; canvas.height = eH * edpr
      canvas.style.width = `${eW}px`; canvas.style.height = `${eH}px`
      ctx.setTransform(edpr, 0, 0, edpr, 0, 0)
      sim.hoverId = null
      sim.autoFit = true
      sim.fitMargin = Math.round(longSide * 0.06) // 라벨이 잘리지 않게 가장자리 여백
      sim.snapFit = true                          // 한 프레임에 정확히 맞춤
      step()
      const url = canvas.toDataURL('image/png')
      // 복원
      W = save.W; H = save.H
      canvas.width = save.bw; canvas.height = save.bh
      canvas.style.width = save.cssW; canvas.style.height = save.cssH
      for (const [id, p] of sim.pts) if (pins.has(id)) p.pin = pins.get(id)
      sim.cam = save.cam; sim.autoFit = save.autoFit; sim.hoverId = save.hoverId
      sim.fitMargin = save.fitMargin; sim.snapFit = save.snapFit
      resize()
      return url
    }
    __boardCapture = capture

    // ── 조작 ──
    const screenToWorld = (mx, my) => {
      const { s, ox, oy } = sim.cam
      return [(mx - ox) / s, (my - oy) / s]
    }
    const hitOrb = (mx, my) => {
      const [wx, wy] = screenToWorld(mx, my)
      const { nodes } = dataRef.current
      for (let i = nodes.length - 1; i >= 0; i--) {
        const p = sim.pts.get(nodes[i].id)
        if (!p) continue
        const d = Math.hypot(p.x - wx, p.y - wy)
        if (d < coreOf(nodes[i]) + 26) return { node: nodes[i], p }
      }
      return null
    }

    const onWheel = (e) => {
      e.preventDefault()
      sim.autoFit = false
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const k = e.ctrlKey ? Math.exp(-e.deltaY * 0.012) : e.deltaY > 0 ? 1 / 1.16 : 1.16
      const { s, ox, oy } = sim.cam
      const ns = Math.max(0.15, Math.min(8, s * k))
      sim.cam.ox = mx - ((mx - ox) / s) * ns
      sim.cam.oy = my - ((my - oy) / s) * ns
      sim.cam.s = ns
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const onDown = (e) => {
      if (e.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const hit = hitOrb(e.clientX - rect.left, e.clientY - rect.top)
      if (hit) {
        hit.p.pin = true
        sim.drag = { type: 'orb', p: hit.p }
      } else {
        sim.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: sim.cam.ox, oy: sim.cam.oy }
        sim.autoFit = false
      }
      const move = (ev) => {
        if (!sim.drag) return
        if (sim.drag.type === 'orb') {
          const r2 = canvas.getBoundingClientRect()
          const [wx, wy] = screenToWorld(ev.clientX - r2.left, ev.clientY - r2.top)
          sim.drag.p.x = wx; sim.drag.p.y = wy
          sim.drag.p.vx = 0; sim.drag.p.vy = 0
        } else {
          sim.cam.ox = sim.drag.ox + (ev.clientX - sim.drag.sx)
          sim.cam.oy = sim.drag.oy + (ev.clientY - sim.drag.sy)
        }
      }
      const up = () => {
        if (sim.drag?.type === 'orb') sim.drag.p.pin = false
        sim.drag = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
    canvas.addEventListener('pointerdown', onDown)

    const onMove = (e) => {
      if (sim.drag) { setHover(null); sim.hoverId = null; return }
      const rect = canvas.getBoundingClientRect()
      const hit = hitOrb(e.clientX - rect.left, e.clientY - rect.top)
      if (hit) {
        const { s, ox, oy } = sim.cam
        sim.hoverId = hit.node.id
        setHover({ node: hit.node, sx: hit.p.x * s + ox, sy: hit.p.y * s + oy })
      } else { sim.hoverId = null; setHover(null) }
    }
    const onLeave = () => { sim.hoverId = null; setHover(null) }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const onDbl = () => { sim.autoFit = true }
    canvas.addEventListener('dblclick', onDbl)

    return () => {
      cancelAnimationFrame(raf)
      if (__boardCapture === capture) __boardCapture = null
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('dblclick', onDbl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 노드가 없어도 캔버스는 항상 마운트 — 빈 상태는 오버레이로만.
  const hv = hover
  const tm = hv ? TYPE_META[hv.node.type] || FALLBACK : null
  const hvOut = hv ? outputs[hv.node.id] : null

  return (
    <div ref={wrapRef} style={{ position: 'relative', height: big ? '100%' : height, overflow: 'hidden', background: '#04050a' }}>
      {/* 배경 오로라 — WebGL 셰이더 (노이즈 도메인 워핑). 데이터 캔버스 뒤에 깔린다. */}
      <canvas
        ref={glRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      />
      <canvas
        ref={canvasRef}
        data-liveboard
        style={{ position: 'absolute', inset: 0, display: 'block', cursor: 'grab' }}
      />
      {nodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3a3e48',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.3em',
            fontFamily: '"Share Tech Mono", monospace',
            pointerEvents: 'none',
          }}
        >
          AWAITING SIGNAL
        </div>
      )}
      {/* 호버 카드 — 가까이 가야 글이 열린다 */}
      {hv && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(8, hv.sx + 22), (wrapRef.current?.clientWidth || 300) - 196),
            top: Math.min(Math.max(8, hv.sy + 10), (wrapRef.current?.clientHeight || 200) - 112),
            width: 188,
            background: 'rgba(8,9,12,0.94)',
            border: '1px solid #2e323c',
            borderLeft: `2px solid ${tm.color}`,
            padding: '8px 10px',
            pointerEvents: 'none',
            zIndex: 5,
            fontFamily: '"Share Tech Mono", monospace',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontSize: 7.5, fontWeight: 800, color: tm.color, letterSpacing: '0.1em' }}>
              {tm.ko}{hv.node.synthesized ? ' · SYNTH' : ''}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 7, color: hvOut ? '#84cc16' : '#6a6e76' }}>
              {hvOut ? (hvOut.busy ? 'PROC…' : 'OUT') : 'NULL — 출력 미연결'}
            </span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#eef0f4', marginBottom: 3, wordBreak: 'keep-all' }}>
            {hv.node.title}
          </div>
          <div style={{ fontSize: 8.5, color: '#9aa0aa', lineHeight: 1.5, wordBreak: 'keep-all' }}>
            {((hvOut?.finalText || hv.node.content) || '').slice(0, 90)}{((hvOut?.finalText || hv.node.content) || '').length > 90 ? '…' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

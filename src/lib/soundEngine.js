// soundEngine — 회로가 실제로 소리를 내는 자리. 외부 라이브러리 없는 WebAudio.
// 감산 합성(subtractive)의 결: 톱니파/사각파 → 로우패스 필터 엔벨로프 → 앰프 엔벨로프.
// 진짜 아날로그 신디사이저의 작동감 — 필터가 열리고 닫히는 소리.
//
//   드론      — 디튠된 톱니파 페어가 로우패스 아래 낮게 깔린다 (노드 수 = 화음 두께)
//   tick      — 노브 조작: 짧은 필터 블립 (값에 따라 컷오프가 쓸린다)
//   working   — 변형 중: 드론 필터가 천천히 열렸다 닫히며 숨쉰다 (LFO)
//   arrive    — 변형 도착: 필터 스윕 스태브 (열렸다 닫히는 saw)
//   analyzeDone — 분해 완료: 아르페지오 플럭
//   synthBirth  — 두 음이 글라이드로 만나 새 음이 떠오른다 (포르타멘토)
//   masterResolve — 디튠 saw 코드의 저음 종지, 필터가 천천히 닫힌다
//
// 전부 실제 이벤트 구동 — 더미 사운드 없음. 첫 제스처에서 unlock().

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17]
const BASE = 110 // A2

let ctx = null
let master = null
let droneBus = null
let droneFilter = null
let workLfo = null
let workLfoGain = null
let droneVoices = [] // { oscA, oscB, gain }
let fxSend = null    // 단발음 → 딜레이/공간 보내는 버스
let muted = false
let lastTick = 0

try {
  muted = localStorage.getItem('idea-synth-mute') === '1'
} catch (e) { /* ignore */ }

function freqOf(step) {
  return BASE * Math.pow(2, PENTA[step % PENTA.length] / 12 + Math.floor(step / PENTA.length))
}

function ensure() {
  if (typeof window === 'undefined') return false
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return false
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.16
    master.connect(ctx.destination)

    // FX 버스 — 핑퐁 풍 피드백 딜레이 + 톤. 신스의 공간감.
    fxSend = ctx.createGain()
    fxSend.gain.value = 0.32
    const delay = ctx.createDelay(1.0)
    delay.delayTime.value = 0.34
    const fb = ctx.createGain()
    fb.gain.value = 0.46 // 잔향이 길게 남는다 (~5초까지 꼬리)
    const fbTone = ctx.createBiquadFilter()
    fbTone.type = 'lowpass'
    fbTone.frequency.value = 1700 // 반복할수록 어두워진다 (테이프 에코 결)
    fxSend.connect(delay)
    delay.connect(fbTone)
    fbTone.connect(fb)
    fb.connect(delay) // 피드백 루프
    delay.connect(master)

    // 드론 버스 — 공통 로우패스 (아날로그의 어둑한 바닥)
    droneFilter = ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 420
    droneFilter.Q.value = 1.2
    droneBus = ctx.createGain()
    droneBus.gain.value = 0.4
    droneBus.connect(droneFilter)
    droneFilter.connect(master)

    // working LFO — 변형 중 필터가 숨쉰다
    workLfo = ctx.createOscillator()
    workLfo.frequency.value = 0.9
    workLfoGain = ctx.createGain()
    workLfoGain.gain.value = 0
    workLfo.connect(workLfoGain)
    workLfoGain.connect(droneFilter.frequency)
    workLfo.start()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return true
}

export function unlock() {
  ensure()
}

export function isMuted() {
  return muted
}

export function setMuted(m) {
  muted = m
  try { localStorage.setItem('idea-synth-mute', m ? '1' : '0') } catch (e) { /* ignore */ }
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 0.16, ctx.currentTime, 0.08)
}

// ── 드론 — 디튠된 saw 페어 (노드 수만큼 화음이 쌓인다, 최대 6성) ──
export function setDrone(nodeCount) {
  if (!ensure()) return
  const target = Math.min(6, nodeCount)
  const t = ctx.currentTime
  while (droneVoices.length > target) {
    const v = droneVoices.pop()
    v.gain.gain.setTargetAtTime(0.0001, t, 0.7)
    v.oscA.stop(t + 3)
    v.oscB.stop(t + 3)
  }
  while (droneVoices.length < target) {
    const i = droneVoices.length
    const f = freqOf(i) / 2
    const oscA = ctx.createOscillator()
    const oscB = ctx.createOscillator()
    oscA.type = 'sawtooth'
    oscB.type = 'sawtooth'
    oscA.frequency.value = f
    oscB.frequency.value = f
    oscA.detune.value = -6 - i // 디튠 페어 — 아날로그의 두께
    oscB.detune.value = 6 + i
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.setTargetAtTime(0.028 / Math.max(1, Math.sqrt(i + 1)), t, 1.4)
    oscA.connect(gain)
    oscB.connect(gain)
    gain.connect(droneBus)
    oscA.start()
    oscB.start()
    droneVoices.push({ oscA, oscB, gain })
  }
}

// ── working — 변형이 흐르는 동안 드론 필터가 숨쉰다 ──
export function setWorking(on) {
  if (!ctx || !workLfoGain) return
  workLfoGain.gain.setTargetAtTime(on ? 240 : 0, ctx.currentTime, 0.3)
  if (droneFilter) droneFilter.frequency.setTargetAtTime(on ? 620 : 420, ctx.currentTime, 0.4)
}

// ── 신스 보이스 — 디튠 오실레이터 페어 → 레조넌트 필터 엔벨로프 → 앰프 → 공간 ──
function voice(freq, {
  dur = 0.3, type = 'sawtooth', vol = 0.2, when = 0,
  cutFrom = 2400, cutTo = 280, q = 9,
  attack = 0.006, glideTo = null, send = 0.5, detune = 9,
} = {}) {
  if (!ensure()) return
  const t = ctx.currentTime + when

  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(vol, t + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  // 레조넌트 로우패스 — 높은 Q 로 스윕에 신스 특유의 '쟁'이 실린다
  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.Q.value = q
  filt.frequency.setValueAtTime(cutFrom, t)
  filt.frequency.exponentialRampToValueAtTime(Math.max(60, cutTo), t + dur)
  filt.connect(amp)

  // 디튠 오실레이터 페어 — 슈퍼소 풍 두께 (살짝 어긋난 둘이 맥놀이)
  ;[-detune, detune].forEach((dt) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.detune.value = dt
    osc.frequency.setValueAtTime(freq, t)
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.7)
    osc.connect(filt)
    osc.start(t)
    osc.stop(t + dur + 0.08)
  })

  amp.connect(master)
  // 공간 — FX 딜레이로 보낸다 (소리가 회로 안에서 울린다)
  if (fxSend && send > 0) {
    const sg = ctx.createGain()
    sg.gain.value = send * 0.5
    amp.connect(sg)
    sg.connect(fxSend)
  }
}

// 케이블이 잭에 꽂히는 '척' — 낮은 thunk + 위로 스냅하는 짧은 plink (모듈러 패치의 손맛)
export function patch() {
  if (!ensure()) return
  voice(96, { type: 'square', dur: 0.20, vol: 0.30, cutFrom: 1500, cutTo: 140, q: 5, attack: 0.003, send: 0.25 })
  voice(523.25, { type: 'triangle', dur: 0.15, vol: 0.16, cutFrom: 4400, cutTo: 950, q: 7, when: 0.035, glideTo: 784, send: 0.4 })
}

// 노브 조작 — 필터 블립. 노브 값이 컷오프가 된다 (조작값이 소리에도 1:1)
export function tick(value = 0.5) {
  const now = Date.now()
  if (now - lastTick < 70) return
  lastTick = now
  // 새 결 — 따뜻한 삼각파 짧은 플럭. 노브 값이 밝기(컷오프)를 1:1 로 정한다.
  const v = Math.max(0, Math.min(1, value))
  voice(294, {
    dur: 0.09, type: 'triangle', vol: 0.05,
    cutFrom: 700 + v * 4300, cutTo: 900, q: 5, attack: 0.002, send: 0.18, detune: 4,
  })
}

// 신호가 출력에 '맺히는' 순간 — 따뜻한 종소리 스택이 위로 한 단 올라 잔향에 머문다.
// (옛 하강 필터 스태브 폐기 — 어둡게 꺼지지 않고, 밝게 열리며 자리잡는 결.)
export function arrive(idx = 0) {
  const f = freqOf(idx % 5)
  // 직접음을 키우고 잔향 send 를 낮춰 또렷하게 들리게 (직전엔 send 과다로 거의 잔향만 남아 안 들렸다).
  voice(f, { type: 'triangle', dur: 0.6, vol: 0.30, cutFrom: 2600, cutTo: 1200, q: 4, attack: 0.003, send: 0.35 })
  voice(f * 2, { type: 'triangle', dur: 0.8, vol: 0.18, cutFrom: 3800, cutTo: 1800, q: 4, when: 0.06, send: 0.4 })
  voice(f * 3, { type: 'sine', dur: 0.6, vol: 0.09, cutFrom: 5200, cutTo: 2800, q: 3, when: 0.12, send: 0.5 })
}

// 분해 완료 — 하나의 재료가 N 조각으로 *갈라져 펼쳐진다*. 중심음에서 위아래로 벌어지는 짧은 플럭 무리.
// (옛 단순 상행 아르페지오 폐기 — 분해의 결을 '펼침'으로 들려준다.)
export function analyzeDone(count = 3) {
  const n = Math.min(7, Math.max(2, count))
  const center = freqOf(2) * 1.5
  for (let i = 0; i < n; i++) {
    const spread = i - (n - 1) / 2                 // 중심 기준 -..+
    const f = center * Math.pow(2, spread / 6)     // 중심에서 위·아래로 부채처럼 벌어진다
    voice(f, { type: 'triangle', dur: 0.2, vol: 0.11, cutFrom: 3400, cutTo: 600, q: 6, attack: 0.004, when: i * 0.055, send: 0.45 })
  }
}

// SYNTH 탄생 — 두 음이 포르타멘토로 미끄러져 만나고, 새 음이 떠오른다
export function synthBirth() {
  const fa = freqOf(0) * 2
  const fb = freqOf(3) * 2
  const fc = freqOf(4) * 2
  // 새 결 — 삼각파 두 음이 포르타멘토로 만나고, 밝은 종소리로 떠오른다 (어두운 cutTo 폐기).
  voice(fa, { type: 'triangle', dur: 0.7, vol: 0.11, cutFrom: 1800, cutTo: 1000, glideTo: fc, send: 0.6 })
  voice(fb, { type: 'triangle', dur: 0.7, vol: 0.11, cutFrom: 1800, cutTo: 1000, glideTo: fc, when: 0.05, send: 0.6 })
  voice(fc, { type: 'triangle', dur: 1.0, vol: 0.16, cutFrom: 3600, cutTo: 1800, q: 5, when: 0.42, send: 0.8 })
  voice(fc * 2, { type: 'sine', dur: 0.9, vol: 0.045, cutFrom: 5200, cutTo: 2600, when: 0.5, send: 0.85 })
}

// 합성(선언문) 완료 — 따뜻한 삼각파 코드가 피어올라 자리를 잡는다 (밝은 종지, 어두운 dive 폐기).
export function masterResolve() {
  const root = freqOf(0)
  ;[1, 1.5, 2, 3].forEach((r, i) =>
    voice(root * r, { type: 'triangle', dur: 1.6 - i * 0.1, vol: 0.13 - i * 0.018, cutFrom: 1700, cutTo: 900, q: 3, when: i * 0.06, attack: 0.05, send: 0.8 })
  )
  voice(root * 4, { type: 'sine', dur: 1.4, vol: 0.04, cutFrom: 4200, cutTo: 2400, when: 0.2, send: 0.85 })
}

// VISION 렌더 완료 — 밝게 열리는 상행 스윕 (새 결: 따뜻한 삼각파 + 잔향)
export function visionDone() {
  voice(freqOf(4) * 2, { type: 'triangle', dur: 0.9, vol: 0.13, cutFrom: 700, cutTo: 3900, q: 6, send: 0.7 })
  voice(freqOf(6) * 2, { type: 'triangle', dur: 0.8, vol: 0.08, cutFrom: 800, cutTo: 3500, q: 6, when: 0.08, send: 0.75 })
}

// 한 음의 패드 보이스 — 부드러운 삼각파 + 살짝 디튠, 종 같은 어택. (Win95 결)
function padNote(freq, { when = 0, dur = 2.6, vol = 0.09, attack = 0.18 } = {}) {
  const t = ctx.currentTime + when
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.linearRampToValueAtTime(vol, t + attack)       // 종처럼 살짝 둥글게
  amp.gain.setValueAtTime(vol, t + dur - 1.0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)  // 길게 사라짐
  ;[-5, 5].forEach((dt) => {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.detune.value = dt
    o.frequency.value = freq
    o.connect(amp)
    o.start(t)
    o.stop(t + dur + 0.1)
  })
  amp.connect(master)
  const sg = ctx.createGain()
  sg.gain.value = 0.4 // 공간(딜레이)으로
  amp.connect(sg)
  if (fxSend) sg.connect(fxSend)
}

// ── 에이전트 부팅음 — Win95 결: 따뜻한 메이저 코드가 위로 펼쳐졌다 머문다 ──
// 카트리지가 깨어나 자리를 잡는 소리. 짧고(약 1.8초) 화사하다.
export function agentBoot(seed = 0) {
  if (!ensure()) return
  // 씨앗에 따라 코드의 높이가 달라진다 (에이전트마다 다른 음색)
  const base = 196 * Math.pow(2, (seed % 4) / 12) // G3 근처에서 살짝 이동
  // 메이저 코드 펼침: 루트 → 3도 → 5도 → 옥타브 (아르페지오처럼 차례로)
  const ratios = [1, 1.26, 1.5, 2]
  ratios.forEach((r, i) => {
    padNote(base * r, { when: i * 0.11, dur: 2.0 - i * 0.15, vol: 0.085, attack: 0.12 })
  })
  // 위에 반짝이는 옥타브 — Win95 특유의 밝은 꼭대기
  padNote(base * 3, { when: 0.5, dur: 1.4, vol: 0.04, attack: 0.05 })
}

// ── 시스템 부팅음 — 전원 인가. 깊고 웅장하며 잔향이 길게 남는다 (~5초) ──
// 깊은 서브가 차오르고, 밝은 상행 스윕이 열린 뒤, 넓은 코드가 자리를 잡고 천천히 사라진다.
export function systemBoot() {
  if (!ensure()) return
  const t = ctx.currentTime

  // ① 깊은 서브 — 바닥에서 차오르고 길게 사라진다
  {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(36, t)
    o.frequency.exponentialRampToValueAtTime(55, t + 1.8)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.24, t + 1.2)
    g.gain.setValueAtTime(0.24, t + 2.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.2)
    o.connect(g); g.connect(master)
    o.start(t); o.stop(t + 5.3)
  }

  // ② 밝은 상행 필터 스윕 — 시스템이 깨어나 열린다
  {
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t + 0.3)
    amp.gain.linearRampToValueAtTime(0.11, t + 1.4)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'; filt.Q.value = 10
    filt.frequency.setValueAtTime(200, t + 0.3)
    filt.frequency.exponentialRampToValueAtTime(5200, t + 2.2)
    filt.connect(amp); amp.connect(master)
    ;[-7, 7].forEach((dt) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'; o.detune.value = dt
      o.frequency.value = 110
      o.connect(filt); o.start(t + 0.3); o.stop(t + 3.3)
    })
    if (fxSend) amp.connect(fxSend) // 공간(딜레이)으로 — 잔향
  }

  // ③ 넓은 종지 코드 — 자리를 잡고 길게 사라진다 (~5초 잔향)
  const root = 110
  ;[1, 1.5, 2, 3].forEach((r, i) =>
    padNote(root * r, { when: 1.3 + i * 0.07, dur: 3.8, vol: 0.11, attack: 0.3 })
  )
}

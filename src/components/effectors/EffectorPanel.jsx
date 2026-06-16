// EFFECTORS 패널 — SPEC 10 종을 2 줄 (5 + 5) 로 박음.
// state · onControlChange(kind, param, value) 받음.

import { useEffect } from 'react'
import RackModule from '../RackModule'
import {
  Perspective, Constrain, Contradict, Consequence, Abstraction, Connect,
} from './EffectorModules'

// 이펙터 6 종 확정 (2026-06-12) — 한 줄 3 모듈, 모듈이 커지고 깊어진다.
const COMPONENTS = {
  perspective: Perspective,
  contradict: Contradict,
  consequence: Consequence,
  constrain: Constrain,
  abstraction: Abstraction,
  connect: Connect,
}

const ROW_1 = ['perspective', 'contradict', 'consequence']
const ROW_2 = ['constrain', 'abstraction', 'connect']

export default function EffectorPanel({
  onJackDown,
  onJackUp,
  effectorState = {},
  onControlChange,
  voicePools = null,
  busyKinds = null, // Set — 지금 변형을 처리 중인 이펙터 (LED 점멸)
  cqx = null,       // CONSEQUENCE 분만 — { canExplode, busy, onExplode }
  ctx = null,       // CONTRADICT 분만 — { canSplit, busy, onSplit }
  agentAxes = [],   // 장착된 에이전트의 사유 축 — LENS 노브가 이걸 훑는다
}) {
  // 잭 버스 — EffectorModules 안 JackHeader 가 가져다 씀
  useEffect(() => {
    window.__jackBus = { onDown: onJackDown, onUp: onJackUp }
    return () => { window.__jackBus = null }
  }, [onJackDown, onJackUp])

  return (
    <RackModule
      title="EFFECTORS"
      style={{ flex: 1, minWidth: 0, height: '100%' }}
      bodyPadding="6px 6px 16px"
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 3,
        }}
      >
        <Row kinds={ROW_1} state={effectorState} onControlChange={onControlChange} voicePools={voicePools} busyKinds={busyKinds} cqx={cqx} ctx={ctx} agentAxes={agentAxes} />
        <Row kinds={ROW_2} state={effectorState} onControlChange={onControlChange} voicePools={voicePools} busyKinds={busyKinds} cqx={cqx} ctx={ctx} agentAxes={agentAxes} />
      </div>
    </RackModule>
  )
}

function Row({ kinds, state, onControlChange, voicePools, busyKinds, cqx, ctx, agentAxes }) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        alignItems: 'stretch',
        gap: 3,
      }}
    >
      {kinds.map((kind, i) => {
        const Mod = COMPONENTS[kind]
        return (
          <div key={kind} style={{ flex: 1, minWidth: 0 }}>
            <Mod
              isLast={i === kinds.length - 1}
              state={state[kind]}
              onChange={(param, value) => onControlChange?.(kind, param, value)}
              onBypassToggle={() =>
                onControlChange?.(kind, '_bypass', !state[kind]?._bypass)
              }
              voicePools={voicePools}
              agentAxes={agentAxes}
              active={!!busyKinds?.has(kind)}
              cqx={kind === 'consequence' ? cqx : undefined}
              ctx={kind === 'contradict' ? ctx : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}

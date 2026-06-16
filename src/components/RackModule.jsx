// 랙에 박힌 고정 모듈 — 드래그 X · 닫기 X.
// 좌(INPUT) · 우(OUTPUT) · 중(EFFECTORS) 자리에 박히는 큰 메탈 패널.
// 헤더 자리는 *배경/구분선 없음* — 텍스트만 위에 떠 있음.
//
// props: title · subtitle · children · width · style · bodyPadding

import { metalPanel, INK, INK_MUTED } from '../lib/textures'
import MetalNoise from './MetalNoise'

// 모서리 볼트 — CLAUDE.md: #c8ccd4 → #6a6e76 → #2a2c32 작은 radial.
// 유로랙 패널의 4 볼트. 입체는 동심 단계로만 (blur·drop-shadow 금지).
function Bolt({ x, y }) {
  return (
    <span
      style={{
        position: 'absolute',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 38% 32%, #c8ccd4 0%, #9ba0a8 38%, #6a6e76 68%, #2a2c32 100%)',
        ...x,
        ...y,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      {/* 일자 홈 */}
      <span
        style={{
          position: 'absolute',
          left: 1.5,
          right: 1.5,
          top: 3.5,
          height: 1.4,
          background: '#3a3e46',
          transform: 'rotate(-24deg)',
        }}
      />
    </span>
  )
}

export default function RackModule({
  title = 'MODULE',
  subtitle,
  headerRight,
  width,
  children,
  style,
  bodyPadding = '14px 14px 16px',
}) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        ...metalPanel,
        borderRadius: 5,
        color: INK,
        overflow: 'hidden',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <MetalNoise />

      {/* 4 볼트 — 유로랙 패널 결 */}
      <Bolt x={{ left: 5 }} y={{ top: 5 }} />
      <Bolt x={{ right: 5 }} y={{ top: 5 }} />
      <Bolt x={{ left: 5 }} y={{ bottom: 5 }} />
      <Bolt x={{ right: 5 }} y={{ bottom: 5 }} />

      {/* 헤더 — 중앙 정렬, 자간 좁게 */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 14px 6px',
          userSelect: 'none',
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: INK,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </span>
      </div>

      {/* 본문 */}
      <div
        style={{
          position: 'relative',
          padding: bodyPadding,
          zIndex: 1,
          flex: 1,
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

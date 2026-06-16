// TopBar — Cascadia 결의 얇은 상단 띠.
// 좌: 타이틀 + 부제 · 가운데: 워크스테이션 메뉴 (실작동) · 우: BACKEND LED · NODES/EDGES LCD

import { useEffect, useRef, useState } from 'react'
import { INK, INK_MUTED, METAL } from '../lib/textures'

const TITLE = 'idea synthesizer'
const SUBTITLE = 'GENERATIVE MODULAR WORKSTATION'

// 로고 — 신스 컨트롤 패널 (페이더 + 노브). 호버 시 노브가 시그널 오렌지로 점등.
function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64" style={{ flexShrink: 0, display: 'block' }}>
      <rect width="64" height="64" rx="14" fill="#f4f5f7" />
      <rect x="0.6" y="0.6" width="62.8" height="62.8" rx="13.4" fill="none" stroke="#d4d7dd" strokeWidth="1.2" />
      <rect x="14.2" y="14" width="3.6" height="28" rx="1.8" fill="#c4c8d0" />
      <rect x="25.2" y="14" width="3.6" height="28" rx="1.8" fill="#c4c8d0" />
      <rect x="36.2" y="14" width="3.6" height="28" rx="1.8" fill="#c4c8d0" />
      <rect x="11.5" y="20" width="9" height="6" rx="1.6" fill="#1c1e24" />
      <rect x="11.9" y="22.6" width="8.2" height="1.2" fill="#f4f5f7" />
      <rect x="22.5" y="30" width="9" height="6" rx="1.6" fill="#1c1e24" />
      <rect x="22.9" y="32.6" width="8.2" height="1.2" fill="#f4f5f7" />
      <rect x="33.5" y="16" width="9" height="6" rx="1.6" fill="#1c1e24" />
      <rect x="33.9" y="18.6" width="8.2" height="1.2" fill="#f4f5f7" />
      {/* 노브 — 호버 시 색이 바뀌는 자리 (data-knob) */}
      <circle data-knob cx="50" cy="42" r="9.6" fill="#1c1e24" style={{ transition: 'fill 160ms' }} />
      <path d="M 43.5 48.5 A 9.6 9.6 0 1 1 56.5 48.5" fill="none" stroke="#c4c8d0" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="50" y1="42" x2="50" y2="34.4" stroke="#f4f5f7" strokeWidth="1.8" strokeLinecap="round" />
      <g fill="#9ba0a8">
        <circle cx="16" cy="50" r="2.2" /><circle cx="24" cy="50" r="2.2" /><circle cx="32" cy="50" r="2.2" />
      </g>
    </svg>
  )
}

export default function TopBar({
  backendOk = false,
  error = null,
  nodeCount = 0,
  edgeCount = 0,
  analyzing = false,
  onTitleClick,
  menuActions = {},
}) {
  const n = analyzing ? '--' : String(nodeCount).padStart(2, '0')
  const e = analyzing ? '--' : String(edgeCount).padStart(2, '0')

  const [openMenu, setOpenMenu] = useState(null)
  const navRef = useRef(null)
  useEffect(() => {
    const close = (ev) => {
      if (navRef.current && !navRef.current.contains(ev.target)) setOpenMenu(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])

  // 메뉴 체계 — 겹침 없이: FILE=세션·산출물 / EDIT=회로 조작 / VIEW=뷰 표시 / WINDOW=창 / HELP
  const w = menuActions.windows || {}
  const MENUS = {
    FILE: [
      { label: '새 세션', action: menuActions.fileNew },
      { label: '세션 열기…', action: menuActions.fileOpenSession },
      { label: '세션 저장…', action: menuActions.fileSaveSession },
      null,
      { label: '아이디어 리포트 내보내기 (.md)', action: menuActions.fileExportReport, disabled: !menuActions.canEdit },
      { label: '보드 이미지 저장 (.png)', action: menuActions.fileExportDiagram, disabled: !menuActions.canDiagram },
      { label: 'STATEMENT 텍스트 복사', action: menuActions.fileCopyStatement, disabled: !menuActions.hasStatement },
    ],
    EDIT: [
      { label: '자동 패치', action: menuActions.editAutoPatch, disabled: !menuActions.canEdit },
      { label: '다시 패치 (새 배선·관계)', action: menuActions.editAutoPatch, disabled: !menuActions.canEdit },
      { label: '다시 분석', action: menuActions.editReanalyze, disabled: !menuActions.canEdit },
      null,
      { label: '케이블 전부 정리', action: menuActions.editClearCables, disabled: !menuActions.canEdit },
      { label: '컨트롤 초기화', action: menuActions.editResetControls },
    ],
    VIEW: [
      { label: `${w.diagram !== 'closed' ? '✓ ' : '  '}DIAGRAM`, action: () => menuActions.toggleWin?.('diagram') },
      { label: `${w.vision !== 'closed' ? '✓ ' : '  '}VISUALIZE`, action: () => menuActions.toggleWin?.('vision') },
      { label: `${w.statement !== 'closed' ? '✓ ' : '  '}STATEMENT`, action: () => menuActions.toggleWin?.('statement') },
      null,
      { label: '보드 전체로 펼치기', action: menuActions.openDiagram, disabled: !menuActions.canDiagram },
      { label: `${menuActions.utilityVisible ? '✓ ' : '   '}유틸리티 랙`, action: menuActions.windowToggleUtility },
    ],
    WINDOW: [
      { label: 'DIAGRAM 창으로 분리', action: () => menuActions.floatWin?.('diagram') },
      { label: 'VISUALIZE 창으로 분리', action: () => menuActions.floatWin?.('vision') },
      { label: 'STATEMENT 창으로 분리', action: () => menuActions.floatWin?.('statement') },
      null,
      { label: 'PANEL 열기 — 중간 확인 창', action: menuActions.openPanel },
      { label: '모든 창 도크로 모으기', action: menuActions.dockAll },
      { label: '전체 화면 토글', action: menuActions.windowFullscreen },
    ],
    HELP: [
      { label: '패치 가이드 · 단축키', action: menuActions.helpOpen },
    ],
  }

  return (
    <header
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid #d4d7dd',
        // 메뉴 바는 항상 최상층 — 케이블·창 위 (OS 메뉴바 관례)
        zIndex: 300,
        flexShrink: 0,
      }}
    >
      {/* 좌측 — 로고 + 타이틀 + 부제. 클릭 = 초기화. 호버 = 로고 점등. */}
      <button
        onClick={onTitleClick}
        title="초기화 — 모든 케이블·입력·결과 비움"
        onMouseEnter={(e) => { const k = e.currentTarget.querySelector('[data-knob]'); if (k) k.setAttribute('fill', '#f97316') }}
        onMouseLeave={(e) => { const k = e.currentTarget.querySelector('[data-knob]'); if (k) k.setAttribute('fill', '#1c1e24') }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <Logo />
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontFamily: '"Helvetica Neue", sans-serif',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.01em',
              color: INK,
            }}
          >
            {TITLE}
          </span>
          <span
            style={{
              fontFamily: '"Barlow Condensed", sans-serif',
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.22em',
              color: INK_MUTED,
              marginTop: 3,
              textTransform: 'uppercase',
            }}
          >
            {SUBTITLE}
          </span>
        </span>
      </button>

      {/* 가운데 메뉴 — 드롭다운 실작동 */}
      <nav ref={navRef} style={{ display: 'flex', gap: 20, position: 'relative' }}>
        {Object.keys(MENUS).map((m) => (
          <div key={m} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === m ? null : m)}
              onMouseEnter={() => openMenu && setOpenMenu(m)}
              style={{
                fontFamily: '"Barlow Condensed", sans-serif',
                background: openMenu === m ? '#dee0e4' : 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.16em',
                color: INK,
                padding: '2px 6px',
                borderRadius: 2,
                textTransform: 'uppercase',
              }}
            >
              {m}
            </button>
            {openMenu === m && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  minWidth: 198,
                  background: 'linear-gradient(180deg, #fafafc 0%, #eceef2 100%)',
                  border: `1px solid ${METAL.edge}`,
                  borderRadius: 3,
                  padding: '4px 0',
                  zIndex: 50,
                }}
              >
                {MENUS[m].map((item, i) =>
                  item === null ? (
                    <div key={i} style={{ height: 1, background: '#cbcdd3', margin: '4px 8px' }} />
                  ) : (
                    <button
                      key={item.label}
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return
                        setOpenMenu(null)
                        item.action?.()
                      }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = '#dee0e4')}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = 'none')}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        cursor: item.disabled ? 'default' : 'pointer',
                        fontSize: 11,
                        color: item.disabled ? '#a0a3a8' : INK,
                        padding: '5px 12px',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* 우측 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* 백엔드 LED */}
        <div title="Python 백엔드 생존 신호 — 꺼져 있으면 synth/server.py 를 실행" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: backendOk ? '#22c55e' : '#dc2626',
              border: `1px solid ${METAL.edge}`,
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)',
            }}
          />
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.22em',
              color: INK_MUTED,
              textTransform: 'uppercase',
            }}
          >
            BACKEND
          </span>
        </div>

        {error && (
          <span
            style={{
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: 9,
              color: '#dc2626',
              letterSpacing: '0.1em',
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={error}
          >
            {error}
          </span>
        )}

        {/* NODES LCD */}
        <span title='분석으로 나온 사고 단위의 수'><LcdCell label="NODES" value={n} /></span>
        {/* EDGES LCD */}
        <span title='사고 단위 사이 관계의 수'><LcdCell label="EDGES" value={e} /></span>
      </div>
    </header>
  )
}

function LcdCell({ label, value, blue = false }) {
  return (
    <div
      style={{
        background: '#1a1410',
        border: `1px solid ${METAL.edge}`,
        borderRadius: 2,
        padding: '3px 8px 2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        minWidth: 48,
      }}
    >
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: '#6b3a2a',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: '"DSEG7 Classic", monospace',
          fontStyle: 'italic',
          fontSize: 15,
          color: blue ? '#06b6d4' : '#dc2626',
          letterSpacing: '0.04em',
          lineHeight: 1,
          marginTop: 1,
        }}
      >
        {value}
      </span>
    </div>
  )
}

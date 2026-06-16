// HELP — 사용 가이드 오버레이. 처음 온 사람이 회로를 만들 수 있게.

const STEPS = [
  ['1', '붙여넣기', 'AI 와 나눈 대화, 메모, 떠오른 문장들을 INPUT 에 붙여넣고 Analyze 를 누른다. 에이전트가 아이디어를 사고 단위로 분해한다.'],
  ['2', '패치', '카드의 OUT 잭을 끌어 이펙터의 IN 에 꽂고, 마지막은 반드시 OUTPUT 의 IN 잭까지 — 연결된 신호만 출력된다. 막막하면 Auto patch가 끝까지 알아서 꽂는다.'],
  ['3', '연주', '각 이펙터는 하나의 사고 동작이다. 일부는 다른 노드를 IN_B 잭에 꽂아 조건을 주고(관점·제약·연결), 일부는 스위치·노브로 방향을 정한다. MIX 로 원문을 얼마나 보존할지 정하면 잠시 후 변형이 흐른다.'],
  ['4', '관찰', 'DIAGRAM 은 회로의 시스템 다이어그램이다 — 번호가 붙은 라벨 박스가 사고 단위, 선이 관계(선 모양이 관계의 종류), 밝기가 에이전트의 평가다. 휠로 줌·드래그로 팬, 더블클릭으로 맞춤. ⛶ 로 크게 펼친다. 소리도 회로의 상태다 (하단 SND 타일).'],
  ['5', '교체', 'AGENT HEAD 카드를 클릭해 다른 사상가를 장착한다. 백남준의 귀와 칸트의 귀는 같은 아이디어를 다르게 듣는다. 맨 아래 NEW AGENT 로 당신의 글로 직접 에이전트를 만들 수도 있다.'],
  ['6', '수확', 'STATEMENT 는 회로가 정착하면 자동으로 맺힌다. ⎇ 다른 종합으로 여러 입장의 종합을 받아 고르고, FILE › 아이디어 리포트로 노드·관계·선언문을 마크다운으로 가져간다.'],
  ['7', '이미지화', 'OUTPUT 의 OUT 잭을 VISUALIZE 의 IN 에 꽂고 ⟳ 렌더 — 선언문이 이미지가 된다. 화풍/사유 토글은 에이전트의 시각 코드 필터: 백남준의 화면 미감으로, 또는 그의 사유 구조로.'],
]

export default function HelpOverlay({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,16,0.82)',
        zIndex: 9990, // 일반 창(9100+)·케이블(9000) 위 — 모달은 최상위

        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '88vw',
          maxHeight: '84vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #f0f2f5 0%, #dee0e4 100%)',
          border: '1px solid #2a2c32',
          borderRadius: 5,
          padding: '22px 26px 18px',
          color: '#2a2a32',
          fontFamily: '"Helvetica Neue", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.02em' }}>
            idea synthesizer — 패치 가이드
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#6a6a72',
            }}
          >
            CLOSE ✕
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: '#6a6a72', marginBottom: 14, lineHeight: 1.5 }}>
          사운드 대신 아이디어를 합성하는 모듈러 신디사이저. 정답을 내는 기계가 아니라, 생각을 연주하는 악기다.
        </div>
        {STEPS.map(([no, t, d]) => (
          <div key={no} style={{ display: 'flex', gap: 12, padding: '7px 0', borderTop: '1px solid #cbcdd3' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#dc2626', width: 18, flexShrink: 0 }}>
              {no}
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 11, color: '#52525c', lineHeight: 1.55, wordBreak: 'keep-all' }}>{d}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: 9.5, color: '#a0a3a8', lineHeight: 1.5 }}>
          모든 부품은 마우스를 올리면 작동 논리가 설명된다. 케이블 클릭 = 연결 정보·관계 지정·삭제. 이펙터 라벨 클릭 = bypass.
        </div>
      </div>
    </div>
  )
}

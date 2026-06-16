// 에이전트 메타 — 신디사이저의 '머리' 카드.
// 백엔드 public/agents/<id>.agent.json 과 1:1. 축 색은 케이블 팔레트 정렬.

export const AGENTS = [
  {
    id: 'paik',
    photo: '/agents/photos/paik.jpg',
    fullName: 'NAM JUNE PAIK',
    subtitle: '데이터 무당 · 비디오 아트',
    color: '#fbbf24',
    axes: ['예술가 정체성', '기술의 인간화', '매체 상호작용', '문화 융합', '시간의 콜라주', '관객 참여'],
    desc: '기술을 가지고 놀아 인간화하고, 관객을 마지막 회로로 끌어들인다. 아이디어를 참여·시간 충돌·매체 정직성의 기준으로 듣는 귀.',
  },
  {
    id: 'eno',
    photo: '/agents/photos/eno.jpg',
    fullName: 'BRIAN ENO',
    subtitle: '생성 음악 · 앰비언트',
    color: '#22d3ee',
    axes: ['창작의 제약', '앰비언트 사운드', '우연의 포용', '전경과 배경', '스튜디오 연주'],
    desc: '통제를 놓고 시스템이 자라게 한다. 제약을 문으로, 실수를 의도로 듣는 귀 — 아이디어를 정원처럼 기르는 관점.',
  },
  {
    id: 'kant',
    photo: '/agents/photos/kant.jpg',
    fullName: 'IMMANUEL KANT',
    subtitle: '비판철학 · 계몽',
    color: '#a855f7',
    axes: ['인식의 한계', '미적 판단', '자유와 법', '숭고와 이성', '현상과 물자체'],
    desc: '무엇을 알 수 있고 무엇을 해야 하는가부터 묻는다. 아이디어의 전제와 한계를 긋고, 보편화 가능한지 시험하는 엄격한 귀.',
  },
  {
    id: 'kahn',
    photo: '/agents/photos/kahn.jpg',
    fullName: 'LOUIS KAHN',
    subtitle: '건축가 · 침묵과 빛',
    color: '#fb923c',
    axes: ['설계 철학', '재료 본질', '공간 기능', '재료 정직', '빛과 공간', '측정 불가 예술'],
    desc: '재료와 빛에게 무엇이 되고 싶은지 묻는다. 침묵과 빛 사이에서 본질과 시작을 듣는 귀.',
  },
  {
    id: 'hadid',
    photo: '/agents/photos/hadid.jpg',
    fullName: 'ZAHA HADID',
    subtitle: '건축가 · 유동하는 공간',
    color: '#d946ef',
    axes: ['기하 폭파', '자연 융합', '미래 지향', '경험 건축', '통제된 자유', '흐르는 공간'],
    desc: '직각을 의심하고 공간을 흐르게 한다. 운동과 미래를 형태에 새기는, 360도로 듣는 귀.',
  },
  {
    id: 'nouvel',
    photo: '/agents/photos/nouvel.jpg',
    fullName: 'JEAN NOUVEL',
    subtitle: '건축가 · 빛과 맥락',
    color: '#84cc16',
    axes: ['감정 설계', '영화적 공간', '비물질화', '맥락 응답', '반사적 단순성', '겹의 투명성'],
    desc: '그 장소, 그 빛에서만 답을 길어 올린다. 건축을 비물질로 녹여 빛의 사건으로 듣는 귀.',
  },
  {
    id: 'musk',
    photo: '/agents/photos/musk.jpg',
    fullName: 'ELON MUSK',
    subtitle: '기업가 · 제1원리 엔지니어링',
    color: '#0ea5e9',
    axes: ['제1원리 물리학', '최적화와 효율', '공학적 제약', '지속적 피드백', '문제 단순화', '다행성의 미래'],
    desc: '모든 것을 물리의 제1원리로 쪼개 다시 쌓는다. 군더더기를 지우고 속도를 높이며, 불가능을 풀 수 있는 단계로 바꾸는 관점.',
  },
  {
    id: 'kanye',
    photo: '/agents/photos/kanye.jpg',
    fullName: 'KANYE WEST',
    subtitle: '창작자 · 음악과 디자인',
    color: '#ec4899',
    axes: ['전체적 설계', '미니멀리즘', '감정의 원동력', '예술의 경계 없음', '비전의 예술', '완벽주의 사랑'],
    desc: '경계를 부수고 확신을 연료로 쓴다. 음악·옷·공간을 한 손으로 빚으며, 군더더기를 비워 본질만 남기는 귀.',
  },
  {
    id: 'chimchakman',
    photo: '/agents/photos/chimchakman.jpg',
    fullName: 'CHIMCHAKMAN',
    subtitle: '코미디언 · 잡학 만담',
    color: '#eab308',
    axes: ['평범한 과정', '자연스러운 흐름', '유머와 현실', '반허세', '삶의 단순함', '쓸데없는 지식'],
    desc: '거창함을 시시하게, 사소함을 진지하게 뒤집는다. 허세를 빼고 잡학으로 노는, 힘을 뺀 B급의 귀.',
  },
]

export const AGENT_IDS = AGENTS.map((a) => a.id)

// 백엔드 GET /api/agents 요약 → 프론트 메타 (사용자가 직접 구운 에이전트)
export function metaFromSummary(a) {
  return {
    id: a.id,
    photo: `/agents/photos/${a.id}.jpg`,
    fullName: (a.label || a.id).toUpperCase(),
    subtitle: a.subtitle || '사용자 에이전트',
    color: a.color || '#8a8e96',
    axes: Array.isArray(a.axes) ? a.axes : [],
    desc: `직접 만든 에이전트 — 발화 ${a.n_samples || '?'}개에서 사유의 축 ${(a.axes || []).length}개를 추출했다.`,
    user: true,
  }
}

export function agentMeta(id, extra = []) {
  return AGENTS.find((a) => a.id === id) || extra.find((a) => a.id === id) || AGENTS[0]
}

export function isKnownAgentId(id, extra = []) {
  return AGENT_IDS.includes(id) || extra.some((a) => a.id === id) || /^user-/.test(id || '')
}

export function nextAgentId(id) {
  const i = AGENT_IDS.indexOf(id)
  return AGENT_IDS[(i + 1) % AGENT_IDS.length]
}

// 케이블 팔레트 (축 색 정렬과 동일)
export const AXIS_PALETTE = ['#fbbf24', '#22d3ee', '#ec4899', '#84cc16', '#a855f7', '#fb923c']

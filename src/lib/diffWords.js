// 단어 단위 diff — 새 텍스트에서 '바뀐 구간'을 표시한다.
// STATEMENT 가 재합성될 때 무엇이 달라졌는지 빛으로 보여주는 실감 장치.
// LCS 기반: 이전 텍스트와 공통인 단어는 유지, 새로 들어온 단어는 changed.

export function diffNewWords(oldText = '', newText = '') {
  if (!oldText || !newText || oldText === newText) {
    return [{ text: newText, changed: false }]
  }
  // 공백을 보존하며 분해 (캡처 그룹 split)
  const a = oldText.split(/(\s+)/).filter((t) => t !== '')
  const b = newText.split(/(\s+)/).filter((t) => t !== '')
  // 너무 길면 디프 생략 (성능 가드)
  if (a.length * b.length > 400000) return [{ text: newText, changed: false }]

  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ text: b[j], changed: false })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++ // 삭제된 단어 — 표시하지 않음
    } else {
      out.push({ text: b[j], changed: true })
      j++
    }
  }
  while (j < m) {
    out.push({ text: b[j], changed: true })
    j++
  }
  // 연속 구간 병합 (공백만의 changed 는 이웃에 흡수)
  const merged = []
  for (const seg of out) {
    const last = merged[merged.length - 1]
    if (last && last.changed === seg.changed) last.text += seg.text
    else merged.push({ ...seg })
  }
  return merged
}

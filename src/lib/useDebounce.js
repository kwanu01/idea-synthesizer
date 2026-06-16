// 디바운스 훅 — 값이 N ms 동안 안 바뀌면 갱신된 값을 돌려줌.

import { useEffect, useState } from 'react'

export function useDebounce(value, ms = 800) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])

  return debounced
}

// 메탈 위에 깔리는 두 노이즈 레이어 — 부모는 position:relative 여야 한다.
import { brushedLayerStyle, grainLayerStyle } from '../lib/textures'

export default function MetalNoise() {
  return (
    <>
      <div aria-hidden style={brushedLayerStyle} />
      <div aria-hidden style={grainLayerStyle} />
    </>
  )
}

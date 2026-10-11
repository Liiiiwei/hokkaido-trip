// 系統設定了「減少動態效果」時，跟手與滑動的動畫改成直接到位
export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

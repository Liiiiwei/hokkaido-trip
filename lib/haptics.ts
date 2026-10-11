// 短震一下當作回饋。只有支援的手機有反應（Android）；iPhone 的瀏覽器不支援，會靜靜略過
export function buzz(pattern: number | number[] = 10): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 被瀏覽器擋下就算了，只是少了震動
  }
}

// 同一個動作進行中時，再次觸發會被忽略（擋掉極快的連點）
export function singleFlight() {
  let busy = false
  return async (fn: () => Promise<void>): Promise<void> => {
    if (busy) return
    busy = true
    try {
      await fn()
    } finally {
      busy = false
    }
  }
}

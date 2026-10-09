const MESSAGES: Record<string, string> = {
  name_taken: '這個名字已經有人用了',
  gone: '這個行程已經被刪掉了',
  bad_key: '連結失效，請跟主揪要新的連結',
  network: '連不上網路，請再試一次',
  conflict: '太多人同時在改，請再試一次',
}

// 把錯誤轉成給人看的一句話；錯誤的 message 是代碼（見 Task 4 的 StoreError）
export function messageOf(error: unknown): string {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''
  return MESSAGES[raw] ?? '操作失敗，請再試一次'
}

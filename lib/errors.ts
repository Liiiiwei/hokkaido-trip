export type ErrorCode =
  | 'bad_key'
  | 'conflict'
  | 'network'
  | 'gone'
  | 'name_taken'
  | 'busy'
  | 'read_only'
  | 'bad_data'
  | 'dates_in_use'
  | 'stale'

// 讀寫行程資料時的錯誤；message 就是代碼
export class StoreError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode) {
    super(code)
    this.name = 'StoreError'
    this.code = code
  }
}

const MESSAGES: Record<string, string> = {
  name_taken: '這個名字已經有人用了',
  gone: '這個行程已經被刪掉了',
  bad_key: '連結失效，請跟主揪要新的連結',
  network: '連不上網路，請再試一次',
  conflict: '太多人同時在改，請再試一次',
  busy: 'GitHub 暫時忙不過來，請過一分鐘再試',
  read_only: '這個連結只能看不能改，請跟主揪要新的連結',
  bad_data: '行程資料檔格式壞了，請跟主揪說',
  stale: '網站剛更新。請先複製打好的內容，關閉面板後會自動換成新版，再存一次',
  dates_in_use: '有人剛在被排除的日子排了行程，請重新確認日期',
}

// 把錯誤轉成給人看的一句話
export function messageOf(error: unknown): string {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''
  return MESSAGES[raw] ?? '操作失敗，請再試一次'
}

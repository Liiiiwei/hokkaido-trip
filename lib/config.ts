// 行程資料放在哪個儲存庫的哪個檔案
export const DATA_REPO = {
  owner: 'Liiiiwei',
  repo: 'hokkaido-trip-data',
  // 驗收測試會用環境變數換成另一個檔案，才不會動到大家的行程
  path: process.env.NEXT_PUBLIC_DATA_PATH ?? 'trip.json',
  branch: 'main',
}

// 前景時每隔多久重抓一次
export const POLL_MS = 15_000

// 設定或更換密語：把 .env.local 裡的權杖用密語加密，寫到 public/door.json。
// 用法：node scripts/seal-door.mts <密語>
// 換權杖之後也要重跑一次。寫完要重新發佈網站才會生效
import { readFileSync, writeFileSync } from 'node:fs'
import { normalizePass, parseDoor, seal, unseal } from '../lib/door.ts'

const OUT = 'public/door.json'

process.loadEnvFile('.env.local')
const token = process.env.TRIP_TOKEN
const pass = normalizePass(process.argv[2] ?? '')

if (!token) {
  console.error('.env.local 裡沒有 TRIP_TOKEN')
  process.exit(1)
}
if (!pass) {
  console.error('用法：node scripts/seal-door.mts <密語>')
  process.exit(1)
}

writeFileSync(OUT, JSON.stringify(await seal(token, pass)) + '\n')

// 另外讀回來解一次，確認寫進去的檔案真的解得開
const saved = parseDoor(JSON.parse(readFileSync(OUT, 'utf8')))
const ok = saved !== null && (await unseal(saved, pass)) === token
if (!ok) {
  console.error(`${OUT} 寫好了但解不回原本的權杖`)
  process.exit(1)
}
console.log(`${OUT} 已更新，用密語解得回權杖。密語長度 ${Array.from(pass).length} 個字`)
if (Array.from(pass).length < 8) {
  console.log('提醒：密語很短，加密檔是公開的，有心人試得出來')
}

import { describe, expect, it } from 'vitest'
import { messageOf } from './errors'

describe('messageOf', () => {
  it('每種錯誤代碼有自己的訊息', () => {
    expect(messageOf(new Error('name_taken'))).toBe('這個名字已經有人用了')
    expect(messageOf(new Error('gone'))).toBe('這個行程已經被刪掉了')
    expect(messageOf(new Error('bad_key'))).toBe('連結失效，請跟主揪要新的連結')
    expect(messageOf(new Error('network'))).toBe('連不上網路，請再試一次')
    expect(messageOf(new Error('conflict'))).toBe('太多人同時在改，請再試一次')
  })
  it('其他錯誤給通用訊息', () => {
    expect(messageOf({ message: 'something else' })).toBe('操作失敗，請再試一次')
    expect(messageOf(null)).toBe('操作失敗，請再試一次')
    expect(messageOf('怪東西')).toBe('操作失敗，請再試一次')
  })
})

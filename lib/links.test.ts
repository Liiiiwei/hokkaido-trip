import { describe, expect, it } from 'vitest'
import { splitLinks } from './links'

describe('splitLinks', () => {
  it('沒有網址時整段都是文字', () => {
    expect(splitLinks('吃拉麵')).toEqual([{ type: 'text', value: '吃拉麵' }])
  })
  it('把網址切出來，顯示成網站名稱', () => {
    expect(splitLinks('訂房 https://www.booking.com/hotel/jp/abc.html 記得帶護照')).toEqual([
      { type: 'text', value: '訂房 ' },
      { type: 'link', href: 'https://www.booking.com/hotel/jp/abc.html', label: 'booking.com' },
      { type: 'text', value: ' 記得帶護照' },
    ])
  })
  it('網址後面緊接的中文標點不算在網址裡', () => {
    expect(splitLinks('看這裡：https://a.test/x。謝謝')).toEqual([
      { type: 'text', value: '看這裡：' },
      { type: 'link', href: 'https://a.test/x', label: 'a.test' },
      { type: 'text', value: '。謝謝' },
    ])
  })
  it('只認 http 與 https，其他寫法當成文字', () => {
    expect(splitLinks('javascript:alert(1) ftp://a.test')).toEqual([
      { type: 'text', value: 'javascript:alert(1) ftp://a.test' },
    ])
  })
  it('保留換行', () => {
    expect(splitLinks('第一行\nhttps://a.test\n第三行')).toEqual([
      { type: 'text', value: '第一行\n' },
      { type: 'link', href: 'https://a.test', label: 'a.test' },
      { type: 'text', value: '\n第三行' },
    ])
  })
})

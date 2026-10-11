import { describe, expect, it } from 'vitest'
import { shellUrls } from './shell'

describe('shellUrls', () => {
  it('只留本站的檔案，別人的網址、版本代號、重複的都不要', () => {
    const entries = [
      { name: 'https://me.github.io/trip/_next/static/a.js' },
      { name: 'https://me.github.io/trip/_next/static/a.js' },
      { name: 'https://me.github.io/trip/version.json?t=1' },
      { name: 'https://me.github.io/other/b.js' },
      { name: 'https://api.github.com/repos/x' },
      { name: 'https://tile.openstreetmap.org/1/2/3.png' },
    ]
    expect(shellUrls(entries, 'https://me.github.io', '/trip')).toEqual([
      'https://me.github.io/trip/_next/static/a.js',
    ])
  })
})

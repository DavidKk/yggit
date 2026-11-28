import { formatJsonLikeValue } from '@/lib/format-json-like'

describe('formatJsonLikeValue', () => {
  it('formats complete JSON objects and JSON strings', () => {
    expect(formatJsonLikeValue({ branch: 'main', count: 2 })).toEqual({
      text: '{\n  "branch": "main",\n  "count": 2\n}',
      isEmpty: false,
    })
    expect(formatJsonLikeValue('{"a":1,"b":[2,3]}')).toEqual({
      text: '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}',
      isEmpty: false,
    })
  })

  it('gracefully formats truncated JSON strings while preserving string literals', () => {
    const truncated = '{"currentBranch":"feature/JZY-3093","branches":[{"name":"a:b,c","tip":"abc'
    const res = formatJsonLikeValue(truncated)
    expect(res.isEmpty).toBe(false)
    expect(res.text).toContain('"currentBranch": "feature/JZY-3093",')
    expect(res.text).toContain('"name": "a:b,c",')
  })

  it('treats empty objects cleanly', () => {
    expect(formatJsonLikeValue({})).toEqual({ text: '{}', isEmpty: true })
    expect(formatJsonLikeValue('{}')).toEqual({ text: '{}', isEmpty: true })
  })
})

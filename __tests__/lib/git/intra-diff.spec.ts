import { computeIntraDiff, splitTokenWithRanges } from '@/lib/git/intra-diff'

describe('intra-diff', () => {
  describe('computeIntraDiff', () => {
    it('returns empty ranges when strings are identical', () => {
      const res = computeIntraDiff('const x = 1;', 'const x = 1;')
      expect(res.oldRanges).toEqual([])
      expect(res.newRanges).toEqual([])
    })

    it('identifies deleted character snippet in line', () => {
      // old: BeforeConfigType *int32
      // new: BeforeConfigType int32
      const res = computeIntraDiff('BeforeConfigType *int32', 'BeforeConfigType int32')
      expect(res.oldRanges).toEqual([[17, 18]])
      expect('BeforeConfigType *int32'.slice(res.oldRanges[0][0], res.oldRanges[0][1])).toBe('*')
      expect(res.newRanges).toEqual([])
    })

    it('identifies added character snippet in line', () => {
      // old: AfterConfigType int32
      // new: AfterConfigType *int32
      const res = computeIntraDiff('AfterConfigType int32', 'AfterConfigType *int32')
      expect(res.oldRanges).toEqual([])
      expect(res.newRanges).toEqual([[16, 17]])
      expect('AfterConfigType *int32'.slice(res.newRanges[0][0], res.newRanges[0][1])).toBe('*')
    })

    it('handles replacement in the middle of a token or phrase', () => {
      const res = computeIntraDiff('const user = getCachedUser()', 'const user = getLiveUser()')
      expect(res.oldRanges.length).toBeGreaterThan(0)
      expect(res.newRanges.length).toBeGreaterThan(0)
    })

    it('handles empty old or new string gracefully', () => {
      const addOnly = computeIntraDiff('', 'hello world')
      expect(addOnly.oldRanges).toEqual([])
      expect(addOnly.newRanges).toEqual([[0, 11]])

      const delOnly = computeIntraDiff('hello world', '')
      expect(delOnly.oldRanges).toEqual([[0, 11]])
      expect(delOnly.newRanges).toEqual([])
    })
  })

  describe('splitTokenWithRanges', () => {
    it('returns single unhighlighted token when no ranges match', () => {
      const parts = splitTokenWithRanges('variableName', 0, [])
      expect(parts).toEqual([{ text: 'variableName', isHighlight: false }])
    })

    it('splits a token when range intersects it', () => {
      // Token '*int32' at start offset 16 with highlight at [16, 17]
      const parts = splitTokenWithRanges('*int32', 16, [[16, 17]])
      expect(parts).toEqual([
        { text: '*', isHighlight: true },
        { text: 'int32', isHighlight: false },
      ])
    })
  })
})

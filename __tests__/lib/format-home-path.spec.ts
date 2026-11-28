import { maskUserHomeInText, maskUserHomePath } from '@/lib/format-home-path'

describe('cross-platform user home path masking', () => {
  it('masks macOS, Linux, and Windows home directories with tilde', () => {
    expect(maskUserHomePath('/Users/alice/Devel/app')).toBe('~/Devel/app')
    expect(maskUserHomePath('/Users/alice')).toBe('~')
    expect(maskUserHomePath('/home/bob/projects/repo')).toBe('~/projects/repo')
    expect(maskUserHomePath('/home/bob')).toBe('~')
    expect(maskUserHomePath('C:\\Users\\carol\\Devel\\repo')).toBe('~\\Devel\\repo')
    expect(maskUserHomePath('D:/Users/carol/Devel')).toBe('~/Devel')
    expect(maskUserHomePath('C:\\Users\\carol')).toBe('~')
  })

  it('preserves system and non-user paths', () => {
    expect(maskUserHomePath('/opt/homebrew/bin/git')).toBe('/opt/homebrew/bin/git')
    expect(maskUserHomePath('/var/log/yggit.log')).toBe('/var/log/yggit.log')
    expect(maskUserHomePath('https://github.com/org/repo')).toBe('https://github.com/org/repo')
  })

  it('redacts embedded user paths inside log messages and JSON text', () => {
    expect(maskUserHomeInText('Loaded "/Users/alice/Develop/admin" and C:\\Users\\bob\\work')).toBe('Loaded "~/Develop/admin" and ~\\work')
    expect(maskUserHomeInText('Failed at /home/dev/repo/main.ts:10')).toBe('Failed at ~/repo/main.ts:10')
  })
})

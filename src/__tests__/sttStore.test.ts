import { resolveSTTLang } from '../store/sttStore';

describe('resolveSTTLang', () => {
  it('returns explicit he-IL unchanged', () => {
    expect(resolveSTTLang('he-IL')).toBe('he-IL');
  });

  it('returns explicit en-US unchanged', () => {
    expect(resolveSTTLang('en-US')).toBe('en-US');
  });

  it('returns a string for auto (no throw)', () => {
    const result = resolveSTTLang('auto');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

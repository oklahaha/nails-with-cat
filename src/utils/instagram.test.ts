import { describe, expect, it } from '@jest/globals';

import { instagramHandle, instagramUrl } from './instagram';

describe('instagramHandle', () => {
  it('reads the name from a profile link', () => {
    expect(instagramHandle('https://www.instagram.com/yeemeng.com.hk/')).toBe('yeemeng.com.hk');
    expect(instagramHandle('instagram.com/natnatlauxd?igsh=abc')).toBe('natnatlauxd');
  });

  it('accepts a bare name or @name', () => {
    expect(instagramHandle('@sze_m_')).toBe('sze_m_');
    expect(instagramHandle('sze_m_')).toBe('sze_m_');
  });

  it('is empty for blanks and other text', () => {
    expect(instagramHandle(undefined)).toBe('');
    expect(instagramHandle('')).toBe('');
    expect(instagramHandle('問佢攞')).toBe('');
  });
});

describe('instagramUrl', () => {
  it('builds a clean profile link', () => {
    expect(instagramUrl('@sze_m_')).toBe('https://www.instagram.com/sze_m_/');
    expect(instagramUrl('https://instagram.com/sze_m_?igsh=x')).toBe(
      'https://www.instagram.com/sze_m_/'
    );
  });

  it('is empty without a profile', () => {
    expect(instagramUrl('')).toBe('');
  });
});

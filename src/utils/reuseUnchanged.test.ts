import { describe, expect, it } from '@jest/globals';

import { reuseUnchanged } from './reuseUnchanged';

type Item = { id: string; name: string };
const keyOf = (item: Item) => item.id;

describe('reuseUnchanged', () => {
  it('returns the previous array when nothing changed', () => {
    const prev = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }];
    const next = prev.map((item) => ({ ...item }));
    expect(reuseUnchanged(prev, next, keyOf)).toBe(prev);
  });

  it('keeps unchanged objects and takes changed ones', () => {
    const prev = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }];
    const result = reuseUnchanged(prev, [{ id: '1', name: 'a' }, { id: '2', name: 'B' }], keyOf);
    expect(result).not.toBe(prev);
    expect(result[0]).toBe(prev[0]);
    expect(result[1]).toEqual({ id: '2', name: 'B' });
  });

  it('treats a reorder as a change but still reuses the objects', () => {
    const prev = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }];
    const result = reuseUnchanged(prev, [{ id: '2', name: 'b' }, { id: '1', name: 'a' }], keyOf);
    expect(result).not.toBe(prev);
    expect(result).toEqual([prev[1], prev[0]]);
    expect(result[0]).toBe(prev[1]);
  });

  it('returns next when there was nothing before', () => {
    const next = [{ id: '1', name: 'a' }];
    expect(reuseUnchanged(null, next, keyOf)).toBe(next);
  });
});

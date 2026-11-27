import { describe, expect, it } from '@jest/globals';

import { firstQuote, parseQuotes, quoteLabel, withQuotes } from './quotes';

describe('parseQuotes', () => {
  it('keeps positions, drops trailing blanks', () => {
    expect(parseQuotes(['', '450', ' '])).toEqual([null, 450]);
    expect(parseQuotes(['380'])).toEqual([380]);
  });
  it('is undefined when all blank and invalid on non-digits', () => {
    expect(parseQuotes(['', ''])).toBeUndefined();
    expect(parseQuotes(['38a'])).toBe('invalid');
  });
});

describe('labels', () => {
  it('numbers from 1', () => {
    expect(quoteLabel(1)).toBe('報價2');
  });
});

describe('withQuotes', () => {
  it('changes only the photos given, by path', () => {
    expect(withQuotes(['a', 'b', 'c'], [100, 200], { c: 300 })).toEqual([100, 200, 300]);
    expect(withQuotes(['a', 'b'], [100, 200], { b: null })).toEqual([100]);
    expect(withQuotes(['a'], [100], { a: null })).toBeUndefined();
  });
});

describe('firstQuote', () => {
  it('is the first one given, whatever the later ones hold', () => {
    expect(firstQuote(['', '380', '4.5'])).toBe(380);
    expect(firstQuote(['3.8', '450'])).toBeUndefined();
    expect(firstQuote(['', ' '])).toBeUndefined();
  });
});

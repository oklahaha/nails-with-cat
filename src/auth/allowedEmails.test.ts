import { describe, expect, it } from '@jest/globals';

import { isAllowedEmail } from './allowedEmails';

describe('isAllowedEmail', () => {
  it('accepts the listed accounts, ignoring case and spaces', () => {
    expect(isAllowedEmail('heiheion@gmail.com')).toBe(true);
    expect(isAllowedEmail(' BaoAnnie0703@Gmail.com ')).toBe(true);
  });

  it('rejects other or missing accounts', () => {
    expect(isAllowedEmail('someone@gmail.com')).toBe(false);
    expect(isAllowedEmail('heiheion@gmail.com.evil.com')).toBe(false);
    expect(isAllowedEmail('')).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
  });
});

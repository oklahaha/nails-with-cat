/// <reference types="node" />
import { describe, expect, it, jest } from '@jest/globals';
import { createHash, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createContext, runInContext } from 'vm';

function fixture() {
  const props: Record<string, string> = {
    ALLOWED_EMAILS: 'operator@example.test', GOOGLE_CLIENT_IDS: 'client-id', AUTH_GENERATION: '1',
  };
  const claims = { email: 'operator@example.test', sub: 'dummy-subject', aud: 'client-id',
    iss: 'https://accounts.google.com', email_verified: 'true', exp: Date.now() / 1000 + 3600 };
  const fetch = jest.fn(() => ({ getResponseCode: () => 200,
    getContentText: () => JSON.stringify(claims) }));
  const context = createContext({
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key: string) => props[key] ?? null,
      setProperty: (key: string, value: string) => { props[key] = value; },
      deleteProperty: (key: string) => { delete props[key]; },
      getProperties: () => ({ ...props }),
    }) },
    Utilities: { getUuid: randomUUID, DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_algorithm: string, value: string) => createHash('sha256').update(value).digest(),
      base64EncodeWebSafe: (value: Uint8Array) => Buffer.from(value).toString('base64url') },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    UrlFetchApp: { fetch }, console,
  });
  runInContext(readFileSync(join(__dirname, 'Code.gs'), 'utf8'), context);
  // Apps Script globals are exercised through its native script interface.
  const call = (expression: string) => runInContext(expression, context);
  return { props, claims, fetch, context, call };
}

describe('server authentication and push revocation', () => {
  it('rejects the bundled legacy token and refuses login without server configuration', () => {
    const f = fixture(); f.props.API_TOKEN = 'old-shared-token';
    expect(() => f.call("checkToken_('old-shared-token')")).toThrow('Unauthorized');
    delete f.props.GOOGLE_CLIENT_IDS;
    expect(() => f.call("createSession_('dummy-id-token')")).toThrow('Unauthorized');
  });

  it.each(['aud', 'iss', 'email', 'email_verified', 'exp'] as const)('rejects invalid %s', (claim) => {
    const f = fixture();
    Object.assign(f.claims, { [claim]: claim === 'exp' ? 0 : 'invalid' });
    expect(() => f.call("createSession_('dummy-id-token')")).toThrow('Unauthorized');
  });

  it('slides a session forward on use instead of expiring it', () => {
    const f = fixture();
    f.call("var issued = createSession_('dummy-id-token').session");
    const key = Object.keys(f.props).find((k) => k.startsWith('SESSION:'))!;
    const day = 24 * 60 * 60 * 1000;
    const stale = { ...JSON.parse(f.props[key]), expiresAt: Date.now() + 10 * day };
    f.props[key] = JSON.stringify(stale);
    f.call('checkToken_(issued.token)');
    expect(JSON.parse(f.props[key]).expiresAt).toBeGreaterThan(Date.now() + 89 * day);
    f.props[key] = JSON.stringify({ ...stale, expiresAt: Date.now() - 1 });
    expect(() => f.call('checkToken_(issued.token)')).toThrow('Unauthorized');
  });

  it('issues opaque sessions and rechecks revocation on each request', () => {
    const f = fixture();
    f.call("var issued = createSession_('dummy-id-token').session");
    expect(f.call('issued.token')).toMatch(/^[a-f0-9]{64}$/);
    expect(f.call('checkToken_(issued.token).email')).toBe('operator@example.test');
    expect(Object.values(f.props).some((v) => v.includes(f.call('issued.token')))).toBe(false);
    f.props.ALLOWED_EMAILS = '';
    expect(() => f.call('checkToken_(issued.token)')).toThrow('Unauthorized');
    f.props.ALLOWED_EMAILS = 'operator@example.test'; f.props.AUTH_GENERATION = '2';
    expect(() => f.call('checkToken_(issued.token)')).toThrow('Unauthorized');
  });

  it('ignores legacy, signed-out and generation-revoked push recipients', () => {
    const f = fixture();
    f.call("var issued = createSession_('dummy-id-token').session");
    f.call("registerPushToken_({pushToken:'ExponentPushToken[dummy]'}, checkToken_(issued.token))");
    f.fetch.mockClear();
    f.call("sendChangePush_('dummy', 'dummy', {}, '')");
    expect(f.fetch).toHaveBeenCalledTimes(1);
    f.call('PropertiesService.getScriptProperties().deleteProperty(sessionKey_(issued.token))');
    f.fetch.mockClear(); f.call("sendChangePush_('dummy', 'dummy', {}, '')");
    expect(f.fetch).not.toHaveBeenCalled();
    f.props.PUSH_TOKENS = JSON.stringify({ 'ExponentPushToken[legacy]': {} });
    f.call("sendChangePush_('dummy', 'dummy', {}, '')");
    expect(f.fetch).not.toHaveBeenCalled();
  });
});

describe('spreadsheet write guards', () => {
  it('neutralizes formula-like service, hand/foot, complex design and status at update sinks', () => {
    const f = fixture();
    const writes: unknown[] = [];
    Object.assign(f.context, {
      openSpreadsheet_: () => ({}), readCustomers_: () => ({ byName: {}, byId: {} }),
      getSheet_: () => ({ getRange: () => ({ getValues: () => [], getDisplayValues: () => [],
        setValue: (value: unknown) => writes.push(value) }) }),
      findAppointmentRow_: () => ({ rowIndex: 2, headers: f.call('Object.values(COL)') }),
      toRows_: () => [{ values: { '預約ID': 'dummy' }, display: {} }],
      SpreadsheetApp: { flush: () => {} },
    });
    f.call(`updateAppointment_('dummy', { customerName: 'Dummy', date: '2026-11-09',
      time: '12:00', service: '=AuditOnly!A1', handOrFoot: '=AuditOnly!A1',
      complexDesign: '=AuditOnly!A1', status: '=AuditOnly!A1' })`);
    expect(writes.filter((value) => value === "'=AuditOnly!A1")).toHaveLength(4);
    expect(writes).not.toContain('=AuditOnly!A1');
  });
});

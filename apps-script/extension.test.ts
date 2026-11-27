/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createContext, runInContext } from 'vm';

const context = createContext({});
runInContext(readFileSync(join(__dirname, 'Code.gs'), 'utf8'), context);
const call = (expression: string) => runInContext(expression, context);

describe('延長', () => {
  it('reads older TRUE / FALSE rows as 全手 / 不延長 and keeps the text', () => {
    expect(call('toExtension_(true)')).toBe('全手');
    expect(call("toExtension_('FALSE')")).toBe('不延長');
    expect(call("toExtension_('幾隻')")).toBe('幾隻');
    expect(call("toExtension_('')")).toBeNull();
  });

  it('accepts older app versions\' true / false and rejects anything else', () => {
    const base = "customerName: 'a', date: '2026-12-01', time: '10:00', service: '整甲'";
    expect(call(`parseAppointmentInput_({ ${base}, extension: true }).extension`)).toBe('全手');
    expect(call(`parseAppointmentInput_({ ${base} }).extension`)).toBeNull();
    expect(() => call(`parseAppointmentInput_({ ${base}, extension: '=A1' })`)).toThrow('延長');
  });

  it('sends the option as extensionLevel, keeping extension a flag for older apps', () => {
    const out = (level: string) =>
      JSON.parse(JSON.stringify(call(`(function () { var a = {}; putExtension_(a, '${level}'); return a; })()`)));
    expect(out('幾隻')).toEqual({ extension: '幾隻', extensionLevel: '幾隻' });
    // Sent back by an older app's status save, it stays 幾隻
    expect(call('toExtension_(\'幾隻\')')).toBe('幾隻');
    expect(out('不延長')).toEqual({ extension: false, extensionLevel: '不延長' });
  });
});

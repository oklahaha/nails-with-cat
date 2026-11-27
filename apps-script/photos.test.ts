/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createContext, runInContext } from 'vm';

const ID = 'AAAAAAAAAAAAAAAAAAAAAA';

function fakeSheet(rows: unknown[][]) {
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max(...rows.map((r) => r.length)),
    getRange: (r: number, c: number, nr = 1, nc = 1) => ({
      getValues: () =>
        Array.from({ length: nr }, (_, i) =>
          Array.from({ length: nc }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')
        ),
      getValue: () => rows[r - 1]?.[c - 1] ?? '',
      getFormula: () => '',
      getFormulas: () => Array.from({ length: nr }, () => Array.from({ length: nc }, () => '')),
      getDisplayValues: () =>
        Array.from({ length: nr }, (_, i) =>
          Array.from({ length: nc }, (_, j) => String(rows[r - 1 + i]?.[c - 1 + j] ?? ''))
        ),
      setValue: (v: unknown) => {
        rows[r - 1][c - 1] = v;
      },
    }),
    appendRow: (row: unknown[]) => rows.push(row),
    deleteRow: (r: number) => rows.splice(r - 1, 1),
  };
}

function fixture() {
  const bookings = fakeSheet([['預約ID', '活動', '收費'], [515, '整甲', 298], [ID, '整甲', 218]]);
  const photos = fakeSheet([
    ['預約ID', 'Type', '相片路徑', 'Price'],
    [515, '完成作品', '完成作品_images/x.jpg', ''],
    [ID, '參考作品', 'r1', 380],
    [ID, '參考作品', 'r2', ''],
  ]);
  const ss = {
    getSheetByName: (name: string) => ({ 預約資料: bookings, 相片: photos })[name],
    getSpreadsheetTimeZone: () => 'Asia/Hong_Kong',
  };
  const props: Record<string, string> = {};
  const context = createContext({
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    SpreadsheetApp: { flush: () => {} },
    Logger: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props[k] ?? null,
        setProperty: (k: string, v: string) => {
          props[k] = v;
        },
      }),
    },
    Utilities: { base64Decode: (x: string) => x, newBlob: () => ({}) },
  });
  runInContext(readFileSync(join(__dirname, 'Code.gs'), 'utf8'), context);
  Object.assign(context, {
    openSpreadsheet_: () => ss,
    photoFileAt_: () => ({ setTrashed: () => {} }),
    photoFolder_: () => ({ createFile: () => {} }),
    photoFileIn_: () => false,
  });
  const call = (expression: string) => JSON.parse(JSON.stringify(runInContext(expression, context) ?? null));
  return { bookings, photos, call };
}

/** Plan and write a booking's photo prices, returning its 報價 as saved. */
function setPrices(f: ReturnType<typeof fixture>, id: string, quotes: string, price: number) {
  return f.call(`(function () {
    var tab = photoTab_(openSpreadsheet_());
    var plan = photoPricePlan_(tab, '${id}', ${quotes}, ${price});
    writePhotoPrices_(tab, plan.writes, false);
    return normalizeQuotes_(plan.quotes);
  })()`);
}

describe('相片 tab', () => {
  it('joins photos and prices by 預約ID, old numeric ids too', () => {
    const f = fixture();
    expect(f.call('readPhotos_(openSpreadsheet_())')['515'].finished).toEqual(['完成作品_images/x.jpg']);
    expect(f.call(`(function () { var a = { id: '${ID}' }; attachPhotos_(a, readPhotos_(openSpreadsheet_())); return a; })()`)).toEqual({
      id: ID,
      referencePhotos: ['r1', 'r2'],
      quotes: [380],
    });
  });

  it('sets 報價 by photo path, leaving the rest, and refuses a photo gone since', () => {
    const f = fixture();
    const set = (quotes: string) => setPrices(f, ID, quotes, 218);
    expect(set('null')).toEqual([380]);
    expect(set("{ byPath: { r2: 450 } }")).toEqual([380, 450]);
    // r1 was removed on the other phone: refused, rather than landing on r2
    f.photos.rows.splice(2, 1);
    expect(() => set("{ byPath: { r1: 999, r2: null } }")).toThrow('參考作品剛被修改');
    expect(f.photos.rows[2][3]).toBe(450);
  });

  it('reads quotesByPath, and nothing from an older single quote', () => {
    const f = fixture();
    const base = "customerName: 'a', date: '2026-11-26', time: '10:00', service: '整甲'";
    expect(f.call(`parseAppointmentInput_({ ${base} }).quotes`)).toBeNull();
    expect(f.call(`parseAppointmentInput_({ ${base}, quotesByPath: { r1: '400', r2: null } }).quotes`)).toEqual({
      byPath: { r1: 400, r2: null },
    });
    // The app turns an older outbox's `quote` into quotesByPath (withoutLegacyQuote)
    expect(f.call(`parseAppointmentInput_({ ${base}, quote: 500 }).quotes`)).toBeNull();
  });

  it('keeps 收費 as the 完成作品 Price: on edit, on upload and from the one-off fill', () => {
    const f = fixture();
    setPrices(f, '515', 'null', 320);
    expect(f.photos.rows[1][3]).toBe(320);
    f.call('fillFinishedPhotoPrices()');
    expect(f.photos.rows[1][3]).toBe(298);
    const path = '完成作品_images/DDDDDDDDDDDDDDDDDDDDDD.完成作品.101010.jpg';
    f.call(`addAppointmentPhoto_('${ID}', 'finished', '${path}', 'b64', 999)`);
    expect(f.photos.rows[4]).toEqual([ID, '完成作品', path, 218]);
  });

  it('adds a row once with its price, and removing deletes only that row', () => {
    const f = fixture();
    const path = '參考作品_images/BBBBBBBBBBBBBBBBBBBBBB.參考作品.101010.jpg';
    f.call(`addAppointmentPhoto_('${ID}', 'reference', '${path}', 'b64', 500)`);
    f.call(`addAppointmentPhoto_('${ID}', 'reference', '${path}', 'b64', 500)`);
    expect(f.photos.rows).toHaveLength(5);
    expect(f.photos.rows[4]).toEqual([ID, '參考作品', path, 500]);
    expect(f.call(`addAppointmentPhoto_('CCCCCCCCCCCCCCCCCCCCCC', 'reference', '${path}', 'b64')`)).toEqual({ missing: true });
    // A stale removal naming another booking, or the wrong Type, changes nothing
    expect(() => f.call(`removeAppointmentPhoto_('515', 'reference', 'r1')`)).toThrow('不屬於');
    expect(() => f.call(`removeAppointmentPhoto_('${ID}', 'finished', 'r1')`)).toThrow('不屬於');
    expect(f.photos.rows).toHaveLength(5);
    f.call(`removeAppointmentPhoto_('${ID}', 'reference', 'r1')`);
    expect(f.call('readPhotos_(openSpreadsheet_())')[ID]).toEqual({
      reference: ['r2', path],
      finished: [],
      quotes: [null, 500],
    });
  });

  it('puts the booking back when a photo price write fails', () => {
    const f = fixture();
    f.call(`(function () {
      readCustomers_ = function () { return { byId: {}, byName: {} }; };
      findAppointmentRow_ = function () { return { rowIndex: 3, headers: ['預約ID', '活動', '收費'] }; };
    })()`);
    // 收費 is a formula in the sheet: put back as the formula, not its result
    const bookingRange = f.bookings.getRange;
    const restored: unknown[] = [];
    f.bookings.getRange = (r: number, c: number, nr?: number, nc?: number) => ({
      ...bookingRange(r, c, nr, nc),
      getFormulas: () => [['', '', '=100+118']],
      setFormula: (formula: string) => restored.push(formula),
    });
    const getRange = f.photos.getRange;
    // A protected Price cell rejects the write
    f.photos.getRange = (r: number, c: number, nr?: number, nc?: number) => {
      const range = getRange(r, c, nr, nc);
      return { ...range, setValue: (v: unknown) => (v === 999 ? (() => { throw new Error('protected'); })() : range.setValue(v)) };
    };
    // 活動 holds text that looks like a formula (typed with a hidden apostrophe)
    f.bookings.rows[2][1] = '=色';
    const input = "{ customerName: 'a', date: '2026-11-26', time: '10:00', service: '整甲', price: 300, quotesByPath: { r1: 999 } }";
    expect(() => f.call(`updateAppointment_('${ID}', ${input})`)).toThrow('protected');
    expect(restored).toEqual(['=100+118']);
    expect(f.bookings.rows[2][1]).toBe("'=色");
    expect(f.photos.rows[2][3]).toBe(380);
  });

  it('applies a resent edit once, and refuses a 報價 for a photo removed meanwhile', () => {
    const f = fixture();
    f.call(`(function () {
      readCustomers_ = function () { return { byId: {}, byName: {} }; };
      findAppointmentRow_ = function () { return { rowIndex: 3, headers: ['預約ID', '活動', '收費'] }; };
    })()`);
    const edit = (price: number, writeId: string, extra = '') =>
      f.call(`updateAppointment_('${ID}', { customerName: 'a', date: '2026-11-26', time: '10:00', service: '整甲', price: ${price}${extra} }, '${writeId}')`);
    edit(300, 'W1');
    edit(400, 'W2', ", quotesByPath: { r1: null }");
    // W1 again, after the app closed before hearing back: W2 stays
    const replay = edit(300, 'W1');
    expect(replay.repeated).toBe(true);
    expect(replay.quotes).toEqual([]);
    expect(f.bookings.rows[2][2]).toBe(400);
    expect(() => edit(500, 'W3', ", quotesByPath: { gone: 500 }")).toThrow('參考作品剛被修改');
    expect(f.bookings.rows[2][2]).toBe(400);
  });

  it('refuses booking and photo writes in another format', () => {
    const f = fixture();
    expect(() => f.call('requireWriteFormat_({})')).toThrow('請先更新 App');
    expect(() => f.call('requireWriteFormat_({ format: 1 })')).toThrow('請先更新 App');
    expect(f.call('requireWriteFormat_({ format: 2 })')).toBeNull();
  });

  it('puts back only the photo price cells written, formulas as formulas', () => {
    const f = fixture();
    const tab = 'photoTab_(openSpreadsheet_())';
    const formulas: string[] = [];
    const getRange = f.photos.getRange;
    f.photos.getRange = (r: number, c: number, nr?: number, nc?: number) => ({
      ...getRange(r, c, nr, nc),
      getFormula: () => (r === 3 ? '=380' : ''),
      setFormula: (formula: string) => formulas.push(formula),
    });
    f.call(`(function () {
      var writes = [{ row: 3, value: 1 }, { row: 4, value: 2 }];
      writePhotoPrices_(${tab}, writes.slice(0, 1), false);
      writePhotoPrices_(${tab}, writes, true);
    })()`);
    // Row 3 back as its formula; row 4, never written, untouched
    expect(formulas).toEqual(['=380']);
    expect(f.photos.rows[3][3]).toBe('');
  });
});

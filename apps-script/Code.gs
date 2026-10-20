/**
 * Nails with Cat — Google Sheets JSON API (Apps Script Web App).
 *
 * Which spreadsheet it talks to is controlled ONLY by Script Properties,
 * so switching from the copy to the real data needs no code change:
 *
 *   SPREADSHEET_ID   ID of the spreadsheet (the copy during development)
 *   API_TOKEN        shared secret; the app sends it as `token`
 *
 * Endpoints (all responses are JSON: { ok: true, ... } or { ok: false, error }):
 *   GET  ?action=ping&token=...
 *   GET  ?action=listAppointments&token=...[&from=YYYY-MM-DD][&to=YYYY-MM-DD]
 *   GET  ?action=listCustomers&token=...
 *   POST body (text/plain JSON): { token, action: 'createAppointment', appointment: {...} }
 *
 * Columns are looked up by header name (row 1), so column order doesn't matter.
 */

const SHEET_APPOINTMENTS = '預約資料';
const SHEET_CUSTOMERS = '顧客';

const COL = {
  id: '預約ID',
  service: '活動',
  notes: '備注',
  customerName: '顧客姓名',
  date: '日期',
  time: '時間',
  duration: 'Duration',
  handOrFoot: '手/腳',
  price: '收費',
  status: '狀態',
  endTime: 'End Time',
};

const CUST_COL = {
  id: '顧客ID',
  name: '顧客姓名',
  phone: '電話',
};

const DEFAULT_STATUS = '預約';

/**
 * How to read dates stored as plain text (not real date cells) with slashes.
 * 'DMY' → 21/10/2026, 'MDY' → 10/21/2026. Real date cells are unaffected.
 */
const TEXT_DATE_ORDER = 'DMY';

/** Hong Kong numbers without country code get this prefix for WhatsApp. */
const DEFAULT_COUNTRY_CODE = '852';

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function doGet(e) {
  return handle_(function () {
    const params = (e && e.parameter) || {};
    checkToken_(params.token);

    switch (params.action) {
      case 'ping':
        return { spreadsheetName: openSpreadsheet_().getName() };
      case 'listAppointments':
        return { appointments: listAppointments_(params.from, params.to) };
      case 'listCustomers':
        return { customers: readCustomers_(openSpreadsheet_()).list };
      default:
        throw new Error('Unknown action: ' + params.action);
    }
  });
}

function doPost(e) {
  return handle_(function () {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkToken_(body.token);

    switch (body.action) {
      case 'createAppointment':
        return { appointment: createAppointment_(body.appointment || {}) };
      default:
        throw new Error('Unknown action: ' + body.action);
    }
  });
}

/** Wrap every response as JSON; errors become { ok: false, error }. */
function handle_(fn) {
  let result;
  try {
    result = Object.assign({ ok: true }, fn());
  } catch (err) {
    result = { ok: false, error: err && err.message ? err.message : String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function checkToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected) throw new Error('API_TOKEN script property is not set');
  if (token !== expected) throw new Error('Unauthorized');
}

function openSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID script property is not set');
  return SpreadsheetApp.openById(id);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function listAppointments_(from, to) {
  const ss = openSpreadsheet_();
  const tz = ss.getSpreadsheetTimeZone();
  const customers = readCustomers_(ss);
  const table = readTable_(getSheet_(ss, SHEET_APPOINTMENTS));

  const out = [];
  table.rows.forEach(function (row) {
    const id = cellText_(row, COL.id);
    if (!id) return; // skip blank rows

    const date = toIsoDate_(row.values[COL.date], row.display[COL.date], tz);
    if (from && date && date < from) return;
    if (to && date && date > to) return;

    // 顧客姓名 may hold the name itself, or a 顧客ID (AppSheet Ref column).
    const rawCustomer = cellText_(row, COL.customerName);
    const customer = customers.byId[rawCustomer] || customers.byName[rawCustomer];

    const apt = {
      id: id,
      service: cellText_(row, COL.service),
      notes: cellText_(row, COL.notes),
      customerName: customer ? customer.name : rawCustomer,
      date: date,
      time: toHHmm_(row.display[COL.time]),
      status: cellText_(row, COL.status),
    };

    if (customer && customer.phone) apt.phone = customer.phone;
    const duration = toMinutes_(row.values[COL.duration], row.display[COL.duration]);
    if (duration != null) apt.durationMinutes = duration;
    const handOrFoot = cellText_(row, COL.handOrFoot);
    if (handOrFoot) apt.handOrFoot = handOrFoot;
    const price = toNumber_(row.values[COL.price]);
    if (price != null) apt.price = price;
    const endTime = toHHmm_(row.display[COL.endTime]);
    if (endTime) apt.endTime = endTime;

    out.push(apt);
  });

  return out;
}

function readCustomers_(ss) {
  const byId = {};
  const byName = {};
  const list = [];

  const sheet = ss.getSheetByName(SHEET_CUSTOMERS);
  if (!sheet) return { byId: byId, byName: byName, list: list };

  readTable_(sheet).rows.forEach(function (row) {
    const name = cellText_(row, CUST_COL.name);
    if (!name) return;
    const customer = {
      id: cellText_(row, CUST_COL.id),
      name: name,
      phone: normalizePhone_(cellText_(row, CUST_COL.phone)),
    };
    if (customer.id) byId[customer.id] = customer;
    if (!byName[name]) byName[name] = customer;
    list.push(customer);
  });

  return { byId: byId, byName: byName, list: list };
}

/** Read a sheet into header-keyed rows (raw values + display strings). */
function readTable_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  const display = range.getDisplayValues();
  const headers = (values[0] || []).map(function (h) {
    return String(h).trim();
  });

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const v = {};
    const d = {};
    headers.forEach(function (h, c) {
      if (!h) return;
      v[h] = values[r][c];
      d[h] = display[r][c];
    });
    rows.push({ values: v, display: d });
  }
  return { headers: headers, rows: rows };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

function createAppointment_(input) {
  const customerName = String(input.customerName || '').trim();
  const date = String(input.date || '').trim();
  const time = String(input.time || '').trim();
  const service = String(input.service || '').trim();
  const notes = String(input.notes || '').trim();

  if (!customerName) throw new Error('customerName is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('time must be HH:mm');
  if (!service) throw new Error('service is required');

  const durationMinutes = toNumber_(input.durationMinutes);
  const price = toNumber_(input.price);
  const handOrFoot = String(input.handOrFoot || '').trim();
  // Matches AppSheet: rows without a duration (e.g. 特別事項) have End Time = start.
  const endTime = durationMinutes != null ? addMinutes_(time, durationMinutes) : time;

  // Both users may save at the same moment — serialize appends.
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = openSpreadsheet_();
    const sheet = getSheet_(ss, SHEET_APPOINTMENTS);
    const table = readTable_(sheet);
    const customers = readCustomers_(ss);
    const customer = customers.byName[customerName];

    const id = newId_(table);
    const [y, m, d] = date.split('-').map(Number);

    const cells = {};
    cells[COL.id] = id;
    cells[COL.service] = service;
    cells[COL.notes] = notes;
    cells[COL.customerName] = customerValueForSheet_(table, customers, customer, customerName);
    cells[COL.date] = new Date(y, m - 1, d);
    cells[COL.time] = time + ':00';
    cells[COL.duration] =
      durationMinutes != null ? durationCellValue_(table, durationMinutes) : '';
    cells[COL.handOrFoot] = handOrFoot;
    cells[COL.price] = price != null ? price : '';
    cells[COL.status] = DEFAULT_STATUS;
    cells[COL.endTime] = endTime ? endTime + ':00' : '';

    // Only fill columns we know; leave any other columns (e.g. AppSheet
    // virtual/formula columns) blank so the sheet computes them.
    const row = table.headers.map(function (h) {
      return Object.prototype.hasOwnProperty.call(cells, h) ? cells[h] : '';
    });
    sheet.appendRow(row);
    SpreadsheetApp.flush();

    const created = {
      id: id,
      service: service,
      notes: notes,
      customerName: customerName,
      date: date,
      time: time,
      status: DEFAULT_STATUS,
    };
    if (customer && customer.phone) created.phone = customer.phone;
    if (durationMinutes != null) created.durationMinutes = durationMinutes;
    if (handOrFoot) created.handOrFoot = handOrFoot;
    if (price != null) created.price = price;
    if (endTime) created.endTime = endTime;
    return created;
  } finally {
    lock.releaseLock();
  }
}

/**
 * If existing rows store 顧客ID in the 顧客姓名 column (AppSheet Ref),
 * write the ID too so AppSheet keeps working; otherwise write the name.
 */
function customerValueForSheet_(table, customers, customer, customerName) {
  if (!customer || !customer.id) return customerName;
  const storesIds = table.rows.some(function (row) {
    const v = cellText_(row, COL.customerName);
    return v && customers.byId[v] && !customers.byName[v];
  });
  return storesIds ? customer.id : customerName;
}

/** 22-char alphanumeric key, same shape as AppSheet's recent 預約ID values. */
function newId_(table) {
  const existing = {};
  table.rows.forEach(function (row) {
    existing[cellText_(row, COL.id)] = true;
  });
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id;
  do {
    id = '';
    for (let i = 0; i < 22; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (existing[id]);
  return id;
}

/**
 * Write Duration in the same format the column already uses:
 * plain minutes ("150") or a duration string ("2:30:00").
 */
function durationCellValue_(table, minutes) {
  for (let i = table.rows.length - 1; i >= 0; i--) {
    const sample = cellText_(table.rows[i], COL.duration);
    if (!sample) continue;
    return /^\d+$/.test(sample) ? minutes : minutesToDuration_(minutes);
  }
  return minutesToDuration_(minutes);
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function getSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function cellText_(row, header) {
  const v = row.display[header];
  return v == null ? '' : String(v).trim();
}

function toIsoDate_(value, display, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');

  const s = String(display || value || '').trim();
  if (!s) return '';

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    const day = TEXT_DATE_ORDER === 'DMY' ? m[1] : m[2];
    const month = TEXT_DATE_ORDER === 'DMY' ? m[2] : m[1];
    return m[3] + '-' + pad2_(month) + '-' + pad2_(day);
  }
  return s;
}

/**
 * Parse a displayed time ("14:30", "14:30:00", "2:30 PM", "下午2:30") to HH:mm.
 * Display strings are used instead of raw values because time-only cells
 * come back as 1899 dates, which shift by odd LMT offsets in Asia/Hong_Kong.
 */
function toHHmm_(display) {
  const s = String(display || '').trim();
  if (!s) return '';
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return s;

  let h = Number(m[1]);
  const isPm = /pm|下午|晚上/i.test(s);
  const isAm = /am|上午|早上/i.test(s);
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  return pad2_(h) + ':' + m[2];
}

/** Duration cells: "1:30:00", "01:30", "90", or a number of minutes. */
function toMinutes_(value, display) {
  if (typeof value === 'number' && !(value instanceof Date)) {
    // A fraction of a day (duration formatted cell) vs plain minutes.
    return value > 0 && value < 1 ? Math.round(value * 24 * 60) : value;
  }
  const s = String(display || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d+):(\d{2})(?::\d{2})?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function minutesToDuration_(minutes) {
  return Math.floor(minutes / 60) + ':' + pad2_(minutes % 60) + ':00';
}

function addMinutes_(hhmm, minutes) {
  const parts = hhmm.split(':').map(Number);
  const total = (parts[0] * 60 + parts[1] + minutes) % (24 * 60);
  return pad2_(Math.floor(total / 60)) + ':' + pad2_(total % 60);
}

function toNumber_(value) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

function normalizePhone_(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return digits.length === 8 ? DEFAULT_COUNTRY_CODE + digits : digits;
}

function pad2_(n) {
  return ('0' + n).slice(-2);
}

// ---------------------------------------------------------------------------
// Manual test helpers — run from the Apps Script editor
// ---------------------------------------------------------------------------

/** Logs which spreadsheet the script is pointed at and the first few rows. */
function debugListAppointments() {
  const ss = openSpreadsheet_();
  Logger.log('Spreadsheet: ' + ss.getName() + ' (' + ss.getId() + ')');
  const list = listAppointments_();
  Logger.log('Total appointments: ' + list.length);
  Logger.log(JSON.stringify(list.slice(-5), null, 2));
}

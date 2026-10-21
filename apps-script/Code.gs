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
 *   POST body (text/plain JSON): { token, action: 'updateAppointment', id, appointment: {...} }
 *   POST body (text/plain JSON): { token, action: 'deleteAppointment', id }
 *   POST body (text/plain JSON): { token, action: 'createCustomer', customer: { name, phone } }
 *   POST body (text/plain JSON): { token, action: 'updateCustomer', key: { id, name }, customer: { name, phone } }
 *   POST body (text/plain JSON): { token, action: 'deleteCustomer', key: { id, name } }
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
      case 'listCustomerAppointments':
        return {
          appointments: listCustomerAppointments_({ id: params.id, name: params.name }),
        };
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
      case 'updateAppointment':
        return { appointment: updateAppointment_(body.id, body.appointment || {}) };
      case 'deleteAppointment':
        deleteAppointment_(body.id);
        return {};
      case 'createCustomer':
        return { customer: createCustomer_(body.customer || {}) };
      case 'updateCustomer':
        return { customer: updateCustomer_(body.key || {}, body.customer || {}) };
      case 'deleteCustomer':
        deleteCustomer_(body.key || {});
        return {};
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
  const sheet = getSheet_(ss, SHEET_APPOINTMENTS);
  const table = from || to ? readTableInDateRange_(sheet, from, to, tz) : readTable_(sheet);

  const out = [];
  table.rows.forEach(function (row) {
    if (!cellText_(row, COL.id)) return; // skip blank rows

    const date = toIsoDate_(row.values[COL.date], row.display[COL.date], tz);
    if (from && date && date < from) return;
    if (to && date && date > to) return;

    out.push(toAppointment_(row, customers, tz));
  });

  return out;
}

/**
 * Every appointment for one customer (any date), for the history in 顧客資料.
 * Rows store either the 顧客ID or the name, so both are matched. Only the
 * 顧客姓名 column is scanned first; full rows are read for the block between
 * the first and last match, like readTableInDateRange_.
 */
function listCustomerAppointments_(key) {
  const id = String(key.id || '').trim();
  const name = String(key.name || '').trim();
  if (!id && !name) throw new Error('id or name is required');

  const ss = openSpreadsheet_();
  const tz = ss.getSpreadsheetTimeZone();
  const customers = readCustomers_(ss);
  const sheet = getSheet_(ss, SHEET_APPOINTMENTS);
  const headers = readHeaders_(sheet);
  const customerCol = headers.indexOf(COL.customerName);
  const lastRow = sheet.getLastRow();
  if (customerCol === -1) throw new Error('Column not found: ' + COL.customerName);
  if (lastRow < 2) return [];

  const matches = function (value) {
    return (id && value === id) || (name && value === name);
  };
  const cells = sheet.getRange(2, customerCol + 1, lastRow - 1, 1).getDisplayValues();
  let first = -1;
  let last = -1;
  cells.forEach(function (cell, i) {
    if (!matches(String(cell[0]).trim())) return;
    if (first === -1) first = i;
    last = i;
  });
  if (first === -1) return [];

  const block = sheet.getRange(first + 2, 1, last - first + 1, headers.length);
  const rows = toRows_(headers, block.getValues(), block.getDisplayValues());
  return rows
    .filter(function (row) {
      return cellText_(row, COL.id) && matches(cellText_(row, COL.customerName));
    })
    .map(function (row) {
      return toAppointment_(row, customers, tz);
    });
}

/** One 預約資料 row as the app's Appointment shape. */
function toAppointment_(row, customers, tz) {
  // 顧客姓名 may hold the name itself, or a 顧客ID (AppSheet Ref column).
  const rawCustomer = cellText_(row, COL.customerName);
  const customer = customers.byId[rawCustomer] || customers.byName[rawCustomer];

  const apt = {
    id: cellText_(row, COL.id),
    service: cellText_(row, COL.service),
    notes: cellText_(row, COL.notes),
    customerName: customer ? customer.name : rawCustomer,
    date: toIsoDate_(row.values[COL.date], row.display[COL.date], tz),
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

  return apt;
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
  return { headers: headers, rows: toRows_(headers, values.slice(1), display.slice(1)) };
}

/**
 * Like readTable_, but only reads full rows for the block that holds
 * appointments between `from` and `to`. Reading every row's display values
 * is what makes a full read slow (the sheet has years of history), so this
 * scans just the 預約ID and 日期 columns first, then fetches the rows from
 * the first match to the last. Rows are mostly in booking order, so that
 * block is small; a stray match far away only makes it bigger, never wrong.
 */
function readTableInDateRange_(sheet, from, to, tz) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { headers: [], rows: [] };

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (h) {
      return String(h).trim();
    });
  const idCol = headers.indexOf(COL.id);
  const dateCol = headers.indexOf(COL.date);
  if (idCol === -1 || dateCol === -1) return readTable_(sheet);
  if (lastRow < 2) return { headers: headers, rows: [] };

  const dataRows = lastRow - 1;
  const ids = sheet.getRange(2, idCol + 1, dataRows, 1).getDisplayValues();
  const dateRange = sheet.getRange(2, dateCol + 1, dataRows, 1);
  const dateValues = dateRange.getValues();
  const dateDisplay = dateRange.getDisplayValues();

  let first = -1;
  let last = -1;
  for (let i = 0; i < dataRows; i++) {
    if (!String(ids[i][0]).trim()) continue;
    const date = toIsoDate_(dateValues[i][0], dateDisplay[i][0], tz);
    // Same rule as listAppointments_: rows without a date are kept
    if (date && ((from && date < from) || (to && date > to))) continue;
    if (first === -1) first = i;
    last = i;
  }
  if (first === -1) return { headers: headers, rows: [] };

  const block = sheet.getRange(first + 2, 1, last - first + 1, lastCol);
  return {
    headers: headers,
    rows: toRows_(headers, block.getValues(), block.getDisplayValues()),
  };
}

function toRows_(headers, values, display) {
  const rows = [];
  for (let r = 0; r < values.length; r++) {
    const v = {};
    const d = {};
    headers.forEach(function (h, c) {
      if (!h) return;
      v[h] = values[r][c];
      d[h] = display[r][c];
    });
    rows.push({ values: v, display: d });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Validate and normalize the appointment fields shared by create and update. */
function parseAppointmentInput_(input) {
  const customerName = String(input.customerName || '').trim();
  const date = String(input.date || '').trim();
  const time = String(input.time || '').trim();
  const service = String(input.service || '').trim();

  if (!customerName) throw new Error('customerName is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('time must be HH:mm');
  if (!service) throw new Error('service is required');

  const durationMinutes = toNumber_(input.durationMinutes);
  return {
    customerName: customerName,
    date: date,
    time: time,
    service: service,
    notes: String(input.notes || '').trim(),
    durationMinutes: durationMinutes,
    price: toNumber_(input.price),
    handOrFoot: String(input.handOrFoot || '').trim(),
    // Matches AppSheet: rows without a duration (e.g. 特別事項) have End Time = start.
    endTime: durationMinutes != null ? addMinutes_(time, durationMinutes) : time,
  };
}

/** The JSON shape the app expects back after a write. */
function appointmentResponse_(id, a, status, customer) {
  const out = {
    id: id,
    service: a.service,
    notes: a.notes,
    customerName: a.customerName,
    date: a.date,
    time: a.time,
    status: status,
  };
  if (customer && customer.phone) out.phone = customer.phone;
  if (a.durationMinutes != null) out.durationMinutes = a.durationMinutes;
  if (a.handOrFoot) out.handOrFoot = a.handOrFoot;
  if (a.price != null) out.price = a.price;
  if (a.endTime) out.endTime = a.endTime;
  return out;
}

function createAppointment_(input) {
  const a = parseAppointmentInput_(input);

  // Both users may save at the same moment — serialize appends.
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = openSpreadsheet_();
    const sheet = getSheet_(ss, SHEET_APPOINTMENTS);
    const table = readTable_(sheet);
    const customers = readCustomers_(ss);
    const customer = customers.byName[a.customerName];

    const id = newId_(table);
    const [y, m, d] = a.date.split('-').map(Number);

    const cells = {};
    cells[COL.id] = id;
    cells[COL.service] = a.service;
    cells[COL.notes] = a.notes;
    cells[COL.customerName] = customerValueForSheet_(table, customers, customer, a.customerName);
    cells[COL.date] = new Date(y, m - 1, d);
    cells[COL.time] = a.time + ':00';
    cells[COL.duration] =
      a.durationMinutes != null ? durationCellValue_(table, a.durationMinutes) : '';
    cells[COL.handOrFoot] = a.handOrFoot;
    cells[COL.price] = a.price != null ? a.price : '';
    cells[COL.status] = DEFAULT_STATUS;
    cells[COL.endTime] = a.endTime ? a.endTime + ':00' : '';

    // Only fill columns we know; leave any other columns (e.g. AppSheet
    // virtual/formula columns) blank so the sheet computes them.
    const row = table.headers.map(function (h) {
      return Object.prototype.hasOwnProperty.call(cells, h) ? cells[h] : '';
    });
    sheet.appendRow(row);
    SpreadsheetApp.flush();

    return appointmentResponse_(id, a, DEFAULT_STATUS, customer);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Overwrite an existing 預約資料 row, found by 預約ID. Only the columns the
 * app edits are written, one cell at a time, so any other columns (formulas,
 * AppSheet extras) are left untouched. 狀態 is only written when sent.
 */
function updateAppointment_(id, input) {
  const a = parseAppointmentInput_(input);
  const hasStatus = input.status != null;
  const status = hasStatus ? String(input.status).trim() : null;

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = openSpreadsheet_();
    const sheet = getSheet_(ss, SHEET_APPOINTMENTS);
    const found = findAppointmentRow_(sheet, id);
    const headers = found.headers;
    const rowIndex = found.rowIndex;

    const range = sheet.getRange(rowIndex, 1, 1, headers.length);
    const current = toRows_(headers, range.getValues(), range.getDisplayValues())[0];

    const customers = readCustomers_(ss);
    const customer = customers.byName[a.customerName];
    // Keep the row's existing style: a 顧客ID (AppSheet Ref) or a plain name
    const currentCustomer = cellText_(current, COL.customerName);
    const storesId =
      currentCustomer && customers.byId[currentCustomer] && !customers.byName[currentCustomer];
    const [y, m, d] = a.date.split('-').map(Number);

    const cells = {};
    cells[COL.service] = a.service;
    cells[COL.notes] = a.notes;
    cells[COL.customerName] = storesId && customer && customer.id ? customer.id : a.customerName;
    cells[COL.date] = new Date(y, m - 1, d);
    cells[COL.time] = a.time + ':00';
    cells[COL.duration] =
      a.durationMinutes != null
        ? durationValueLike_(cellText_(current, COL.duration), a.durationMinutes)
        : '';
    cells[COL.handOrFoot] = a.handOrFoot;
    cells[COL.price] = a.price != null ? a.price : '';
    if (hasStatus) cells[COL.status] = status;
    cells[COL.endTime] = a.endTime ? a.endTime + ':00' : '';

    Object.keys(cells).forEach(function (h) {
      const c = headers.indexOf(h);
      if (c !== -1) sheet.getRange(rowIndex, c + 1).setValue(cells[h]);
    });
    SpreadsheetApp.flush();

    return appointmentResponse_(
      id,
      a,
      hasStatus ? status : cellText_(current, COL.status),
      customer
    );
  } finally {
    lock.releaseLock();
  }
}

/** Remove an appointment's row from 預約資料, found by 預約ID. */
function deleteAppointment_(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getSheet_(openSpreadsheet_(), SHEET_APPOINTMENTS);
    sheet.deleteRow(findAppointmentRow_(sheet, id).rowIndex);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Find the row holding `id` in 預約ID, scanning only that column.
 * Returns its 1-based row number and the sheet's headers.
 */
function findAppointmentRow_(sheet, id) {
  id = String(id || '').trim();
  if (!id) throw new Error('id is required');

  const lastRow = sheet.getLastRow();
  const headers = readHeaders_(sheet);
  const idCol = headers.indexOf(COL.id);
  if (idCol === -1) throw new Error('Column not found: ' + COL.id);

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getDisplayValues();
    // Recent bookings are near the bottom
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]).trim() === id) return { rowIndex: i + 2, headers: headers };
    }
  }
  throw new Error('找不到此預約，可能已被刪除（' + id + '）');
}

/** Append a 顧客 row, with a new 顧客ID shaped like the existing ones. */
function createCustomer_(input) {
  const name = String(input.name || '').trim();
  // Stored as typed (digits only); reads add the 852 prefix
  const phone = String(input.phone || '').replace(/[^\d]/g, '');
  if (!name) throw new Error('請輸入顧客姓名');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = openSpreadsheet_();
    const sheet = getSheet_(ss, SHEET_CUSTOMERS);
    const table = readTable_(sheet);
    if (table.headers.indexOf(CUST_COL.name) === -1) {
      throw new Error('Column not found: ' + CUST_COL.name);
    }

    const ids = [];
    table.rows.forEach(function (row) {
      if (cellText_(row, CUST_COL.name) === name) throw new Error('已有同名顧客：' + name);
      const id = cellText_(row, CUST_COL.id);
      if (id) ids.push(id);
    });
    const id = table.headers.indexOf(CUST_COL.id) === -1 ? '' : newCustomerId_(ids);

    const cells = {};
    cells[CUST_COL.id] = id;
    cells[CUST_COL.name] = name;
    cells[CUST_COL.phone] = phone;
    // Leave any other columns blank, as createAppointment_ does
    sheet.appendRow(
      table.headers.map(function (h) {
        return Object.prototype.hasOwnProperty.call(cells, h) ? cells[h] : '';
      })
    );
    SpreadsheetApp.flush();

    return { id: id, name: name, phone: normalizePhone_(phone) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * A 顧客ID in the same style as the latest existing one: the next number
 * when IDs are numeric, otherwise a random key of the same length and
 * character set (AppSheet keys); 8 hex characters for an empty sheet.
 */
function newCustomerId_(ids) {
  const existing = {};
  ids.forEach(function (id) {
    existing[id] = true;
  });

  const sample = ids.length ? ids[ids.length - 1] : '';
  if (/^\d+$/.test(sample)) {
    const max = ids.reduce(function (m, id) {
      return /^\d+$/.test(id) ? Math.max(m, Number(id)) : m;
    }, 0);
    return String(max + 1);
  }

  let chars = '0123456789abcdef';
  if (/[G-Zg-z]/.test(sample) || (/[a-f]/.test(sample) && /[A-F]/.test(sample))) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  } else if (/[A-F]/.test(sample)) {
    chars = '0123456789ABCDEF';
  }
  const length = sample.length || 8;

  let id;
  do {
    id = '';
    for (let i = 0; i < length; i++) id += chars[Math.floor(Math.random() * chars.length)];
  } while (existing[id]);
  return id;
}

/**
 * Edit a 顧客 row (found by 顧客ID, or by name when it has none). Renaming
 * also renames the bookings that store the old name, so they stay linked.
 */
function updateCustomer_(key, input) {
  const name = String(input.name || '').trim();
  // Stored as typed (digits only); reads add the 852 prefix
  const phone = String(input.phone || '').replace(/[^\d]/g, '');
  if (!name) throw new Error('請輸入顧客姓名');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = openSpreadsheet_();
    const sheet = getSheet_(ss, SHEET_CUSTOMERS);
    const found = findCustomerRow_(sheet, key);

    if (name !== found.name && readCustomers_(ss).byName[name]) {
      throw new Error('已有同名顧客：' + name);
    }

    sheet.getRange(found.rowIndex, found.nameCol + 1).setValue(name);
    const phoneCol = found.headers.indexOf(CUST_COL.phone);
    if (phoneCol !== -1) sheet.getRange(found.rowIndex, phoneCol + 1).setValue(phone);
    if (name !== found.name) replaceCustomerRefs_(ss, found.name, name);
    SpreadsheetApp.flush();

    return { id: found.id, name: name, phone: normalizePhone_(phone) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Remove a 顧客 row. Their bookings are kept; any that store the 顧客ID
 * (AppSheet Ref) get the name instead, so the history still reads properly.
 */
function deleteCustomer_(key) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = openSpreadsheet_();
    const sheet = getSheet_(ss, SHEET_CUSTOMERS);
    const found = findCustomerRow_(sheet, key);
    if (found.id) replaceCustomerRefs_(ss, found.id, found.name);
    sheet.deleteRow(found.rowIndex);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/** Find a 顧客 row by 顧客ID, or by name when the customer has no ID. */
function findCustomerRow_(sheet, key) {
  const id = String(key.id || '').trim();
  const name = String(key.name || '').trim();
  if (!id && !name) throw new Error('id or name is required');

  const headers = readHeaders_(sheet);
  const idCol = headers.indexOf(CUST_COL.id);
  const nameCol = headers.indexOf(CUST_COL.name);
  if (nameCol === -1) throw new Error('Column not found: ' + CUST_COL.name);

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
    for (let i = 0; i < rows.length; i++) {
      const rowId = idCol === -1 ? '' : String(rows[i][idCol]).trim();
      const rowName = String(rows[i][nameCol]).trim();
      if (id ? rowId === id : rowName === name) {
        return { rowIndex: i + 2, headers: headers, nameCol: nameCol, id: rowId, name: rowName };
      }
    }
  }
  throw new Error('找不到此顧客，可能已被刪除（' + (id || name) + '）');
}

/** In 預約資料, change every 顧客姓名 cell holding `from` to `to`. */
function replaceCustomerRefs_(ss, from, to) {
  const sheet = getSheet_(ss, SHEET_APPOINTMENTS);
  const col = readHeaders_(sheet).indexOf(COL.customerName);
  const lastRow = sheet.getLastRow();
  if (col === -1 || lastRow < 2) return;

  const cells = [];
  sheet
    .getRange(2, col + 1, lastRow - 1, 1)
    .getDisplayValues()
    .forEach(function (row, i) {
      if (String(row[0]).trim() === from) cells.push(sheet.getRange(i + 2, col + 1).getA1Notation());
    });
  if (cells.length) sheet.getRangeList(cells).setValue(to);
}

function readHeaders_(sheet) {
  return sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0]
    .map(function (h) {
      return String(h).trim();
    });
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
    if (sample) return durationValueLike_(sample, minutes);
  }
  return minutesToDuration_(minutes);
}

/** Minutes in the same format as `sample`; a duration string when it's blank. */
function durationValueLike_(sample, minutes) {
  return /^\d+$/.test(sample) ? minutes : minutesToDuration_(minutes);
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

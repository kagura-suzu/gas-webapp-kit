// GASのサーバー側コード（src/**/*.js）を、パソコンの中で動かすための仕組み。
// テスト（Vitest）とプレビューの両方で使う。Googleの機能はよく使う一部だけを再現する。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const UNSUPPORTED_SERVICES = [
  'DriveApp', 'GmailApp', 'MailApp', 'UrlFetchApp', 'CalendarApp', 'DocumentApp',
  'SlidesApp', 'FormApp', 'ContactsApp', 'GroupsApp', 'LanguageApp', 'Maps', 'Charts', 'XmlService',
];

function unsupported(name) {
  return new Error(`プレビューでは ${name} は使えません。Googleに送ってから確認用の画面で試してください。`);
}

/** 実装していない機能に触れたときに、分かりやすいエラーにする */
function guard(name, target) {
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON' || prop === 'constructor') return undefined;
      throw unsupported(`${name}.${String(prop)}`);
    },
  });
}

// ---- スプレッドシート -------------------------------------------------------

function columnToNumber(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseA1(a1) {
  const m = /^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/.exec(String(a1).trim());
  if (!m) throw unsupported(`getRange("${a1}") の書き方`);
  const row = Number(m[2]);
  const col = columnToNumber(m[1]);
  const row2 = m[4] ? Number(m[4]) : row;
  const col2 = m[3] ? columnToNumber(m[3]) : col;
  return [Math.min(row, row2), Math.min(col, col2), Math.abs(row2 - row) + 1, Math.abs(col2 - col) + 1];
}

function makeRange(sheetData, row, col, numRows, numCols) {
  const cell = (r, c) => {
    const line = sheetData.rows[r - 1];
    const v = line ? line[c - 1] : undefined;
    return v === undefined || v === null ? '' : v;
  };
  const write = (r, c, v) => {
    while (sheetData.rows.length < r) sheetData.rows.push([]);
    const line = sheetData.rows[r - 1];
    while (line.length < c - 1) line.push('');
    line[c - 1] = v;
  };
  const range = {
    getRow: () => row,
    getColumn: () => col,
    getNumRows: () => numRows,
    getNumColumns: () => numCols,
    getValues() {
      const out = [];
      for (let r = 0; r < numRows; r++) {
        const line = [];
        for (let c = 0; c < numCols; c++) line.push(cell(row + r, col + c));
        out.push(line);
      }
      return out;
    },
    getDisplayValues() {
      return range.getValues().map((line) => line.map((v) => String(v)));
    },
    getValue: () => cell(row, col),
    setValues(values) {
      if (!Array.isArray(values) || values.length !== numRows) {
        throw new Error(`The number of rows in the data does not match the number of rows in the range. The data has ${Array.isArray(values) ? values.length : 0} but the range has ${numRows}.`);
      }
      values.forEach((line, r) => {
        if (!Array.isArray(line) || line.length !== numCols) {
          throw new Error(`The number of columns in the data does not match the number of columns in the range. The data has ${Array.isArray(line) ? line.length : 0} but the range has ${numCols}.`);
        }
        line.forEach((v, c) => write(row + r, col + c, v));
      });
      return guarded;
    },
    setValue(v) {
      for (let r = 0; r < numRows; r++) for (let c = 0; c < numCols; c++) write(row + r, col + c, v);
      return guarded;
    },
    clearContent() {
      return range.setValue('');
    },
  };
  const guarded = guard('Range', range);
  return guarded;
}

function makeSheet(spreadsheet, sheetData) {
  const lastRow = () => {
    for (let i = sheetData.rows.length; i > 0; i--) {
      if (sheetData.rows[i - 1].some((v) => v !== '' && v !== null && v !== undefined)) return i;
    }
    return 0;
  };
  const lastColumn = () => sheetData.rows.reduce((max, line) => {
    for (let i = line.length; i > 0; i--) if (line[i - 1] !== '' && line[i - 1] !== null && line[i - 1] !== undefined) return Math.max(max, i);
    return max;
  }, 0);
  const sheet = {
    getName: () => sheetData.name,
    setName(name) { sheetData.name = String(name); return guarded; },
    getParent: () => spreadsheet,
    getLastRow: lastRow,
    getLastColumn: lastColumn,
    getMaxRows: () => Math.max(1000, lastRow()),
    getMaxColumns: () => Math.max(26, lastColumn()),
    getRange(a, b, c, d) {
      let row, col, numRows, numCols;
      if (typeof a === 'string') [row, col, numRows, numCols] = parseA1(a);
      else [row, col, numRows, numCols] = [a, b, c === undefined ? 1 : c, d === undefined ? 1 : d];
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1) {
        throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      }
      if (numRows < 1) throw new Error('The number of rows in the range must be at least 1.');
      if (numCols < 1) throw new Error('The number of columns in the range must be at least 1.');
      return makeRange(sheetData, row, col, numRows, numCols);
    },
    getDataRange() {
      return makeRange(sheetData, 1, 1, Math.max(1, lastRow()), Math.max(1, lastColumn()));
    },
    appendRow(values) {
      sheetData.rows.splice(lastRow(), sheetData.rows.length - lastRow(), Array.from(values));
      return guarded;
    },
    deleteRow(row) {
      sheetData.rows.splice(row - 1, 1);
      return guarded;
    },
    deleteRows(row, howMany) {
      sheetData.rows.splice(row - 1, howMany);
      return guarded;
    },
    clear() { sheetData.rows = []; return guarded; },
    clearContents() { sheetData.rows = []; return guarded; },
    setFrozenRows(n) { sheetData.frozenRows = n; return guarded; },
    getFrozenRows: () => sheetData.frozenRows || 0,
  };
  const guarded = guard('Sheet', sheet);
  return guarded;
}

function makeSpreadsheet(store, id) {
  const book = store.books.get(id);
  const spreadsheet = {
    getId: () => id,
    getName: () => book.name,
    getUrl: () => `https://docs.google.com/spreadsheets/d/${id}/edit`,
    getSpreadsheetTimeZone: () => book.timeZone,
    setSpreadsheetTimeZone(tz) {
      book.timeZone = String(tz);
      return guarded;
    },
    getSheets: () => book.sheets.map((s) => makeSheet(guarded, s)),
    getActiveSheet: () => makeSheet(guarded, book.sheets[0]),
    getSheetByName(name) {
      const s = book.sheets.find((x) => x.name === name);
      return s ? makeSheet(guarded, s) : null;
    },
    insertSheet(name) {
      const sheetName = name === undefined ? `シート${book.sheets.length + 1}` : String(name);
      if (book.sheets.some((x) => x.name === sheetName)) {
        throw new Error(`A sheet with the name "${sheetName}" already exists. Please enter another name.`);
      }
      const data = { name: sheetName, rows: [] };
      book.sheets.push(data);
      return makeSheet(guarded, data);
    },
  };
  const guarded = guard('Spreadsheet', spreadsheet);
  return guarded;
}

/**
 * プレビュー用のスプレッドシートの入れ物。
 * sheets: { "シート名": [[1行目], [2行目], ...] }。どのIDで開いても、この内容から始まる。
 */
export function createPreviewStore(sheets = {}, { timeZone = 'Asia/Tokyo' } = {}) {
  const initial = Object.entries(sheets).map(([name, rows]) => ({ name, rows: rows.map((r) => r.slice()) }));
  return {
    timeZone,
    books: new Map(),
    open(id) {
      if (!this.books.has(id)) {
        const sheetsCopy = initial.length > 0
          ? initial.map((s) => ({ name: s.name, rows: s.rows.map((r) => r.slice()) }))
          : [{ name: 'シート1', rows: [] }];
        this.books.set(id, { name: 'プレビュー用のシート', sheets: sheetsCopy, timeZone: this.timeZone });
      }
      return makeSpreadsheet(this, id);
    },
  };
}

// ---- 画面（HtmlService）--------------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** <?= ?>、<?!= ?>、<? ?> を含む画面を、関数の本文に変換する */
export function compileTemplate(source) {
  let code = 'var __out = [];\n';
  const re = /<\?(!=|=)?([\s\S]*?)\?>/g;
  let last = 0;
  let m;
  while ((m = re.exec(source))) {
    code += `__out.push(${JSON.stringify(source.slice(last, m.index))});\n`;
    const body = m[2].trim().replace(/;\s*$/, '');
    if (m[1] === '!=') code += `__out.push(String(${body}));\n`;
    else if (m[1] === '=') code += `__out.push(__esc(${body}));\n`;
    else code += `${m[2]}\n`;
    last = re.lastIndex;
  }
  code += `__out.push(${JSON.stringify(source.slice(last))});\nreturn __out.join('');`;
  return code;
}

class HtmlOutput {
  constructor(content) {
    this.content = String(content);
    this.title = '';
    this.metaTags = [];
  }
  getContent() { return this.content; }
  setContent(c) { this.content = String(c); return this; }
  append(c) { this.content += String(c); return this; }
  appendUntrusted(c) { this.content += escapeHtml(c); return this; }
  setTitle(t) { this.title = String(t); return this; }
  getTitle() { return this.title; }
  addMetaTag(name, content) { this.metaTags.push({ name, content }); return this; }
  setXFrameOptionsMode() { return this; }
  setSandboxMode() { return this; }
  setFaviconUrl() { return this; }
  setWidth() { return this; }
  setHeight() { return this; }
}

class TextOutput {
  constructor(content) {
    this.content = String(content);
    this.mimeType = 'text/plain';
  }
  getContent() { return this.content; }
  setContent(c) { this.content = String(c); return this; }
  append(c) { this.content += String(c); return this; }
  setMimeType(m) { this.mimeType = m; return this; }
  getMimeType() { return this.mimeType; }
  downloadAsFile() { return this; }
}

// ---- 日付 -------------------------------------------------------------------

export function formatDate(date, timeZone, pattern) {
  const d = new Date(date.getTime());
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)) parts[p.type] = p.value;
  const map = {
    yyyy: parts.year, MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute, ss: parts.second,
    M: String(Number(parts.month)), d: String(Number(parts.day)), H: String(Number(parts.hour)),
  };
  return String(pattern).replace(/yyyy|MM|dd|HH|mm|ss|M|d|H/g, (t) => map[t]);
}

// ---- 本体 -------------------------------------------------------------------

function listScripts(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|gs)$/.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

function makeProperties() {
  const map = new Map();
  return {
    getProperty: (k) => (map.has(k) ? map.get(k) : null),
    setProperty(k, v) { map.set(k, String(v)); return this; },
    getProperties: () => Object.fromEntries(map),
    setProperties(obj) { Object.entries(obj).forEach(([k, v]) => map.set(k, String(v))); return this; },
    deleteProperty(k) { map.delete(k); return this; },
    deleteAllProperties() { map.clear(); return this; },
    getKeys: () => [...map.keys()],
  };
}

function makeCache() {
  const map = new Map();
  return {
    get: (k) => (map.has(k) ? map.get(k) : null),
    put: (k, v) => { map.set(k, String(v)); },
    remove: (k) => { map.delete(k); },
    getAll: (keys) => Object.fromEntries(keys.filter((k) => map.has(k)).map((k) => [k, map.get(k)])),
    putAll: (obj) => Object.entries(obj).forEach(([k, v]) => map.set(k, String(v))),
  };
}

/**
 * src/ のコードを読み込んだ実行環境を作る。
 * - store: createPreviewStore() の戻り値（省略時は空のシート）
 * - email: Session.getActiveUser() のメールアドレス
 */
export function createGasRuntime({ srcDir, store, email = 'preview@example.com', baseUrl = 'http://localhost:8787/' } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'appsscript.json'), 'utf8'));
  const timeZone = manifest.timeZone || 'Asia/Tokyo';
  const sheets = store || createPreviewStore({}, { timeZone });
  const logs = [];

  const readHtml = (name) => {
    const file = path.join(srcDir, name.endsWith('.html') ? name : `${name}.html`);
    if (!fs.existsSync(file)) throw new Error(`No HTML file named ${name} was found.`);
    return fs.readFileSync(file, 'utf8');
  };

  let context;
  const templateState = new WeakMap();
  class HtmlTemplate {
    constructor(source) {
      templateState.set(this, source);
    }
    getRawContent() { return templateState.get(this); }
    evaluate() {
      const code = compileTemplate(templateState.get(this));
      const fn = vm.runInContext(`(function (__vars, __esc) { with (__vars) { ${code} } })`, context);
      return new HtmlOutput(fn({ ...this }, escapeHtml));
    }
  }

  const user = { getEmail: () => email };
  const lock = () => ({ waitLock() {}, tryLock: () => true, releaseLock() {}, hasLock: () => true });
  const scriptProps = makeProperties();
  const userProps = makeProperties();
  const docProps = makeProperties();
  const scriptCache = makeCache();

  const sandbox = {
    console,
    Logger: { log: (...args) => { logs.push(args.join(' ')); console.log('[Logger]', ...args); } },
    SpreadsheetApp: guard('SpreadsheetApp', {
      openById: (id) => sheets.open(String(id)),
      openByUrl: (url) => {
        const m = /\/d\/([a-zA-Z0-9_-]+)/.exec(String(url));
        if (!m) throw new Error('Invalid argument: url');
        return sheets.open(m[1]);
      },
      getActiveSpreadsheet: () => sheets.open('active'),
      flush() {},
    }),
    HtmlService: guard('HtmlService', {
      createTemplateFromFile: (name) => new HtmlTemplate(readHtml(name)),
      createTemplate: (source) => new HtmlTemplate(String(source)),
      createHtmlOutputFromFile: (name) => new HtmlOutput(readHtml(name)),
      createHtmlOutput: (content = '') => new HtmlOutput(content),
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
      SandboxMode: { IFRAME: 'IFRAME', NATIVE: 'NATIVE', EMULATED: 'EMULATED' },
    }),
    ContentService: guard('ContentService', {
      createTextOutput: (content = '') => new TextOutput(content),
      MimeType: {
        JSON: 'application/json', TEXT: 'text/plain', CSV: 'text/csv', JAVASCRIPT: 'application/javascript',
        XML: 'text/xml', ATOM: 'application/atom+xml', RSS: 'application/rss+xml', ICAL: 'text/calendar', VCARD: 'text/vcard',
      },
    }),
    Session: guard('Session', {
      getActiveUser: () => user,
      getEffectiveUser: () => user,
      getScriptTimeZone: () => timeZone,
      getActiveUserLocale: () => 'ja',
      getTemporaryActiveUserKey: () => 'preview-user-key',
    }),
    LockService: guard('LockService', { getScriptLock: lock, getDocumentLock: lock, getUserLock: lock }),
    PropertiesService: guard('PropertiesService', {
      getScriptProperties: () => scriptProps,
      getUserProperties: () => userProps,
      getDocumentProperties: () => docProps,
    }),
    CacheService: guard('CacheService', {
      getScriptCache: () => scriptCache,
      getUserCache: () => scriptCache,
      getDocumentCache: () => scriptCache,
    }),
    Utilities: guard('Utilities', {
      formatDate: (date, tz, pattern) => formatDate(date, tz, pattern),
      getUuid: () => crypto.randomUUID(),
      sleep: () => {},
      base64Encode: (s) => Buffer.from(String(s)).toString('base64'),
      base64Decode: (s) => [...Buffer.from(String(s), 'base64')],
    }),
    ScriptApp: guard('ScriptApp', {
      getService: () => ({ getUrl: () => baseUrl, isEnabled: () => true }),
      getScriptId: () => 'preview-script',
    }),
  };
  for (const name of UNSUPPORTED_SERVICES) {
    sandbox[name] = new Proxy({}, {
      get(obj, prop) {
        if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
        throw unsupported(name);
      },
    });
  }

  context = vm.createContext(sandbox);
  for (const file of listScripts(srcDir)) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: path.relative(srcDir, file) });
  }

  const getFunction = (name) => {
    if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error(`Script function not found: ${name}`);
    const fn = vm.runInContext(`typeof ${name} === 'function' ? ${name} : undefined`, context);
    if (!fn) throw new Error(`Script function not found: ${name}`);
    return fn;
  };

  return {
    context,
    store: sheets,
    logs,
    /** GASのグローバルにある値や関数を取り出す（テスト用。_で終わる関数も取り出せる） */
    get(name) {
      return vm.runInContext(name, context);
    },
    /** コードを1行実行する（プレビューの設定の上書きなど） */
    eval(code) {
      return vm.runInContext(code, context);
    },
    /** 画面から google.script.run で呼ぶのと同じ決まりで、サーバーの関数を呼ぶ */
    run(name, args = []) {
      if (name.endsWith('_')) throw new Error(`Script function not found: ${name}`);
      return getFunction(name)(...args);
    },
    /** doGet を呼ぶ。params はURLの ?a=1&b=2 を { a: ['1'], b: ['2'] } の形で渡す */
    doGet(params = {}) {
      const parameter = {};
      const parameters = {};
      for (const [k, v] of Object.entries(params)) {
        const list = Array.isArray(v) ? v.map(String) : [String(v)];
        parameters[k] = list;
        parameter[k] = list[0];
      }
      return getFunction('doGet')({ parameter, parameters, queryString: new URLSearchParams(parameter).toString(), contextPath: '', contentLength: -1, pathInfo: '' });
    },
  };
}

/**
 * google.script.run の戻り値として画面に届くかを確かめる。
 * 本物のGASでは、日付（Date）が入っていると画面には null が届く。
 */
export function toTransferable(value, fnName) {
  const warnings = [];
  let hasDate = false;
  let hasFunction = false;
  const seen = new Set();
  const walk = (v) => {
    if (v && typeof v === 'object') {
      if (typeof v.getTime === 'function' && Object.prototype.toString.call(v) === '[object Date]') { hasDate = true; return; }
      if (seen.has(v)) return;
      seen.add(v);
      Object.values(v).forEach(walk);
    } else if (typeof v === 'function') {
      hasFunction = true;
    }
  };
  walk(value);
  if (hasDate) {
    warnings.push(`${fnName} の戻り値に日付（Date）が入っています。本物のGASでは画面に null が届きます。文字列にしてから返してください。`);
    return { value: null, warnings };
  }
  if (hasFunction) warnings.push(`${fnName} の戻り値に関数が入っています。本物のGASでは画面に届きません。`);
  return { value: value === undefined ? null : JSON.parse(JSON.stringify(value)), warnings };
}

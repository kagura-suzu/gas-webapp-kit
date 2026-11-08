/**
 * 画面から呼ぶ処理：記録の一覧と追加。
 * 名前が _ で終わる関数は画面から呼べない（内部用）。
 */

/** 最近の記録を新しい順に返す（最大50件） */
function getRecords() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { headers: CONFIG.HEADERS, rows: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
  const rows = values.map(toRecord_).reverse().slice(0, 50);
  return { headers: CONFIG.HEADERS, rows: rows };
}

/** 記録を1件追加する。入力に問題があれば errors を返す */
function addRecord(input) {
  const result = validateRecord_(input);
  if (!result.ok) return result;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    getSheet_().appendRow([new Date(), result.value.content, result.value.person]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function validateRecord_(input) {
  const content = String((input && input.content) || '').trim();
  const person = String((input && input.person) || '').trim();
  const errors = {};
  if (!content) errors.content = '内容を入力してください';
  else if (content.length > 500) errors.content = '内容は500文字以内にしてください';
  if (person.length > 50) errors.person = '担当は50文字以内にしてください';
  if (Object.keys(errors).length > 0) return { ok: false, errors: errors };
  return { ok: true, value: { content: content, person: person } };
}

/** シートの1行を、画面に渡せる形（日付は文字列）にする */
function toRecord_(row) {
  return {
    date: formatDate_(row[0]),
    content: String(row[1]),
    person: String(row[2]),
  };
}

function formatDate_(value) {
  if (value && typeof value.getTime === 'function') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
  }
  return String(value || '');
}

/** データのシートを開く。無ければ見出し付きで作る */
function getSheet_() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('スプレッドシートのIDが設定されていません（src/server/config.js）');
  }
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  // 時間帯がアプリと違うと、書いた日時を読み戻したときにずれる（新しく作ったシートだけ合わせる）
  if (CONFIG.MATCH_SHEET_TIME_ZONE && spreadsheet.getSpreadsheetTimeZone() !== Session.getScriptTimeZone()) {
    spreadsheet.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  }
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(CONFIG.HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

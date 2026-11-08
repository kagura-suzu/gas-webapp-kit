/**
 * 確認用の画面の自己テスト。データは書き換えない（シートが無いときに見出し付きで作るだけ）。
 * 作った人のアカウントで開いたときだけ動く。
 */

function isSelftestAllowed_() {
  if (!CONFIG.SELFTEST_ENABLED) return false;
  const active = Session.getActiveUser().getEmail();
  return active !== '' && active === Session.getEffectiveUser().getEmail();
}

/** 画面の自己テストから呼ぶ。結果には業務データを入れない */
function runServerSelftest() {
  if (!isSelftestAllowed_()) return { ok: false, reason: 'not-allowed', passed: 0, failed: 0, checks: [] };
  const checks = [];
  const check = function (name, fn) {
    try {
      const detail = fn();
      checks.push({ name: name, ok: true, detail: detail ? String(detail) : '' });
    } catch (err) {
      checks.push({ name: name, ok: false, detail: String((err && err.message) || err) });
    }
  };

  check('設定にシートのIDがある', function () {
    if (!CONFIG.SPREADSHEET_ID) throw new Error('SPREADSHEET_ID が空です');
  });
  check('シートを開ける', function () {
    return getSheet_().getName();
  });
  check('見出しが正しい', function () {
    const header = getSheet_().getRange(1, 1, 1, CONFIG.HEADERS.length).getValues()[0].map(String);
    if (header.join('|') !== CONFIG.HEADERS.join('|')) throw new Error('1行目: ' + header.join(', '));
  });
  check('一覧を読める', function () {
    return getRecords().rows.length + '件';
  });
  check('入力チェックが動く', function () {
    if (validateRecord_({ content: '' }).ok) throw new Error('空の内容が通りました');
    if (!validateRecord_({ content: 'テスト', person: '' }).ok) throw new Error('正しい内容が通りませんでした');
  });
  check('時間帯が日本', function () {
    const tz = Session.getScriptTimeZone();
    if (tz !== 'Asia/Tokyo') throw new Error(tz);
  });
  check('シートの時間帯がアプリと同じ', function () {
    const sheetTz = getSheet_().getParent().getSpreadsheetTimeZone();
    const appTz = Session.getScriptTimeZone();
    if (sheetTz !== appTz) throw new Error('シートは ' + sheetTz + '、アプリは ' + appTz + '。このままだと日時がずれます');
  });

  const failed = checks.filter(function (c) { return !c.ok; }).length;
  return { ok: failed === 0, passed: checks.length - failed, failed: failed, checks: checks };
}

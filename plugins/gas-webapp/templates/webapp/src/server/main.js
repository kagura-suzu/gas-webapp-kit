/**
 * Webアプリの入口。
 * ?selftest=1  画面の自己テストを動かす（作った人が開いたときだけ）
 * ?api=selftest サーバーの自己テストの結果をJSONで返す
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.api === 'selftest') {
    const result = isSelftestAllowed_() ? runServerSelftest() : { ok: false, reason: 'not-allowed' };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  const template = HtmlService.createTemplateFromFile('client/index');
  template.appName = CONFIG.APP_NAME;
  template.selftest = params.selftest === '1' && isSelftestAllowed_();
  return template
    .evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 画面の部品（client/css など）を読み込む */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

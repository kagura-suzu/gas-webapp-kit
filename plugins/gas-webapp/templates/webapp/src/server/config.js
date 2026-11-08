/**
 * アプリの設定。シートのIDは `npm run create` が書き込みます。
 */
const CONFIG = {
  APP_NAME: '{{APP_NAME}}',
  // データを入れるスプレッドシートのID（URLの /d/ と /edit の間の文字）
  SPREADSHEET_ID: '',
  // データを入れるシート（タブ）の名前。無ければ最初の読み書きで作る
  SHEET_NAME: '記録',
  // 1行目の見出し
  HEADERS: ['日時', '内容', '担当'],
  // シートの時間帯をアプリの時間帯（日本）に合わせるか。`npm run create` で新しく作ったシートのときだけ true になる
  // （Googleが新しく作るシートは時間帯がロサンゼルスになっていて、そのままだと読み書きした日時がずれるため）
  MATCH_SHEET_TIME_ZONE: false,
  // 確認用の画面の自己テスト（?selftest=1、?api=selftest）を使うか
  SELFTEST_ENABLED: true,
};

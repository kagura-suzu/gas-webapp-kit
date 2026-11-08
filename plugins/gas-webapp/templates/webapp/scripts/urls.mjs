// アプリに関係するURLをまとめて出す
import { files, readJson, finish, requireCreated, getHeadDeploymentId, urls, readSpreadsheetId, parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const project = requireCreated();
const release = readJson(files.release, {});
const spreadsheetId = readSpreadsheetId();
const head = getHeadDeploymentId({ refresh: Boolean(args.refresh) });
const devUrl = head.ok ? urls.dev(head.id) : null;

finish({
  ok: head.ok,
  appName: release.appName,
  devUrl,
  selftestUrl: devUrl ? `${devUrl}?selftest=1` : null,
  apiSelftestUrl: devUrl ? `${devUrl}?api=selftest` : null,
  execUrl: release.deploymentId ? urls.exec(release.deploymentId) : null,
  sheetUrl: spreadsheetId ? urls.sheet(spreadsheetId) : null,
  editorUrl: urls.editor(project.scriptId),
  message: release.deploymentId
    ? '確認用の画面と、みんなが使う画面のURLです。'
    : '確認用の画面のURLです。みんなが使う画面は、まだ公開していません。',
  ...(head.ok ? {} : { error: head.error }),
});

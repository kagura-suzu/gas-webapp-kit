// Googleに送る（確認用の画面だけに反映される。みんなが使う画面は変わらない）
import { finish, fail, runClasp, requireCreated, getHeadDeploymentId, urls, markProgress } from './lib.mjs';

requireCreated();
const res = runClasp(['push', '--force']);
if (!res.ok) fail(res.error, { stage: 'push' });
markProgress('push');

const pushed = Array.isArray(res.data) ? res.data : [];
const head = getHeadDeploymentId();
const devUrl = head.ok ? urls.dev(head.id) : null;
finish({
  ok: true,
  pushedFiles: pushed.length,
  devUrl,
  selftestUrl: devUrl ? `${devUrl}?selftest=1` : null,
  message: pushed.length > 0
    ? 'Googleに送りました。確認用の画面に反映されています。'
    : '変更はありませんでした。確認用の画面はすでに最新です。',
});

// キットの形の確認：マニフェストの版がそろっているか、Skillの書式、台本の参照先があるか。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugins', 'gas-webapp');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const errors = [];

const claudePlugin = read('plugins/gas-webapp/.claude-plugin/plugin.json');
const codexPlugin = read('plugins/gas-webapp/.codex-plugin/plugin.json');
const claudeMarket = read('.claude-plugin/marketplace.json');
const codexMarket = read('.agents/plugins/marketplace.json');

if (claudePlugin.version !== codexPlugin.version) errors.push(`plugin.json の版が違います: Claude ${claudePlugin.version} / Codex ${codexPlugin.version}`);
if (claudePlugin.name !== codexPlugin.name) errors.push('plugin.json の name が違います');
const entry = claudeMarket.plugins.find((p) => p.name === claudePlugin.name);
if (!entry) errors.push('Claude の marketplace.json に Plugin がありません');
else if (entry.version && entry.version !== claudePlugin.version) errors.push(`marketplace.json の版が違います: ${entry.version}`);
if (!codexMarket.plugins.some((p) => p.name === codexPlugin.name)) errors.push('Codex の marketplace.json に Plugin がありません');

const steps = new Set(fs.readdirSync(path.join(plugin, 'steps')).map((f) => f.replace(/\.md$/, '')));
for (const skill of fs.readdirSync(path.join(plugin, 'skills'))) {
  const file = path.join(plugin, 'skills', skill, 'SKILL.md');
  const text = fs.readFileSync(file, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, '\n'));
  if (!fm) { errors.push(`${skill}: frontmatter がありません`); continue; }
  const name = /^name:\s*(.+)$/m.exec(fm[1]);
  const desc = /^description:\s*(.+)$/m.exec(fm[1]);
  if (!name || name[1].trim() !== skill) errors.push(`${skill}: name がフォルダ名と違います`);
  if (!/^[a-z0-9-]{1,64}$/.test(skill)) errors.push(`${skill}: 名前は英小文字・数字・ハイフンで64文字まで`);
  if (!desc) errors.push(`${skill}: description がありません`);
  else if (desc[1].length > 1024) errors.push(`${skill}: description が1024文字を超えています（${desc[1].length}）`);
  for (const m of text.matchAll(/steps\/(\d\d-[a-z0-9-]+)\.md/g)) {
    if (!steps.has(m[1])) errors.push(`${skill}: 台本 ${m[1]}.md がありません`);
  }
  for (const m of text.matchAll(/\]\((references\/[^)]+)\)/g)) {
    if (!fs.existsSync(path.join(plugin, 'skills', skill, m[1]))) errors.push(`${skill}: ${m[1]} がありません（tools/sync-shared.mjs を実行）`);
  }
}

// 雛形のスクリプトが参照する台本の名前
const errorsSrc = fs.readFileSync(path.join(plugin, 'templates', 'webapp', 'scripts', 'errors.mjs'), 'utf8');
for (const m of errorsSrc.matchAll(/step:\s*'([^']+)'/g)) {
  if (!steps.has(m[1])) errors.push(`errors.mjs: 台本 ${m[1]}.md がありません`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`確認しました（gas-webapp ${claudePlugin.version}、Skill ${fs.readdirSync(path.join(plugin, 'skills')).length}つ、台本 ${steps.size}つ）。`);

// shared/ の決まり（やさしい言葉・AIに任せる範囲）を、各Skillの references/ にコピーする。
// 正本は plugins/gas-webapp/shared/。Skill側のコピーは直接直さない。
//   node tools/sync-shared.mjs          コピーする
//   node tools/sync-shared.mjs --check  ずれていれば失敗する（CI用）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugins', 'gas-webapp');
const sharedDir = path.join(plugin, 'shared');
const skillsDir = path.join(plugin, 'skills');
const check = process.argv.includes('--check');
const header = '<!-- このファイルは plugins/gas-webapp/shared/ からのコピーです。直すときは shared/ を直して node tools/sync-shared.mjs を実行します。 -->\n\n';

const drift = [];
for (const skill of fs.readdirSync(skillsDir)) {
  const refDir = path.join(skillsDir, skill, 'references');
  for (const file of fs.readdirSync(sharedDir)) {
    const expected = header + fs.readFileSync(path.join(sharedDir, file), 'utf8');
    const target = path.join(refDir, file);
    const actual = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (actual === expected) continue;
    if (check) drift.push(path.relative(root, target));
    else {
      fs.mkdirSync(refDir, { recursive: true });
      fs.writeFileSync(target, expected, 'utf8');
      console.log(`更新: ${path.relative(root, target)}`);
    }
  }
}
if (check && drift.length > 0) {
  console.error(`shared/ とずれています。node tools/sync-shared.mjs を実行してください:\n${drift.join('\n')}`);
  process.exit(1);
}
console.log(check ? 'shared/ と各Skillのコピーは一致しています。' : 'コピーが終わりました。');

import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['backend', 'js', 'scripts', 'tests'];
const files = [];
for (const root of roots) await collect(path.join(projectDir, root));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
}
console.log(`Syntax check passed for ${files.length} JavaScript files.`);

async function collect(directory) {
  for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
  }
}

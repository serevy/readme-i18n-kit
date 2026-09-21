import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const patchScript = new URL('./apply-md-translator-whole-line-patch.mjs', import.meta.url);

test('runtime patch includes source-residue repair hooks', () => {
  const root = mkdtempSync(join(tmpdir(), 'readme-i18n-kit-patch-'));
  const targetDir = join(root, 'src', 'app', 'lib', 'translation');
  mkdirSync(targetDir, { recursive: true });

  const marker = '    const { contentLines, sourceLineNumbers } = parsed;\n\n    // 结构化模式:';
  const target = join(targetDir, 'cliFormat.ts');
  writeFileSync(target, `before\n${marker}\nafter\n`, 'utf8');

  const run = spawnSync(process.execPath, [patchScript.pathname, root], {
    encoding: 'utf8',
  });

  assert.equal(run.status, 0, run.stderr);
  const patched = readFileSync(target, 'utf8');

  assert.match(patched, /README_I18N_SOURCE_RESIDUE_PATTERNS_JSON/);
  assert.match(patched, /README_I18N_ALLOWED_SOURCE_RESIDUE_PATTERNS_JSON/);
  assert.match(patched, /source-language residue/);
  assert.match(patched, /retrying once/);
});

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const patchScript = new URL('./apply-md-translator-whole-line-patch.mjs', import.meta.url);

test('runtime patch wires a dedicated source-residue repair prompt', () => {
  const root = mkdtempSync(join(tmpdir(), 'readme-i18n-kit-patch-'));
  const targetDir = join(root, 'src', 'app', 'lib', 'translation');
  const scriptsDir = join(root, 'scripts');
  mkdirSync(targetDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });

  const contextSignature =
    '  translate: (texts: string[], documentType: "subtitle" | "markdown" | undefined, meta: TranslateBatchMeta, opts?: { independent?: boolean }) => Promise<PipelineOutcome>;';
  const marker =
    '    const { contentLines, sourceLineNumbers } = parsed;\n\n    // 结构化模式:';
  const target = join(targetDir, 'cliFormat.ts');
  writeFileSync(
    target,
    `before\n${contextSignature}\n${marker}\nafter\n`,
    'utf8',
  );

  const cliSignature =
    '    translate: async (texts: string[], documentType: "subtitle" | "markdown" | undefined, meta: TranslateBatchMeta, opts?: { independent?: boolean }) => {';
  const configCall =
    '        buildConfig(lang, opts?.independent === true),';
  const cliTarget = join(scriptsDir, 'cli.ts');
  writeFileSync(
    cliTarget,
    `before\n${cliSignature}\ncall(\n${configCall}\n);\nafter\n`,
    'utf8',
  );

  const run = spawnSync(process.execPath, [patchScript.pathname, root], {
    encoding: 'utf8',
  });

  assert.equal(run.status, 0, run.stderr);

  const patched = readFileSync(target, 'utf8');
  const patchedCli = readFileSync(cliTarget, 'utf8');

  assert.match(patched, /userPrompt\?: string/);
  assert.match(patched, /README_I18N_SOURCE_RESIDUE_PATTERNS_JSON/);
  assert.match(patched, /README_I18N_ALLOWED_SOURCE_RESIDUE_PATTERNS_JSON/);
  assert.match(patched, /README_I18N_LITERAL_TERMS_BY_LANGUAGE_JSON/);
  assert.match(patched, /maskLiteralTerms/);
  assert.match(patched, /restoreLiteralTerms/);
  assert.match(patched, /README_LITERAL_/);
  assert.match(patched, /The previous translation left source-language prose untranslated/);
  assert.match(patched, /source-language residue persists/);
  assert.match(patched, /final quality gate will reject it/);

  assert.match(patchedCli, /userPrompt\?: string/);
  assert.match(
    patchedCli,
    /opts\?\.userPrompt \? \{ userPrompt: opts\.userPrompt \}/,
  );
});

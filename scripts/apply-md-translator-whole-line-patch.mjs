import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node apply-md-translator-whole-line-patch.mjs <md-translator-dir>");
  process.exit(2);
}

const target = join(root, "src/app/lib/translation/cliFormat.ts");
const cliTarget = join(root, "scripts/cli.ts");
let source = readFileSync(target, "utf8");
let cliSource = readFileSync(cliTarget, "utf8");

const contextSignature =
  'translate: (texts: string[], documentType: "subtitle" | "markdown" | undefined, meta: TranslateBatchMeta, opts?: { independent?: boolean }) => Promise<PipelineOutcome>;';
const patchedContextSignature =
  'translate: (texts: string[], documentType: "subtitle" | "markdown" | undefined, meta: TranslateBatchMeta, opts?: { independent?: boolean; userPrompt?: string }) => Promise<PipelineOutcome>;';

if (!source.includes(contextSignature)) {
  console.error("Pinned md-translator CliFormatContext no longer matches the expected patch point.");
  process.exit(1);
}
source = source.replace(contextSignature, patchedContextSignature);

const cliSignature =
  'translate: async (texts: string[], documentType: "subtitle" | "markdown" | undefined, meta: TranslateBatchMeta, opts?: { independent?: boolean }) => {';
const patchedCliSignature =
  'translate: async (texts: string[], documentType: "subtitle" | "markdown" | undefined, meta: TranslateBatchMeta, opts?: { independent?: boolean; userPrompt?: string }) => {';
const configCall = '        buildConfig(lang, opts?.independent === true),';
const patchedConfigCall =
  '        { ...buildConfig(lang, opts?.independent === true), ...(opts?.userPrompt ? { userPrompt: opts.userPrompt } : null) },';

if (!cliSource.includes(cliSignature) || !cliSource.includes(configCall)) {
  console.error("Pinned md-translator CLI translate adapter no longer matches the expected patch point.");
  process.exit(1);
}
cliSource = cliSource
  .replace(cliSignature, patchedCliSignature)
  .replace(configCall, patchedConfigCall);

const marker = "    const { contentLines, sourceLineNumbers } = parsed;\n\n    // 结构化模式:";
if (!source.includes(marker)) {
  console.error("Pinned md-translator source no longer matches the expected whole-line patch point.");
  process.exit(1);
}

const injected = [
  "    const { contentLines, sourceLineNumbers } = parsed;",
  "",
  "    // readme-i18n-kit whole-line mode (LLM only):",
  "    // keep md-translator's placeholder protection, but send each protected line as",
  "    // one unit so the model can choose natural target-language word order around",
  "    // inline code / links. Hard-fail if any placeholder is lost, duplicated,",
  "    // or rewritten. Token order may change when target-language grammar requires it;",
  "    if (ctx.isLlmMethod && contentLines.length > 0) {",
  "      const outcome = await ctx.translate(contentLines, undefined, { lineNumbers: sourceLineNumbers, fileName: ctx.fileName });",
  "      const softFilled = softFilledIndices(outcome);",
  "      const cleanedLines = mapSkippingSoftFilled(outcome.lines, softFilled, (line) => applyRemoveCharsToMarkdown(line, ctx.removeChars));",
  "      const tokenPattern = /<<<[A-Z_]+_\\d+>>>/g;",
  "      const tokensMatch = (sourceLine: string, translatedLine: string): boolean => {",
  "        const expected = (sourceLine.match(tokenPattern) ?? []).sort();",
  "        const actual = (translatedLine.match(tokenPattern) ?? []).sort();",
  "        return expected.length === actual.length && expected.every((token, n) => token === actual[n]);",
  "      };",
  "      const parseRegexList = (name: string): RegExp[] => {",
  "        const raw = process.env[name] ?? \"[]\";",
  "        let values: unknown;",
  "        try { values = JSON.parse(raw); }",
  "        catch { throw new CliFileFormatError(\"invalid JSON in \" + name); }",
  "        if (!Array.isArray(values) || !values.every((value) => typeof value === \"string\" && value.length > 0)) {",
  "          throw new CliFileFormatError(name + \" must be a JSON array of non-empty regex strings\");",
  "        }",
  "        try { return values.map((pattern) => new RegExp(pattern)); }",
  "        catch { throw new CliFileFormatError(\"invalid regex in \" + name); }",
  "      };",
  "      const residuePatterns = parseRegexList(\"README_I18N_SOURCE_RESIDUE_PATTERNS_JSON\");",
  "      const allowedResiduePatterns = parseRegexList(\"README_I18N_ALLOWED_SOURCE_RESIDUE_PATTERNS_JSON\");",
  "      const hasSourceResidue = (translatedLine: string): boolean => {",
  "        if (residuePatterns.length === 0) return false;",
  "        if (!residuePatterns.some((pattern) => pattern.test(translatedLine))) return false;",
  "        return !allowedResiduePatterns.some((pattern) => pattern.test(translatedLine));",
  "      };",
  "      const residueRepairPrompt = [",
  "        \"The previous translation left source-language prose untranslated.\",",
  "        \"Translate the following complete Markdown line fully into \${targetLanguage}.\",",
  "        \"Return only the corrected translated line.\",",
  "        \"Do not leave source-language prose unchanged unless it is represented by a protected <<<...>>> token or explicitly required by the glossary.\",",
  "        \"Preserve every protected <<<...>>> token byte-for-byte exactly once.\",",
  "        \"\",",
  "        \"\${content}\",",
  "      ].join(\"\\n\");",
  "",
  "      for (let i = 0; i < contentLines.length; i++) {",
  "        const tokenMismatch = !tokensMatch(contentLines[i], cleanedLines[i]);",
  "        const sourceResidue = hasSourceResidue(cleanedLines[i]);",
  "        if (tokenMismatch || sourceResidue) {",
  "          const line = sourceLineNumbers[i] ?? i + 1;",
  "          const reason = tokenMismatch ? \"protected token mismatch\" : \"source-language residue\";",
  "          console.error(\`readme-i18n-kit: \${reason} at source line \${line}; retrying once\`);",
  "          const retryOutcome = await ctx.translate(",
  "            [contentLines[i]],",
  "            undefined,",
  "            { lineNumbers: [line], fileName: ctx.fileName },",
  "            sourceResidue ? { userPrompt: residueRepairPrompt } : undefined,",
  "          );",
  "          const retrySoftFilled = softFilledIndices(retryOutcome);",
  "          const retryLines = mapSkippingSoftFilled(retryOutcome.lines, retrySoftFilled, (candidate) => applyRemoveCharsToMarkdown(candidate, ctx.removeChars));",
  "          const retryFailed = retryOutcome.failures.length > 0 || retryLines.length !== 1;",
  "          if (retryFailed) {",
  "            if (tokenMismatch) {",
  "              throw new CliFileFormatError(\"translation failure at source line \" + line + \" after one retry\");",
  "            }",
  "            console.error(\`readme-i18n-kit: source-language residue repair request failed at source line \${line}; keeping candidate for final quality gate\`);",
  "            continue;",
  "          }",
  "          const retryTokenMismatch = !tokensMatch(contentLines[i], retryLines[0]);",
  "          if (retryTokenMismatch) {",
  "            throw new CliFileFormatError(\"protected token mismatch at source line \" + line + \" after one retry\");",
  "          }",
  "          const retryResidue = hasSourceResidue(retryLines[0]);",
  "          cleanedLines[i] = retryLines[0];",
  "          if (retryResidue) {",
  "            console.error(\`readme-i18n-kit: source-language residue persists at source line \${line} after repair; final quality gate will reject it\`);",
  "          }",
  "        }",
  "      }",
  "",
  "      return { content: restorePlaceholders(cleanedLines.join(\"\\n\"), parsed), ext };",
  "    }",
  "",
  "    // 構造化モード:"
].join("\n");

source = source.replace(marker, injected);

writeFileSync(target, source, "utf8");
writeFileSync(cliTarget, cliSource, "utf8");
console.log("Applied readme-i18n-kit whole-line Markdown patch.");

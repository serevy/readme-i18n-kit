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
  "      const tokenPattern = /<<<[A-Z_]+_\\d+>>>/g;",
  "      const fullTokenPattern = /^<<<[A-Z_]+_\\d+>>>$/;",
  "      const parseLiteralTerms = (): string[] => {",
  "        const raw = process.env.README_I18N_LITERAL_TERMS_BY_LANGUAGE_JSON ?? \"{}\";",
  "        let value: unknown;",
  "        try { value = JSON.parse(raw); }",
  "        catch { throw new CliFileFormatError(\"invalid JSON in README_I18N_LITERAL_TERMS_BY_LANGUAGE_JSON\"); }",
  "        if (!value || typeof value !== \"object\" || Array.isArray(value)) {",
  "          throw new CliFileFormatError(\"README_I18N_LITERAL_TERMS_BY_LANGUAGE_JSON must be an object\");",
  "        }",
  "        const terms = (value as Record<string, unknown>)[ctx.targetLanguage] ?? [];",
  "        if (!Array.isArray(terms) || !terms.every((term) => typeof term === \"string\" && term.length > 0)) {",
  "          throw new CliFileFormatError(\"literal terms for target language must be a string array\");",
  "        }",
  "        return [...new Set(terms as string[])].sort((a, b) => b.length - a.length || a.localeCompare(b));",
  "      };",
  "      const literalTerms = parseLiteralTerms();",
  "      let nextLiteralToken = 900000;",
  "      const sourceHasToken = (token: string): boolean => contentLines.some((line) => line.includes(token));",
  "      const allocateLiteralToken = (): string => {",
  "        let token = `<<<README_LITERAL_${nextLiteralToken++}>>>`;",
  "        while (sourceHasToken(token)) token = `<<<README_LITERAL_${nextLiteralToken++}>>>`;",
  "        return token;",
  "      };",
  "      const maskLiteralTerms = (line: string): { line: string; replacements: Map<string, string> } => {",
  "        let parts = [line];",
  "        const replacements = new Map<string, string>();",
  "        for (const term of literalTerms) {",
  "          const nextParts: string[] = [];",
  "          let token: string | undefined;",
  "          for (const part of parts) {",
  "            if (fullTokenPattern.test(part) || !part.includes(term)) {",
  "              nextParts.push(part);",
  "              continue;",
  "            }",
  "            token ??= allocateLiteralToken();",
  "            replacements.set(token, term);",
  "            const chunks = part.split(term);",
  "            chunks.forEach((chunk, index) => {",
  "              nextParts.push(chunk);",
  "              if (index < chunks.length - 1) nextParts.push(token!);",
  "            });",
  "          }",
  "          parts = nextParts;",
  "        }",
  "        return { line: parts.join(\"\"), replacements };",
  "      };",
  "      const restoreLiteralTerms = (line: string, replacements: Map<string, string>): string => {",
  "        let restored = line;",
  "        for (const [token, term] of replacements) restored = restored.split(token).join(term);",
  "        return restored;",
  "      };",
  "      const masked = contentLines.map(maskLiteralTerms);",
  "      const maskedContentLines = masked.map((entry) => entry.line);",
  "      const outcome = await ctx.translate(maskedContentLines, undefined, { lineNumbers: sourceLineNumbers, fileName: ctx.fileName });",
  "      const softFilled = softFilledIndices(outcome);",
  "      const cleanedLines = mapSkippingSoftFilled(outcome.lines, softFilled, (line) => applyRemoveCharsToMarkdown(line, ctx.removeChars));",
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
  "        const tokenMismatch = !tokensMatch(maskedContentLines[i], cleanedLines[i]);",
  "        const sourceResidue = hasSourceResidue(cleanedLines[i]);",
  "        if (tokenMismatch || sourceResidue) {",
  "          const line = sourceLineNumbers[i] ?? i + 1;",
  "          const reason = tokenMismatch ? \"protected token mismatch\" : \"source-language residue\";",
  "          console.error(\`readme-i18n-kit: \${reason} at source line \${line}; retrying once\`);",
  "          const retryOutcome = await ctx.translate(",
  "            [maskedContentLines[i]],",
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
  "          const retryTokenMismatch = !tokensMatch(maskedContentLines[i], retryLines[0]);",
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
  "      const restoredLiteralLines = cleanedLines.map((line, index) => restoreLiteralTerms(line, masked[index].replacements));",
  "      return { content: restorePlaceholders(restoredLiteralLines.join(\"\\n\"), parsed), ext };",
  "    }",
  "",
  "    // 構造化モード:"
].join("\n");

source = source.replace(marker, injected);

writeFileSync(target, source, "utf8");
writeFileSync(cliTarget, cliSource, "utf8");
console.log("Applied readme-i18n-kit whole-line Markdown patch.");

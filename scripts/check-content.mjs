// OG-033 AC-R1.1: no authored text in the web's code. Every text a visitor or founder reads is a content entry read
// by key (src/i18n). This walks every source file in src/ (tests and fixtures aside) with the TypeScript parser and
// reports JSX text with letters and string literals that read as words: a capitalised word, or three words or more.
// A file of sample data (the demo's company names and amounts are data, not content) starts with
// `// content-check: data`; one line that must keep a word (a header name) ends with `// content-check: ignore`.
// Run: `node scripts/check-content.mjs` (exit 1 on a finding); `npm test` runs it through src/test/content-check.test.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Words that are not copy: header names and protocol words. */
const ALLOWED = new Set(['Authorization', 'Accept', 'Bearer', 'Content-Type', 'ETag', 'OnGem']);

const skipped = (path) =>
  /(^|\/)(test|fixtures)\//.test(path) || /\.(test|e2e)\.tsx?$/.test(path) || /\.d\.ts$/.test(path);

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

const words = (s) => s.match(/[A-Za-z؀-ۿ][A-Za-z؀-ۿ’']*/g) ?? [];

/** A literal that reads as copy: starts with a capitalised word, or has three words or more (any script). */
export function readsAsCopy(s) {
  const text = s.trim();
  if (!text || ALLOWED.has(text)) return false;
  if (/[؀-ۿ]/.test(text)) return true;
  if (/^[a-z0-9_.-]+$/i.test(text) && !/\s/.test(text) && !/^[A-Z][a-z’']+$/.test(text)) return false;
  if (/^(https?:|\/|#|\.|\[|data:|mailto:)/.test(text)) return false;
  if (/^[A-Z][a-z’']+(\s|[.,:?!]|$)/.test(text)) return true;
  return words(text).length >= 3 && /\s/.test(text) && !/^[a-z0-9_-]+( [a-z0-9_-]+)*$/.test(text);
}

function inDeveloperCall(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())) return true;
    if (ts.isCallExpression(p) && /^console\./.test(p.expression.getText())) return true;
    if (ts.isTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isPropertyAssignment(p) && p.name === node) return true;
    if (ts.isJsxAttribute(p) && /^(className|data-testid|id|to|href|type|variant|status|name|htmlFor|role|rel|target|autoComplete|inputMode|src)$/.test(p.name.getText()))
      return true;
    if (ts.isBinaryExpression(p) && /===|!==|==|!=/.test(p.operatorToken.getText())) return true;
    if (ts.isCaseClause(p)) return true;
    if (ts.isCallExpression(p) && /(^|\.)(t|tn|tList|has|keysUnder|metaOf|getItem|setItem|removeItem|get|querySelector|querySelectorAll|getElementById|matchMedia|addEventListener|removeEventListener|startsWith|endsWith|includes|split|replace|test|closest|getAttribute|setAttribute|hasAttribute)$/.test(p.expression.getText()))
      return true;
    if (ts.isStatement(p) || ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) return false;
  }
  return false;
}

export function findings(root = ROOT) {
  const out = [];
  for (const path of files(join(root, 'src'))) {
    const rel = relative(root, path);
    if (skipped(rel)) continue;
    const source = readFileSync(path, 'utf8');
    if (/^\/\/ content-check: data/m.test(source.slice(0, 400))) continue;
    const lines = source.split('\n');
    const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const report = (node, text) => {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line;
      if (/content-check: ignore/.test(lines[line] ?? '')) return;
      out.push(`${rel}:${line + 1}: ${text.trim().slice(0, 80)}`);
    };
    const visit = (node) => {
      if (ts.isJsxText(node)) {
        const text = node.getText();
        if (/[A-Za-z؀-ۿ]{2,}/.test(text)) report(node, text);
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (readsAsCopy(node.text) && !inDeveloperCall(node)) report(node, node.text);
      } else if (ts.isTemplateExpression(node)) {
        const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' x ');
        if (readsAsCopy(parts) && /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(parts) && !inDeveloperCall(node))
          report(node, parts);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const found = findings();
  for (const f of found) console.log(f);
  if (found.length) {
    console.error(`check-content: ${found.length} authored text(s) in src; move them to content keys (OG-033 R1).`);
    process.exit(1);
  }
  console.log('check-content: no authored text in src');
}

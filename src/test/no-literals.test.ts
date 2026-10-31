import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..');
const scanned = [
  'design-system/components',
  'design-system/styles.css',
  'web.css',
  'screens',
  'App.tsx',
  'session.tsx',
];

function files(path: string): string[] {
  const full = join(root, path);
  let st;
  try {
    st = statSync(full);
  } catch {
    return [];
  }
  if (st.isFile()) return [full];
  return readdirSync(full).flatMap((f) => files(join(path, f)));
}

const sources = scanned.flatMap(files).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f));

const rules: Array<[string, RegExp]> = [
  ['hex colour', /#[0-9a-fA-F]{3,8}\b(?![-\w])/],
  ['rgb or hsl colour', /\b(rgba?|hsla?)\(/],
  ['literal font family', /font-family:(?!\s*var\()/],
  ['literal radius', /border-radius:\s*\d/],
  ['inline style colour', /\b(color|background|borderColor):\s*['"`](?!var\()/],
];

describe('design tokens only', () => {
  it('scans component and screen sources', () => {
    expect(sources.length).toBeGreaterThan(15);
  });

  for (const [name, re] of rules) {
    it(`no_literals_AC_R10_1: has no ${name} in components or screens`, () => {
      const hits = sources.flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, i }))
          .filter(({ line }) => re.test(line))
          .map(({ line, i }) => `${relative(root, f)}:${i + 1}: ${line.trim()}`),
      );
      expect(hits).toEqual([]);
    });
  }
});

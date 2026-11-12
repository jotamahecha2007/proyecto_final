// Pruebas del sistema de temas: contraste de todos los colores y prohibición de colores fijos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { resolveTheme, THEMES, type Theme } from '../src/lib/palette';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const FOREGROUNDS: (keyof Theme)[] = ['text', 'textMuted', 'primary', 'danger', 'success', 'warning', 'info', 'accent'];
const BACKGROUNDS: (keyof Theme)[] = ['bg', 'surface', 'surfaceAlt'];

for (const theme of Object.values(THEMES)) {
  const min = theme.name.endsWith('contrast') ? 7 : 4.5;
  test(`contraste ≥ ${min}:1 en el tema ${theme.name}`, () => {
    const fails: string[] = [];
    for (const fg of FOREGROUNDS) {
      for (const bg of BACKGROUNDS) {
        const c = contrast(theme[fg] as string, theme[bg] as string);
        if (c < min) fails.push(`${fg} sobre ${bg}: ${c.toFixed(2)}`);
      }
    }
    for (const [fg, bg] of [['primaryText', 'primary'], ['onDanger', 'danger']] as const) {
      const c = contrast(theme[fg], theme[bg]);
      if (c < min) fails.push(`${fg} sobre ${bg}: ${c.toFixed(2)}`);
    }
    assert.deepEqual(fails, []);
  });
}

test('todos los temas tienen los mismos nombres de color', () => {
  const keys = Object.keys(THEMES.light).sort();
  for (const t of Object.values(THEMES)) assert.deepEqual(Object.keys(t).sort(), keys, t.name);
});

test('el tema se resuelve según preferencia, celular y alto contraste', () => {
  assert.equal(resolveTheme('system', 'dark', false).name, 'dark');
  assert.equal(resolveTheme('system', 'light', false).name, 'light');
  assert.equal(resolveTheme('light', 'dark', false).name, 'light');
  assert.equal(resolveTheme('dark', 'light', true).name, 'dark-contrast');
  assert.equal(resolveTheme('system', null, true).name, 'light-contrast');
});

/**
 * Regla: ningún archivo fuera de src/lib/palette.ts puede escribir un color fijo
 * (#hex, rgb(), rgba() o nombres como 'white'). Si falla, usa un color de useTheme().
 */
test('no hay colores fijos fuera de src/lib/palette.ts', () => {
  const root = join(__dirname, '..', 'src');
  const allowed = new Set(['lib/palette.ts']);
  const pattern = /(['"`])#[0-9a-fA-F]{3,8}\1|rgba?\(|(['"])(white|black|red|blue|green|gray|grey)\2/;
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(f)) {
        const rel = relative(root, p).replace(/\\/g, '/');
        if (allowed.has(rel)) continue;
        readFileSync(p, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (line.trim().startsWith('//') || line.includes('theme-ok')) return;
            if (pattern.test(line)) offenders.push(`src/${rel}:${i + 1}  ${line.trim()}`);
          });
      }
    }
  };
  walk(root);
  assert.deepEqual(offenders, [], 'Usa los colores de useTheme() en vez de colores fijos:\n' + offenders.join('\n'));
});

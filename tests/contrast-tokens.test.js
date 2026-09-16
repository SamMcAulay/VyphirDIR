import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(projectRoot, 'public/styles.css'), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

const tokens = Object.fromEntries(
    [...rootBlock.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map(([, name, hex]) => [name, hex])
);

function luminance(hex) {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token]: every pairing the page-layouts spec uses.
const PAIRS = [
    ['slime-teal-ink', 'slime-teal'], ['slime-teal-ink', 'slime-teal-light'], ['slime-teal-ink', 'bg-cream'],
    ['slime-honey-ink', 'slime-honey'], ['slime-honey-ink', 'slime-honey-light'], ['slime-honey-ink', 'bg-cream'],
    ['slime-tabby-ink', 'slime-tabby'], ['slime-tabby-ink', 'slime-tabby-light'],
    ['slime-lavender-ink', 'slime-lavender'], ['slime-lavender-ink', 'slime-lavender-light'], ['slime-lavender-ink', 'bg-cream'],
    ['slime-pink-ink', 'slime-pink'], ['slime-pink-ink', 'slime-pink-light'],
    ['text-muted', 'bg-cream'], ['text-muted', 'slime-tabby-light'], ['text-muted', 'surface-muted'],
    ['surface', 'text-muted'],
    ['text-ink', 'bg-cream'], ['text-ink', 'slime-teal-light'], ['text-ink', 'slime-honey-light'],
    ['text-ink', 'slime-tabby-light'], ['text-ink', 'slime-lavender-light'],
];

for (const [text, background] of PAIRS) {
    test(`--${text} on --${background} reaches 4.5:1`, () => {
        assert.ok(tokens[text], `--${text} must be defined as a 6-digit hex in :root`);
        assert.ok(tokens[background], `--${background} must be defined as a 6-digit hex in :root`);
        const ratio = contrast(tokens[text], tokens[background]);
        assert.ok(ratio >= 4.5, `--${text} on --${background} is ${ratio.toFixed(2)}:1`);
    });
}

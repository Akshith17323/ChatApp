import assert from 'node:assert/strict';
import test from 'node:test';
import { darkColors, isThemeMode, lightColors, resolveColorScheme } from '../src/theme/colors.ts';

test('system mode tracks device appearance and safely defaults to light', () => {
  assert.equal(resolveColorScheme('system', 'dark'), 'dark');
  assert.equal(resolveColorScheme('system', 'light'), 'light');
  assert.equal(resolveColorScheme('system', null), 'light');
  assert.equal(resolveColorScheme('system', undefined), 'light');
});

test('explicit appearance overrides device appearance', () => {
  assert.equal(resolveColorScheme('dark', 'light'), 'dark');
  assert.equal(resolveColorScheme('light', 'dark'), 'light');
});

test('only supported saved preferences are accepted', () => {
  for (const value of ['system', 'light', 'dark']) assert.equal(isThemeMode(value), true);
  for (const value of [null, undefined, '', 'automatic', {}, 1]) assert.equal(isThemeMode(value), false);
});

test('both palettes cover the same UI colors and provide readable outgoing messages', () => {
  assert.deepEqual(Object.keys(darkColors).sort(), Object.keys(lightColors).sort());
  assert.notEqual(darkColors.background, lightColors.background);
  assert.notEqual(darkColors.surface, lightColors.surface);
  for (const colors of [lightColors, darkColors]) {
    assert.ok(contrast(colors.onPrimary, colors.outgoingBubble) >= 4.5);
    assert.ok(contrast(colors.text, colors.background) >= 4.5);
    assert.ok(contrast(colors.text, colors.surface) >= 4.5);
    assert.ok(contrast(colors.primary, colors.surface) >= 4.5);
  }
});

function contrast(foreground, background) {
  const luminance = (color) => {
    const rgb = color.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255);
    const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

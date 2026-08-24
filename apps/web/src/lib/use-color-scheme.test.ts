import { describe, expect, it } from 'vitest';
import { resolveIsDark } from './use-color-scheme';

describe('resolveIsDark', () => {
  it('follows the OS when the choice is system', () => {
    expect(resolveIsDark('system', true)).toBe(true);
    expect(resolveIsDark('system', false)).toBe(false);
  });

  it('ignores the OS once a theme is pinned', () => {
    expect(resolveIsDark('dark', false)).toBe(true);
    expect(resolveIsDark('light', true)).toBe(false);
  });
});

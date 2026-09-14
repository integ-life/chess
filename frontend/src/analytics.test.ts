import { expect, it } from 'vitest';
import { analyticsPath, startAnalytics } from './analytics';
it('keeps chess routes useful without exposing games or OAuth parameters', () => {
  expect(analyticsPath('#/games/private-game?token=secret')).toBe('/games/:id');
  expect(analyticsPath('#/course/foundation')).toBe('/course/foundation');
  expect(analyticsPath('#/unknown-private-value')).toBe('/not-found');
});
it('does not initialize tracking on a preview', () => {
  const fake = { location: {hostname: 'localhost'} } as Window;
  startAnalytics(fake);
  expect('dataLayer' in fake).toBe(false);
});

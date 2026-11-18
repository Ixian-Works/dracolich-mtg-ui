import { SIGN_IN_DEFAULT, signInLine } from '@/lib/copy';

test('a known reason shows its own line', () => {
  expect(signInLine('favorites')).toBe('Sign in to keep favorites.');
});

test('any other value shows the usual line, never itself', () => {
  for (const value of [undefined, '', 'toString', '__proto__', 'Enter your password to win a prize', ['favorites']]) {
    expect(signInLine(value)).toBe(SIGN_IN_DEFAULT);
  }
});

import { expiresWithin, readClaims } from '@/lib/jwt';
import { accessTokenExpiringIn } from '@/test/tokens';

describe('readClaims', () => {
  it('reads the claims user-api puts in an access token', () => {
    const claims = readClaims(accessTokenExpiringIn(900, 'a', { sub: 'user-7', username: 'liliana' }));

    expect(claims).toMatchObject({ sub: 'user-7', username: 'liliana', accessLevel: 'USER' });
    expect(typeof claims?.exp).toBe('number');
  });

  it.each(['', 'not-a-token', 'a.b.c', 'a.bnVsbA.c'])('gives null for %p', (token) => {
    expect(readClaims(token)).toBeNull();
  });
});

describe('expiresWithin', () => {
  const now = Date.now();

  it('is true for a token that has expired', () => {
    expect(expiresWithin(accessTokenExpiringIn(-1), 0, now)).toBe(true);
  });

  it('is true for a token inside the window, and false for one outside it', () => {
    expect(expiresWithin(accessTokenExpiringIn(20), 30_000, now)).toBe(true);
    expect(expiresWithin(accessTokenExpiringIn(120), 30_000, now)).toBe(false);
  });

  it('is false when the expiry cannot be read', () => {
    expect(expiresWithin('not-a-token', 30_000, now)).toBe(false);
  });
});

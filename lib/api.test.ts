import { ApiError, api, setOnSessionExpired } from '@/lib/api';
import { StorageKeys, storage } from '@/lib/storage';
import { deferred, failure, fakeApi, ok, type Reply } from '@/test/fake-api';
import { accessTokenExpiringIn, storeTokens, storedTokens } from '@/test/tokens';

const DECKS = '/decks/';
const REFRESH = '/auth/refresh';

const expired = () => accessTokenExpiringIn(-60, 'old');
const live = (label = 'new') => accessTokenExpiringIn(900, label);

function refreshReturns(accessToken: string, refreshToken = 'refresh-2') {
  fakeApi.on('POST', REFRESH, () => ok({ accessToken, refreshToken, expiresIn: 900 }));
}

/** Decks answer 200 to `accepted` and 401 to any other token, or to none. */
function decksAcceptOnly(accepted: string) {
  fakeApi.on('GET', DECKS, (request) =>
    request.authorization === `Bearer ${accepted}` ? ok([]) : failure(401, 'DMD034')
  );
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => {
      throw new Error('Expected the request to fail, and it succeeded');
    },
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

let sessionExpired: jest.Mock;

beforeEach(() => {
  sessionExpired = jest.fn();
  setOnSessionExpired(sessionExpired);
});

afterEach(() => {
  setOnSessionExpired(null);
});

describe('an access token that has expired, or is about to', () => {
  it('is replaced before the request leaves', async () => {
    const dead = expired();
    const fresh = live();
    await storeTokens(dead, 'refresh-1');
    refreshReturns(fresh);
    fakeApi.on('GET', DECKS, () => ok([]));

    await api.deckBuilder(DECKS);

    expect(fakeApi.requests.map((request) => request.path.split('/').slice(-2).join('/'))).toEqual([
      'auth/refresh',
      'decks/',
    ]);
    expect(fakeApi.requestsTo(REFRESH)[0].body).toEqual({ refreshToken: 'refresh-1' });
    expect(fakeApi.requestsTo(DECKS)[0].authorization).toBe(`Bearer ${fresh}`);
    expect(fakeApi.requests.some((request) => request.authorization === `Bearer ${dead}`)).toBe(
      false
    );
    expect(await storedTokens()).toEqual({ access: fresh, refresh: 'refresh-2' });
  });

  it('counts as expired from 30 seconds before its expiry', async () => {
    const fresh = live();
    await storeTokens(accessTokenExpiringIn(20, 'old'), 'refresh-1');
    refreshReturns(fresh);
    fakeApi.on('GET', DECKS, () => ok([]));

    await api.deckBuilder(DECKS);

    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1);
    expect(fakeApi.requestsTo(DECKS)[0].authorization).toBe(`Bearer ${fresh}`);
  });

  it('is sent as it is while it has longer than that to live', async () => {
    const token = accessTokenExpiringIn(120);
    await storeTokens(token, 'refresh-1');
    fakeApi.on('GET', DECKS, () => ok([]));

    await api.deckBuilder(DECKS);

    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(0);
    expect(fakeApi.requestsTo(DECKS)[0].authorization).toBe(`Bearer ${token}`);
  });

  it('is renewed once for requests made at the same moment', async () => {
    const fresh = live();
    await storeTokens(expired(), 'refresh-1');
    const refresh = deferred<Reply>();
    fakeApi.on('POST', REFRESH, () => refresh.promise);
    fakeApi.on('GET', DECKS, () => ok([]));

    const requests = [api.deckBuilder(DECKS), api.deckBuilder(DECKS), api.deckBuilder(DECKS)];
    refresh.resolve(ok({ accessToken: fresh, refreshToken: 'refresh-2' }));
    await Promise.all(requests);

    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1);
    expect(fakeApi.requestsTo(DECKS).map((request) => request.authorization)).toEqual([
      `Bearer ${fresh}`,
      `Bearer ${fresh}`,
      `Bearer ${fresh}`,
    ]);
  });

  it('is left off a request to /auth/, which does not wait for a refresh', async () => {
    await storeTokens(expired(), 'refresh-1');
    fakeApi.on('POST', '/auth/login', () => ok({ accessToken: live(), refreshToken: 'refresh-9' }));

    await api.user('/auth/login', { method: 'POST', data: { username: 'jace', password: 'x' } });

    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(0);
    expect(fakeApi.requestsTo('/auth/login')[0].authorization).toBeNull();
  });
});

describe('a request the server answers with 401', () => {
  it('is retried once with a renewed token', async () => {
    // Live by the clock, and the server still refuses it.
    const refused = accessTokenExpiringIn(600, 'refused');
    const fresh = live();
    await storeTokens(refused, 'refresh-1');
    refreshReturns(fresh);
    decksAcceptOnly(fresh);

    await expect(api.deckBuilder(DECKS)).resolves.toEqual([]);

    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1);
    expect(fakeApi.requestsTo(DECKS).map((request) => request.authorization)).toEqual([
      `Bearer ${refused}`,
      `Bearer ${fresh}`,
    ]);
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('shares one refresh with the other requests that got a 401', async () => {
    const fresh = live();
    await storeTokens(accessTokenExpiringIn(600, 'refused'), 'refresh-1');
    refreshReturns(fresh);
    decksAcceptOnly(fresh);

    await Promise.all([api.deckBuilder(DECKS), api.deckBuilder(DECKS), api.deckBuilder(DECKS)]);

    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1);
  });

  it('is given up on after that one retry', async () => {
    await storeTokens(accessTokenExpiringIn(600, 'refused'), 'refresh-1');
    refreshReturns(live());
    fakeApi.on('GET', DECKS, () => failure(401, 'DMD034', 'Not your deck'));

    const error = await rejection(api.deckBuilder(DECKS));

    expect(error.status).toBe(401);
    expect(error.message).toBe('Not your deck');
    expect(fakeApi.requestsTo(DECKS)).toHaveLength(2);
    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1);
    // The server refused the request, not the session.
    expect(sessionExpired).not.toHaveBeenCalled();
    expect((await storedTokens()).refresh).toBe('refresh-2');
  });

  it('is passed on untouched for a visitor who is not signed in', async () => {
    fakeApi.on('GET', DECKS, () => failure(401, 'DMD034'));

    const error = await rejection(api.deckBuilder(DECKS));

    expect(error.status).toBe(401);
    expect(error.errors).toEqual([{ error: 'DMD034', severity: 'ERROR' }]);
    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(0);
    expect(sessionExpired).not.toHaveBeenCalled();
  });
});

describe('a refresh that fails', () => {
  it('keeps the session when the network is off, and sends nothing with the dead token', async () => {
    const dead = expired();
    await storeTokens(dead, 'refresh-1');
    fakeApi.on('POST', REFRESH, () => 'network-error');

    const error = await rejection(api.deckBuilder(DECKS));

    expect(error.status).toBe(0);
    expect(fakeApi.requestsTo(DECKS)).toHaveLength(0);
    expect(await storedTokens()).toEqual({ access: dead, refresh: 'refresh-1' });
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('keeps the session when the refresh times out after a 401', async () => {
    const refused = accessTokenExpiringIn(600, 'refused');
    await storeTokens(refused, 'refresh-1');
    fakeApi.on('GET', DECKS, () => failure(401, 'DMD034'));
    fakeApi.on('POST', REFRESH, () => 'timeout');

    const error = await rejection(api.deckBuilder(DECKS));

    expect(await storedTokens()).toEqual({ access: refused, refresh: 'refresh-1' });
    expect(sessionExpired).not.toHaveBeenCalled();
    expect(error.status).toBe(0);
  });

  it('keeps the session when user-api answers 503', async () => {
    const refused = accessTokenExpiringIn(600, 'refused');
    await storeTokens(refused, 'refresh-1');
    fakeApi.on('GET', DECKS, () => failure(401, 'DMD034'));
    fakeApi.on('POST', REFRESH, () => failure(503, 'DMD001', 'Service unavailable'));

    const error = await rejection(api.deckBuilder(DECKS));

    expect(await storedTokens()).toEqual({ access: refused, refresh: 'refresh-1' });
    expect(sessionExpired).not.toHaveBeenCalled();
    expect(error.status).toBe(503);
  });

  it.each([401, 403])('ends the session when user-api answers %i', async (status) => {
    await storeTokens(expired(), 'refresh-1');
    fakeApi.on('POST', REFRESH, () => failure(status, 'DMD017'));

    const error = await rejection(api.deckBuilder(DECKS));

    expect(error.status).toBe(401);
    expect(fakeApi.requestsTo(DECKS)).toHaveLength(0);
    expect(await storedTokens()).toEqual({ access: null, refresh: null });
    expect(sessionExpired).toHaveBeenCalledTimes(1);
  });

  it('ends the session once, however many requests were waiting on it', async () => {
    await storeTokens(accessTokenExpiringIn(600, 'refused'), 'refresh-1');
    fakeApi.on('GET', DECKS, () => failure(401, 'DMD034'));
    fakeApi.on('POST', REFRESH, () => failure(401, 'DMD017'));

    const results = await Promise.allSettled([
      api.deckBuilder(DECKS),
      api.deckBuilder(DECKS),
      api.deckBuilder(DECKS),
    ]);

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1);
    expect(sessionExpired).toHaveBeenCalledTimes(1);
  });

  it('ends the session when there is no refresh token to send', async () => {
    await storage.set(StorageKeys.accessToken, expired());

    const error = await rejection(api.deckBuilder(DECKS));

    expect(error.status).toBe(401);
    expect(fakeApi.requests).toHaveLength(0);
    expect(await storedTokens()).toEqual({ access: null, refresh: null });
    expect(sessionExpired).toHaveBeenCalledTimes(1);
  });
});

describe('a device whose clock runs ahead', () => {
  it('does not ask again for a token it was just given', async () => {
    // To this device the new token has expired too. Only the clock can be
    // wrong about that, so the token is used until the server refuses it.
    const freshToTheServer = accessTokenExpiringIn(-30, 'new');
    await storeTokens(expired(), 'refresh-1');
    refreshReturns(freshToTheServer);
    fakeApi.on('GET', DECKS, () => ok([]));

    await api.deckBuilder(DECKS);
    await api.deckBuilder(DECKS);

    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1);
    expect(fakeApi.requestsTo(DECKS).map((request) => request.authorization)).toEqual([
      `Bearer ${freshToTheServer}`,
      `Bearer ${freshToTheServer}`,
    ]);
  });
});

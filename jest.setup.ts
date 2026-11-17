// Jest setup, run before every test file.

import { fakeApi } from './test/fake-api';

// `lib/env.ts` throws at import time without a base URL. No test reaches this
// host: `test/fake-api.ts` answers every request axios makes.
process.env.EXPO_PUBLIC_API_BASE = 'https://api.test';

// expo-secure-store needs the Keychain. Tests get an in-memory stand-in with
// the same three calls `lib/storage.ts` uses, emptied before each test.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
    __clear: () => store.clear(),
  };
});

beforeEach(() => {
  (jest.requireMock('expo-secure-store') as { __clear: () => void }).__clear();
  fakeApi.reset();
});

// A request no test gave an answer for is a mistake in the test or in the code,
// and code that swallows errors would otherwise hide it.
afterEach(() => {
  expect(fakeApi.unanswered).toEqual([]);
});

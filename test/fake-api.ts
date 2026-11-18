// A stand-in for the three Dracolich APIs, installed as axios's adapter by
// `jest.setup.ts`. Every request the app makes in a test ends here instead of
// on the network, is recorded, and gets the answer the test set up for it.
//
//   fakeApi.on('POST', '/auth/refresh', () => ok({ accessToken, refreshToken }));
//   fakeApi.on('GET', '/decks/', () => failure(401, 'DMD034'));
//   fakeApi.on('GET', '/decks/', () => 'network-error');
//
// A route matches when the method is equal and the request path ends with the
// given text. The route added last wins, so a test can replace an answer.

import axios, { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';

export interface SeenRequest {
  method: string;
  path: string;
  /** The query parameters, from the URL and from axios's `params`. */
  query: Record<string, string>;
  /** The `Authorization` header as sent, or null when there was none. */
  authorization: string | null;
  body: unknown;
}

export type Reply = { status: number; body: unknown } | 'network-error' | 'timeout';

type Handler = (request: SeenRequest) => Reply | Promise<Reply>;

interface Route {
  method: string;
  pathEnding: string;
  handler: Handler;
}

let routes: Route[] = [];

export const fakeApi = {
  /** Every request made since the last reset, in the order they were sent. */
  requests: [] as SeenRequest[],
  /** Requests no route matched. `jest.setup.ts` fails the test if there are any. */
  unanswered: [] as string[],

  on(method: string, pathEnding: string, handler: Handler) {
    routes.unshift({ method: method.toUpperCase(), pathEnding, handler });
  },

  /** The requests whose path ends with `pathEnding`. */
  requestsTo(pathEnding: string): SeenRequest[] {
    return fakeApi.requests.filter((request) => request.path.endsWith(pathEnding));
  },

  reset() {
    routes = [];
    fakeApi.requests = [];
    fakeApi.unanswered = [];
  },
};

/** A successful response in forge's envelope. */
export function ok(payload: unknown, status = 200): Reply {
  return {
    status,
    body: { success: true, httpStatus: 'OK', message: 'ok', payload, errors: null },
  };
}

/** A failed response in forge's envelope, with one error code. */
export function failure(status: number, code: string, message = 'Request rejected'): Reply {
  return {
    status,
    body: {
      success: false,
      httpStatus: String(status),
      message,
      payload: null,
      errors: [{ error: code, severity: 'ERROR' }],
    },
  };
}

/**
 * A promise and the function that settles it, for an answer the test wants to
 * hold back until it has done something else.
 */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function parseBody(data: unknown): unknown {
  if (typeof data !== 'string') return data ?? null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

const adapter: AxiosAdapter = async (config) => {
  const url = config.url ?? '';
  const absolute = /^https?:\/\//.test(url) ? url : `${config.baseURL ?? ''}${url}`;
  const headers = AxiosHeaders.from(config.headers);
  const authorization = headers.get('Authorization');

  const parsed = new URL(absolute);
  const query: Record<string, string> = Object.fromEntries(parsed.searchParams.entries());
  for (const [key, value] of Object.entries(config.params ?? {})) {
    if (value !== undefined && value !== null) query[key] = String(value);
  }

  const seen: SeenRequest = {
    method: (config.method ?? 'get').toUpperCase(),
    path: parsed.pathname,
    query,
    authorization: typeof authorization === 'string' ? authorization : null,
    body: parseBody(config.data),
  };
  fakeApi.requests.push(seen);

  const route = routes.find(
    (candidate) => candidate.method === seen.method && seen.path.endsWith(candidate.pathEnding)
  );
  if (!route) {
    fakeApi.unanswered.push(`${seen.method} ${seen.path}`);
    throw new AxiosError('No fake route for this request', AxiosError.ERR_NETWORK, config, {});
  }

  const reply = await route.handler(seen);
  if (reply === 'network-error') {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
  }
  if (reply === 'timeout') {
    throw new AxiosError(
      `timeout of ${config.timeout}ms exceeded`,
      AxiosError.ECONNABORTED,
      config,
      {}
    );
  }

  const response = {
    data: reply.body,
    status: reply.status,
    statusText: '',
    headers: new AxiosHeaders(),
    config,
    request: {},
  };
  const accepts = config.validateStatus ?? ((status: number) => status >= 200 && status < 300);
  if (accepts(reply.status)) return response;
  throw new AxiosError(
    `Request failed with status code ${reply.status}`,
    reply.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    response
  );
};

// Instances made with `axios.create` copy the defaults when they are made, so
// this has to be in place before `lib/api.ts` is first imported. `jest.setup.ts`
// imports this file before any test does.
axios.defaults.adapter = adapter;

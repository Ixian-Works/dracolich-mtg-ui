import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import SettingsScreen from '@/app/(app)/account/settings';
import { AuthProvider } from '@/lib/auth';
import { SIGN_OUT_CONFIRM } from '@/lib/copy';
import { clearDialogHandler, setDialogHandler } from '@/lib/dialogs';
import * as feedback from '@/lib/feedback';
import { PreferenceKeys, useAssistantForThisDeck, useAssistantPreference } from '@/lib/preferences';
import { StorageKeys, storage } from '@/lib/storage';
import { fakeApi, ok } from '@/test/fake-api';
import { accessTokenExpiringIn, storeTokens } from '@/test/tokens';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

let queryClient: QueryClient;
afterEach(() => {
  queryClient?.clear();
  clearDialogHandler();
});

function newClient() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  return queryClient;
}

function show(element: React.ReactElement = <SettingsScreen />) {
  const client = newClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return render(element, { wrapper });
}

const signIn = () => storeTokens(accessTokenExpiringIn(900, 'live'), 'refresh-1');

test('signed in: the username, Sign out, and the assistant switch, off at first', async () => {
  await signIn();
  show();

  expect(await screen.findByText('jace')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  const assistant = screen.getByRole('switch', { name: 'Counsel while building' });
  await waitFor(() => expect(assistant.props.disabled).toBeFalsy());
  expect(assistant.props.value).toBe(false);
});

test('only rows whose backend exists are shown', async () => {
  await signIn();
  show();
  await screen.findByText('jace');

  for (const missing of ['Email', 'Change password', 'Delete account', 'About Dracolich', 'Privacy policy', 'Terms']) {
    expect(screen.queryByText(missing)).toBeNull();
  }
});

test('the assistant switch survives a restart', async () => {
  await signIn();
  const first = show();
  const assistant = await screen.findByRole('switch', { name: 'Counsel while building' });
  await waitFor(() => expect(assistant.props.disabled).toBeFalsy());

  fireEvent(assistant, 'valueChange', true);
  await waitFor(async () => expect(await storage.get(PreferenceKeys.assistantOn)).toBe('on'));
  first.unmount();
  queryClient.clear();

  // A fresh cache, as after the app starts again.
  show();
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Counsel while building' }).props.value).toBe(true)
  );
});

test('Sign out asks first, and signs out only on yes', async () => {
  await signIn();
  fakeApi.on('POST', '/auth/logout', () => ok(null));
  const answers = [false, true];
  const asked: unknown[] = [];
  setDialogHandler(async (options) => {
    asked.push(options);
    return answers.shift() ?? false;
  });
  show();

  fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(asked).toHaveLength(1));
  expect(asked[0]).toEqual(SIGN_OUT_CONFIRM);
  expect(await storage.get(StorageKeys.refreshToken)).toBe('refresh-1');

  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(async () => expect(await storage.get(StorageKeys.refreshToken)).toBeNull());
  await waitFor(() => expect(fakeApi.requestsTo('/auth/logout')).toHaveLength(1));
});

test('signed out: a Sign in button, no account rows, and the version line', async () => {
  show();

  fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));
  expect(router.push).toHaveBeenCalledWith('/login');
  expect(screen.queryByText('Sign out')).toBeNull();
  expect(screen.queryByRole('switch')).toBeNull();
  expect(screen.getByText(/· An Ixian Works product$/)).toBeTruthy();
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
});

test("a failed save puts the switch back and says so", async () => {
  const toast = jest.spyOn(feedback, 'showFeedback').mockReturnValue({ update: () => {}, close: () => {} });
  const set = jest.spyOn(storage, 'set').mockRejectedValueOnce(new Error('disk full'));
  let hook!: ReturnType<typeof useAssistantPreference>;
  function Probe() {
    hook = useAssistantPreference();
    return null;
  }
  show(<Probe />);
  await waitFor(() => expect(hook.loaded).toBe(true));

  act(() => hook.setOn(true));
  await waitFor(() => expect(set).toHaveBeenCalled());
  await waitFor(() => expect(hook.on).toBe(false));
  expect(toast).toHaveBeenCalledWith({ kind: 'error', title: "That setting didn't save. Try again." });
  set.mockRestore();
  toast.mockRestore();
});

test("the builder's switch starts from the setting, and flipping it leaves the setting alone", async () => {
  await storage.set(PreferenceKeys.assistantOn, 'on');
  let deck!: ReturnType<typeof useAssistantForThisDeck>;
  function Probe() {
    deck = useAssistantForThisDeck();
    return null;
  }
  show(<Probe />);
  await waitFor(() => expect(deck[0]).toBe(true));

  act(() => deck[1](false));
  await waitFor(() => expect(deck[0]).toBe(false));
  expect(await storage.get(PreferenceKeys.assistantOn)).toBe('on');
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
});

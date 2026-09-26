/**
 * Who is signed in. Loaded from GET /api/me once, on first use. When the API
 * does not answer like the API (static hosting, dev server without the
 * backend, offline at start) the state is `unavailable` and every cloud
 * feature stays hidden: the app then works exactly as it did without accounts.
 */
import { create } from 'zustand';
import { cloudApi, isCloudError, type CloudApi } from './api';
import type { Me } from './contract';

export type AccountState =
  | { status: 'loading'; me: null }
  | { status: 'unavailable'; me: null }
  | { status: 'signedOut'; me: null }
  | { status: 'signedIn'; me: Me };

export const useAccountStore = create<AccountState>(() => ({ status: 'loading', me: null }));

let loading: Promise<AccountState> | null = null;
let api: CloudApi = cloudApi;

/** Tests swap the client and start over. */
export function resetAccount(client: CloudApi = cloudApi) {
  api = client;
  loading = null;
  useAccountStore.setState({ status: 'loading', me: null }, true);
}

async function fetchAccount(): Promise<AccountState> {
  try {
    const me = await api.me();
    return { status: 'signedIn', me };
  } catch (error) {
    if (isCloudError(error, 'unauthorized')) return { status: 'signedOut', me: null };
    return { status: 'unavailable', me: null };
  }
}

/** Starts loading once; later calls return the same promise. */
export function ensureAccount(): Promise<AccountState> {
  loading ??= fetchAccount().then((state) => {
    // A refresh that cannot reach the server keeps the known account.
    const known = useAccountStore.getState();
    if (state.status === 'unavailable' && known.status === 'signedIn') return known;
    useAccountStore.setState(state, true);
    return state;
  });
  return loading;
}

/** Re-reads /api/me (plan or usage changed). */
export async function refreshAccount(): Promise<AccountState> {
  loading = null;
  return ensureAccount();
}

export function setSignedIn(me: Me) {
  loading = Promise.resolve<AccountState>({ status: 'signedIn', me });
  useAccountStore.setState({ status: 'signedIn', me }, true);
}

export async function signOut(): Promise<void> {
  try {
    await api.logout();
  } finally {
    loading = Promise.resolve<AccountState>({ status: 'signedOut', me: null });
    useAccountStore.setState({ status: 'signedOut', me: null }, true);
  }
}

/** Current account; triggers the one-time load. */
export function useAccount(): AccountState {
  void ensureAccount();
  return useAccountStore();
}

/** The signed-in user, or null (also while loading or without the API). */
export function currentMe(): Me | null {
  const state = useAccountStore.getState();
  return state.status === 'signedIn' ? state.me : null;
}

/** Whether a new cloud project would exceed the plan (the server decides; this only explains). */
export function atProjectLimit(me: Me): boolean {
  const limit = me.entitlements.cloudProjects;
  return limit !== null && me.usage.cloudProjects >= limit;
}

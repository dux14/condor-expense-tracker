// Calls the server account-deletion endpoint. Lives in lib/auth (not the UI) so
// the network call stays out of components — the UI-invariant gate forbids raw
// fetch() outside lib/{data,fx,auth,lock} and app/api. The endpoint is the single
// authoritative cloud-cleanup path (rows + auth user, scoped to the session).
export async function deleteAccount(): Promise<void> {
  const res = await fetch('/api/account', { method: 'DELETE' });
  if (!res.ok) throw new Error('delete_failed');
}

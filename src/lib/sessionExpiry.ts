// Handling for the one failure the gateway can't catch: a token whose SESSION is
// gone (signed out in another tab, or rotated away by a refresh) while the JWT
// itself still looks valid — right signature, not yet expired. Only an edge
// function's auth.getUser() sees it, and it answers 401. We drop the dead token
// and hand the reason to the login page, so the student gets "sign in again"
// instead of a bare "Unauthorized" dead end.
import { supabase } from './supabase'

// sessionStorage (not module state) because the sign-out and the login render
// are separate route mounts; it must not outlive the tab.
const KEY = 'cefrly-session-expired'

/** Marks the next /login visit as "we signed you out, here's why". */
export function flagSessionExpired() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // A blocked/full store only costs us the notice — never break the sign-out.
  }
}

/** Reads AND clears the flag, so the notice shows exactly once. */
export function consumeSessionExpired(): boolean {
  try {
    const flagged = sessionStorage.getItem(KEY) === '1'
    if (flagged) sessionStorage.removeItem(KEY)
    return flagged
  } catch {
    return false
  }
}

/** The server refused our token. Thrown after the dead session is cleared. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.')
    this.name = 'SessionExpiredError'
  }
}

/** Every edge-function caller funnels its 401 here: the stored token is dead, so
 *  retrying can only fail the same way. Dropping it makes the auth listener null
 *  the session, which is what sends ProtectedRoute to /login. signOut() ignores
 *  401/403/404 from the server and clears local storage regardless — exactly
 *  what a dead token needs. Scope 'local': this tab's token is the broken one;
 *  the default ('global') would revoke the account on every other device too. */
export async function abandonDeadSession(): Promise<never> {
  flagSessionExpired()
  await supabase.auth.signOut({ scope: 'local' })
  throw new SessionExpiredError()
}

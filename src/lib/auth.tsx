import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { effectivePlan } from './plans'
import type { PlanId } from '../types/plan'

export type Role = 'student' | 'admin' | 'super_admin'

interface AuthState {
  session: Session | null
  /** True until the initial session restore finishes. */
  loading: boolean
  /** The signed-in user's profiles.role; null while signed out or still loading. */
  role: Role | null
  /** True while the role for the current session is being fetched. */
  roleLoading: boolean
  /** The plan in force right now — expiry already resolved (an expired paid
   *  plan reads as 'free'), and staff (admin/super_admin) read as 'premium'
   *  since they're unlimited. 'free' while signed out or still loading. Loaded
   *  with role. For authoritative usage numbers use fetchEntitlements(). */
  plan: PlanId
  /** profiles.onboarded_at — null means the /welcome wizard hasn't been
   *  completed (it runs exactly once per account). Loaded together with role,
   *  so `role !== null` also means this value is settled. */
  onboardedAt: string | null
  /** Lifts the onboarding gate immediately after the wizard saves, without a
   *  profile refetch. */
  markOnboarded: () => void
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  role: null,
  roleLoading: false,
  plan: 'free',
  onboardedAt: null,
  markOnboarded: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role | null>(null)
  const [roleLoading, setRoleLoading] = useState(false)
  const [plan, setPlan] = useState<PlanId>('free')
  const [onboardedAt, setOnboardedAt] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  // RLS lets users read only their own profile row; role changes happen
  // exclusively through the admin-users edge function.
  useEffect(() => {
    if (!userId) {
      setRole(null)
      setPlan('free')
      setOnboardedAt(null)
      return
    }
    let cancelled = false
    setRoleLoading(true)
    supabase
      .from('profiles')
      .select('role, plan, plan_expires_at, onboarded_at')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        const r = (data?.role as Role | undefined) ?? 'student'
        setRole(r)
        // Staff are unlimited → surface as 'premium'; otherwise resolve expiry.
        const stored = (data?.plan as PlanId | undefined) ?? 'free'
        setPlan(
          r === 'admin' || r === 'super_admin'
            ? 'premium'
            : effectivePlan(stored, (data?.plan_expires_at as string | null | undefined) ?? null),
        )
        setOnboardedAt((data?.onboarded_at as string | null | undefined) ?? null)
        setRoleLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        role,
        roleLoading,
        plan,
        onboardedAt,
        markOnboarded: () => setOnboardedAt(new Date().toISOString()),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

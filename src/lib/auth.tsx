import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'student' | 'admin' | 'super_admin'

interface AuthState {
  session: Session | null
  /** True until the initial session restore finishes. */
  loading: boolean
  /** The signed-in user's profiles.role; null while signed out or still loading. */
  role: Role | null
  /** True while the role for the current session is being fetched. */
  roleLoading: boolean
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  role: null,
  roleLoading: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role | null>(null)
  const [roleLoading, setRoleLoading] = useState(false)

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
      return
    }
    let cancelled = false
    setRoleLoading(true)
    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setRole((data?.role as Role | undefined) ?? 'student')
        setRoleLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <AuthContext.Provider value={{ session, loading, role, roleLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

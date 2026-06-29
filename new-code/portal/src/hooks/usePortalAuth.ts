import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PortalUser } from '../types/portal'

export function usePortalAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPortalUser = async (userId: string) => {
    const { data, error } = await supabase
      .schema('portal')
      .from('client_portal_user')
      .select('*')
      .eq('auth_uid', userId)
      .eq('enabled', true)
      .single()

    if (error) {
      setError('No portal access. Contact Amplior admin.')
      setPortalUser(null)
    } else {
      setPortalUser(data as PortalUser)
      setError(null)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        await fetchPortalUser(session.user.id)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        setLoading(true)
        await fetchPortalUser(session.user.id)
        setLoading(false)
      } else {
        setPortalUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { session, portalUser, loading, error, signOut }
}

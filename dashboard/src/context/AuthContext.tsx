import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UserProfile {
  is_admin: boolean
}

export interface Device {
  device_id: string
  label: string
}

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  devices: Device[]           // all devices (populated for admins; single-item for regular users)
  selectedDevice: string | null
  setSelectedDevice: (id: string) => void
  signOut: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfileAndDevices(userId: string) {
    const [profileRes, allDevicesRes, myDeviceRes] = await Promise.all([
      supabase.from('user_profiles').select('is_admin').eq('id', userId).single(),
      supabase.from('devices').select('device_id, label').order('device_id'),
      supabase.from('devices').select('device_id').eq('assigned_user_id', userId).maybeSingle(),
    ])

    const prof = profileRes.data ?? null
    const allDevices = allDevicesRes.data ?? []

    setProfile(prof)
    setDevices(allDevices)

    if (prof?.is_admin) {
      setSelectedDevice(allDevices[0]?.device_id ?? null)
    } else {
      setSelectedDevice(myDeviceRes.data?.device_id ?? null)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfileAndDevices(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadProfileAndDevices(session.user.id)
      } else {
        setProfile(null)
        setDevices([])
        setSelectedDevice(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, devices, selectedDevice, setSelectedDevice, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

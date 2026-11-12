import { createClient, processLock } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// processLock instead of the default cross-tab Navigator lock: on phones a reload or a
// backgrounded tab could "steal" that lock mid-request, which surfaced as
// "AbortError: Lock broken by another request with 'steal' option".
export const supabase = createClient(url, key, {
  auth: { lock: processLock },
})

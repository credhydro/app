import { supabase } from './supabase'

export async function sendCommand(
  deviceId: string,
  command: string,
  params?: Record<string, unknown>,
  trialName?: string | null,
) {
  return supabase.from('commands').insert({
    device_id: deviceId,
    command,
    params: params ?? null,
    trial_name: trialName ?? null,
    status: 'pending',
  })
}

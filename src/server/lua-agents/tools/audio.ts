import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export const audioTools = {
  'audio.features': async (mixId: string) => {
    const { data } = await adminClient()
      .from('audio_features')
      .select('*')
      .eq('mix_id', mixId)
      .single()
    return data ?? null
  },

  'audio.tracklist': async (mixId: string) => {
    const { data } = await adminClient()
      .from('mix_tracks')
      .select('*')
      .eq('mix_id', mixId)
      .order('start_sec')
    return data ?? []
  },

  'audio.trigger_analysis': async (mixId: string): Promise<boolean> => {
    const triggerUrl = process.env.TRIGGER_API_URL
    const triggerKey = process.env.TRIGGER_SECRET_KEY
    if (!triggerUrl || !triggerKey) {
      console.warn('audio.trigger_analysis: TRIGGER env vars not set')
      return false
    }
    const res = await fetch(`${triggerUrl}/api/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${triggerKey}`,
      },
      body: JSON.stringify({ event: { name: 'mix.analyze', payload: { mix_id: mixId } } }),
    })
    return res.ok
  },
}

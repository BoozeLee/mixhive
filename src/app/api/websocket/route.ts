import { NextResponse } from 'next/server'

// WebSocket support via socket.io is not yet configured.
// Real-time updates use Supabase Realtime instead.
export async function GET() {
  return NextResponse.json({ error: 'WebSocket endpoint not available' }, { status: 501 })
}

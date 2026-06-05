import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service role not configured');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function moderateContent(
  sourceTable: 'buzzes' | 'mixes' | 'profiles',
  sourceId: string,
  text: string
): Promise<void> {
  if (!text?.trim()) return;

  const supabase = getServiceClient();

  const { error: signalError } = await supabase.from('moderation_signals').insert({
    source_table: sourceTable,
    source_id: sourceId,
    signal_type: 'text_flagged',
    severity: 'low',
    action_taken: null,
    flagged_by: 'moderation_agent',
    payload: { text, status: 'pending' },
  });

  if (signalError) {
    console.error('Failed to create moderation signal:', signalError);
  }

  const { error: updateError } = await supabase
    .from(sourceTable)
    .update({ moderation_status: 'pending', moderation_reason: null })
    .eq('id', sourceId);

  if (updateError) {
    console.error(`Failed to update ${sourceTable} moderation status:`, updateError);
  }
}

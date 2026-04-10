import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.RUNWAY_CONFIG;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.RunwayDB = {
  supabase,

  async getLatestSnapshot() {
    const { data, error } = await supabase
      .from('runway_snapshots')
      .select('data')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    return data.data;
  },

  async getTransactions() {
    const { data, error } = await supabase
      .from('runway_transactions')
      .select('date, card, merchant, amount, category, source')
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  }
};

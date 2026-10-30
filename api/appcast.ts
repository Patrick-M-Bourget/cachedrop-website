import { createClient } from '@supabase/supabase-js';
import { handleAppcast } from '../src/server/appcast.ts';

export function GET(request: Request) {
  return handleAppcast(request, async () => {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
    const expected = process.env.VERCEL_ENV === 'production'
      ? 'https://dqpvfcthotskzfvdpjdm.supabase.co' : 'https://nyefnnwhnlyovpdmzxiw.supabase.co';
    if (SUPABASE_URL !== expected || !SUPABASE_SECRET_KEY) throw new Error('Update feed environment is not configured.');
    const client = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from('release_feeds').select('appcast_xml, sha256').eq('singleton', true).maybeSingle();
    if (error) throw new Error('Update feed lookup failed.');
    return data ? { xml: data.appcast_xml, sha256: data.sha256 } : null;
  });
}

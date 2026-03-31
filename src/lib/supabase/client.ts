import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (name: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  // Vite env in client-side
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    // @ts-ignore
    return import.meta.env[name];
  }
  return undefined;
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set. Features depending on Supabase may not work.');
}

export const supabaseClient: SupabaseClient = createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '');

export const getSupabaseServerClient = (): SupabaseClient => {
  const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !serviceKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured on server side');
  }
  return createClient(SUPABASE_URL, serviceKey);
};

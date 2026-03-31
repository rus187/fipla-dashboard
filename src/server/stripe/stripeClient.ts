import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is required');
}
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase server-side operations');
}

export const stripe = new Stripe(stripeSecretKey, { apiVersion: '2022-11-15' });
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

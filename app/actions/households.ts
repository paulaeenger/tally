// Target path in your repo: app/actions/households.ts (NEW FILE)
//
// Server actions for household management: generating invite codes,
// redeeming them, and (in the future) renaming the household or
// removing members.

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Generate a new invite code for the current user's household.
 * Returns the code for display in the UI.
 */
export async function generateInviteCode(): Promise<{ code?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  // Calls the SQL function defined in the Phase 2 migration.
  const { data, error } = await supabase.rpc('generate_household_invite');

  if (error) return { error: error.message };
  if (!data) return { error: 'Failed to generate invite code' };

  return { code: data as string };
}

/**
 * Redeem an invite code — adds the current user to the household and
 * makes it their current household.
 */
export async function redeemInviteCode(
  code: string
): Promise<{ householdName?: string; error?: string }> {
  if (!code || !code.trim()) {
    return { error: 'Enter an invite code' };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  // Calls the SQL function defined in the Phase 2 migration.
  const { data, error } = await supabase.rpc('redeem_household_invite', {
    invite_code: code,
  });

  if (error) {
    // Friendlier error for the common cases
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid')) return { error: 'That invite code isn\'t valid.' };
    if (msg.includes('expired')) return { error: 'That invite has expired — ask for a new one.' };
    if (msg.includes('already been used')) return { error: 'That invite has already been used.' };
    if (msg.includes('already a member')) return { error: 'You\'re already in this household.' };
    if (msg.includes('own invite')) return { error: 'You can\'t redeem your own invite code.' };
    return { error: error.message };
  }

  // Revalidate every route since the user's household just changed
  revalidatePath('/', 'layout');

  const result = Array.isArray(data) ? data[0] : data;
  return { householdName: result?.household_name };
}

// Target path: app/actions/merchant-rules.ts (NEW FILE)
//
// Server actions for merchant rules — the learning system behind the CSV
// import review UI. Users correct a row's type/category during import and
// check "save as rule," which calls upsertMerchantRule here.

'use server';

import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getCurrentHouseholdId } from '@/lib/data/queries';
import type { TransactionType } from '@/lib/data/types';

export interface MerchantRule {
  id: string;
  pattern: string;
  type: TransactionType;
  category_id: string | null;
  match_count: number;
}

/**
 * Returns all merchant rules for the current household. Called by the
 * import modal when it opens so it can pre-fill type/category suggestions.
 */
export async function getMerchantRules(): Promise<MerchantRule[]> {
  if (!isSupabaseConfigured()) return [];

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from('merchant_rules')
    .select('id, pattern, type, category_id, match_count')
    .eq('household_id', householdId)
    .order('match_count', { ascending: false });

  if (error || !data) return [];
  return data as MerchantRule[];
}

/**
 * Saves or updates a merchant rule. Called after CSV import commit,
 * for each row where the user checked "save as rule."
 *
 * Pattern should be the cleaned/normalized merchant name (lowercase, trimmed).
 */
export async function upsertMerchantRule(params: {
  pattern: string;
  type: TransactionType;
  category_id: string | null;
}): Promise<{ error?: string; rule?: MerchantRule }> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  const pattern = params.pattern.trim().toLowerCase();
  if (!pattern) return { error: 'Pattern is empty' };
  if (pattern.length > 100) return { error: 'Pattern is too long' };

  const supabase = createClient();

  // Upsert: if pattern already exists for this household, update it
  const { data, error } = await supabase
    .from('merchant_rules')
    .upsert(
      {
        household_id: householdId,
        pattern,
        type: params.type,
        category_id: params.category_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,pattern' }
    )
    .select('id, pattern, type, category_id, match_count')
    .single();

  if (error) return { error: error.message };
  return { rule: data as MerchantRule };
}

/**
 * Delete a merchant rule by id. Used by future "manage rules" UI
 * (not used in the import flow).
 */
export async function deleteMerchantRule(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

  const supabase = createClient();
  const { error } = await supabase.from('merchant_rules').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

/**
 * Bumps match_count for rules that were applied during an import.
 * Called after a successful import with the list of rule ids that matched.
 * Useful for "most-used rules" analytics later.
 */
export async function incrementRuleMatches(ruleIds: string[]): Promise<void> {
  if (ruleIds.length === 0) return;
  if (!isSupabaseConfigured()) return;

  const supabase = createClient();
  // Single batched update using .in()
  // We fetch the current values then update because rpc/increment isn't
  // straightforward in Supabase without a custom function.
  const { data: current } = await supabase
    .from('merchant_rules')
    .select('id, match_count')
    .in('id', ruleIds);

  if (!current) return;

  for (const rule of current) {
    await supabase
      .from('merchant_rules')
      .update({ match_count: rule.match_count + 1 })
      .eq('id', rule.id);
  }
}

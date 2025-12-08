import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '$lib/types/database';

export type FeatureFlag = Tables<'feature_flags'>;

/**
 * Fetch all feature flags from Supabase
 */
export async function getAllFlags(
	supabase: SupabaseClient<Database>,
): Promise<{ data: FeatureFlag[] | null; error: Error | null }> {
	const { data, error } = await supabase.from('feature_flags').select('*');

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	return { data, error: null };
}

/**
 * Get a single feature flag by ID
 */
export async function getFlag(
	supabase: SupabaseClient<Database>,
	flagId: string,
): Promise<{ data: FeatureFlag | null; error: Error | null }> {
	const { data, error } = await supabase
		.from('feature_flags')
		.select('*')
		.eq('id', flagId)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			return { data: null, error: null };
		}
		return { data: null, error: new Error(error.message) };
	}

	return { data, error: null };
}

/**
 * Subscribe to realtime changes on feature_flags table
 * Returns an unsubscribe function
 */
export function subscribeToFlags(
	supabase: SupabaseClient<Database>,
	onUpdate: (flags: FeatureFlag[]) => void,
): RealtimeChannel {
	const channel = supabase
		.channel('feature_flags_changes')
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'feature_flags',
			},
			async () => {
				// On any change, refetch all flags
				const { data } = await getAllFlags(supabase);
				if (data) {
					onUpdate(data);
				}
			},
		)
		.subscribe();

	return channel;
}

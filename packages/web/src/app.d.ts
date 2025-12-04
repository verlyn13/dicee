// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			/**
			 * Safe session getter that validates the JWT.
			 * ALWAYS use this instead of supabase.auth.getSession()
			 */
			safeGetSession: () => Promise<{
				session: Session | null;
				user: User | null;
			}>;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
			supabase: SupabaseClient<Database>;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			analysis_events: {
				Row: {
					event_type: string;
					id: string;
					payload: Json;
					source_event_id: string | null;
					timestamp: string;
				};
				Insert: {
					event_type: string;
					id?: string;
					payload: Json;
					source_event_id?: string | null;
					timestamp?: string;
				};
				Update: {
					event_type?: string;
					id?: string;
					payload?: Json;
					source_event_id?: string | null;
					timestamp?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'analysis_events_source_event_id_fkey';
						columns: ['source_event_id'];
						isOneToOne: false;
						referencedRelation: 'domain_events';
						referencedColumns: ['id'];
					},
				];
			};
			domain_events: {
				Row: {
					event_type: string;
					event_version: string;
					game_id: string;
					id: string;
					payload: Json;
					player_id: string;
					roll_number: number | null;
					sequence_number: number;
					timestamp: string;
					turn_number: number | null;
				};
				Insert: {
					event_type: string;
					event_version?: string;
					game_id: string;
					id?: string;
					payload: Json;
					player_id: string;
					roll_number?: number | null;
					sequence_number: number;
					timestamp?: string;
					turn_number?: number | null;
				};
				Update: {
					event_type?: string;
					event_version?: string;
					game_id?: string;
					id?: string;
					payload?: Json;
					player_id?: string;
					roll_number?: number | null;
					sequence_number?: number;
					timestamp?: string;
					turn_number?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: 'domain_events_game_id_fkey';
						columns: ['game_id'];
						isOneToOne: false;
						referencedRelation: 'games';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'domain_events_player_id_fkey';
						columns: ['player_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
				];
			};
			feature_flags: {
				Row: {
					created_at: string;
					description: string | null;
					enabled: boolean;
					id: string;
					min_games_played: number;
					premium_only: boolean;
					rollout_percent: number;
					updated_at: string;
					user_ids: string[];
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					enabled?: boolean;
					id: string;
					min_games_played?: number;
					premium_only?: boolean;
					rollout_percent?: number;
					updated_at?: string;
					user_ids?: string[];
				};
				Update: {
					created_at?: string;
					description?: string | null;
					enabled?: boolean;
					id?: string;
					min_games_played?: number;
					premium_only?: boolean;
					rollout_percent?: number;
					updated_at?: string;
					user_ids?: string[];
				};
				Relationships: [];
			};
			game_players: {
				Row: {
					final_rank: number | null;
					final_score: number | null;
					game_id: string;
					is_connected: boolean;
					joined_at: string;
					left_at: string | null;
					scorecard: Json | null;
					seat_number: number;
					turn_order: number;
					user_id: string;
				};
				Insert: {
					final_rank?: number | null;
					final_score?: number | null;
					game_id: string;
					is_connected?: boolean;
					joined_at?: string;
					left_at?: string | null;
					scorecard?: Json | null;
					seat_number: number;
					turn_order: number;
					user_id: string;
				};
				Update: {
					final_rank?: number | null;
					final_score?: number | null;
					game_id?: string;
					is_connected?: boolean;
					joined_at?: string;
					left_at?: string | null;
					scorecard?: Json | null;
					seat_number?: number;
					turn_order?: number;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'game_players_game_id_fkey';
						columns: ['game_id'];
						isOneToOne: false;
						referencedRelation: 'games';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'game_players_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
				];
			};
			games: {
				Row: {
					completed_at: string | null;
					created_at: string;
					game_mode: string;
					host_id: string | null;
					id: string;
					room_code: string | null;
					settings: Json;
					started_at: string | null;
					status: string;
					winner_id: string | null;
				};
				Insert: {
					completed_at?: string | null;
					created_at?: string;
					game_mode?: string;
					host_id?: string | null;
					id?: string;
					room_code?: string | null;
					settings?: Json;
					started_at?: string | null;
					status?: string;
					winner_id?: string | null;
				};
				Update: {
					completed_at?: string | null;
					created_at?: string;
					game_mode?: string;
					host_id?: string | null;
					id?: string;
					room_code?: string | null;
					settings?: Json;
					started_at?: string | null;
					status?: string;
					winner_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'games_host_id_fkey';
						columns: ['host_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'games_winner_id_fkey';
						columns: ['winner_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
				];
			};
			player_stats: {
				Row: {
					avg_ev_loss: number;
					avg_score: number;
					best_score: number;
					bonus_dicees: number;
					category_stats: Json;
					dicees_rolled: number;
					games_completed: number;
					games_played: number;
					games_won: number;
					optimal_decisions: number;
					total_decisions: number;
					total_score: number;
					updated_at: string;
					upper_bonuses: number;
					user_id: string;
				};
				Insert: {
					avg_ev_loss?: number;
					avg_score?: number;
					best_score?: number;
					bonus_dicees?: number;
					category_stats?: Json;
					dicees_rolled?: number;
					games_completed?: number;
					games_played?: number;
					games_won?: number;
					optimal_decisions?: number;
					total_decisions?: number;
					total_score?: number;
					updated_at?: string;
					upper_bonuses?: number;
					user_id: string;
				};
				Update: {
					avg_ev_loss?: number;
					avg_score?: number;
					best_score?: number;
					bonus_dicees?: number;
					category_stats?: Json;
					dicees_rolled?: number;
					games_completed?: number;
					games_played?: number;
					games_won?: number;
					optimal_decisions?: number;
					total_decisions?: number;
					total_score?: number;
					updated_at?: string;
					upper_bonuses?: number;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'player_stats_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
				];
			};
			profiles: {
				Row: {
					avatar_seed: string;
					avatar_style: string;
					badges: Json;
					bio: string | null;
					created_at: string;
					display_name: string | null;
					id: string;
					is_anonymous: boolean;
					is_public: boolean;
					last_seen_at: string;
					rating_deviation: number;
					rating_volatility: number;
					skill_rating: number;
					updated_at: string;
					username: string | null;
				};
				Insert: {
					avatar_seed?: string;
					avatar_style?: string;
					badges?: Json;
					bio?: string | null;
					created_at?: string;
					display_name?: string | null;
					id: string;
					is_anonymous?: boolean;
					is_public?: boolean;
					last_seen_at?: string;
					rating_deviation?: number;
					rating_volatility?: number;
					skill_rating?: number;
					updated_at?: string;
					username?: string | null;
				};
				Update: {
					avatar_seed?: string;
					avatar_style?: string;
					badges?: Json;
					bio?: string | null;
					created_at?: string;
					display_name?: string | null;
					id?: string;
					is_anonymous?: boolean;
					is_public?: boolean;
					last_seen_at?: string;
					rating_deviation?: number;
					rating_volatility?: number;
					skill_rating?: number;
					updated_at?: string;
					username?: string | null;
				};
				Relationships: [];
			};
			rooms: {
				Row: {
					allow_spectators: boolean | null;
					code: string;
					created_at: string;
					created_by: string;
					current_players: number;
					expires_at: string;
					game_id: string | null;
					is_public: boolean;
					max_players: number;
				};
				Insert: {
					allow_spectators?: boolean | null;
					code: string;
					created_at?: string;
					created_by: string;
					current_players?: number;
					expires_at?: string;
					game_id?: string | null;
					is_public?: boolean;
					max_players?: number;
				};
				Update: {
					allow_spectators?: boolean | null;
					code?: string;
					created_at?: string;
					created_by?: string;
					current_players?: number;
					expires_at?: string;
					game_id?: string | null;
					is_public?: boolean;
					max_players?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'rooms_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'rooms_game_id_fkey';
						columns: ['game_id'];
						isOneToOne: true;
						referencedRelation: 'games';
						referencedColumns: ['id'];
					},
				];
			};
			solo_leaderboard: {
				Row: {
					created_at: string;
					dicee_count: number | null;
					efficiency: number | null;
					game_id: string | null;
					id: string;
					score: number;
					upper_bonus: boolean | null;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					dicee_count?: number | null;
					efficiency?: number | null;
					game_id?: string | null;
					id?: string;
					score: number;
					upper_bonus?: boolean | null;
					user_id: string;
				};
				Update: {
					created_at?: string;
					dicee_count?: number | null;
					efficiency?: number | null;
					game_id?: string | null;
					id?: string;
					score?: number;
					upper_bonus?: boolean | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'solo_leaderboard_game_id_fkey';
						columns: ['game_id'];
						isOneToOne: false;
						referencedRelation: 'games';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'solo_leaderboard_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
				];
			};
			telemetry_events: {
				Row: {
					event_type: string;
					id: string;
					page_url: string | null;
					payload: Json;
					referrer: string | null;
					session_id: string;
					timestamp: string;
					user_agent: string | null;
					user_id: string | null;
				};
				Insert: {
					event_type: string;
					id?: string;
					page_url?: string | null;
					payload: Json;
					referrer?: string | null;
					session_id: string;
					timestamp?: string;
					user_agent?: string | null;
					user_id?: string | null;
				};
				Update: {
					event_type?: string;
					id?: string;
					page_url?: string | null;
					payload?: Json;
					referrer?: string | null;
					session_id?: string;
					timestamp?: string;
					user_agent?: string | null;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'telemetry_events_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			cleanup_expired_rooms: { Args: never; Returns: undefined };
			cleanup_old_analysis: { Args: never; Returns: undefined };
			cleanup_old_telemetry: { Args: never; Returns: undefined };
			generate_room_code: { Args: never; Returns: string };
			get_alltime_leaderboard: {
				Args: { limit_count?: number };
				Returns: {
					avatar_seed: string;
					created_at: string;
					display_name: string;
					efficiency: number;
					rank: number;
					score: number;
					user_id: string;
				}[];
			};
			get_daily_leaderboard: {
				Args: { limit_count?: number };
				Returns: {
					avatar_seed: string;
					created_at: string;
					display_name: string;
					efficiency: number;
					rank: number;
					score: number;
					user_id: string;
				}[];
			};
			get_user_best_scores: {
				Args: { limit_count?: number; target_user_id: string };
				Returns: {
					created_at: string;
					dicee_count: number;
					efficiency: number;
					score: number;
					upper_bonus: boolean;
				}[];
			};
			get_weekly_leaderboard: {
				Args: { limit_count?: number };
				Returns: {
					avatar_seed: string;
					created_at: string;
					display_name: string;
					efficiency: number;
					rank: number;
					score: number;
					user_id: string;
				}[];
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {},
	},
} as const;

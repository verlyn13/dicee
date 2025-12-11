/**
 * AI Chat Responses
 *
 * Deterministic chat messages based on game events and AI personality.
 * Uses seeded randomness for reproducible but varied responses.
 */

import type { Category, DiceArray } from '../game';
import type { AIProfile, GameContext } from './types';

// ============================================================================
// Chat Event Types
// ============================================================================

/**
 * Game events that can trigger AI chat responses.
 */
export type ChatTrigger =
	| 'game_start'
	| 'my_turn_start'
	| 'rolled_dicee'
	| 'scored_dicee'
	| 'scored_zero'
	| 'good_roll'
	| 'bad_roll'
	| 'opponent_dicee'
	| 'taking_lead'
	| 'falling_behind'
	| 'final_round'
	| 'game_won'
	| 'game_lost'
	| 'close_game';

/**
 * Context for generating chat responses.
 */
export interface ChatContext {
	trigger: ChatTrigger;
	profile: AIProfile;
	gameContext?: GameContext;
	score?: number;
	category?: Category;
	opponentName?: string;
	scoreDiff?: number;
}

// ============================================================================
// Response Templates by Profile
// ============================================================================

/**
 * Chat responses for Riley (beginner, enthusiastic).
 */
const RILEY_RESPONSES: Record<ChatTrigger, string[]> = {
	game_start: [
		"Let's do this! 🎲",
		"I'm so excited to play!",
		'Good luck everyone!',
		'May the best roller win! 😊',
	],
	my_turn_start: [
		'Okay, here we go!',
		'My turn! 🎲',
		'Fingers crossed!',
		"Let's see what I get...",
	],
	rolled_dicee: [
		'WAIT IS THAT A DICEE?! 🎉',
		'OMG OMG OMG!!!',
		'NO WAY! ALL THE SAME!',
		"I can't believe it! 😱",
	],
	scored_dicee: ['50 POINTS! Best day ever!', 'I did it! I actually did it!', 'Dicee baby! 🎯'],
	scored_zero: [
		"Oops... that didn't work out 😅",
		"Well, that's unfortunate",
		'Zero points? Really? 😭',
		"I'll do better next time!",
	],
	good_roll: [
		'Ooh, nice!',
		"That's pretty good!",
		'I like this roll! 😊',
		'Things are looking up!',
	],
	bad_roll: ['Hmm, not great...', 'Could be better 😬', "Well, let's work with it", 'Uh oh...'],
	opponent_dicee: ['Wow, nice roll!', "Congrats! That's amazing!", 'So jealous right now 😄'],
	taking_lead: ["Wait, I'm winning?!", 'Look at me go! 🚀', 'This is exciting!'],
	falling_behind: ['I can still catch up!', "It's not over yet!", 'Come on dice, help me out!'],
	final_round: ['Last round! So nervous!', 'Here goes nothing!', 'Final chance! 🤞'],
	game_won: ['I WON?! Really?! 🎉', 'That was so fun! GG!', 'Yay! Great game everyone!'],
	game_lost: ['Good game! You played great!', 'So close! Next time! 😊', 'That was fun anyway!'],
	close_game: ['This is so intense!', 'Anyone could win!', 'What a game! 😱'],
};

/**
 * Chat responses for Carmen (intermediate, balanced).
 */
const CARMEN_RESPONSES: Record<ChatTrigger, string[]> = {
	game_start: ['Good luck!', "Let's have a good game", 'May the dice favor us all'],
	my_turn_start: ["Alright, let's see...", 'My turn', 'Here we go'],
	rolled_dicee: ['Dicee! 🎲', 'All five! Nice!', "That's what I'm talking about!"],
	scored_dicee: ['50 points, thank you very much', "I'll take that Dicee", 'Perfect! 🎯'],
	scored_zero: ['Had to sacrifice that one', 'Strategic zero', 'Not ideal, but necessary'],
	good_roll: ['Not bad', 'I can work with this', 'Decent'],
	bad_roll: ['Hmm', 'Could be worse', "Let's try again"],
	opponent_dicee: ['Nice one!', 'Well played', 'Good roll!'],
	taking_lead: ['Looking good', "I'll take the lead", 'Ahead for now'],
	falling_behind: ['Still in this', 'Plenty of game left', 'Time to focus'],
	final_round: ['Final round', 'Make it count', 'Last chance'],
	game_won: ['Good game!', 'GG everyone', 'Thanks for playing!'],
	game_lost: ['Well played!', 'Good game', 'You got me this time'],
	close_game: ['Close one!', 'Tight game', 'This is interesting'],
};

/**
 * Chat responses for Liam (risk-taker, expressive).
 */
const LIAM_RESPONSES: Record<ChatTrigger, string[]> = {
	game_start: ["Let's GO! 🔥", 'Time to roll big!', 'No fear! All gas!'],
	my_turn_start: ['Watch this!', 'Big roll incoming!', 'Fortune favors the bold!'],
	rolled_dicee: ['BOOM! DICEE! 💥', "THAT'S WHAT I'M TALKING ABOUT!", 'YESSSSS! 🎲🎲🎲🎲🎲'],
	scored_dicee: ["50 points! Let's GOOO!", 'Dicee secured! 🏆', "That's how it's done!"],
	scored_zero: [
		'Worth the risk!',
		'Swing and a miss, but no regrets!',
		"You miss 100% of the shots you don't take!",
	],
	good_roll: ["Now we're cooking!", "That's what I like to see!", "Let's push it further!"],
	bad_roll: [
		"Doesn't matter, going for it anyway!",
		'The comeback starts now!',
		'Just need one good roll!',
	],
	opponent_dicee: ["Nice! But I'm coming for you!", 'Game on!', 'Challenge accepted! 💪'],
	taking_lead: ["That's right! 🔥", 'Top of the leaderboard!', "Can't stop won't stop!"],
	falling_behind: ['Just getting warmed up!', 'Watch the comeback!', 'This is where it gets fun!'],
	final_round: ['ALL OR NOTHING!', 'Final round, maximum effort!', "Let's end this with a bang!"],
	game_won: ['VICTORY! 🏆', "That's how you play!", 'GG! What a rush!'],
	game_lost: ['Respect! You earned it!', 'Good game! Rematch?', "Next time I'm going even bigger!"],
	close_game: ['THIS IS INTENSE!', 'Love a close game!', 'Heart is POUNDING!'],
};

/**
 * Chat responses for Professor (expert, analytical).
 */
const PROFESSOR_RESPONSES: Record<ChatTrigger, string[]> = {
	game_start: ["Let's begin.", 'Good luck to all.', 'May probability be with you.'],
	my_turn_start: ['Calculating...', 'Analyzing options...', 'Let me consider this.'],
	rolled_dicee: [
		'Dicee. Probability: 0.046%.',
		'Excellent. Five of a kind.',
		'Statistically improbable, yet here we are.',
	],
	scored_dicee: ['50 points. Optimal outcome.', 'Maximum value achieved.', 'As calculated.'],
	scored_zero: [
		'Expected value optimization.',
		'Necessary sacrifice for future gains.',
		'The math supports this decision.',
	],
	good_roll: ['Favorable outcome.', 'Above expected value.', 'Acceptable.'],
	bad_roll: ['Suboptimal, but manageable.', 'Variance is inevitable.', 'Adjusting strategy.'],
	opponent_dicee: ['Well rolled.', 'Impressive probability.', 'Noted.'],
	taking_lead: ['Currently optimal position.', 'Lead acquired.', 'Ahead by expected margins.'],
	falling_behind: [
		'Recalculating approach.',
		'Still within recovery parameters.',
		'Adjusting for deficit.',
	],
	final_round: [
		'Final optimization round.',
		'Concluding calculations.',
		'Terminal decision point.',
	],
	game_won: [
		'Victory achieved. Well played.',
		'Optimal outcome. Good game.',
		'The math prevailed.',
	],
	game_lost: [
		'Variance favored you. Well played.',
		'Congratulations on your victory.',
		'A learning experience.',
	],
	close_game: [
		'Margin within standard deviation.',
		'Competitive equilibrium.',
		'Interesting game state.',
	],
};

/**
 * Chat responses for Charlie (chaos, random).
 */
const CHARLIE_RESPONSES: Record<ChatTrigger, string[]> = {
	game_start: [
		'CHAOS TIME! 🌀',
		'Let the randomness begin!',
		"Who knows what'll happen?!",
		'Buckle up! 🎢',
	],
	my_turn_start: [
		'Eeny meeny miny moe!',
		"Let's see what chaos brings!",
		'Random strategy: ACTIVATE!',
		'*rolls dice with eyes closed*',
	],
	rolled_dicee: [
		'WAIT WHAT?! HOW?!',
		'CHAOS DICEE! 🌀🎲',
		"I DIDN'T EVEN TRY FOR THAT!",
		'The universe provides!',
	],
	scored_dicee: ['Accidental genius!', 'Chaos wins again!', "I have no idea what I'm doing! 😂"],
	scored_zero: [
		'Zero is a number too!',
		'Part of the plan! (There is no plan)',
		'Embrace the void! 🕳️',
		'Math is just a suggestion!',
	],
	good_roll: [
		'Ooh shiny!',
		'The dice gods smile upon me!',
		'Was that good? I think that was good!',
	],
	bad_roll: [
		'The dice have spoken!',
		'Chaos is chaos!',
		"It's all part of the journey!",
		'Plot twist! 📖',
	],
	opponent_dicee: ['Ooooh fancy!', 'Show off! 😜', 'The chaos spreads!'],
	taking_lead: [
		"Wait I'm winning?! HOW?!",
		'Chaos strategy working?!',
		"This wasn't supposed to happen!",
	],
	falling_behind: [
		'Points are just numbers!',
		'Winning is overrated anyway!',
		'The real treasure was the chaos we made!',
	],
	final_round: [
		'FINAL CHAOS ROUND!',
		'One last dance with randomness!',
		"Let's see how this ends! 🎭",
	],
	game_won: [
		'I WON?! THE CHAOS WON?! 🎉',
		'Strategy is dead! Long live chaos!',
		'I literally have no idea how!',
	],
	game_lost: [
		"Chaos doesn't care about winning!",
		'The journey was the destination!',
		'GG! That was wild! 🌀',
	],
	close_game: [
		'MAXIMUM CHAOS ACHIEVED!',
		"This is exactly what I wanted! (It wasn't)",
		'The suspense! 😱',
	],
};

// ============================================================================
// Response Selection
// ============================================================================

/**
 * Get response templates for a profile.
 */
function getResponsesForProfile(profileId: string): Record<ChatTrigger, string[]> {
	switch (profileId) {
		case 'riley':
			return RILEY_RESPONSES;
		case 'carmen':
			return CARMEN_RESPONSES;
		case 'liam':
			return LIAM_RESPONSES;
		case 'professor':
			return PROFESSOR_RESPONSES;
		case 'charlie':
			return CHARLIE_RESPONSES;
		default:
			return CARMEN_RESPONSES; // Default to balanced
	}
}

/**
 * Simple seeded random for deterministic selection.
 * Uses game state to ensure same response for same situation.
 */
function seededRandom(seed: number): number {
	const x = Math.sin(seed) * 10000;
	return x - Math.floor(x);
}

/**
 * Generate a seed from context for deterministic responses.
 */
function generateSeed(context: ChatContext): number {
	let seed = 0;
	seed += context.trigger.length * 17;
	seed += context.profile.id.length * 31;
	if (context.gameContext) {
		seed += context.gameContext.round * 101;
		seed += context.gameContext.rollsRemaining * 53;
	}
	if (context.score !== undefined) {
		seed += context.score * 7;
	}
	return seed;
}

/**
 * Select a response from templates using seeded randomness.
 */
function selectResponse(templates: string[], seed: number): string {
	const index = Math.floor(seededRandom(seed) * templates.length);
	return templates[index];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate an AI chat response for a game event.
 *
 * @param context - Chat context including trigger, profile, and game state
 * @returns Chat message string, or null if AI chooses not to chat
 */
export function generateChatResponse(context: ChatContext): string | null {
	const { trigger, profile } = context;

	// Check chattiness - AI may choose not to respond
	const chattiness = profile.traits.chattiness;
	const seed = generateSeed(context);
	const chatRoll = seededRandom(seed + 999);

	// Higher chattiness = more likely to chat
	// Always chat for major events (dicee, game end)
	const majorEvents: ChatTrigger[] = [
		'rolled_dicee',
		'scored_dicee',
		'game_won',
		'game_lost',
		'game_start',
	];

	if (!majorEvents.includes(trigger) && chatRoll > chattiness) {
		return null; // AI chooses not to chat this time
	}

	// Get responses for this profile
	const responses = getResponsesForProfile(profile.id);
	const templates = responses[trigger];

	if (!templates || templates.length === 0) {
		return null;
	}

	return selectResponse(templates, seed);
}

/**
 * Check if AI should react to an opponent's action.
 *
 * @param profile - AI profile
 * @param trigger - Event trigger
 * @returns true if AI should react
 */
export function shouldReact(profile: AIProfile, trigger: ChatTrigger): boolean {
	const chattiness = profile.traits.chattiness;

	// Always react to opponent dicees if somewhat chatty
	if (trigger === 'opponent_dicee' && chattiness > 0.3) {
		return true;
	}

	// React to close games if chatty
	if (trigger === 'close_game' && chattiness > 0.5) {
		return true;
	}

	return chattiness > 0.7; // Very chatty AIs react to most things
}

/**
 * Analyze dice roll quality for chat triggers.
 *
 * @param dice - Current dice values
 * @param rollNumber - Which roll this is (1, 2, or 3)
 * @returns 'good_roll', 'bad_roll', or null
 */
export function analyzeRollQuality(
	dice: DiceArray,
	rollNumber: number,
): 'good_roll' | 'bad_roll' | null {
	// Count matches
	const counts = new Map<number, number>();
	for (const d of dice) {
		counts.set(d, (counts.get(d) ?? 0) + 1);
	}

	const maxCount = Math.max(...counts.values());
	const uniqueCount = counts.size;

	// Check for straights
	const sorted = [...new Set(dice)].sort((a, b) => a - b);
	const hasRun4 =
		sorted.length >= 4 &&
		sorted.some(
			(_, i) =>
				i <= sorted.length - 4 &&
				sorted[i + 1] === sorted[i] + 1 &&
				sorted[i + 2] === sorted[i] + 2 &&
				sorted[i + 3] === sorted[i] + 3,
		);

	// Good roll indicators
	if (maxCount >= 4) return 'good_roll'; // Four of a kind
	if (maxCount === 3 && uniqueCount === 2) return 'good_roll'; // Full house potential
	if (hasRun4) return 'good_roll'; // Straight potential
	if (maxCount === 3 && rollNumber === 1) return 'good_roll'; // Three of a kind on first roll

	// Bad roll indicators (only on later rolls)
	if (rollNumber >= 2 && maxCount <= 2 && !hasRun4) return 'bad_roll';

	return null; // Neutral roll
}

/**
 * Get all chat triggers for a scoring event.
 *
 * @param category - Category scored
 * @param score - Points scored
 * @param isDiceeBonus - Whether this triggered a Dicee bonus
 * @param context - Game context
 * @returns Array of applicable triggers
 */
export function getScoreTriggers(
	category: Category,
	score: number,
	isDiceeBonus: boolean,
	context: GameContext,
): ChatTrigger[] {
	const triggers: ChatTrigger[] = [];

	// Dicee events
	if (category === 'dicee' && score === 50) {
		triggers.push('scored_dicee');
	}
	if (isDiceeBonus) {
		triggers.push('scored_dicee');
	}

	// Zero score
	if (score === 0) {
		triggers.push('scored_zero');
	}

	// Position changes
	if (context.scoreDifferential > 0 && context.scoreDifferential <= 20) {
		triggers.push('taking_lead');
	}
	if (context.scoreDifferential < -20) {
		triggers.push('falling_behind');
	}

	// Final round
	if (context.isFinalRound) {
		triggers.push('final_round');
	}

	return triggers;
}

# Dicee: Lobby Chat Implementation Addendum

**Addendum to:** Durable Objects Migration Guide v1.0  
**Date:** December 7, 2025  
**Scope:** Text chat, typing indicators, quick chat, reactions, message history  
**Estimated Effort:** 4-6 hours

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Type Definitions](#2-type-definitions)
3. [Server Implementation](#3-server-implementation)
4. [Client Implementation](#4-client-implementation)
5. [Mobile-First Layout](#5-mobile-first-layout)
6. [Extensibility Hooks](#6-extensibility-hooks)
7. [Testing](#7-testing)

---

## 1. Feature Overview

### MVP Features

| Feature | Description | Rate Limit |
|---------|-------------|------------|
| **Text Chat** | Free-form messages, 500 char max | 1 msg/sec |
| **Typing Indicators** | Shows who's typing | 1 update/2sec |
| **Quick Chat** | 6 preset Yahtzee-themed messages | 1 msg/sec (shared with text) |
| **Reactions** | 5 emoji reactions on messages | 5 reactions/sec |
| **Message History** | Last 20 messages on join | N/A |

### Message Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Text Input  │  │ Quick Chat  │  │ Reaction Picker     │  │
│  │ + Send Btn  │  │ Buttons     │  │ (on message hover)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              WebSocket.send(JSON)                        ││
│  │  { type: 'CHAT' | 'QUICK_CHAT' | 'REACTION' | ... }     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Durable Object                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   handleMessage()                        ││
│  │  1. Validate schema (Zod)                                ││
│  │  2. Check rate limit                                     ││
│  │  3. Process & persist (if needed)                        ││
│  │  4. Broadcast to room                                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     All Clients                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  onMessage → Update chat store → Re-render UI           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Type Definitions

### 2.1 Shared Types

**`packages/cloudflare-do/src/chat/types.ts`**
```typescript
// ═══════════════════════════════════════════════════════════
// Chat Message Types
// ═══════════════════════════════════════════════════════════

export interface ChatMessage {
  id: string;                    // Unique message ID (nanoid)
  type: 'text' | 'quick' | 'system';
  userId: string;
  displayName: string;
  content: string;               // Message text or quick chat key
  timestamp: number;             // Unix ms
  reactions: MessageReactions;   // Aggregated reactions
}

export interface MessageReactions {
  '👍': string[];  // Array of userIds who reacted
  '🎲': string[];
  '😱': string[];
  '💀': string[];
  '🎉': string[];
}

export type ReactionEmoji = keyof MessageReactions;

export const REACTION_EMOJIS: ReactionEmoji[] = ['👍', '🎲', '😱', '💀', '🎉'];

// ═══════════════════════════════════════════════════════════
// Quick Chat Definitions
// ═══════════════════════════════════════════════════════════

export type QuickChatKey = 
  | 'nice_roll'
  | 'good_game'
  | 'your_turn'
  | 'yahtzee'
  | 'ouch'
  | 'thinking';

export const QUICK_CHAT_MESSAGES: Record<QuickChatKey, { emoji: string; text: string }> = {
  nice_roll:  { emoji: '🎲', text: 'Nice roll!' },
  good_game:  { emoji: '👏', text: 'Good game!' },
  your_turn:  { emoji: '⏰', text: 'Your turn!' },
  yahtzee:    { emoji: '🎉', text: 'YAHTZEE!' },
  ouch:       { emoji: '💀', text: 'Ouch...' },
  thinking:   { emoji: '🤔', text: 'Hmm, let me think...' },
};

// ═══════════════════════════════════════════════════════════
// Typing Indicator
// ═══════════════════════════════════════════════════════════

export interface TypingState {
  userId: string;
  displayName: string;
  startedAt: number;
}

// ═══════════════════════════════════════════════════════════
// Client → Server Messages
// ═══════════════════════════════════════════════════════════

export type ChatClientMessage =
  | { type: 'CHAT'; payload: { content: string } }
  | { type: 'QUICK_CHAT'; payload: { key: QuickChatKey } }
  | { type: 'REACTION'; payload: { messageId: string; emoji: ReactionEmoji; action: 'add' | 'remove' } }
  | { type: 'TYPING_START' }
  | { type: 'TYPING_STOP' };

// ═══════════════════════════════════════════════════════════
// Server → Client Messages
// ═══════════════════════════════════════════════════════════

export type ChatServerMessage =
  | { type: 'CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'CHAT_HISTORY'; payload: ChatMessage[] }
  | { type: 'REACTION_UPDATE'; payload: { messageId: string; reactions: MessageReactions } }
  | { type: 'TYPING_UPDATE'; payload: { typing: TypingState[] } }
  | { type: 'CHAT_ERROR'; payload: { code: string; message: string } };

// ═══════════════════════════════════════════════════════════
// Rate Limiting
// ═══════════════════════════════════════════════════════════

export interface RateLimitState {
  lastMessageAt: number;
  lastTypingAt: number;
  reactionCount: number;
  reactionWindowStart: number;
}

export const RATE_LIMITS = {
  MESSAGE_INTERVAL_MS: 1000,      // 1 message per second
  TYPING_INTERVAL_MS: 2000,       // 1 typing update per 2 seconds
  REACTIONS_PER_WINDOW: 5,        // 5 reactions per window
  REACTION_WINDOW_MS: 1000,       // 1 second window
  MAX_MESSAGE_LENGTH: 500,
  MESSAGE_HISTORY_SIZE: 20,
  TYPING_TIMEOUT_MS: 3000,        // Auto-clear typing after 3s
} as const;
```

### 2.2 Zod Schemas

**`packages/cloudflare-do/src/chat/schemas.ts`**
```typescript
import { z } from 'zod';
import { QUICK_CHAT_MESSAGES, REACTION_EMOJIS, RATE_LIMITS } from './types';

export const chatMessageSchema = z.object({
  type: z.literal('CHAT'),
  payload: z.object({
    content: z
      .string()
      .min(1, 'Message cannot be empty')
      .max(RATE_LIMITS.MAX_MESSAGE_LENGTH, `Message cannot exceed ${RATE_LIMITS.MAX_MESSAGE_LENGTH} characters`)
      .transform(s => s.trim()),
  }),
});

export const quickChatSchema = z.object({
  type: z.literal('QUICK_CHAT'),
  payload: z.object({
    key: z.enum(Object.keys(QUICK_CHAT_MESSAGES) as [string, ...string[]]),
  }),
});

export const reactionSchema = z.object({
  type: z.literal('REACTION'),
  payload: z.object({
    messageId: z.string().min(1),
    emoji: z.enum(REACTION_EMOJIS as [string, ...string[]]),
    action: z.enum(['add', 'remove']),
  }),
});

export const typingSchema = z.object({
  type: z.enum(['TYPING_START', 'TYPING_STOP']),
});

// Combined schema for all chat-related messages
export const chatClientMessageSchema = z.discriminatedUnion('type', [
  chatMessageSchema,
  quickChatSchema,
  reactionSchema,
  typingSchema,
]);
```

---

## 3. Server Implementation

### 3.1 Chat Manager Class

**`packages/cloudflare-do/src/chat/ChatManager.ts`**
```typescript
import { nanoid } from 'nanoid';
import type { DurableObjectState } from '@cloudflare/workers-types';
import {
  type ChatMessage,
  type MessageReactions,
  type ReactionEmoji,
  type QuickChatKey,
  type TypingState,
  type RateLimitState,
  QUICK_CHAT_MESSAGES,
  REACTION_EMOJIS,
  RATE_LIMITS,
} from './types';

export class ChatManager {
  private typingUsers: Map<string, TypingState> = new Map();
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private rateLimits: Map<string, RateLimitState> = new Map();

  constructor(private ctx: DurableObjectState) {}

  // ─────────────────────────────────────────────────────────
  // Message History
  // ─────────────────────────────────────────────────────────

  async getHistory(): Promise<ChatMessage[]> {
    return (await this.ctx.storage.get<ChatMessage[]>('chat_history')) ?? [];
  }

  private async saveMessage(message: ChatMessage): Promise<void> {
    const history = await this.getHistory();
    history.push(message);
    
    // Keep only last N messages
    while (history.length > RATE_LIMITS.MESSAGE_HISTORY_SIZE) {
      history.shift();
    }
    
    await this.ctx.storage.put('chat_history', history);
  }

  private async updateMessageReactions(
    messageId: string,
    reactions: MessageReactions
  ): Promise<void> {
    const history = await this.getHistory();
    const message = history.find(m => m.id === messageId);
    
    if (message) {
      message.reactions = reactions;
      await this.ctx.storage.put('chat_history', history);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Rate Limiting
  // ─────────────────────────────────────────────────────────

  private getRateLimitState(userId: string): RateLimitState {
    if (!this.rateLimits.has(userId)) {
      this.rateLimits.set(userId, {
        lastMessageAt: 0,
        lastTypingAt: 0,
        reactionCount: 0,
        reactionWindowStart: 0,
      });
    }
    return this.rateLimits.get(userId)!;
  }

  private checkMessageRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
    const state = this.getRateLimitState(userId);
    const now = Date.now();
    const elapsed = now - state.lastMessageAt;

    if (elapsed < RATE_LIMITS.MESSAGE_INTERVAL_MS) {
      return {
        allowed: false,
        retryAfterMs: RATE_LIMITS.MESSAGE_INTERVAL_MS - elapsed,
      };
    }

    state.lastMessageAt = now;
    return { allowed: true };
  }

  private checkTypingRateLimit(userId: string): boolean {
    const state = this.getRateLimitState(userId);
    const now = Date.now();

    if (now - state.lastTypingAt < RATE_LIMITS.TYPING_INTERVAL_MS) {
      return false;
    }

    state.lastTypingAt = now;
    return true;
  }

  private checkReactionRateLimit(userId: string): boolean {
    const state = this.getRateLimitState(userId);
    const now = Date.now();

    // Reset window if expired
    if (now - state.reactionWindowStart > RATE_LIMITS.REACTION_WINDOW_MS) {
      state.reactionCount = 0;
      state.reactionWindowStart = now;
    }

    if (state.reactionCount >= RATE_LIMITS.REACTIONS_PER_WINDOW) {
      return false;
    }

    state.reactionCount++;
    return true;
  }

  // ─────────────────────────────────────────────────────────
  // Message Handling
  // ─────────────────────────────────────────────────────────

  async handleTextMessage(
    userId: string,
    displayName: string,
    content: string
  ): Promise<{ success: true; message: ChatMessage } | { success: false; error: string; retryAfterMs?: number }> {
    // Rate limit check
    const rateLimit = this.checkMessageRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: 'Rate limited. Please wait before sending another message.',
        retryAfterMs: rateLimit.retryAfterMs,
      };
    }

    // Create message
    const message: ChatMessage = {
      id: nanoid(12),
      type: 'text',
      userId,
      displayName,
      content,
      timestamp: Date.now(),
      reactions: this.createEmptyReactions(),
    };

    // Persist
    await this.saveMessage(message);

    // Clear typing indicator for this user
    this.clearTyping(userId);

    return { success: true, message };
  }

  async handleQuickChat(
    userId: string,
    displayName: string,
    key: QuickChatKey
  ): Promise<{ success: true; message: ChatMessage } | { success: false; error: string; retryAfterMs?: number }> {
    // Rate limit check (shared with text messages)
    const rateLimit = this.checkMessageRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: 'Rate limited. Please wait before sending another message.',
        retryAfterMs: rateLimit.retryAfterMs,
      };
    }

    const quickChat = QUICK_CHAT_MESSAGES[key];
    const message: ChatMessage = {
      id: nanoid(12),
      type: 'quick',
      userId,
      displayName,
      content: `${quickChat.emoji} ${quickChat.text}`,
      timestamp: Date.now(),
      reactions: this.createEmptyReactions(),
    };

    await this.saveMessage(message);
    this.clearTyping(userId);

    return { success: true, message };
  }

  async handleReaction(
    userId: string,
    messageId: string,
    emoji: ReactionEmoji,
    action: 'add' | 'remove'
  ): Promise<{ success: true; reactions: MessageReactions } | { success: false; error: string }> {
    // Rate limit check
    if (!this.checkReactionRateLimit(userId)) {
      return { success: false, error: 'Too many reactions. Please slow down.' };
    }

    // Find message in history
    const history = await this.getHistory();
    const message = history.find(m => m.id === messageId);

    if (!message) {
      return { success: false, error: 'Message not found' };
    }

    // Update reactions
    const reactions = message.reactions;
    const userIndex = reactions[emoji].indexOf(userId);

    if (action === 'add' && userIndex === -1) {
      reactions[emoji].push(userId);
    } else if (action === 'remove' && userIndex !== -1) {
      reactions[emoji].splice(userIndex, 1);
    }

    // Persist
    await this.updateMessageReactions(messageId, reactions);

    return { success: true, reactions };
  }

  // ─────────────────────────────────────────────────────────
  // Typing Indicators
  // ─────────────────────────────────────────────────────────

  handleTypingStart(userId: string, displayName: string): TypingState[] | null {
    // Rate limit check
    if (!this.checkTypingRateLimit(userId)) {
      return null;
    }

    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set typing state
    this.typingUsers.set(userId, {
      userId,
      displayName,
      startedAt: Date.now(),
    });

    // Auto-clear after timeout
    const timeout = setTimeout(() => {
      this.clearTyping(userId);
    }, RATE_LIMITS.TYPING_TIMEOUT_MS);
    this.typingTimeouts.set(userId, timeout);

    return this.getTypingUsers();
  }

  handleTypingStop(userId: string): TypingState[] {
    this.clearTyping(userId);
    return this.getTypingUsers();
  }

  private clearTyping(userId: string): void {
    this.typingUsers.delete(userId);
    const timeout = this.typingTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(userId);
    }
  }

  getTypingUsers(): TypingState[] {
    return Array.from(this.typingUsers.values());
  }

  // ─────────────────────────────────────────────────────────
  // System Messages
  // ─────────────────────────────────────────────────────────

  async createSystemMessage(content: string): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: nanoid(12),
      type: 'system',
      userId: 'system',
      displayName: 'System',
      content,
      timestamp: Date.now(),
      reactions: this.createEmptyReactions(),
    };

    await this.saveMessage(message);
    return message;
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  private createEmptyReactions(): MessageReactions {
    return {
      '👍': [],
      '🎲': [],
      '😱': [],
      '💀': [],
      '🎉': [],
    };
  }

  // Clean up when user disconnects
  handleDisconnect(userId: string): void {
    this.clearTyping(userId);
    this.rateLimits.delete(userId);
  }
}
```

### 3.2 GameRoom Integration

Add these methods to `packages/cloudflare-do/src/GameRoom.ts`:

```typescript
import { ChatManager } from './chat/ChatManager';
import { chatClientMessageSchema } from './chat/schemas';
import type {
  ChatClientMessage,
  ChatServerMessage,
  QuickChatKey,
  ReactionEmoji,
} from './chat/types';

export class GameRoom extends DurableObject<Env> {
  private chatManager: ChatManager;
  // ... existing properties

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.gameManager = new GameStateManager(ctx);
    this.chatManager = new ChatManager(ctx);  // Add this
  }

  // ─────────────────────────────────────────────────────────
  // Add to onConnect() - Send chat history to new connections
  // ─────────────────────────────────────────────────────────

  private async onConnect(ws: WebSocket, connState: ConnectionState): Promise<void> {
    // ... existing room state logic ...

    // Send chat history
    const chatHistory = await this.chatManager.getHistory();
    ws.send(JSON.stringify({
      type: 'CHAT_HISTORY',
      payload: chatHistory,
    } satisfies ChatServerMessage));

    // Send current typing state
    const typingUsers = this.chatManager.getTypingUsers();
    if (typingUsers.length > 0) {
      ws.send(JSON.stringify({
        type: 'TYPING_UPDATE',
        payload: { typing: typingUsers },
      } satisfies ChatServerMessage));
    }

    // ... rest of existing onConnect logic ...
    
    // System message for join
    const joinMessage = await this.chatManager.createSystemMessage(
      `${connState.displayName} joined the room`
    );
    this.broadcast({ type: 'CHAT_MESSAGE', payload: joinMessage });
  }

  // ─────────────────────────────────────────────────────────
  // Add to handleMessage() switch statement
  // ─────────────────────────────────────────────────────────

  private async handleMessage(
    ws: WebSocket,
    connState: ConnectionState,
    message: { type: string; payload?: unknown }
  ): Promise<void> {
    const { type, payload } = message;

    switch (type) {
      // ... existing cases ...

      case 'CHAT':
        await this.handleChat(ws, connState, payload);
        break;

      case 'QUICK_CHAT':
        await this.handleQuickChat(ws, connState, payload);
        break;

      case 'REACTION':
        await this.handleReaction(ws, connState, payload);
        break;

      case 'TYPING_START':
        this.handleTypingStart(connState);
        break;

      case 'TYPING_STOP':
        this.handleTypingStop(connState);
        break;

      // ... existing default case ...
    }
  }

  // ─────────────────────────────────────────────────────────
  // Chat Handlers
  // ─────────────────────────────────────────────────────────

  private async handleChat(
    ws: WebSocket,
    connState: ConnectionState,
    payload: unknown
  ): Promise<void> {
    // Validate
    const parsed = chatClientMessageSchema.safeParse({ type: 'CHAT', payload });
    if (!parsed.success) {
      this.sendChatError(ws, 'INVALID_MESSAGE', parsed.error.message);
      return;
    }

    const { content } = parsed.data.payload;
    const result = await this.chatManager.handleTextMessage(
      connState.userId,
      connState.displayName,
      content
    );

    if (!result.success) {
      this.sendChatError(ws, 'RATE_LIMITED', result.error);
      return;
    }

    // Broadcast to all
    this.broadcast({
      type: 'CHAT_MESSAGE',
      payload: result.message,
    } satisfies ChatServerMessage);
  }

  private async handleQuickChat(
    ws: WebSocket,
    connState: ConnectionState,
    payload: unknown
  ): Promise<void> {
    const parsed = chatClientMessageSchema.safeParse({ type: 'QUICK_CHAT', payload });
    if (!parsed.success) {
      this.sendChatError(ws, 'INVALID_MESSAGE', parsed.error.message);
      return;
    }

    const { key } = parsed.data.payload as { key: QuickChatKey };
    const result = await this.chatManager.handleQuickChat(
      connState.userId,
      connState.displayName,
      key
    );

    if (!result.success) {
      this.sendChatError(ws, 'RATE_LIMITED', result.error);
      return;
    }

    this.broadcast({
      type: 'CHAT_MESSAGE',
      payload: result.message,
    } satisfies ChatServerMessage);
  }

  private async handleReaction(
    ws: WebSocket,
    connState: ConnectionState,
    payload: unknown
  ): Promise<void> {
    const parsed = chatClientMessageSchema.safeParse({ type: 'REACTION', payload });
    if (!parsed.success) {
      this.sendChatError(ws, 'INVALID_MESSAGE', parsed.error.message);
      return;
    }

    const { messageId, emoji, action } = parsed.data.payload as {
      messageId: string;
      emoji: ReactionEmoji;
      action: 'add' | 'remove';
    };

    const result = await this.chatManager.handleReaction(
      connState.userId,
      messageId,
      emoji,
      action
    );

    if (!result.success) {
      this.sendChatError(ws, 'REACTION_FAILED', result.error);
      return;
    }

    // Broadcast reaction update to all
    this.broadcast({
      type: 'REACTION_UPDATE',
      payload: { messageId, reactions: result.reactions },
    } satisfies ChatServerMessage);
  }

  private handleTypingStart(connState: ConnectionState): void {
    const typingUsers = this.chatManager.handleTypingStart(
      connState.userId,
      connState.displayName
    );

    if (typingUsers) {
      this.broadcast({
        type: 'TYPING_UPDATE',
        payload: { typing: typingUsers },
      } satisfies ChatServerMessage);
    }
  }

  private handleTypingStop(connState: ConnectionState): void {
    const typingUsers = this.chatManager.handleTypingStop(connState.userId);
    this.broadcast({
      type: 'TYPING_UPDATE',
      payload: { typing: typingUsers },
    } satisfies ChatServerMessage);
  }

  private sendChatError(ws: WebSocket, code: string, message: string): void {
    ws.send(JSON.stringify({
      type: 'CHAT_ERROR',
      payload: { code, message },
    } satisfies ChatServerMessage));
  }

  // ─────────────────────────────────────────────────────────
  // Update onDisconnect()
  // ─────────────────────────────────────────────────────────

  private async onDisconnect(
    connState: ConnectionState,
    code: number,
    reason: string
  ): Promise<void> {
    // Clean up chat state
    this.chatManager.handleDisconnect(connState.userId);

    // Broadcast typing update (in case they were typing)
    this.broadcast({
      type: 'TYPING_UPDATE',
      payload: { typing: this.chatManager.getTypingUsers() },
    } satisfies ChatServerMessage);

    // System message for leave
    const leaveMessage = await this.chatManager.createSystemMessage(
      `${connState.displayName} left the room`
    );
    this.broadcast({ type: 'CHAT_MESSAGE', payload: leaveMessage });

    // ... existing disconnect logic ...
  }
}
```

### 3.3 Dependencies

Add to `packages/cloudflare-do/package.json`:

```json
{
  "dependencies": {
    "nanoid": "^5.0.9",
    "zod": "^3.24.1"
  }
}
```

---

## 4. Client Implementation

### 4.1 Chat Store

**`packages/web/src/lib/stores/chat.svelte.ts`**
```typescript
import type {
  ChatMessage,
  MessageReactions,
  TypingState,
  QuickChatKey,
  ReactionEmoji,
  ChatServerMessage,
} from '@dicee/cloudflare-do/chat/types';
import { roomService } from '$lib/services/roomService.svelte';

// ═══════════════════════════════════════════════════════════
// Chat Store (Svelte 5 Runes)
// ═══════════════════════════════════════════════════════════

class ChatStore {
  // Reactive state
  messages = $state<ChatMessage[]>([]);
  typingUsers = $state<TypingState[]>([]);
  isRateLimited = $state(false);
  rateLimitResetAt = $state<number | null>(null);
  error = $state<string | null>(null);

  // Derived state
  hasMessages = $derived(this.messages.length > 0);
  typingDisplay = $derived(this.formatTypingDisplay());

  // Local state (non-reactive)
  private currentUserId: string | null = null;
  private typingDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyTyping = false;

  // ─────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────

  init(userId: string): void {
    this.currentUserId = userId;
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    roomService.on<ChatMessage>('CHAT_MESSAGE', (message) => {
      this.messages = [...this.messages, message];
      this.scrollToBottom();
    });

    roomService.on<ChatMessage[]>('CHAT_HISTORY', (history) => {
      this.messages = history;
      this.scrollToBottom();
    });

    roomService.on<{ messageId: string; reactions: MessageReactions }>(
      'REACTION_UPDATE',
      ({ messageId, reactions }) => {
        this.messages = this.messages.map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        );
      }
    );

    roomService.on<{ typing: TypingState[] }>('TYPING_UPDATE', ({ typing }) => {
      // Filter out current user
      this.typingUsers = typing.filter((t) => t.userId !== this.currentUserId);
    });

    roomService.on<{ code: string; message: string }>('CHAT_ERROR', ({ code, message }) => {
      if (code === 'RATE_LIMITED') {
        this.isRateLimited = true;
        this.rateLimitResetAt = Date.now() + 1000;
        setTimeout(() => {
          this.isRateLimited = false;
          this.rateLimitResetAt = null;
        }, 1000);
      }
      this.error = message;
      setTimeout(() => (this.error = null), 3000);
    });
  }

  // ─────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────

  sendMessage(content: string): void {
    if (!content.trim() || this.isRateLimited) return;

    roomService.send({
      type: 'CHAT',
      payload: { content: content.trim() },
    });

    this.stopTyping();
  }

  sendQuickChat(key: QuickChatKey): void {
    if (this.isRateLimited) return;

    roomService.send({
      type: 'QUICK_CHAT',
      payload: { key },
    });
  }

  toggleReaction(messageId: string, emoji: ReactionEmoji): void {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message || !this.currentUserId) return;

    const hasReacted = message.reactions[emoji].includes(this.currentUserId);

    roomService.send({
      type: 'REACTION',
      payload: {
        messageId,
        emoji,
        action: hasReacted ? 'remove' : 'add',
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // Typing Indicators
  // ─────────────────────────────────────────────────────────

  handleInputChange(): void {
    // Debounce typing start
    if (!this.isCurrentlyTyping) {
      this.isCurrentlyTyping = true;
      roomService.send({ type: 'TYPING_START' });
    }

    // Reset stop timer
    if (this.typingDebounceTimer) {
      clearTimeout(this.typingDebounceTimer);
    }

    // Auto-stop after 2 seconds of no input
    this.typingDebounceTimer = setTimeout(() => {
      this.stopTyping();
    }, 2000);
  }

  stopTyping(): void {
    if (this.isCurrentlyTyping) {
      this.isCurrentlyTyping = false;
      roomService.send({ type: 'TYPING_STOP' });
    }
    if (this.typingDebounceTimer) {
      clearTimeout(this.typingDebounceTimer);
      this.typingDebounceTimer = null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  private formatTypingDisplay(): string {
    const names = this.typingUsers.map((t) => t.displayName);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others are typing...`;
  }

  private scrollToBottom(): void {
    // Defer to allow DOM update
    setTimeout(() => {
      const container = document.getElementById('chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  hasUserReacted(messageId: string, emoji: ReactionEmoji): boolean {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message || !this.currentUserId) return false;
    return message.reactions[emoji].includes(this.currentUserId);
  }

  // ─────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────

  reset(): void {
    this.messages = [];
    this.typingUsers = [];
    this.isRateLimited = false;
    this.error = null;
    this.currentUserId = null;
    this.stopTyping();
  }
}

export const chatStore = new ChatStore();
```

### 4.2 Chat Components

**`packages/web/src/lib/components/chat/ChatPanel.svelte`**
```svelte
<script lang="ts">
  import { chatStore } from '$lib/stores/chat.svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import QuickChatBar from './QuickChatBar.svelte';
  import TypingIndicator from './TypingIndicator.svelte';

  interface Props {
    collapsed?: boolean;
    onToggle?: () => void;
  }

  let { collapsed = false, onToggle }: Props = $props();
</script>

<div class="chat-panel" class:collapsed>
  <!-- Header (mobile toggle) -->
  <button class="chat-header" onclick={onToggle} aria-expanded={!collapsed}>
    <span class="chat-title">💬 Chat</span>
    {#if collapsed && chatStore.messages.length > 0}
      <span class="unread-badge">{chatStore.messages.length}</span>
    {/if}
    <span class="toggle-icon">{collapsed ? '▲' : '▼'}</span>
  </button>

  {#if !collapsed}
    <div class="chat-body">
      <!-- Messages -->
      <div id="chat-messages" class="messages-container">
        {#if !chatStore.hasMessages}
          <p class="empty-state">No messages yet. Say hello! 👋</p>
        {:else}
          {#each chatStore.messages as message (message.id)}
            <ChatMessage {message} />
          {/each}
        {/if}
      </div>

      <!-- Typing Indicator -->
      <TypingIndicator />

      <!-- Quick Chat -->
      <QuickChatBar />

      <!-- Input -->
      <ChatInput />

      <!-- Error Toast -->
      {#if chatStore.error}
        <div class="error-toast" role="alert">
          {chatStore.error}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100%;
    background: var(--surface-1);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  /* Mobile: Fixed bottom sheet */
  @media (max-width: 768px) {
    .chat-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 60vh;
      border-radius: 16px 16px 0 0;
      z-index: 100;
      transition: transform 0.3s ease;
    }

    .chat-panel.collapsed {
      transform: translateY(calc(100% - 48px));
    }
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--surface-2);
    border: none;
    cursor: pointer;
    font-weight: 600;
    color: var(--text-1);
    touch-action: manipulation;
  }

  .chat-title {
    flex: 1;
    text-align: left;
  }

  .unread-badge {
    background: var(--accent);
    color: white;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .toggle-icon {
    font-size: 12px;
    opacity: 0.6;
  }

  /* Desktop: Hide toggle */
  @media (min-width: 769px) {
    .chat-header {
      cursor: default;
    }
    .toggle-icon {
      display: none;
    }
  }

  .chat-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 0 12px 12px;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 0;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  .empty-state {
    text-align: center;
    color: var(--text-3);
    padding: 24px;
    font-size: 14px;
  }

  .error-toast {
    position: absolute;
    bottom: 80px;
    left: 12px;
    right: 12px;
    background: var(--error);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
```

**`packages/web/src/lib/components/chat/ChatMessage.svelte`**
```svelte
<script lang="ts">
  import { chatStore } from '$lib/stores/chat.svelte';
  import type { ChatMessage, ReactionEmoji } from '@dicee/cloudflare-do/chat/types';
  import ReactionBar from './ReactionBar.svelte';

  interface Props {
    message: ChatMessage;
  }

  let { message }: Props = $props();

  let showReactions = $state(false);

  const isSystem = $derived(message.type === 'system');
  const isQuick = $derived(message.type === 'quick');
  const timeDisplay = $derived(formatTime(message.timestamp));
  const totalReactions = $derived(
    Object.values(message.reactions).reduce((sum, arr) => sum + arr.length, 0)
  );

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleReaction(emoji: ReactionEmoji): void {
    chatStore.toggleReaction(message.id, emoji);
  }
</script>

<div
  class="message"
  class:system={isSystem}
  class:quick={isQuick}
  onmouseenter={() => (showReactions = true)}
  onmouseleave={() => (showReactions = false)}
  ontouchstart={() => (showReactions = !showReactions)}
  role="article"
  aria-label="Chat message from {message.displayName}"
>
  {#if isSystem}
    <p class="system-text">{message.content}</p>
  {:else}
    <div class="message-header">
      <span class="author">{message.displayName}</span>
      <span class="time">{timeDisplay}</span>
    </div>
    <p class="content" class:quick-content={isQuick}>{message.content}</p>

    <!-- Reaction Summary -->
    {#if totalReactions > 0}
      <div class="reaction-summary">
        {#each Object.entries(message.reactions) as [emoji, users]}
          {#if users.length > 0}
            <button
              class="reaction-chip"
              class:active={chatStore.hasUserReacted(message.id, emoji as ReactionEmoji)}
              onclick={() => handleReaction(emoji as ReactionEmoji)}
              title="{users.length} {emoji}"
            >
              {emoji} {users.length}
            </button>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Reaction Picker (on hover/tap) -->
    {#if showReactions}
      <ReactionBar messageId={message.id} onReact={handleReaction} />
    {/if}
  {/if}
</div>

<style>
  .message {
    position: relative;
    padding: 8px 12px;
    margin-bottom: 8px;
    border-radius: 12px;
    background: var(--surface-2);
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  .message.system {
    background: transparent;
    text-align: center;
    padding: 4px;
  }

  .system-text {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
  }

  .message.quick {
    background: var(--accent-light);
  }

  .message-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }

  .author {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-1);
  }

  .time {
    font-size: 11px;
    color: var(--text-3);
  }

  .content {
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--text-2);
    word-wrap: break-word;
  }

  .quick-content {
    font-size: 16px;
  }

  .reaction-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .reaction-chip {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface-1);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reaction-chip:hover {
    background: var(--surface-3);
  }

  .reaction-chip.active {
    background: var(--accent-light);
    border-color: var(--accent);
  }
</style>
```

**`packages/web/src/lib/components/chat/ReactionBar.svelte`**
```svelte
<script lang="ts">
  import type { ReactionEmoji } from '@dicee/cloudflare-do/chat/types';
  import { REACTION_EMOJIS } from '@dicee/cloudflare-do/chat/types';

  interface Props {
    messageId: string;
    onReact: (emoji: ReactionEmoji) => void;
  }

  let { messageId, onReact }: Props = $props();
</script>

<div class="reaction-bar" role="group" aria-label="Add reaction">
  {#each REACTION_EMOJIS as emoji}
    <button
      class="reaction-btn"
      onclick={() => onReact(emoji)}
      aria-label="React with {emoji}"
    >
      {emoji}
    </button>
  {/each}
</div>

<style>
  .reaction-bar {
    position: absolute;
    top: -36px;
    right: 8px;
    display: flex;
    gap: 2px;
    padding: 4px 6px;
    background: var(--surface-1);
    border-radius: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    animation: popIn 0.15s ease;
    z-index: 10;
  }

  @keyframes popIn {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
  }

  .reaction-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    transition: all 0.1s ease;
  }

  .reaction-btn:hover {
    transform: scale(1.2);
    background: var(--surface-3);
  }

  .reaction-btn:active {
    transform: scale(1.1);
  }

  /* Touch-friendly sizing on mobile */
  @media (max-width: 768px) {
    .reaction-btn {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }
  }
</style>
```

**`packages/web/src/lib/components/chat/QuickChatBar.svelte`**
```svelte
<script lang="ts">
  import { chatStore } from '$lib/stores/chat.svelte';
  import { QUICK_CHAT_MESSAGES, type QuickChatKey } from '@dicee/cloudflare-do/chat/types';

  const quickChats = Object.entries(QUICK_CHAT_MESSAGES) as [QuickChatKey, { emoji: string; text: string }][];
</script>

<div class="quick-chat-bar">
  <div class="quick-chat-scroll">
    {#each quickChats as [key, { emoji, text }]}
      <button
        class="quick-chat-btn"
        onclick={() => chatStore.sendQuickChat(key)}
        disabled={chatStore.isRateLimited}
        title={text}
        aria-label={text}
      >
        <span class="emoji">{emoji}</span>
        <span class="label">{text}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .quick-chat-bar {
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }

  .quick-chat-scroll {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .quick-chat-scroll::-webkit-scrollbar {
    display: none;
  }

  .quick-chat-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface-1);
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .quick-chat-btn:hover:not(:disabled) {
    background: var(--accent-light);
    border-color: var(--accent);
  }

  .quick-chat-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .quick-chat-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .emoji {
    font-size: 16px;
  }

  .label {
    font-size: 13px;
    color: var(--text-2);
  }

  /* Mobile: Hide labels, show only emoji */
  @media (max-width: 480px) {
    .quick-chat-btn {
      padding: 8px 12px;
    }
    .label {
      display: none;
    }
    .emoji {
      font-size: 18px;
    }
  }
</style>
```

**`packages/web/src/lib/components/chat/ChatInput.svelte`**
```svelte
<script lang="ts">
  import { chatStore } from '$lib/stores/chat.svelte';
  import { RATE_LIMITS } from '@dicee/cloudflare-do/chat/types';

  let inputValue = $state('');
  let inputElement: HTMLTextAreaElement;

  const charCount = $derived(inputValue.length);
  const isOverLimit = $derived(charCount > RATE_LIMITS.MAX_MESSAGE_LENGTH);
  const canSend = $derived(
    inputValue.trim().length > 0 && !isOverLimit && !chatStore.isRateLimited
  );

  function handleSubmit(e: Event): void {
    e.preventDefault();
    if (!canSend) return;

    chatStore.sendMessage(inputValue);
    inputValue = '';
    inputElement?.focus();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleInput(): void {
    chatStore.handleInputChange();
  }
</script>

<form class="chat-input-container" onsubmit={handleSubmit}>
  <div class="input-wrapper">
    <textarea
      bind:this={inputElement}
      bind:value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onblur={() => chatStore.stopTyping()}
      placeholder="Type a message..."
      rows="1"
      maxlength={RATE_LIMITS.MAX_MESSAGE_LENGTH + 50}
      disabled={chatStore.isRateLimited}
      aria-label="Chat message"
    ></textarea>

    {#if charCount > RATE_LIMITS.MAX_MESSAGE_LENGTH - 50}
      <span class="char-count" class:over={isOverLimit}>
        {charCount}/{RATE_LIMITS.MAX_MESSAGE_LENGTH}
      </span>
    {/if}
  </div>

  <button
    type="submit"
    class="send-btn"
    disabled={!canSend}
    aria-label="Send message"
  >
    {#if chatStore.isRateLimited}
      ⏳
    {:else}
      ➤
    {/if}
  </button>
</form>

<style>
  .chat-input-container {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    padding-top: 8px;
  }

  .input-wrapper {
    position: relative;
    flex: 1;
  }

  textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface-1);
    font-size: 14px;
    line-height: 1.4;
    resize: none;
    outline: none;
    transition: border-color 0.15s ease;
    font-family: inherit;
    min-height: 40px;
    max-height: 100px;
  }

  textarea:focus {
    border-color: var(--accent);
  }

  textarea:disabled {
    opacity: 0.6;
  }

  .char-count {
    position: absolute;
    right: 12px;
    bottom: 8px;
    font-size: 11px;
    color: var(--text-3);
  }

  .char-count.over {
    color: var(--error);
    font-weight: 600;
  }

  .send-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--accent-dark);
    transform: scale(1.05);
  }

  .send-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .send-btn:disabled {
    background: var(--surface-3);
    color: var(--text-3);
    cursor: not-allowed;
  }

  /* Touch-friendly on mobile */
  @media (max-width: 768px) {
    textarea {
      font-size: 16px; /* Prevents iOS zoom */
      padding: 12px 16px;
    }

    .send-btn {
      width: 44px;
      height: 44px;
    }
  }
</style>
```

**`packages/web/src/lib/components/chat/TypingIndicator.svelte`**
```svelte
<script lang="ts">
  import { chatStore } from '$lib/stores/chat.svelte';
</script>

{#if chatStore.typingDisplay}
  <div class="typing-indicator" aria-live="polite">
    <span class="dots">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </span>
    <span class="text">{chatStore.typingDisplay}</span>
  </div>
{/if}

<style>
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
    color: var(--text-3);
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
  }

  .dots {
    display: flex;
    gap: 3px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .dot:nth-child(1) {
    animation-delay: -0.32s;
  }

  .dot:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
</style>
```

---

## 5. Mobile-First Layout

### 5.1 Layout Integration

**`packages/web/src/routes/room/[code]/+page.svelte`** (partial)

```svelte
<script lang="ts">
  import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
  import GameBoard from '$lib/components/game/GameBoard.svelte';

  let chatCollapsed = $state(true); // Start collapsed on mobile
</script>

<div class="room-layout">
  <!-- Main game area -->
  <main class="game-area">
    <GameBoard />
  </main>

  <!-- Chat panel -->
  <aside class="chat-area">
    <ChatPanel
      collapsed={chatCollapsed}
      onToggle={() => (chatCollapsed = !chatCollapsed)}
    />
  </aside>
</div>

<style>
  .room-layout {
    display: flex;
    flex-direction: column;
    height: 100dvh; /* Dynamic viewport height for mobile */
    overflow: hidden;
  }

  .game-area {
    flex: 1;
    overflow: auto;
    padding: 16px;
  }

  .chat-area {
    /* Mobile: Chat is fixed positioned via ChatPanel */
  }

  /* Desktop: Side-by-side layout */
  @media (min-width: 769px) {
    .room-layout {
      flex-direction: row;
    }

    .game-area {
      flex: 1;
    }

    .chat-area {
      width: 320px;
      min-width: 280px;
      max-width: 400px;
      border-left: 1px solid var(--border);
      padding: 16px;
    }
  }

  /* Large desktop: Wider chat */
  @media (min-width: 1200px) {
    .chat-area {
      width: 360px;
    }
  }
</style>
```

### 5.2 CSS Variables

Add to your global CSS:

```css
:root {
  /* Surfaces */
  --surface-1: #ffffff;
  --surface-2: #f8f9fa;
  --surface-3: #e9ecef;

  /* Text */
  --text-1: #212529;
  --text-2: #495057;
  --text-3: #868e96;

  /* Accent */
  --accent: #4263eb;
  --accent-light: #edf2ff;
  --accent-dark: #364fc7;

  /* Semantic */
  --border: #dee2e6;
  --error: #fa5252;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --surface-1: #1a1a1a;
    --surface-2: #242424;
    --surface-3: #2e2e2e;

    --text-1: #f8f9fa;
    --text-2: #ced4da;
    --text-3: #868e96;

    --accent: #5c7cfa;
    --accent-light: #1c2541;
    --accent-dark: #4263eb;

    --border: #343a40;
  }
}
```

---

## 6. Extensibility Hooks

### 6.1 Future Feature Placeholders

The architecture supports these additions without major refactoring:

**GIFs/Stickers** (Future)
```typescript
// Add to ChatMessage type
export interface ChatMessage {
  // ... existing fields
  media?: {
    type: 'gif' | 'sticker';
    url: string;
    width: number;
    height: number;
  };
}

// Add message type
| { type: 'MEDIA'; payload: { mediaType: 'gif' | 'sticker'; mediaId: string } }
```

**Sound Effects** (Future)
```typescript
// In ChatStore
private playSoundEffect(type: 'message' | 'reaction' | 'quickChat'): void {
  if (this.soundEnabled) {
    const audio = new Audio(`/sounds/${type}.mp3`);
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore autoplay errors
  }
}
```

**Custom Quick Chat** (Future)
```typescript
// Store user preferences
interface UserChatPreferences {
  customQuickChats: QuickChatKey[]; // User's favorite 6
  soundEnabled: boolean;
  compactMode: boolean;
}
```

**Message Threading** (Future)
```typescript
// Add to ChatMessage type
export interface ChatMessage {
  // ... existing fields
  replyTo?: {
    messageId: string;
    preview: string; // First 50 chars of parent
  };
}
```

### 6.2 Event System for Game Integration

Hook chat events into game state:

```typescript
// In GameRoom.ts - auto-chat on game events
private async handleGameEvent(event: GameEvent): Promise<void> {
  switch (event.type) {
    case 'YAHTZEE_SCORED':
      const msg = await this.chatManager.createSystemMessage(
        `🎉 ${event.playerName} scored a YAHTZEE!`
      );
      this.broadcast({ type: 'CHAT_MESSAGE', payload: msg });
      break;

    case 'GAME_STARTED':
      const startMsg = await this.chatManager.createSystemMessage(
        `🎲 Game started! ${event.firstPlayer} goes first.`
      );
      this.broadcast({ type: 'CHAT_MESSAGE', payload: startMsg });
      break;

    case 'GAME_ENDED':
      const endMsg = await this.chatManager.createSystemMessage(
        `🏆 Game over! ${event.winner} wins with ${event.score} points!`
      );
      this.broadcast({ type: 'CHAT_MESSAGE', payload: endMsg });
      break;
  }
}
```

---

## 7. Testing

### 7.1 Unit Tests

**`packages/cloudflare-do/src/chat/__tests__/ChatManager.test.ts`**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatManager } from '../ChatManager';
import { RATE_LIMITS } from '../types';

const mockStorage = {
  get: vi.fn(),
  put: vi.fn(),
};

const mockCtx = {
  storage: mockStorage,
} as unknown as DurableObjectState;

describe('ChatManager', () => {
  let manager: ChatManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockStorage.get.mockResolvedValue([]);
    manager = new ChatManager(mockCtx);
  });

  describe('handleTextMessage', () => {
    it('creates message with correct structure', async () => {
      const result = await manager.handleTextMessage('user1', 'Alice', 'Hello!');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.message).toMatchObject({
          type: 'text',
          userId: 'user1',
          displayName: 'Alice',
          content: 'Hello!',
        });
        expect(result.message.id).toHaveLength(12);
        expect(result.message.reactions).toEqual({
          '👍': [],
          '🎲': [],
          '😱': [],
          '💀': [],
          '🎉': [],
        });
      }
    });

    it('rate limits messages', async () => {
      await manager.handleTextMessage('user1', 'Alice', 'First');
      const result = await manager.handleTextMessage('user1', 'Alice', 'Second');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Rate limited');
        expect(result.retryAfterMs).toBeLessThanOrEqual(RATE_LIMITS.MESSAGE_INTERVAL_MS);
      }
    });

    it('allows messages after rate limit expires', async () => {
      await manager.handleTextMessage('user1', 'Alice', 'First');

      vi.advanceTimersByTime(RATE_LIMITS.MESSAGE_INTERVAL_MS + 1);

      const result = await manager.handleTextMessage('user1', 'Alice', 'Second');
      expect(result.success).toBe(true);
    });
  });

  describe('handleReaction', () => {
    it('adds reaction to message', async () => {
      // Setup: create a message first
      mockStorage.get.mockResolvedValueOnce([
        { id: 'msg1', reactions: { '👍': [], '🎲': [], '😱': [], '💀': [], '🎉': [] } },
      ]);

      const result = await manager.handleReaction('user1', 'msg1', '👍', 'add');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reactions['👍']).toContain('user1');
      }
    });

    it('removes reaction from message', async () => {
      mockStorage.get.mockResolvedValueOnce([
        { id: 'msg1', reactions: { '👍': ['user1'], '🎲': [], '😱': [], '💀': [], '🎉': [] } },
      ]);

      const result = await manager.handleReaction('user1', 'msg1', '👍', 'remove');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reactions['👍']).not.toContain('user1');
      }
    });
  });

  describe('typing indicators', () => {
    it('tracks typing users', () => {
      const result = manager.handleTypingStart('user1', 'Alice');

      expect(result).toHaveLength(1);
      expect(result![0]).toMatchObject({ userId: 'user1', displayName: 'Alice' });
    });

    it('auto-clears typing after timeout', () => {
      manager.handleTypingStart('user1', 'Alice');

      vi.advanceTimersByTime(RATE_LIMITS.TYPING_TIMEOUT_MS + 1);

      expect(manager.getTypingUsers()).toHaveLength(0);
    });

    it('clears typing on stop', () => {
      manager.handleTypingStart('user1', 'Alice');
      const result = manager.handleTypingStop('user1');

      expect(result).toHaveLength(0);
    });
  });
});
```

### 7.2 E2E Tests

**`packages/web/e2e/chat.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Lobby Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: navigate to a room
    await page.goto('/room/TEST01');
    await page.waitForSelector('[data-testid="chat-panel"]');
  });

  test('sends and displays text message', async ({ page }) => {
    const input = page.locator('textarea[aria-label="Chat message"]');
    const sendBtn = page.locator('button[aria-label="Send message"]');

    await input.fill('Hello world!');
    await sendBtn.click();

    await expect(page.locator('.message').last()).toContainText('Hello world!');
    await expect(input).toHaveValue('');
  });

  test('quick chat sends correct message', async ({ page }) => {
    await page.click('button[title="Nice roll!"]');

    await expect(page.locator('.message').last()).toContainText('🎲 Nice roll!');
  });

  test('reactions can be added and removed', async ({ page }) => {
    // First send a message
    await page.fill('textarea[aria-label="Chat message"]', 'Test message');
    await page.click('button[aria-label="Send message"]');

    // Hover to show reaction bar
    await page.locator('.message').last().hover();

    // Add reaction
    await page.click('button[aria-label="React with 👍"]');
    await expect(page.locator('.reaction-chip').first()).toContainText('👍 1');

    // Remove reaction
    await page.click('.reaction-chip');
    await expect(page.locator('.reaction-chip')).toHaveCount(0);
  });

  test('typing indicator shows for other users', async ({ browser }) => {
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/room/TEST02');
    await page2.goto('/room/TEST02');

    // User 2 starts typing
    await page2.fill('textarea[aria-label="Chat message"]', 'typing...');

    // User 1 should see typing indicator
    await expect(page1.locator('.typing-indicator')).toBeVisible();

    await context1.close();
    await context2.close();
  });

  test('rate limiting prevents spam', async ({ page }) => {
    const input = page.locator('textarea[aria-label="Chat message"]');
    const sendBtn = page.locator('button[aria-label="Send message"]');

    // Send first message
    await input.fill('Message 1');
    await sendBtn.click();

    // Try to send second immediately
    await input.fill('Message 2');
    await sendBtn.click();

    // Should show rate limit indicator
    await expect(sendBtn).toContainText('⏳');
  });
});
```

---

## Summary

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `chat/types.ts` | Create | Shared type definitions |
| `chat/schemas.ts` | Create | Zod validation schemas |
| `chat/ChatManager.ts` | Create | Server-side chat logic |
| `GameRoom.ts` | Modify | Add chat handlers |
| `stores/chat.svelte.ts` | Create | Client state management |
| `components/chat/*.svelte` | Create | 6 UI components |
| `room/[code]/+page.svelte` | Modify | Layout integration |

### Key Design Decisions

1. **Shared rate limit for text + quick chat** — Prevents spam switching between modes
2. **Reactions are optimistic** — Update UI immediately, server confirms
3. **Typing auto-clears after 3s** — No stale "typing" indicators
4. **System messages for join/leave** — Keeps context without notification overload
5. **Mobile bottom sheet pattern** — Familiar, thumb-reachable
6. **Desktop sidebar** — Always visible, doesn't interrupt game

### Performance Considerations

- Message history capped at 20 (adjustable via `RATE_LIMITS.MESSAGE_HISTORY_SIZE`)
- Typing indicator debounced client-side
- Reactions use toggle pattern (one DB write per action)
- No polling — all updates via existing WebSocket

---

*End of Addendum*

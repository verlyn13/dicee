# Dicee Spectator Mode — "The Gallery"
## Capturing the Kitchen Table Energy

The goal: spectating should feel like sitting at the family table, kibitzing, rooting, groaning at bad luck, and celebrating big moments together—not like watching a loading screen.

---

## 1. Core Philosophy

**Spectators are participants, not observers.**

In a family Yahtzee game, the people waiting for their turn (or not playing at all) are:
- Offering unsolicited advice
- Predicting what someone will roll
- Groaning when someone "steals" the category they wanted
- Celebrating (or mock-celebrating) big rolls
- Having side conversations
- Making it a social event

The Gallery captures this energy with **interactive spectating**.

---

## 2. Spectator Engagement Systems

### 2.1 Predictions — "Call Your Shot"

Before each roll, spectators can predict outcomes:

```
┌──────────────────────────────────────────────────────────────────────┐
│  🎯 CALL IT                                           [15s to predict]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  @jane is about to roll. What happens?                              │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │  YAHTZEE!  │  │  IMPROVES  │  │  BRICKS IT │  │  EXACT     │    │
│  │    🎲🎲🎲   │  │     📈     │  │     💀     │  │   SCORE    │    │
│  │            │  │            │  │            │  │   [___]    │    │
│  │   +50 pts  │  │   +10 pts  │  │   +10 pts  │  │  +100 pts  │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
│                                                                      │
│  Your prediction streak: 🔥 4                                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Prediction types:**
- **Yahtzee!** — They roll a Yahtzee (rare but huge points)
- **Improves** — Their best available score goes up
- **Bricks It** — No improvement, forced to take a zero or low score
- **Exact Score** — Predict the exact score they'll take (hardest)

**Scoring:**
- Correct predictions earn "Gallery Points" (separate from game)
- Streak bonuses for consecutive correct calls
- End-of-game "Best Predictor" badge

**Social visibility:**
```
@mike predicted YAHTZEE! 🎲  •  @sarah predicted BRICKS IT 💀
```

### 2.2 Rooting — "Pick Your Horse"

At game start, spectators can publicly declare who they're rooting for:

```
┌──────────────────────────────────────────────────────────────────────┐
│  WHO'S YOUR PICK?                                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   @jane      │  │   @mike      │  │   @sarah     │              │
│  │   👤 ████    │  │   👤 ████    │  │   👤 ████    │              │
│  │              │  │              │  │              │              │
│  │  [ROOT! 📣]  │  │  [ROOT! 📣]  │  │  [ROOT! 📣]  │              │
│  │              │  │              │  │              │              │
│  │  Fans: 2     │  │  Fans: 0     │  │  Fans: 5     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  Or: [Watch Neutral 👁]                                             │
└──────────────────────────────────────────────────────────────────────┘
```

**Effects of rooting:**
- Your avatar appears in a small "fan section" under that player
- You get notified (subtle haptic) when your player is up
- Special reactions unlocked ("Let's go!" "You got this!")
- Your celebrations are amplified when your player scores big
- End-of-game: "Backed the Winner" badge if your pick wins

**Player sees:**
```
┌─────────────────────────────────────────────────────────────────┐
│  YOUR TURN                                     👁 3 rooting for you │
│                                                                    │
│  [👤][👤][👤] are watching!                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 The Kibitz System — "Unsolicited Advice"

The classic family game experience: everyone has an opinion.

```
┌──────────────────────────────────────────────────────────────────────┐
│  KIBITZ CORNER                                         [Mute Kibitz] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  @jane just rolled [4][4][4][2][6]                                  │
│                                                                      │
│  What should they do?                                               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ KEEP THE 4s │  │ GO FOR FULL  │  │ YOLO YAHTZEE │              │
│  │     🎯      │  │    HOUSE     │  │     🎲       │              │
│  │             │  │              │  │              │              │
│  │   12 votes  │  │   3 votes    │  │   1 vote     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  💬 @mike: "Don't you DARE take the 4s, I need those!"             │
│  💬 @spectator2: "Full house is the play here"                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Kibitz features:**
- Quick-vote on what player should do (non-binding, obviously)
- Free-form advice in spectator chat
- Player can toggle "Show Kibitz" to see/hide advice
- After the play: "The Gallery was RIGHT/WRONG" display

**The tension:**
```
@jane ignored the Gallery's advice and went for Yahtzee...

[Dice rolling animation with extra tension]

😱 AND GOT IT! 

The Gallery: "We take it back, that was genius"
```

### 2.4 Enhanced Reactions — "The Peanut Gallery"

Spectator reactions are MORE expressive than player reactions:

```typescript
const spectatorReactions = [
  // Standard reactions (also available to players)
  { emoji: '👏', label: 'Nice!', sound: 'clap.mp3' },
  { emoji: '😱', label: 'Wow!', sound: 'gasp.mp3' },
  { emoji: '😅', label: 'Oof', sound: 'groan.mp3' },
  
  // Spectator-exclusive reactions
  { emoji: '🍿', label: 'Drama!', sound: 'popcorn.mp3' },
  { emoji: '📢', label: 'Called it!', sound: 'airhorn.mp3' },  // After correct prediction
  { emoji: '🙈', label: "Can't watch", sound: 'suspense.mp3' },
  { emoji: '🪦', label: 'RIP', sound: 'sad-trombone.mp3' },    // When someone zeros
  { emoji: '🔥', label: 'On fire!', sound: 'fire.mp3' },       // Streak plays
  { emoji: '🤡', label: 'Clown play', sound: 'honk.mp3' },     // Suboptimal choice
  
  // Rooting-specific (only for your picked player)
  { emoji: '📣', label: "Let's GO!", sound: 'cheer.mp3' },
  { emoji: '💪', label: 'You got this', sound: 'pump-up.mp3' },
];
```

**Reaction visibility:**
- Reactions float up from the spectator bar at bottom of screen
- Multiple same-reaction combo: "👏 x7" with bigger animation
- Players see spectator reactions (optional toggle)

### 2.5 Live Commentary Prompts

System-generated prompts that encourage spectator engagement:

```
┌──────────────────────────────────────────────────────────────────────┐
│  💬 GALLERY PROMPT                                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  "@mike just took a ZERO on Yahtzee. Thoughts?"                     │
│                                                                      │
│  [😱 Brutal]  [🧠 Smart play]  [🤷 Whatever]  [Custom reply...]     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Prompt triggers:**
- Player takes a zero
- Yahtzee rolled
- Bonus threshold reached/missed
- Huge score differential
- Final round drama
- Comeback in progress
- Someone ignores optimal play

---

## 3. Spectator View Layout

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔴 LIVE  │  Room ABC123  │  Round 7/13  │  👁 8 watching  │  [Join Queue]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                           GAME VIEW                                     │ │
│ │  ┌───────────┐  ┌──────────────────────────┐  ┌───────────────────────┐ │ │
│ │  │  PLAYERS  │  │                          │  │     ALL SCORECARDS    │ │ │
│ │  │           │  │       DICE TRAY          │  │  (scrollable grid)    │ │ │
│ │  │  @jane 🎯 │  │    [4][4][4][2][6]       │  │                       │ │ │
│ │  │  Score:156│  │                          │  │  jane │ mike │ sarah  │ │ │
│ │  │  📣 x3    │  │  "Keeping the 4s..."     │  │  ───────────────────  │ │ │
│ │  │           │  │                          │  │  Ones  3   2    4     │ │ │
│ │  │  @mike    │  └──────────────────────────┘  │  Twos  6   --   8     │ │ │
│ │  │  Score:142│                                │  ...                   │ │ │
│ │  │           │  ┌──────────────────────────┐  │                       │ │ │
│ │  │  @sarah   │  │  🎯 CALL IT  [12s left]  │  │                       │ │ │
│ │  │  Score:138│  │  [YAHTZEE][IMPROVE][BRICK]│  │                       │ │ │
│ │  └───────────┘  └──────────────────────────┘  └───────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  GALLERY CHAT & REACTIONS                                                   │
│  ────────────────────────────────────────────────────────────────────────── │
│  @viewer1: Should've kept the 2 for full house                             │
│  @viewer2: 📣 Let's go Jane!                                               │
│  @viewer3: 🍿 This is getting good                                         │
│  [Type a message...]                      [😱][👏][🍿][🔥][📢]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout

```
┌────────────────────────────────┐
│ 🔴 LIVE │ ABC123 │ 👁 8       │
├────────────────────────────────┤
│                                │
│  @jane's turn (Round 7/13)    │
│  Score: 156  │  📣 3 fans     │
│                                │
│  ┌──────────────────────────┐ │
│  │    [4][4][4][2][6]       │ │
│  │     ▲  ▲  ▲              │ │
│  │    KEEPING               │ │
│  └──────────────────────────┘ │
│                                │
│  ┌──────────────────────────┐ │
│  │  🎯 CALL IT              │ │
│  │  [YAH][IMP][BRICK][EXACT]│ │
│  └──────────────────────────┘ │
│                                │
├────────────────────────────────┤
│ [SCORES] [CHAT] [PREDICT]     │  ← Tab bar
├────────────────────────────────┤
│  💬 Gallery Chat               │
│  ───────────────────────────── │
│  @v1: Go for Yahtzee!         │
│  @v2: 🔥🔥🔥                  │
│  [...]                [React] │
└────────────────────────────────┘
```

---

## 4. The Spectator Metagame

### Gallery Points System

Spectators earn points for engagement (completely separate from game scores):

```typescript
interface GalleryPoints {
  predictions: {
    correct: number;        // +10-100 based on difficulty
    streak: number;         // Multiplier for consecutive
    exactScore: number;     // +100 for exact predictions
  };
  social: {
    reactionsGiven: number; // +1 each (capped per game)
    kibitzVotes: number;    // +2 when majority agrees
    chatMessages: number;   // +1 each (capped)
  };
  backing: {
    backedWinner: number;   // +50 if your pick wins
    loyaltyBonus: number;   // +25 for backing underdog who wins
  };
}
```

### Spectator Achievements

```
┌──────────────────────────────────────────────────────────────────────┐
│  GALLERY ACHIEVEMENTS                                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🎯 Oracle          Called 5 correct predictions in a row           │
│  🍿 Drama Magnet    Watched 10 games with a comeback                │
│  📣 Superfan        Backed the same player 5 times                  │
│  🤡 Jinx            Your pick lost 5 times in a row                 │
│  🧠 Analyst         Predicted exact score 3 times                   │
│  📢 Called It!      Predicted a Yahtzee correctly                   │
│  👁 Voyeur          Watched 50 games total                          │
│  🏠 Regular         Spectated in 20 different rooms                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Gallery Leaderboard

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP GALLERY MEMBERS (This Week)                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   #   SPECTATOR       PTS    PREDICTIONS   WIN PICKS                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   1   @kibitz_king   2,847   73% accuracy   12/15                   │
│   2   @peanut_pro    2,341   68% accuracy   10/14                   │
│   3   @you           1,892   71% accuracy   8/12                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Spectator-to-Player Pipeline

### Join Queue

Spectators can queue to join the next game:

```
┌──────────────────────────────────────────────────────────────────────┐
│  NEXT GAME QUEUE                                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Current game: Round 9/13 (~5 min remaining)                        │
│                                                                      │
│  Queue position:                                                    │
│  1. @viewer1 ✓                                                      │
│  2. @viewer2 ✓                                                      │
│  3. @you ← You're #3                                                │
│  4. @viewer4                                                        │
│                                                                      │
│  Room accepts 4 players. You'll join next game!                     │
│                                                                      │
│  [Leave Queue]                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Warm Seat

When game ends, queued spectators auto-transition:

```
┌──────────────────────────────────────────────────────────────────────┐
│  🎉 GAME OVER — NEXT GAME STARTING                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  You're in! Transitioning from spectator to player...               │
│                                                                      │
│  Players for next game:                                             │
│  • @jane (staying)                                                  │
│  • @you (from queue) ← NEW                                          │
│  • @viewer1 (from queue) ← NEW                                      │
│  • @viewer2 (from queue) ← NEW                                      │
│                                                                      │
│  Starting in 10...                                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Family Mode Settings

For family-friendly rooms, hosts can configure:

```typescript
interface FamilyModeSettings {
  // Content
  chatFilter: 'strict' | 'moderate' | 'off';
  allowClownReaction: boolean;          // Some families are sensitive!
  
  // Engagement
  kibitzVisible: boolean;               // Show advice to players
  predictionsEnabled: boolean;          // Some prefer pure watching
  
  // Audio
  reactionSounds: boolean;
  volumeLimit: number;                  // Cap spectator noise
  
  // Privacy
  spectatorsCanSeeEV: boolean;          // Hide strategy from gallery
  showSpectatorCount: boolean;
  allowSpectatorChat: boolean;
}
```

### "Living Room" Mode

A preset for casual family play:

```
┌──────────────────────────────────────────────────────────────────────┐
│  🏠 LIVING ROOM MODE                                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Perfect for family game night!                                      │
│                                                                      │
│  ✓ Friendly chat filter                                             │
│  ✓ Kibitz advice shown to players                                   │
│  ✓ Predictions enabled (makes waiting fun!)                         │
│  ✓ All reactions available                                          │
│  ✓ Sound effects on                                                 │
│  ✗ EV/probability hidden (no spoilers!)                             │
│  ✗ Skill ratings hidden (no pressure!)                              │
│                                                                      │
│  [Apply Living Room Mode]                                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Spectator Chat Personality

### System Messages with Character

Instead of dry notifications, the system has personality:

```
// Standard
"@jane rolled a Yahtzee"

// With personality
"🎲 YAHTZEE! @jane just rolled five 4s and the Gallery goes WILD!"

// Standard
"@mike scored 0 on Large Straight"

// With personality
"💀 @mike takes the zero on Large Straight. Press F to pay respects."

// Standard  
"@sarah's turn"

// With personality
"📣 @sarah steps up to the plate. The Gallery holds its breath..."
```

### Contextual Flavor Text

```typescript
const flavorText = {
  yahtzee: [
    "The impossible dream becomes reality!",
    "Five of a kind! The Gallery erupts!",
    "YAHTZEE! Someone check if that's legal!",
  ],
  
  zero: [
    "Sometimes you just gotta take the L.",
    "A strategic zero? Or just bad luck? The Gallery debates.",
    "Zero points, infinite sadness.",
  ],
  
  comeback: [
    "Wait... is this a comeback brewing?",
    "The underdog stirs! The Gallery senses blood!",
    "From the ashes, a phoenix rises...",
  ],
  
  blowout: [
    "This one's getting away from the pack.",
    "Mercy rule when?",
    "And THAT'S why we watch the games.",
  ],
  
  finalRound: [
    "Final round. Everything comes down to this.",
    "Last chance for glory. The Gallery leans in.",
    "Round 13. Legends are made here.",
  ],
};
```

---

## 8. Implementation Priorities

### Phase 1: Core Spectating
- [x] View all scorecards
- [x] Separate spectator chat
- [ ] Basic reactions (visible to spectators only)
- [ ] Spectator count display

### Phase 2: Engagement
- [ ] Predictions system
- [ ] Rooting/backing players
- [ ] Reactions visible to players (opt-in)
- [ ] Gallery points

### Phase 3: Polish
- [ ] Kibitz voting
- [ ] System personality/flavor text
- [ ] Achievements
- [ ] Gallery leaderboard
- [ ] Living Room mode preset

### Phase 4: Pipeline
- [ ] Join queue
- [ ] Warm seat transitions
- [ ] Spectator-to-player matchmaking

---

## 9. The Feeling We're Creating

**Before:** "I'm just waiting for a spot to open up."

**After:** "I'm part of this game. I called that Yahtzee. I'm rooting for Jane. I told Mike to keep the 3s and he didn't listen and NOW LOOK. When's the next game? I'm staying."

The Gallery transforms spectating from a waiting room into a **second game** that runs parallel to the main event. Spectators have their own goals, their own leaderboard, their own achievements—and most importantly, they feel like they're *at the table*, not watching through a window.

---

*"The best games aren't won by the players—they're won by the crowd that refuses to look away."*

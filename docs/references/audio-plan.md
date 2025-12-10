# **DICEE**

Audio Production Guide

Version 1.0 — Sound Design Specification for AI-Assisted Production

| EXECUTIVE SUMMARY Dicee is a turn-based probability game—think Yahtzee reimagined for digital play. The audio must evoke the intimacy of a cozy game night: warm, tactile, and emotionally responsive without being overwhelming. This guide provides a phased approach to audio production using AI-assisted tools within a $50 budget. Target Platform: Web (Chrome, Safari, Firefox, Mobile browsers) Budget: $50 for AI audio generation tools (ElevenLabs Sound Effects, Suno, etc.) |
| :---- |

# **1\. Creative Direction**

## **The Soul of Dicee**

The silence of Dicee is the contemplative pause before a decision. We want the quiet tension of a poker table, not the anxiety of a casino floor. Think: friends around a kitchen table, wooden dice in a leather cup, the warmth of a game night.

### **Production Aesthetic Keywords**

* *Tactile, Wooden, Resin, Felt, Warm, Thocky, Analog*  
* Avoid harsh high frequencies (2kHz-5kHz). Focus on warm low-mids (200Hz-500Hz) for UI.  
* Instrumentation: Marimba, Rhodes Piano, Kalimba, Acoustic Guitar harmonics, Foley percussion (wood blocks, cloth, paper).

### **Reference Touchstones**

* **Stardew Valley** — Cozy, warm, not demanding  
* **Slay the Spire** — Clear feedback without fatigue  
* **Unpacking** — Intimate, tactile, satisfying

## **Emotional Arc of a 13-Round Game**

The game has a distinct emotional shape that audio should support:

| Rounds | Phase | Audio Direction |
| ----- | ----- | ----- |
| **1–4** | EXPLORATION | Hopeful, open. Music at Layer 1 only. Sounds feel fresh and bright. |
| **5–8** | TENSION | Stakes rise. Add Layer 2 (rhythmic element). Reverb tightens slightly. |
| **9–11** | CRISIS | Forced decisions. Layer 3 (pulsing bass). Shorter reverb tails. |
| **12–13** | RESOLUTION | Final push. Full arrangement. Dramatic reveals land with impact. |

# **2\. Phased Implementation Strategy**

**Critical Recommendation:** Ship MVP audio first, validate emotional beats land with real players, then expand. Do not attempt the full production list before validating the core experience.

## **Phase 1: MVP Audio (Ship First)**

**Budget Allocation: $20**

This tier covers the essential audio that makes the game feel alive. Focus all initial effort here.

| Asset ID | Filename | Description & AI Prompt Direction |
| ----- | ----- | ----- |
| **MVP-01** | dice\_roll\_heavy.ogg | 5 resin dice shaken in leather cup, spilled onto felt-lined wooden tray. Heavy initial impact, woody clatter, 1.2s settle. Prompt: "wooden dice rolling on felt table, satisfying clatter, warm tone" |
| **MVP-02** | dice\_roll\_light.ogg | 1-2 dice, lighter texture. Single click-clack-stop. Intimate. Prompt: "single wooden die rolling, soft felt surface, brief" |
| **MVP-03** | dice\_select.ogg | Soft satisfying thock. Mechanical keyboard with O-rings feel. 100ms. Prompt: "soft wooden tap, satisfying click, muted" |
| **MVP-04** | score\_positive.ogg | Two-note ascending arpeggio (C→E). Marimba or Kalimba. Warm, dry. Prompt: "marimba two notes ascending, gentle, warm" |
| **MVP-05** | score\_negative.ogg | Descending two-note (E→C\#). Not harsh—a musical sigh. Muted. Prompt: "kalimba descending notes, melancholic, soft" |
| **MVP-06** | dicee\_fanfare.ogg | THE HERO SOUND. Five-of-a-kind celebration. Harp gliss \+ shimmering chord. Must cut through everything. 2-3s. Prompt: "triumphant fanfare, harp glissando, magical shimmer, celebration" |
| **MVP-07** | turn\_start.ogg | Clear gentle chime. Tibetan singing bowl or Rhodes Major 7th. Inviting, not alarming. 1.5s tail. Prompt: "gentle bell chime, tibetan bowl, warm resonance" |
| **MVP-08** | ambient\_base.ogg | Barely-there room warmth. NOT air conditioning hum. Subtle, subliminal. 30s seamless loop. Prompt: "subtle ambient room tone, warm, barely audible, no hum" |

**MVP Validation Criteria:** Before moving to Phase 2, confirm with 3-5 playtesters:

1. Can players distinguish good vs. bad score outcomes by sound alone?  
2. Does the Dicee fanfare feel special and exciting?  
3. Do dice sounds become annoying after 10+ rolls?  
4. Is the turn-start chime clear without being jarring?

## **Phase 2: Complete Audio (Post-Validation)**

**Budget Allocation: $30**

| Asset ID | Filename | Description & AI Prompt Direction |
| ----- | ----- | ----- |
| **PHY-02** | dice\_roll\_heavy\_alt1.ogg | Variation of MVP-01. Longer settle, one die spins before dropping. |
| **PHY-03** | dice\_roll\_heavy\_alt2.ogg | Variation of MVP-01. Tighter, quicker throw. More decisive. |
| **PHY-04** | dice\_roll\_medium.ogg | 2-3 dice throw. Distinct separation between impacts. Less bass than heavy. |
| **PHY-05** | dice\_deselect.ogg | Release die. Similar to select but higher pitch, lighter attack. |
| **UI-01** | btn\_hover.ogg | Subtle fabric swoosh. Almost subliminal. \-18dB, high-cut filter. |
| **UI-02** | btn\_click.ogg | Crisp wooden snap. Like snapping a dry twig or clicking quality pen. |
| **UI-03** | ui\_error.ogg | Dull wooden thud. Says "no" without saying "WRONG\!" Pitched-down click. |
| **UI-04** | timer\_tick.ogg | Soft wooden clock tick. 60 BPM or 120 BPM synced. |
| **SCR-01** | score\_good.ogg | Three-note C Major chord. Marimba \+ light sparkle/glockenspiel. |
| **SCR-02** | score\_zero.ogg | Hollow wood block \+ low "wump." Finality without harshness. |
| **SCR-03** | upper\_bonus.ogg | Warm enveloping wash. Acoustic guitar G Major strum \+ synth swell. 3s. |
| **SCR-04** | bonus\_dicee.ogg | 100pt bonus. Callback to main Dicee \+ extra shimmer layer. |
| **EVT-01** | game\_win.ogg | Triumphant 4-6s phrase. Acoustic guitar \+ piano. Celebratory, not obnoxious. |
| **EVT-02** | game\_loss.ogg | Respectful, reflective. Solo piano, slower tempo. "Good game, try again." |
| **MUS-01** | music\_layer\_calm.ogg | Layer 1: Slow drifting pads. Rhodes chord every 4 bars. 80 BPM, C Major. 60s loop. |
| **MUS-02** | music\_layer\_activity.ogg | Layer 2: Adds brushed snare/shaker \+ acoustic fingerpicking. Time-aligned to MUS-01. |
| **MUS-03** | music\_layer\_tension.ogg | Layer 3: Pulsing bass synth \+ urgent xylophone ostinato. Time-aligned to MUS-01. |

# **3\. Technical Specifications**

## **Format Requirements**

| Parameter | Specification |
| ----- | ----- |
| **Format** | OGG Vorbis (primary), MP3 (fallback for Safari) |
| **Sample Rate** | 44.1kHz |
| **Bit Depth** | 16-bit (OGG quality 5-6) |
| **Channels** | Stereo for music/ambient, Mono for SFX (save space) |
| **Total Budget** | \~2-3MB initial load. Stream ambient/music after first interaction. |
| **Max Concurrent** | 8-12 sounds maximum |
| **Latency Target** | \<50ms for player actions (dice, buttons) |

## **Duration Guidelines**

| Sound Type | Duration | Notes |
| ----- | ----- | ----- |
| Dice rolls (heavy) | 1.0–1.5s | Include full settle |
| Dice rolls (light) | 0.4–0.8s | Quick resolution |
| UI clicks/taps | 50–150ms | Instant feedback |
| Score confirmations | 0.3–0.8s | Clean tail |
| Dicee fanfare | 2.0–3.0s | Hero moment |
| Turn chime | 1.5–2.0s | Long resonant tail |
| Music loops | 60s each | Seamless loop points |
| Ambient loop | 30s | Truly seamless |

# **4\. Implementation Rules**

## **Audio Ducking**

When the Dicee fanfare triggers, all other audio must step aside:

* Duck music layers by **\-6dB to \-9dB** (NOT \-12dB—that's too aggressive)  
* Fade down over 200ms  
* Hold for 2.5s  
* Release over 800ms

## **Randomization (Anti-Fatigue)**

For dice rolls (the most repetitive action):

* Apply random pitch shift: ±5%  
* Apply random volume variance: ±10%  
* Rotate between available variations (when Phase 2 assets exist)

## **Spatial Panning (Multiplayer)**

| Source | Pan Position |
| ----- | ----- |
| Player's dice | Center (0) |
| Opponent (left seat) | Pan \-30 |
| Opponent (right seat) | Pan \+30 |
| Opponent (across) | Center (0) but \-3dB volume |

## **Intensity System (Simplified)**

**Start simple.** Use only round number for initial implementation:

*intensity \= round / 13*

This maps rounds 1-13 to intensity 0.08-1.0. Music layers activate at thresholds: Layer 1 always, Layer 2 at intensity \> 0.35 (round 5+), Layer 3 at intensity \> 0.65 (round 9+).

**Future expansion (post-validation):** Add score differential and time pressure if playtesting reveals the simple formula feels flat.

## **Score Sound Logic**

Use absolute value thresholds (not context-dependent):

| Score Range | Sound | Rationale |
| ----- | ----- | ----- |
| 0 points | score\_zero.ogg | Scratch/forced zero |
| 1–15 points | score\_negative.ogg | Low/disappointing |
| 16–29 points | score\_positive.ogg | Decent/neutral-good |
| 30+ points | score\_good.ogg | High score |
| 50 (Dicee) | dicee\_fanfare.ogg | Five of a kind |

# **5\. AI Audio Generation Guide**

## **Recommended Tools**

| Tool | Best For | Budget Estimate |
| ----- | ----- | ----- |
| **ElevenLabs SFX** | UI sounds, foley, short SFX | $5-15 (text-to-SFX credits) |
| **Suno** | Music loops, ambient, fanfares | $10-20 (subscription) |
| **Stable Audio** | Alternative for music/ambient | $10-15 (credits) |
| **Audacity** | Post-processing, trimming, loops | Free |

## **Prompt Engineering Tips**

**For ElevenLabs Sound Effects:**

* Be specific about material: "wooden dice on felt" not "dice rolling"  
* Include emotional context: "satisfying," "warm," "gentle"  
* Specify what to avoid: "no harsh frequencies," "not metallic"  
* Request duration: "brief 100ms click" or "1 second with decay"

**For Suno Music:**

* Style tags: "lo-fi, ambient, cozy, Rhodes piano, warm"  
* Specify BPM: "80 BPM" for calm layers  
* Key specification: "C Major" for consistency across layers  
* Request instrumental: "no vocals, instrumental only"

## **Post-Processing Checklist**

1. **Normalize:** All SFX to \-3dB peak, music to \-6dB peak  
2. **Trim:** Remove silence, add 10ms fade in/out to prevent clicks  
3. **Loop test:** Ambient/music must loop seamlessly—check for pops  
4. **EQ:** Roll off harsh 2-5kHz if present, boost warmth at 200-400Hz  
5. **Convert:** Export as OGG Vorbis quality 5, verify file size  
6. **Mobile test:** Play through phone speakers—must be audible and not harsh

# **6\. The Golden Question**

*"If the player turns off their monitor, can they still understand what is happening?"*

## **Target Capabilities**

A blindfolded player should be able to understand:

| Game State | MVP | Complete |
| ----- | ----- | ----- |
| Dice were rolled | ✓ | ✓ |
| How many dice rolled (1 vs 5\) | Partial | ✓ |
| Outcome quality (good vs bad) | ✓ | ✓ |
| It's my turn now | ✓ | ✓ |
| Special event occurred (Dicee\!) | ✓ | ✓ |
| Game phase (early vs late) | — | ✓ |
| Specific dice values | — | —\* |

*\* Would require screen reader / audio announcer—separate accessibility feature.*

# **7\. File Delivery Structure**

Deliver files in the following directory structure:

| Directory Structure |
| :---- |
| `audio/├── sfx/│   ├── dice/│   │   ├── dice_roll_heavy.ogg│   │   ├── dice_roll_heavy_alt1.ogg│   │   ├── dice_roll_heavy_alt2.ogg│   │   ├── dice_roll_medium.ogg│   │   ├── dice_roll_light.ogg│   │   ├── dice_select.ogg│   │   └── dice_deselect.ogg│   ├── ui/│   │   ├── btn_hover.ogg│   │   ├── btn_click.ogg│   │   ├── ui_error.ogg│   │   └── timer_tick.ogg│   └── score/│       ├── score_positive.ogg│       ├── score_negative.ogg│       ├── score_good.ogg│       ├── score_zero.ogg│       ├── upper_bonus.ogg│       ├── dicee_fanfare.ogg│       ├── bonus_dicee.ogg│       ├── game_win.ogg│       └── game_loss.ogg├── music/│   ├── music_layer_calm.ogg│   ├── music_layer_activity.ogg│   └── music_layer_tension.ogg└── ambient/    └── ambient_base.ogg` |

# **8\. Final Notes**

## **What NOT to Include**

* **Shaking cup loop (PHY-08 from original spec):** Trigger unclear, conflicts with roll sounds. Cut.  
* **60-second room tone:** Reduced to 30s. Truly ambient—below conscious perception.  
* **Spectator gallery sounds:** Deferred to Phase 3\. Focus on core experience first.

## **Key Success Criteria**

* The Dicee fanfare must make players smile. Every time.  
* Dice sounds should not become irritating after 100 rolls.  
* The audio should feel like a cozy game night, not a slot machine.  
* Silence should feel contemplative, not empty.

## **Contact & Iteration**

Submit MVP assets for review before proceeding to Phase 2\. Expect 1-2 rounds of feedback on tonality and emotional fit. The Dicee fanfare will likely need the most iteration—plan accordingly.

| Remember: Ship MVP → Validate → Expand *Perfect is the enemy of shipped.* |
| :---: |

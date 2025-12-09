# Audio Assets

This directory contains audio files for the Dicee game. The audio system gracefully degrades when files are missing.

## Required Files

### Dice Sounds (preloaded)
| File | Purpose | Duration | Notes |
|------|---------|----------|-------|
| `dice-roll.mp3` | Initial roll sound | ~500ms | Preloaded for low latency |
| `dice-land.mp3` | Single die landing | ~200ms | Base file |
| `dice-land_1.mp3` | Landing variant 1 | ~200ms | Optional variant |
| `dice-land_2.mp3` | Landing variant 2 | ~200ms | Optional variant |
| `dice-land_3.mp3` | Landing variant 3 | ~200ms | Optional variant |
| `chip-click.mp3` | Keep die click | ~100ms | Short, satisfying click |
| `chip-unclick.mp3` | Unkeep die click | ~100ms | Slightly softer click |

### Scoring Sounds (preloaded)
| File | Purpose | Duration | Notes |
|------|---------|----------|-------|
| `register-ding.mp3` | Score confirmation | ~300ms | Preloaded for low latency |
| `bell-triple.mp3` | Bonus achieved | ~500ms | Upper section bonus |
| `jackpot.mp3` | Dicee celebration | ~1000ms | Five of a kind |

### UI Sounds
| File | Purpose | Duration | Notes |
|------|---------|----------|-------|
| `click.mp3` | Button click | ~50ms | Generic UI feedback |
| `soft-chime.mp3` | Turn change | ~400ms | Multiplayer turn notification |
| `tick.mp3` | Timer warning | ~100ms | Low time warning |

### System Sounds
| File | Purpose | Duration | Notes |
|------|---------|----------|-------|
| `pop.mp3` | Chat message | ~100ms | New message notification |
| `join.mp3` | Player join | ~300ms | Player joined room |
| `leave.mp3` | Player leave | ~200ms | Player left room |
| `game-start.mp3` | Game start | ~500ms | Game beginning fanfare |
| `game-end.mp3` | Game end | ~600ms | Game completion sound |

## Audio Specifications

- **Format**: MP3 (for broad compatibility)
- **Sample Rate**: 44.1kHz
- **Bit Rate**: 128kbps minimum
- **Channels**: Stereo preferred, mono acceptable
- **Normalization**: -3dB peak, avoid clipping

## Sourcing Audio

Recommended royalty-free sources:
- [Freesound.org](https://freesound.org) (CC0/CC-BY)
- [Mixkit](https://mixkit.co/free-sound-effects/)
- [Zapsplat](https://www.zapsplat.com)

## Volume Defaults

The audio service applies these base volumes (before user preferences):

| Category | Base Volume | Files |
|----------|-------------|-------|
| Dice | 0.7 | dice-roll, dice-land, chip-* |
| Score | 0.6 | register-ding, bell-triple, jackpot |
| UI | 0.4 | click, soft-chime, tick |
| System | 0.5 | pop, join, leave, game-* |

## Graceful Degradation

If audio files are missing:
1. Console warning is logged
2. Play request completes silently
3. Game continues without audio
4. No user-facing errors

To test without audio, simply leave this directory empty.

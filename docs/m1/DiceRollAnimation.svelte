/**
 * Enhanced Dice Roll Animations
 * 
 * Visual feedback for dice rolls using modern CSS animations and Svelte 5 transitions.
 */

// src/lib/components/dice/DiceRollAnimation.svelte
<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  
  interface Props {
    rolling: boolean;
    onComplete?: () => void;
  }
  
  let { rolling, onComplete }: Props = $props();
  
  // Trigger completion callback after animation
  $effect(() => {
    if (!rolling && onComplete) {
      const timer = setTimeout(onComplete, 300);
      return () => clearTimeout(timer);
    }
  });
</script>

{#if rolling}
  <div 
    class="roll-overlay"
    transition:fly={{ y: -20, duration: 200, easing: cubicOut }}
  >
    <div class="roll-indicator">
      <span class="roll-text">ROLLING</span>
      <div class="roll-dots">
        <span class="dot" style="--delay: 0s"></span>
        <span class="dot" style="--delay: 0.1s"></span>
        <span class="dot" style="--delay: 0.2s"></span>
      </div>
    </div>
  </div>
{/if}

<style>
  .roll-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.8);
    padding: var(--space-2);
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .roll-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .roll-text {
    font-size: var(--text-h3);
    font-weight: var(--weight-black);
    letter-spacing: var(--tracking-widest);
    color: var(--color-accent);
  }
  
  .roll-dots {
    display: flex;
    gap: var(--space-1);
  }
  
  .dot {
    width: 8px;
    height: 8px;
    background: var(--color-accent);
    border-radius: 50%;
    animation: bounce 0.6s infinite var(--delay);
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
</style>

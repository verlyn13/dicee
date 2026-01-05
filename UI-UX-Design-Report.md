# Dicee UI/UX Design & Layout Report

**Generated:** January 4, 2026  
**Version:** 1.0  
**Scope:** Complete analysis of current UI/UX design and layout for mobile and desktop

---

## Executive Summary

Dicee implements a **Neo-Brutalist design system** with strong visual hierarchy, high contrast, and mobile-first responsive design. The application features a sophisticated component architecture with 40+ specialized UI components organized into logical domains: authentication, chat, dice gameplay, gallery/spectator features, and game management.

**Key Design Pillars:**
- **Neo-Brutalist Aesthetic:** Hard edges, visible borders, honest interactivity
- **Mobile-First Responsive Design:** Progressive enhancement from mobile to desktop
- **Accessibility First:** WCAG AA compliance with semantic HTML and keyboard navigation
- **Component Architecture:** Modular, reusable components with clear separation of concerns

---

## Design System Architecture

### Core Design Philosophy

**Neo-Brutalist Principles (RFC-002):**
- Hard edges (no rounded corners except where specifically needed)
- High contrast (black/white primary with electric gold accent)
- Visible structure (borders delineate all interactive elements)
- Typography as UI (functional, not decorative)
- Honest interactivity (buttons look like buttons)

### Color Palette

**Primary Colors:**
- Background: `#fafafa` (warm white)
- Surface: `#ffffff` (pure white)
- Border: `#000000` (hard black)
- Text: `#0a0a0a` (near black)
- Text Muted: `#666666` (medium gray)

**Accent Colors:**
- Electric Gold: `#ffd700` (primary accent)
- Gold Dark: `#b8860b` (hover states)
- Gold Light: `#fff4bf` (subtle highlights)

**Semantic Colors:**
- Success: `#10b981` (positive actions)
- Warning: `#f59e0b` (caution states)
- Danger: `#ef4444` (errors/danger)
- Disabled: `#9ca3af` (inactive elements)

**Signal Colors (Lobby UI):**
- Live: `#059669` (online/open games)
- Busy: `#dc2626` (full/error states)
- System: `#d946ef` (system messages)
- Muted: `#6b7280` (timestamps/secondary)

### Typography System

**Font Stacks:**
- Sans: "Inter Variable", "SF Pro", system-ui
- Mono: "JetBrains Mono", "IBM Plex Mono", "SF Mono"

**Type Scale (Major Third - 1.250):**
- Display: 3rem (48px)
- H1: 2.375rem (38px)
- H2: 1.875rem (30px)
- H3: 1.5rem (24px)
- Body: 1rem (16px)
- Small: 0.875rem (14px)
- Tiny: 0.75rem (12px)
- Micro: 0.625rem (10px)

**Font Weights:**
- Normal: 400
- Medium: 500
- Semibold: 600
- Bold: 700
- Black: 900

### Spacing System

**8px Base Unit:**
- Space-0: 0
- Space-1: 0.5rem (8px)
- Space-2: 1rem (16px)
- Space-3: 1.5rem (24px)
- Space-4: 2rem (32px)
- Space-5: 3rem (48px)
- Space-6: 4rem (64px)
- Space-7: 6rem (96px)
- Space-8: 8rem (128px)

### Border System

**Neo-Brutalist Borders:**
- Thin: 1px solid black
- Medium: 2px solid black
- Thick: 3px solid black
- Heavy: 4px solid black

**Border Radius (Minimal):**
- None: 0 (default)
- Small: 2px (specific cases)
- Medium: 4px (bottom sheets, modals)

---

## Component Architecture

### Authentication Components

**Location:** `/src/lib/components/auth/`

1. **AuthHeader.svelte** - Top-level authentication interface
2. **GoogleButton.svelte** - Google OAuth integration
3. **MagicLinkForm.svelte** - Email-based authentication
4. **PlayNowButton.svelte** - Guest play entry point
5. **UpgradePrompt.svelte** - Account upgrade messaging

### Chat System Components

**Location:** `/src/lib/components/chat/`

1. **ChatPanel.svelte** - Main chat interface with message history
2. **ChatInput.svelte** - Message composition with validation
3. **ChatMessage.svelte** - Individual message rendering
4. **QuickChatBar.svelte** - Predefined message shortcuts
5. **ReactionBar.svelte** - Emoji reactions to messages
6. **ReactionFloat.svelte** - Floating reaction indicators
7. **TypingIndicator.svelte** - Real-time typing status

### Dice Gameplay Components

**Location:** `/src/lib/components/dice/`

1. **DiceTray.svelte** - Central dice interaction area
   - Pre-roll state with placeholder dice
   - Animated rolling states
   - Keep/release functionality
   - Roll counter with pip indicators
   - Spectator mode for watching opponents

2. **Die.svelte** - Individual die component
   - Animated faces (Unicode dice symbols)
   - Keep/release visual states
   - Hover and active states
   - Suggestion highlighting

### Game Management Components

**Location:** `/src/lib/components/game/`

1. **MultiplayerGameView.svelte** - Main game container
   - Smart responsive layout (mobile/desktop)
   - Turn management and state orchestration
   - Settings and chat integration
   - Keyboard navigation support

2. **MultiplayerScorecard.svelte** - Player scoring interface
   - 13 scoring categories
   - WASM-powered probability analysis
   - Visual score indicators
   - Category availability states

3. **OpponentPanel.svelte** - Opponent information display
   - Avatar and score display
   - Turn status indicators
   - AI activity animations

4. **TurnIndicator.svelte** - Current turn signaling
   - Visual turn ownership
   - Round progress tracking
   - AFK warning system

### Gallery & Spectator Components

**Location:** `/src/lib/components/gallery/`

1. **GalleryLeaderboard.svelte** - Spectator rankings
2. **PredictionPanel.svelte** - Outcome prediction system
3. **KibitzCorner.svelte** - Spectator discussion area
4. **SpectatorReactionBar.svelte** - Audience reactions
5. **WarmSeatTransition.svelte** - Player change animations

### UI Foundation Components

**Location:** `/src/lib/components/ui/`

1. **BottomSheet.svelte** - Mobile-optimized modal system
   - Spring animations
   - Focus management
   - Backdrop interactions
   - Escape key handling

2. **Avatar.svelte** - User avatar display system

---

## Responsive Design Strategy

### Mobile-First Approach

**Breakpoint System:**
- Mobile Portrait: 320-480px
- Mobile Landscape: 568-844px
- Tablet: 768-1024px
- Desktop: 1280px+
- Desktop Large: 1440px+

### Mobile Layout (< 768px)

**Layout Characteristics:**
- Single-column stacked layout
- Touch-optimized interaction (44px minimum touch targets)
- Virtual keyboard awareness with dynamic viewport handling
- Swipe gestures for navigation
- Bottom sheet modals for contextual actions

**Key Mobile Patterns:**

1. **Lobby Layout:**
   - Stacked game mode cards (vertical orientation)
   - Tab-based navigation (Games/Chat toggle)
   - Collapsible side panels
   - Pull-to-refresh functionality

2. **Game Layout:**
   - Dice tray centered with full-width roll button
   - Scorecard below dice (scrollable)
   - Mobile player bar with avatars and scores
   - Slide-up chat panel
   - Keyboard-aware layout adjustments

3. **Navigation:**
   - Bottom navigation for primary actions
   - Swipe gestures for dice selection
   - Long-press for contextual menus
   - Haptic feedback integration

### Desktop Layout (≥ 768px)

**Layout Characteristics:**
- Multi-column grid layouts
- Hover states and micro-interactions
- Keyboard shortcuts and navigation
- Fixed positioning for persistent elements
- Mouse-optimized interaction patterns

**Key Desktop Patterns:**

1. **Lobby Layout:**
   - Three-column grid (Games:Chat = 2:1 ratio)
   - Hover states on interactive elements
   - Keyboard shortcuts for quick actions
   - Persistent side panels

2. **Game Layout:**
   - Three-column layout (240px | 1fr | 280px)
   - Fixed sidebar with opponent info
   - Centered dice tray with quick actions
   - Persistent scorecard panel
   - Floating chat overlay

3. **Interaction Enhancements:**
   - Tooltip system for contextual help
   - Keyboard navigation (R for roll, 1-5 for dice)
   - Right-click context menus
   - Drag-and-drop functionality

### Cross-Platform Considerations

**Viewport Handling:**
- Dynamic viewport height (dvh) with JavaScript fallbacks
- Safe area insets for notched devices
- Visual Viewport API for keyboard detection
- Pinch-zoom prevention for game stability

**Performance Optimizations:**
- Component lazy loading for mobile
- Optimized animations with GPU acceleration
- Reduced motion support
- Touch-action controls for gesture conflicts

---

## Layout Systems

### Lobby Layout Structure

**Desktop Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header (Logo | Online Users | Settings | Profile)        │
├─────────────────────────────────────────────────────────┤
│ Mode Cards (SOLO | QUICK PLAY | MULTIPLAYER)           │
├─────────────────────────────────────────────────────────┤
│ Games Panel (2fr)        │ Chat Panel (1fr)           │
│ ┌─────────────────────┐   │ ┌─────────────────────┐   │
│ │ Room Cartridges     │   │ │ Global Chat         │   │
│ │ • Open Games        │   │ │ • Messages          │   │
│ │ • Live Games        │   │ │ • User List         │   │
│ │ • Create Room       │   │ │ • Quick Chat        │   │
│ └─────────────────────┘   │ └─────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Mobile Layout:**
```
┌─────────────────────────┐
│ Header (Logo | Settings)│
├─────────────────────────┤
│ Mode Cards (Stacked)    │
│ ┌─────────────────────┐ │
│ │ SOLO                 │ │
│ ├─────────────────────┤ │
│ │ QUICK PLAY           │ │
│ ├─────────────────────┤ │
│ │ MULTIPLAYER          │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ Tab Toggle (Games|Chat) │
├─────────────────────────┤
│ Active Panel            │
│ ┌─────────────────────┐ │
│ │ (Games or Chat)     │ │
│ │ Content Area        │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Game Layout Structure

**Desktop Layout (3-Column):**
```
┌─────────────────────────────────────────────────────────┐
│ Header (Leave | Settings | Round | Chat)               │
├─────────┬─────────────────────────┬─────────────────────┤
│ Sidebar │ Game Main               │ Scorecard           │
│ (240px) │                         │ (280px)             │
│ ┌─────┐ │ ┌─────────────────────┐ │ ┌─────────────────┐ │
│ │Turn │ │ │    Dice Tray        │ │ │ Scoring         │ │
│ │Info │ │ │ ┌─────┐ ┌─────┐     │ │ │ Categories      │ │
│ │     │ │ │ │⚀⚁⚂│ │⚃⚄⚅│     │ │ │ • Ones          │ │
│ ├─────┤ │ │ └─────┘ └─────┘     │ │ │ • Twos          │ │
│ │Opp  │ │ │   ROLL DICE         │ │ │ • Threes        │ │
│ │onents│ │ │   [Keep All]        │ │ │ • DICEE!        │ │
│ │     │ │ │   [Release All]     │ │ │ • Chance        │ │
│ │ • A │ │ └─────────────────────┘ │ └─────────────────┘ │
│ │ • B │ │ Turn Status            │                     │ │
│ │ • C │ │ Your turn! Roll dice   │                     │ │
│ └─────┘ │ Keys: R 1-5 C          │                     │ │
└─────────┴─────────────────────────┴─────────────────────┘
```

**Mobile Layout (Stacked):**
```
┌─────────────────────────┐
│ Header (Leave | Round)  │
├─────────────────────────┤
│ Player Bar              │
│ [You] [A] [B] [C]       │
├─────────────────────────┤
│ Dice Tray               │
│ ┌─────┐ ┌─────┐         │
│ │⚀⚁⚂│ │⚃⚄⚅│         │
│ └─────┘ └─────┘         │
│   🎲 START YOUR TURN    │
├─────────────────────────┤
│ Turn Status             │
│ Your turn! Roll dice    │
├─────────────────────────┤
│ Scorecard               │
│ ┌─────────────────────┐ │
│ │ • Ones          [ ] │ │
│ │ • Twos          [ ] │ │
│ │ • Threes        [ ] │ │
│ │ • DICEE!        [ ] │ │
│ │ • Chance        [ ] │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ Chat Panel (Slide-up)   │
└─────────────────────────┘
```

---

## Interactive Elements

### Button System

**Primary Button (.btn):**
- Background: Electric gold (`#ffd700`)
- Thick black border (3px)
- Bold uppercase typography
- Hover: Translate up 2px + darker gold
- Active: Return to base position
- Disabled: Gray background with reduced opacity

**Secondary Button (.btn-secondary):**
- Background: White surface
- Black border
- Hover: Light gray background

**Ghost Button (.btn-ghost):**
- Transparent background
- Thin black border
- Hover: Light gold background

### Form Elements

**Input Fields:**
- White background with black border
- Monospace font for codes/room IDs
- Focus state: Gold outline
- Error state: Red border and text

**Checkboxes/Radio:**
- Custom styled with black borders
- Gold accent for selected states
- Keyboard accessible

### Feedback Systems

**Loading States:**
- Dice rolling animations
- Button pulse effects
- Progress indicators
- Skeleton screens for content

**Success/Error States:**
- Color-coded banners
- Icon-based indicators
- ARIA live regions for screen readers
- Haptic feedback on mobile

**Hover States:**
- Transform effects (-2px translate)
- Shadow enhancements
- Color transitions
- Tooltip appearances

---

## Animation & Motion Design

### Animation Principles

**Neo-Brutalist Motion:**
- Functional, not decorative
- Fast and responsive (150-300ms)
- GPU-accelerated transforms
- Reduced motion support

### Key Animations

**Dice Rolling:**
- 3D rotation effects
- Random bounce patterns
- Landing synchronization
- Haptic feedback integration

**UI Transitions:**
- Slide-up bottom sheets (cubic-bezier easing)
- Fade-in overlays
- Transform-based hover states
- Attention pulses for CTAs

**Micro-interactions:**
- Button press feedback
- Card hover lifts
- Chat message slides
- Score updates

### Performance Considerations

**Optimization Techniques:**
- `transform` and `opacity` for GPU acceleration
- `will-change` for complex animations
- Animation worklets for dice physics
- Reduced motion media queries

---

## Accessibility Features

### WCAG Compliance

**Level AA Standards:**
- Color contrast ratios (≥ 4.5:1 for normal text)
- Keyboard navigation for all interactive elements
- Screen reader compatibility
- Focus management in modals

### Keyboard Navigation

**Game Controls:**
- `R` - Roll dice
- `1-5` - Toggle keep dice
- `C` - Toggle chat
- `Escape` - Close modals/chat

**Navigation:**
- Tab order follows visual hierarchy
- Skip links for main content
- Focus indicators on all interactive elements
- ARIA labels for complex components

### Screen Reader Support

**Semantic HTML:**
- Proper heading hierarchy
- List structures for navigation
- Button roles for interactive elements
- Live regions for dynamic content

**ARIA Attributes:**
- `aria-label` for icon-only buttons
- `aria-describedby` for form help
- `aria-expanded` for collapsible content
- `aria-live` for status updates

---

## Technical Implementation

### CSS Architecture

**Token-Based Design System:**
- CSS custom properties for theming
- Component-scoped styles
- Utility classes for common patterns
- Responsive design with mobile-first media queries

**Key Files:**
- `global.css` - Base styles and utilities
- `tokens.css` - Design system tokens
- `cartridge-tokens.css` - Room identity system

### Component Patterns

**Svelte 5 Features:**
- `$state()` for reactive state
- `$derived()` for computed values
- `$effect()` for side effects
- Snippets for content projection

**State Management:**
- Stores for global state (auth, game, chat)
- Local component state for UI
- Props for configuration
- Events for communication

### Performance Optimizations

**Bundle Size:**
- Component lazy loading
- Icon optimization
- CSS purging for unused styles
- Image optimization and WebP support

**Runtime Performance:**
- Virtual scrolling for long lists
- Debounced resize handlers
- Optimized animation frames
- Memory leak prevention

---

## Mobile-Specific Features

### Touch Interactions

**Gesture Support:**
- Swipe to navigate between tabs
- Long-press for context menus
- Pull-to-refresh for content
- Haptic feedback integration

**Touch Targets:**
- Minimum 44px touch targets
- Comfortable 56px for primary actions
- Spacing between interactive elements
- Palm rejection for game area

### Virtual Keyboard Handling

**Viewport Management:**
- Dynamic viewport height calculation
- Visual Viewport API integration
- Safe area inset handling
- Keyboard-aware layout adjustments

**Input Optimization:**
- Appropriate keyboard types
- Auto-complete suggestions
- Input mode specifications
- Focus management

### iOS Safari Optimizations

**Viewport Configuration:**
- `viewport-fit=cover` for full-bleed design
- `interactive-widget=resizes-content` for keyboard handling
- Safe area inset support
- Pinch-zoom prevention in game areas

**Performance:**
- GPU compositing for smooth animations
- Memory management for large game sessions
- Battery optimization considerations
- Background tab handling

---

## Desktop Enhancements

### Keyboard Shortcuts

**Game Shortcuts:**
- `Space/Enter` - Primary action (Roll)
- `1-5` - Toggle dice keep state
- `A` - Keep all dice
- `D` - Release all dice
- `C` - Toggle chat panel
- `S` - Open settings
- `Escape` - Close modals/panels

**Navigation Shortcuts:**
- `Tab/Shift+Tab` - Navigate elements
- `Arrow Keys` - Navigate lists/grids
- `Enter/Space` - Activate focused element
- `Escape` - Cancel/close current action

### Mouse Interactions

**Hover States:**
- Button transformations
- Tooltip appearances
- Card lifting effects
- Interactive element highlighting

**Context Menus:**
- Right-click for additional options
- Custom context menus for game elements
- Quick actions for user management
- Developer tools integration

### Multi-Monitor Support

**Window Management:**
- Responsive sizing for various screen sizes
- Minimum width constraints (320px)
- Maximum width optimization (1200px)
- Dynamic layout adjustments

---

## Brand & Visual Identity

### Cartridge System

**Room Identity:**
- 13 unique color cartridges for room differentiation
- Pattern overlays for visual texture
- Consistent naming and coding systems
- Dark mode adaptations

**Color Palette:**
- Flamingo, Mint, Sky, Orchid, Sherbet
- Slime, Concrete, Coral, Teal, Lavender
- Peach, Sage, Plum
- All colors meet WCAG AA contrast requirements

### Iconography

**Dice Symbols:**
- Unicode dice faces (⚀⚁⚂⚃⚄⚅)
- Consistent sizing and positioning
- Animation-ready structure
- Fallback icons for compatibility

**UI Icons:**
- SVG-based for scalability
- Consistent stroke width (2px)
- Black fill for Neo-Brutalist style
- Hover state variations

---

## Future Considerations

### Scalability

**Component Library:**
- Design system documentation
- Component storybook
- Automated testing for visual regressions
- Version-controlled design tokens

**Internationalization:**
- RTL language support
- Text expansion accommodations
- Cultural color considerations
- Localization-ready components

### Enhancement Opportunities

**Advanced Features:**
- Theme system (dark mode ready)
- Advanced animations
- Voice control integration
- Eye-tracking support

**Performance:**
- Service worker for offline play
- WebAssembly optimizations
- Streaming for large datasets
- Edge computing integration

---

## Conclusion

Dicee's UI/UX design represents a sophisticated implementation of Neo-Brutalist principles combined with modern responsive design practices. The system successfully balances visual distinctiveness with functional usability, providing an engaging experience across all device types.

**Strengths:**
- Strong visual identity with consistent design language
- Comprehensive mobile optimization with thoughtful touch interactions
- Robust accessibility foundation with WCAG AA compliance
- Modular component architecture enabling maintainable development
- Performance-conscious implementation with smooth animations

**Areas for Future Enhancement:**
- Dark mode implementation (tokens are prepared)
- Advanced personalization options
- Enhanced spectator features
- Expanded accessibility features (voice control, eye-tracking)

The design system provides a solid foundation for scaling the application while maintaining its unique character and user experience quality.

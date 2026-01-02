## Code Investigation Directive

**Priority**: CRITICAL - The refresh-cascade-disconnection issue is game-breaking and likely indicates a fundamental flaw in the session persistence implementation.

---

### Investigation 1: Refresh Causing Cascading Disconnections (CRITICAL)

**Symptom**: Player refreshes page → player disconnected → OTHER players removed → nobody can rejoin from lobby.

This suggests the WebSocket `close` event is triggering destructive cleanup that shouldn't happen on a refresh, and possibly corrupting room state.

**Examine these code paths in order:**

1. **WebSocket close handler in `GameRoom.ts`**
   - Find `webSocketClose()` or equivalent close handler
   - Document: What cleanup actions fire on socket close?
   - Specifically: Does it differentiate between "browser closed" vs "page refresh" vs "network blip"?
   - Check: Is there a delay/debounce before marking a seat as disconnected?

2. **Seat cleanup logic**
   - Find where `PlayerSeat.isConnected` gets set to `false`
   - Find where seats get deleted/removed entirely
   - Check: Is there a race condition where multiple disconnect events fire?
   - Check: Is there alarm/timeout cancellation logic that might be clearing other players' seats?

3. **Room state corruption vector**
   - Find the `RoomState` update logic triggered by disconnection
   - Check: Could a single player's disconnect trigger room-wide state changes (status → abandoned, clearing player list)?
   - Examine: What happens if `notifyLobbyOfUpdate()` is called during partial state?

4. **The new `checkIfRoomShouldPause()` implementation**
   - This was just added - is it triggering prematurely?
   - Is the "zero connected players" check racing with reconnection?

5. **Lobby's room directory**
   - When a player can't rejoin, what does `GlobalLobby`'s room directory show?
   - Is the room being deleted/marked inactive when it shouldn't be?

**Output required**: 
- Sequence diagram of what happens when `webSocketClose` fires
- Identification of any destructive operations that don't have grace periods
- The exact condition that causes "other players removed"

---

### Investigation 2: Mobile Viewport/Zoom Clipping

**Symptom**: Bottom of screen cut off when zooming on iPhone Chrome, affects in-game and chat but NOT main lobby.

**Examine:**

1. **Viewport meta tags**
   - Find all `<meta name="viewport">` declarations
   - Check if different layouts have different viewport settings
   - Look for: `maximum-scale=1`, `user-scalable=no`, or missing `viewport-fit=cover`

2. **CSS differences between lobby and game views**
   - Find the root layout CSS for:
     - Main lobby (`lobby.svelte` or equivalent)
     - Game view (`room.svelte` or equivalent)  
     - Chat component
   - Look for differences in:
     - `height: 100vh` vs `100dvh` vs `100%`
     - `position: fixed` usage
     - `overflow` settings
     - Safe area inset handling (`env(safe-area-inset-bottom)`)

3. **Container hierarchy**
   - Map the DOM nesting from `<html>` → game container
   - Check for `overflow: hidden` on parent elements that would clip content

4. **iOS-specific CSS**
   - Search for `-webkit-` prefixed properties
   - Check for `touch-action` settings that might interact with zoom

**Output required**:
- Side-by-side comparison of viewport/layout CSS: lobby vs game view
- Identification of which specific container causes the clipping

---

### Investigation 3: Emoji Rendering on Pinch

**Symptom**: Emojis invisible until pinch-zoom, then immediately retract.

**Examine:**

1. **Emoji rendering method**
   - How are emojis rendered? Native Unicode? Image sprites? SVG?
   - Is there a custom emoji component with conditional rendering?

2. **Font loading**
   - Check if there's an emoji font that might not be loading
   - Look for `@font-face` declarations related to emojis

3. **CSS visibility triggers**
   - Look for emoji-related CSS with:
     - `opacity` or `visibility` that might be 0/hidden
     - `transform: scale(0)` 
     - Conditional classes based on viewport size
   - Check if pinch-zoom triggers a resize event that toggles visibility

4. **Intersection Observer or lazy loading**
   - Is there lazy rendering that requires elements to be "in viewport"?
   - Pinch might be triggering a re-evaluation of what's visible

**Output required**:
- The emoji rendering pipeline (component → CSS → rendered output)
- Any viewport-dependent conditional logic

---

### Required Report Format

```markdown
## Investigation Report: [Issue Name]

### Files Examined
- `path/to/file.ts` (lines X-Y): [what this section does]

### Root Cause Analysis
[Detailed explanation with code snippets]

### Sequence of Events Leading to Bug
1. User action
2. Code path triggered
3. Unexpected state change
4. Visible symptom

### Recommended Fix
[Specific code changes with rationale]

### Risk Assessment
- What else might this fix affect?
- What tests should be added?
```

---

### Priority Order

1. **CRITICAL**: Investigation 1 (cascading disconnection) - This is game-breaking
2. **HIGH**: Investigation 2 (viewport clipping) - Blocks gameplay on common devices
3. **MEDIUM**: Investigation 3 (emoji rendering) - Cosmetic but frustrating

Begin with Investigation 1 and provide the sequence diagram before proceeding to fixes. The cascading disconnection suggests either a state corruption bug in the new implementation or a pre-existing race condition that the new code exposed.
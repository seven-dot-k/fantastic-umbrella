
---

**Prompt:**

Create a **2D top-down murder mystery game** using **PIXIJS** with a soft, “cute” pixel-art aesthetic inspired by cozy farming/adventure games.

### Core Gameplay

* The player controls a character using:

  * **WASD** for movement
  * **E** for interaction
* Movement should feel smooth and responsive with simple collision handling.

---

### Map & Environment

* The game takes place in a **single large room inside an old mansion**.
* The room should feel slightly mysterious but still stylized and charming (not horror).
* Include furniture, rugs, shelves, and subtle environmental storytelling elements.
* The layout should encourage exploration but remain fully visible (no camera transitions).

---

### NPC System

* Place **5–6 NPCs** scattered throughout the room.
* Each NPC should have:

  * A **name**
  * A **mood state** (e.g., nervous, calm, defensive, suspicious)
  * A simple idle animation

#### Interaction

* When the player is near an NPC:

  * Show a floating prompt: **“E to interact”**
* Pressing **E** opens a **dialogue UI panel**:

  * Styled like a cozy RPG conversation window
  * Displays:

    * NPC name
    * Portrait/avatar
    * Dialogue text (prose-style)
  * Text appears in a readable, slightly stylized font
  * Option to advance dialogue with input

---

### Clue System

* Place **2–3 clue items** in the environment.
* Clues should visually stand out slightly (glow, sparkle, or outline).
* When the player is near a clue:

  * Show **“E to interact”**
* On interaction:

  * Open the same dialogue UI
  * Display clue description text
  * Store clue in an internal “discovered clues” list

---

### Accusation Mechanic

* In the **center of the room**, place a distinct object (e.g., table, statue, or ritual circle).
* When the player interacts with it:

  * Trigger the **“Accuse” phase**
  * Present a UI where the player selects one NPC as the culprit
  * (Basic version: simple selection list; no need for complex logic unless extended)

---

### HUD / UI

* On the **left side of the screen**, display a **vertical HUD panel**:

  * Shows all NPCs
  * Each entry includes:

    * Name
    * Small avatar
    * Current mood indicator (icon or color-coded)
* The HUD updates dynamically if moods change (optional but preferred).

---

### Interaction Feedback

* When the player is within interaction range of an NPC or clue:

  * Show a **floating text prompt above the object/NPC**:

    * “E to interact”
  * Prompt should fade in/out smoothly

---

### Visual Style

* Overall aesthetic:

  * **Cute, soft, pixel-art style**
  * Warm color palette with slightly muted tones
  * Rounded, friendly character designs
* Lighting:

  * Subtle ambient lighting (slightly dim to suggest mystery, but not dark)
* Animations:

  * Simple walk cycles
  * Idle bobbing for NPCs

---

### Technical Notes

* Use **PIXIJS** for rendering
* Structure code into:

  * Scene management (game, UI, dialogue)
  * Entity system (player, NPCs, clues)
  * Input handling
* Keep logic modular for future expansion (inventory, branching dialogue, etc.)

---

# Theme & Character Creator Wizard — Implementation Plan

## 1. Data Schemas

### Custom Theme

```js
{
  id: "custom-ocean",          // string, unique kebab-case id (prefix "custom-" recommended)
  label: "Ocean Depths",       // string, display name
  icon: "🌊",                  // string, single emoji
  description: "Deep blues",   // string, tooltip text
  base: "dark",                // "dark" | "light" — which built-in palette to extend
  colors: {                    // object — only the CSS vars you want to override
    "--color-canvas": "#040b18",
    "--color-canvas-elevated": "#0a1628",
    "--color-surface-1": "#0e1c30",
    "--color-accent-primary": "#5bb8ff",
    "--color-text-primary": "#e8f0ff",
    // ... any other --color-* vars from colors.css
  }
}
```

**Validation rules:**
- `id` must be non-empty, unique among all themes (built-in + custom), kebab-case recommended
- `label` must be non-empty, max 40 chars
- `base` must be `"dark"` or `"light"`
- `colors` must be a non-empty object
- Each key in `colors` must start with `"--color-"`
- Each value in `colors` must be a valid CSS color string (basic validation: non-empty, no semicolons)

### Custom Character

```js
{
  id: "custom-alien",          // string, unique kebab-case id (prefix "custom-" recommended)
  name: "Zyx",                 // string, display name, max 30 chars
  emoji: "👽",                  // string, single emoji
  description: "Alien scientist", // string, tooltip, max 80 chars
  avatar: "",                  // string, URL or data URI (empty = use emoji)
  systemPromptPrefix: "You are Zyx, an alien scientist..." // string, prepended to system prompt
}
```

**Validation rules:**
- `id` must be non-empty, unique among all characters (built-in + custom), kebab-case recommended
- `name` must be non-empty, max 30 chars
- `emoji` must be non-empty
- `description` max 80 chars
- `avatar` optional (empty string = use emoji fallback)
- `systemPromptPrefix` optional, max 2000 chars

---

## 2. Storage Strategy

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `"space.customThemes"` | JSON array of custom theme objects |
| `"space.customCharacters"` | JSON array of custom character objects |

### Persistence Flow

```
On init():
  1. Read built-in THEMES from config.js
  2. Read localStorage["space.customThemes"] → parse JSON → validate each entry
  3. Merge: allThemes = [...THEMES, ...validatedCustomThemes]
  4. Same for CHARACTERS

On create custom theme:
  1. Validate input against schema
  2. Read current custom themes from localStorage
  3. Append new theme (check id uniqueness against both built-in and custom)
  4. Write back to localStorage["space.customThemes"]
  5. Inject <style id="theme-{id}"> into <head>
  6. Update store's merged list

On delete custom theme:
  1. Remove from localStorage array
  2. Remove <style id="theme-{id}"> from <head>
  3. If active theme was the deleted one, fall back to DEFAULT_THEME
  4. Update store's merged list
```

### Merge Logic (in store.js)

```js
// In store.js — replaces direct THEMES/CHARACTERS references in getters

function getMergedThemes() {
  const customs = loadCustomThemes(); // reads + validates localStorage
  return [...config.THEMES, ...customs];
}

function getMergedCharacters() {
  const customs = loadCustomCharacters();
  return [...config.CHARACTERS, ...customs];
}

// The getters become:
get themes() { return getMergedThemes(); }
get characters() { return getMergedCharacters(); }

// findTheme / findCharacter must search the merged list
function findTheme(themeId) {
  return getMergedThemes().find(t => t.id === themeId) || config.THEMES[0];
}
function findCharacter(characterId) {
  return getMergedCharacters().find(c => c.id === characterId) || config.CHARACTERS[0];
}
```

### What Persists Where

| Data | Storage | Reason |
|------|---------|--------|
| Active theme id | `localStorage["space.theme"]` + server YAML | Fast reload + cross-device |
| Active character id | `localStorage["space.character"]` + server YAML | Fast reload + cross-device |
| Custom theme definitions | `localStorage["space.customThemes"]` only | CSS-only, per-browser |
| Custom character definitions | `localStorage["space.customCharacters"]` only | Simple JSON, per-browser |

Custom themes/characters are **not** saved to the server YAML because:
- Themes generate dynamic `<style>` tags that are inherently browser-local
- Characters are lightweight JSON that can live in localStorage
- This avoids polluting the server config with UI-local data

---

## 3. UI Wireframes

### 3A. Settings Dialog — Add "Create" Buttons

In the existing settings dialog (`panel.html` lines ~337–370), after the theme selector and character selector, add small "+" buttons:

```
┌─────────────────────────────────────────────────────┐
│  Theme                                              │
│  ┌─────┐ ┌─────┐ ┌─────┐                           │
│  │ 🌙  │ │ ☀️  │ │ 💻  │  [+ Create]               │
│  │Dark │ │Light│ │Sys  │                           │
│  └─────┘ └─────┘ └─────┘                           │
│                                                     │
│  Character                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│  │ 🤖  │ │ 🦾  │ │ 🧙  │ │ 🐱  │  [+ Create]      │
│  │Space│ │BEEP │ │Sage │ │Whisk│                   │
│  └─────┘ └─────┘ └─────┘ └─────┘                  │
└─────────────────────────────────────────────────────┘
```

### 3B. Theme Creator Wizard Dialog

A new `<dialog>` element, opened from the [+ Create] button next to the theme selector:

```
┌──────────────────────────────────────────────────────┐
│  Create Custom Theme                           [×]   │
│──────────────────────────────────────────────────────│
│                                                      │
│  Theme ID     [custom-ocean                    ]     │
│  Display Name [Ocean Depths                   ]     │
│  Icon         [🌊]  (emoji picker or free text)     │
│  Description  [Deep blue underwater theme    ]     │
│                                                      │
│  Base Palette  (●) Dark   ( ) Light                  │
│                                                      │
│  ── Color Overrides ──────────────────────────────   │
│                                                      │
│  Canvas        [#040b18 ■]  [Reset]                 │
│  Surface 1     [#0e1c30 ■]  [Reset]                 │
│  Accent Primary[#5bb8ff ■]  [Reset]                 │
│  Text Primary  [#e8f0ff ■]  [Reset]                 │
│  ... (collapsible "Show all 30 colors" section)      │
│                                                      │
│  ── Live Preview ─────────────────────────────────   │
│  ┌──────────────────────────────────────────────┐   │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│  │  ░ Sample text in the selected theme...     ░  │   │
│  │  ░ [Button]  [Input field]                  ░  │   │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│              [Cancel]  [Save Theme]                  │
└──────────────────────────────────────────────────────┘
```

**Interaction details:**
- Color inputs use native `<input type="color">` with a text field showing the hex value
- Each color row has a "Reset" button that reverts to the base palette's default
- The live preview panel applies the draft colors via an inline `<style>` scoped to the preview container
- On save: validates, writes to localStorage, injects a `<style>` tag into `<head>`, closes dialog, refreshes the theme selector

### 3C. Character Creator Wizard Dialog

```
┌──────────────────────────────────────────────────────┐
│  Create Custom Character                       [×]   │
│──────────────────────────────────────────────────────│
│                                                      │
│  Character ID     [custom-alien                 ]    │
│  Display Name     [Zyx                          ]    │
│  Emoji            [👽]                                │
│  Description      [Alien scientist from Kepler-22b]  │
│                                                      │
│  Avatar                                                 │
│  ┌──────────┐  [Upload Image]  [Clear]              │
│  │ 👽       │                                        │
│  │(preview) │  or paste URL: [                    ]  │
│  └──────────┘                                        │
│                                                      │
│  System Prompt Prefix                                │
│  ┌──────────────────────────────────────────────┐   │
│  │ You are Zyx, an alien scientist from the     │   │
│  │ Kepler-22b system. You speak with curious    │   │
│  │ wonder about Earth and its inhabitants...    │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│  (This prefix is prepended to your system prompt)    │
│                                                      │
│  ── Live Preview ─────────────────────────────────   │
│  ┌──────────────────────────────────────────────┐   │
│  │  ┌────┐                                      │   │
│  │  │ 👽 │  Zyx                                 │   │
│  │  └────┘  Alien scientist from Kepler-22b     │   │
│  │          [This is how your character card    │   │
│  │           will appear in the selector]       │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│              [Cancel]  [Save Character]              │
└──────────────────────────────────────────────────────┘
```

**Interaction details:**
- Avatar upload: `<input type="file" accept="image/*">` → read as data URL → store in the `avatar` field
- Character ID auto-suggests from name (slugify "Zyx" → "custom-zyx") but user can override
- Live preview shows the character card exactly as it will appear in the selector
- On save: validates, writes to localStorage, closes dialog, refreshes the character selector

### 3D. Edit/Delete Actions

In the theme and character selectors, custom items get a small "⋮" (vertical ellipsis) button on hover:

```
┌─────┐
│ 🌊  │  ← custom theme
│Ocean│
│  ⋮  │  ← hover reveals this
└─────┘
```

Clicking "⋮" shows a tiny dropdown:
- **Edit** — opens the creator wizard pre-filled with current values
- **Delete** — confirmation toast "Delete 'Ocean Depths'?" [Cancel] [Delete]

Built-in themes/characters do NOT get the "⋮" button (they're immutable).

---

## 4. Agent API

The agent can create themes and characters by calling store methods directly from the browser console or via `space.extend()` hooks.

### Create a Custom Theme

```js
// From browser console or agent script:
$store.onscreenAgent.createCustomTheme({
  id: "custom-ocean",
  label: "Ocean Depths",
  icon: "🌊",
  description: "Deep blue underwater theme",
  base: "dark",
  colors: {
    "--color-canvas": "#040b18",
    "--color-canvas-elevated": "#0a1628",
    "--color-surface-1": "#0e1c30",
    "--color-surface-2": "#132238",
    "--color-accent-primary": "#5bb8ff",
    "--color-accent-primary-strong": "#3a9ae0",
    "--color-text-primary": "#e8f0ff",
    "--color-text-secondary": "#a0b4cc",
  }
});
// Returns: { success: true, theme: {...} }
// Or: { success: false, errors: ["id must be unique", ...] }
```

### Create a Custom Character

```js
$store.onscreenAgent.createCustomCharacter({
  id: "custom-alien",
  name: "Zyx",
  emoji: "👽",
  description: "Alien scientist from Kepler-22b",
  avatar: "",  // or data URL / image URL
  systemPromptPrefix: "You are Zyx, an alien scientist from the Kepler-22b system. You speak with curious wonder about Earth."
});
// Returns: { success: true, character: {...} }
```

### List Custom Themes / Characters

```js
$store.onscreenAgent.getCustomThemes();     // → [{...}, ...]
$store.onscreenAgent.getCustomCharacters(); // → [{...}, ...]
```

### Delete

```js
$store.onscreenAgent.deleteCustomTheme("custom-ocean");
$store.onscreenAgent.deleteCustomCharacter("custom-alien");
// Returns: { success: true }
```

### Update (Edit)

```js
$store.onscreenAgent.updateCustomTheme("custom-ocean", {
  label: "Ocean Deep",
  colors: { "--color-canvas": "#030810" }
});
// Partial update — only changed fields
```

### Full Agent Workflow Example

```js
// Agent wants to create a "sunset" theme and a "fire genie" character:

// 1. Create theme
const themeResult = $store.onscreenAgent.createCustomTheme({
  id: "custom-sunset",
  label: "Sunset Glow",
  icon: "🌅",
  description: "Warm sunset colors",
  base: "dark",
  colors: {
    "--color-canvas": "#1a0a00",
    "--color-canvas-elevated": "#2a1200",
    "--color-surface-1": "#331800",
    "--color-accent-primary": "#ff8c42",
    "--color-accent-primary-strong": "#ff6b1a",
    "--color-text-primary": "#fff0e6",
  }
});

// 2. Create character
const charResult = $store.onscreenAgent.createCustomCharacter({
  id: "custom-genie",
  name: "Ember",
  emoji: "🔥",
  description: "A wise fire genie",
  systemPromptPrefix: "You are Ember, a wise fire genie who has burned for millennia. You speak in warm, crackling metaphors."
});

// 3. Activate them
if (themeResult.success) $store.onscreenAgent.setTheme("custom-sunset");
if (charResult.success) $store.onscreenAgent.setCharacter("custom-genie");

// 4. Save to server config (persists active theme/character ids)
$store.onscreenAgent.persistConfig();
```

---

## 5. File-by-File Change List

### 5A. `config.js` — Add storage keys and validation helpers

**Location:** After the existing `THEME_STORAGE_KEY` and `CHARACTER_STORAGE_KEY` exports (around line 340).

**Changes:**
1. Add new exports:
   ```js
   export const CUSTOM_THEMES_STORAGE_KEY = "space.customThemes";
   export const CUSTOM_CHARACTERS_STORAGE_KEY = "space.customCharacters";
   ```

2. Add a frozen array of all CSS color variable names (for the theme creator UI):
   ```js
   export const THEME_COLOR_KEYS = Object.freeze([
     "--color-canvas",
     "--color-canvas-elevated",
     "--color-canvas-deep",
     "--color-surface-1",
     "--color-surface-2",
     "--color-surface-3",
     "--color-surface-glass",
     "--color-border-soft",
     "--color-border-strong",
     "--color-text-primary",
     "--color-text-secondary",
     "--color-text-tertiary",
     "--color-accent-primary",
     "--color-accent-primary-strong",
     "--color-accent-primary-soft",
     "--color-accent-secondary",
     "--color-accent-ink",
     "--color-status-success",
     "--color-status-warning",
     "--color-status-danger",
     "--color-layer-overlay",
     "--color-backdrop-glow-primary",
     "--color-backdrop-glow-secondary",
     "--color-backdrop-glow-depth",
     // ... all color vars from colors.css :root block
   ]);
   ```

3. Add a helper to get default colors for a base palette:
   ```js
   export function getThemeBaseColors(base) {
     // Returns an object with all --color-* values from colors.css
     // for the given base ("dark" or "light")
     // This is a static map — copy the values from colors.css :root and .theme-light
   }
   ```

4. Add validation functions:
   ```js
   export function validateCustomTheme(theme, existingCustoms) {
     const errors = [];
     if (!theme.id || typeof theme.id !== "string") errors.push("id is required");
     if (!theme.label || typeof theme.label !== "string") errors.push("label is required");
     if (!["dark", "light"].includes(theme.base)) errors.push("base must be 'dark' or 'light'");
     if (!theme.colors || typeof theme.colors !== "object") errors.push("colors object is required");
     // Check id uniqueness against built-in THEMES and existingCustoms
     if (THEMES.some(t => t.id === theme.id)) errors.push(`id '${theme.id}' conflicts with built-in theme`);
     if (existingCustoms.some(t => t.id === theme.id)) errors.push(`id '${theme.id}' already exists`);
     // Validate color keys
     for (const key of Object.keys(theme.colors)) {
       if (!key.startsWith("--color-")) errors.push(`invalid color key '${key}'`);
     }
     return errors;
   }

   export function validateCustomCharacter(character, existingCustoms) {
     const errors = [];
     if (!character.id || typeof character.id !== "string") errors.push("id is required");
     if (!character.name || typeof character.name !== "string") errors.push("name is required");
     if (character.name && character.name.length > 30) errors.push("name must be ≤30 chars");
     if (!character.emoji) errors.push("emoji is required");
     if (character.description && character.description.length > 80) errors.push("description must be ≤80 chars");
     if (character.systemPromptPrefix && character.systemPromptPrefix.length > 2000) errors.push("systemPromptPrefix must be ≤2000 chars");
     if (CHARACTERS.some(c => c.id === character.id)) errors.push(`id '${character.id}' conflicts with built-in character`);
     if (existingCustoms.some(c => c.id === character.id)) errors.push(`id '${character.id}' already exists`);
     return errors;
   }
   ```

### 5B. `store.js` — Core logic changes

**Changes:**

1. **New imports** (top of file):
   ```js
   import {
     CUSTOM_THEMES_STORAGE_KEY, CUSTOM_CHARACTERS_STORAGE_KEY,
     getThemeBaseColors, validateCustomTheme, validateCustomCharacter
   } from "/mod/_core/onscreen_agent/config.js";
   ```

2. **Replace `loadPersistedTheme` and `loadPersistedCharacter`** (lines 62–77) to also accept custom ids:
   ```js
   function loadCustomThemes() {
     try {
       const raw = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
       const parsed = JSON.parse(raw);
       if (!Array.isArray(parsed)) return [];
       return parsed.filter(t => validateCustomTheme(t, parsed).length === 0);
     } catch { return []; }
   }

   function loadCustomCharacters() {
     try {
       const raw = localStorage.getItem(CUSTOM_CHARACTERS_STORAGE_KEY);
       const parsed = JSON.parse(raw);
       if (!Array.isArray(parsed)) return [];
       return parsed.filter(c => validateCustomCharacter(c, parsed).length === 0);
     } catch { return []; }
   }

   function loadPersistedTheme() {
     try {
       const stored = localStorage.getItem(THEME_STORAGE_KEY);
       if (!stored) return null;
       // Check built-in
       if (config.THEMES.some(t => t.id === stored)) return stored;
       // Check custom
       const customs = loadCustomThemes();
       if (customs.some(t => t.id === stored)) return stored;
     } catch {}
     return null;
   }

   function loadPersistedCharacter() {
     try {
       const stored = localStorage.getItem(CHARACTER_STORAGE_KEY);
       if (!stored) return null;
       if (config.CHARACTERS.some(c => c.id === stored)) return stored;
       const customs = loadCustomCharacters();
       if (customs.some(c => c.id === stored)) return stored;
     } catch {}
     return null;
   }
   ```

3. **Replace `findTheme` and `findCharacter`** (lines 58–61) to search merged lists:
   ```js
   function findTheme(themeId) {
     const merged = [...config.THEMES, ...loadCustomThemes()];
     return merged.find(t => t.id === themeId) || config.THEMES[0];
   }

   function findCharacter(characterId) {
     const merged = [...config.CHARACTERS, ...loadCustomCharacters()];
     return merged.find(c => c.id === characterId) || config.CHARACTERS[0];
   }
   ```

4. **Replace `get themes()` and `get characters()` getters** (lines 1716, 1720):
   ```js
   get themes() {
     return [...config.THEMES, ...loadCustomThemes()];
   },

   get characters() {
     return [...config.CHARACTERS, ...loadCustomCharacters()];
   },
   ```

5. **Replace `applyTheme`** (line 18) to handle custom themes:
   ```js
   function applyTheme(themeId) {
     const root = document.documentElement;
     root.classList.remove("theme-light");

     // Check if it's a custom theme
     const customThemes = loadCustomThemes();
     const custom = customThemes.find(t => t.id === themeId);

     if (custom) {
       // Remove any previously injected custom theme styles
       document.querySelectorAll("style[data-custom-theme]").forEach(el => el.remove());
       // Inject custom theme <style>
       const styleEl = document.createElement("style");
       styleEl.setAttribute("data-custom-theme", custom.id);
       const baseColors = getThemeBaseColors(custom.base);
       const mergedColors = { ...baseColors, ...custom.colors };
       const cssVars = Object.entries(mergedColors)
         .map(([k, v]) => `    ${k}: ${v};`)
         .join("\n");
       styleEl.textContent = `:root {\n${cssVars}\n}`;
       document.head.appendChild(styleEl);
       // Also handle light class if base is light
       if (custom.base === "light") {
         root.classList.add("theme-light");
       }
     } else if (themeId === "light") {
       root.classList.add("theme-light");
     } else if (themeId === "system") {
       const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
       if (prefersLight) root.classList.add("theme-light");
     }
     // Persist
     try { localStorage.setItem(THEME_STORAGE_KEY, themeId); } catch {}
   }
   ```

6. **Add new store methods** — insert after the `setCharacter` method (around line 1745):
   ```js
   // ─── Custom Theme CRUD ─────────────────────────────────────────────────

   getCustomThemes() {
     return loadCustomThemes();
   },

   getCustomCharacters() {
     return loadCustomCharacters();
   },

   createCustomTheme(themeInput) {
     const customs = loadCustomThemes();
     const errors = validateCustomTheme(themeInput, customs);
     if (errors.length > 0) return { success: false, errors };

     const theme = {
       id: String(themeInput.id).trim(),
       label: String(themeInput.label).trim(),
       icon: String(themeInput.icon || "🎨").trim(),
       description: String(themeInput.description || "").trim(),
       base: themeInput.base === "light" ? "light" : "dark",
       colors: { ...themeInput.colors }
     };

     customs.push(theme);
     try { localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customs)); } catch {}

     // Inject style
     applyTheme(theme.id);

     this.render();
     return { success: true, theme };
   },

   updateCustomTheme(themeId, updates) {
     const customs = loadCustomThemes();
     const idx = customs.findIndex(t => t.id === themeId);
     if (idx === -1) return { success: false, errors: ["Theme not found"] };

     const updated = { ...customs[idx], ...updates };
     // Ensure id doesn't change
     updated.id = themeId;
     const errors = validateCustomTheme(updated, customs.filter((_, i) => i !== idx));
     if (errors.length > 0) return { success: false, errors };

     customs[idx] = updated;
     try { localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customs)); } catch {}

     // Re-inject style
     document.querySelectorAll(`style[data-custom-theme="${themeId}"]`).forEach(el => el.remove());
     if (this.settings.theme === themeId) applyTheme(themeId);

     this.render();
     return { success: true, theme: updated };
   },

   deleteCustomTheme(themeId) {
     const customs = loadCustomThemes().filter(t => t.id !== themeId);
     try { localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customs)); } catch {}

     // Remove injected style
     document.querySelectorAll(`style[data-custom-theme="${themeId}"]`).forEach(el => el.remove());

     // If this was the active theme, fall back
     if (this.settings.theme === themeId) {
       this.setTheme(DEFAULT_THEME);
       applyTheme(DEFAULT_THEME);
     }

     this.render();
     return { success: true };
   },

   // ─── Custom Character CRUD ─────────────────────────────────────────────

   createCustomCharacter(charInput) {
     const customs = loadCustomCharacters();
     const errors = validateCustomCharacter(charInput, customs);
     if (errors.length > 0) return { success: false, errors };

     const character = {
       id: String(charInput.id).trim(),
       name: String(charInput.name).trim(),
       emoji: String(charInput.emoji || "🙂").trim(),
       description: String(charInput.description || "").trim(),
       avatar: String(charInput.avatar || "").trim(),
       systemPromptPrefix: String(charInput.systemPromptPrefix || "").trim()
     };

     customs.push(character);
     try { localStorage.setItem(CUSTOM_CHARACTERS_STORAGE_KEY, JSON.stringify(customs)); } catch {}

     this.render();
     return { success: true, character };
   },

   updateCharacter(characterId, updates) {
     const customs = loadCustomCharacters();
     const idx = customs.findIndex(c => c.id === characterId);
     if (idx === -1) return { success: false, errors: ["Character not found"] };

     const updated = { ...customs[idx], ...updates };
     updated.id = characterId;
     const errors = validateCustomCharacter(updated, customs.filter((_, i) => i !== idx));
     if (errors.length > 0) return { success: false, errors };

     customs[idx] = updated;
     try { localStorage.setItem(CUSTOM_CHARACTERS_STORAGE_KEY, JSON.stringify(customs)); } catch {}

     if (this.settings.characterId === characterId) {
       this.applyCharacterAvatar(updated);
     }

     this.render();
     return { success: true, character: updated };
   },

   deleteCustomCharacter(characterId) {
     const customs = loadCustomCharacters().filter(c => c.id !== characterId);
     try { localStorage.setItem(CUSTOM_CHARACTERS_STORAGE_KEY, JSON.stringify(customs)); } catch {}

     if (this.settings.characterId === characterId) {
       this.setCharacter(DEFAULT_CHARACTER_ID);
     }

     this.render();
     return { success: true };
   },

   // ─── Creator Dialog State ──────────────────────────────────────────────

   creatorDialogMode: "",       // "" | "theme" | "character"
   creatorEditingId: null,      // null | string id of item being edited
   creatorDraftTheme: null,     // draft theme object while editing
   creatorDraftCharacter: null, // draft character object while editing

   openCreatorDialog(mode, editId = null) {
     this.creatorDialogMode = mode;
     this.creatorEditingId = editId;
     if (mode === "theme") {
       if (editId) {
         const existing = loadCustomThemes().find(t => t.id === editId);
         this.creatorDraftTheme = existing ? { ...existing, colors: { ...existing.colors } } : this._createEmptyThemeDraft();
       } else {
         this.creatorDraftTheme = this._createEmptyThemeDraft();
       }
     } else if (mode === "character") {
       if (editId) {
         const existing = loadCustomCharacters().find(c => c.id === editId);
         this.creatorDraftCharacter = existing ? { ...existing } : this._createEmptyCharacterDraft();
       } else {
         this.creatorDraftCharacter = this._createEmptyCharacterDraft();
       }
     }
     openDialog(resolveDialogRef(this.refs, "creatorDialog", CREATOR_DIALOG_ELEMENT_ID));
   },

   closeCreatorDialog() {
     closeDialog(resolveDialogRef(this.refs, "creatorDialog", CREATOR_DIALOG_ELEMENT_ID));
     this.creatorDialogMode = "";
     this.creatorEditingId = null;
     this.creatorDraftTheme = null;
     this.creatorDraftCharacter = null;
   },

   _createEmptyThemeDraft() {
     return {
       id: "custom-",
       label: "",
       icon: "🎨",
       description: "",
       base: "dark",
       colors: {}
     };
   },

   _createEmptyCharacterDraft() {
     return {
       id: "custom-",
       name: "",
       emoji: "🙂",
       description: "",
       avatar: "",
       systemPromptPrefix: ""
     };
   },

   creatorThemeColorPreviewStyle() {
     // Returns an inline style string for the live preview panel
     if (!this.creatorDraftTheme) return "";
     const baseColors = getThemeBaseColors(this.creatorDraftTheme.base);
     const merged = { ...baseColors, ...this.creatorDraftTheme.colors };
     return Object.entries(merged).map(([k, v]) => `${k}:${v}`).join(";");
   },

   creatorSaveTheme() {
     if (!this.creatorDraftTheme) return;
     const result = this.creatorEditingId
       ? this.updateCustomTheme(this.creatorEditingId, this.creatorDraftTheme)
       : this.createCustomTheme(this.creatorDraftTheme);
     if (result.success) {
       this.closeCreatorDialog();
       showToast(this.creatorEditingId ? "Theme updated!" : "Theme created!", { tone: "success" });
     } else {
       showToast(result.errors.join("; "), { tone: "error" });
     }
   },

   creatorSaveCharacter() {
     if (!this.creatorDraftCharacter) return;
     const result = this.creatorEditingId
       ? this.updateCharacter(this.creatorEditingId, this.creatorDraftCharacter)
       : this.createCustomCharacter(this.creatorDraftCharacter);
     if (result.success) {
       this.closeCreatorDialog();
       showToast(this.creatorEditingId ? "Character updated!" : "Character created!", { tone: "success" });
     } else {
       showToast(result.errors.join("; "), { tone: "error" });
     }
   },

   creatorDeleteCurrentItem() {
     if (this.creatorDialogMode === "theme" && this.creatorEditingId) {
       this.deleteCustomTheme(this.creatorEditingId);
       this.closeCreatorDialog();
       showToast("Theme deleted.", { tone: "success" });
     } else if (this.creatorDialogMode === "character" && this.creatorEditingId) {
       this.deleteCustomCharacter(this.creatorEditingId);
       this.closeCreatorDialog();
       showToast("Character deleted.", { tone: "success" });
     }
   },
   ```

7. **Add constant** near the top with other constants (around line 119):
   ```js
   const CREATOR_DIALOG_ELEMENT_ID = "onscreen-agent-creator-dialog";
   ```

8. **In `init()` method** (line ~3442), after applying saved theme, inject any active custom theme's style tag:
   ```js
   // After applyTheme(this.settings.theme); line ~3491
   // Also inject style for custom themes on reload
   const activeTheme = findTheme(this.settings.theme);
   if (activeTheme.colors) {
     // It's a custom theme — applyTheme already injected it, but ensure it's there
     applyTheme(this.settings.theme);
   }
   ```

### 5C. `panel.html` — New UI elements

**Changes:**

1. **Add [+ Create] buttons** after the theme selector (after line ~351):
   ```html
   <!-- After the theme-select-wrap div, inside the Theme label -->
   <button
     type="button"
     class="creator-open-button"
     @click="$store.onscreenAgent.openCreatorDialog('theme')"
     title="Create a custom theme"
   >
     <x-icon>add</x-icon>
     <span>Create</span>
   </button>
   ```

2. **Add [+ Create] button** after the character selector (after line ~369):
   ```html
   <button
     type="button"
     class="creator-open-button"
     @click="$store.onscreenAgent.openCreatorDialog('character')"
     title="Create a custom character"
   >
     <x-icon>add</x-icon>
     <span>Create</span>
   </button>
   ```

3. **Add edit/delete "⋮" buttons** to custom theme/character options in the selector loops:
   ```html
   <!-- Inside the theme x-for loop, add after the theme-option content: -->
   <template x-if="theme.id.startsWith('custom-')">
     <button
       type="button"
       class="creator-edit-button"
       @click.stop="$store.onscreenAgent.openCreatorDialog('theme', theme.id)"
       title="Edit or delete this theme"
     >
       <x-icon>more_vert</x-icon>
     </button>
   </template>
   ```

4. **Add the Creator Dialog** before the closing `</section>` tag (before line ~710):
   ```html
   <dialog
     class="chat-dialog creator-dialog"
     x-ref="creatorDialog"
     @cancel.prevent="$store.onscreenAgent.closeCreatorDialog()"
   >
     <form method="dialog" class="dialog-card dialog-card-shell" @submit.prevent>
       <header class="dialog-header">
         <div>
           <p class="page-eyebrow" x-text="$store.onscreenAgent.creatorDialogMode === 'theme' ? 'Theme Creator' : 'Character Creator'"></p>
           <h2 x-text="$store.onscreenAgent.creatorDialogMode === 'theme' ? 'Design your theme' : 'Design your character'"></h2>
         </div>
         <button type="button" class="dialog-close-button" @click="$store.onscreenAgent.closeCreatorDialog()">×</button>
       </header>
       <div class="dialog-scroll-body">
         <!-- THEME CREATOR FIELDS -->
         <template x-if="$store.onscreenAgent.creatorDialogMode === 'theme'">
           <div class="creator-section">
             <label class="field">
               <span>Theme ID</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftTheme.id" placeholder="custom-my-theme" />
             </label>
             <label class="field">
               <span>Display Name</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftTheme.label" placeholder="My Theme" maxlength="40" />
             </label>
             <label class="field">
               <span>Icon (emoji)</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftTheme.icon" placeholder="🎨" />
             </label>
             <label class="field">
               <span>Description</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftTheme.description" placeholder="A short description" />
             </label>
             <label class="field">
               <span>Base Palette</span>
               <div class="creator-base-toggle">
                 <button type="button"
                   :class="{ 'is-active': $store.onscreenAgent.creatorDraftTheme.base === 'dark' }"
                   @click="$store.onscreenAgent.creatorDraftTheme.base = 'dark'">🌙 Dark</button>
                 <button type="button"
                   :class="{ 'is-active': $store.onscreenAgent.creatorDraftTheme.base === 'light' }"
                   @click="$store.onscreenAgent.creatorDraftTheme.base = 'light'">☀️ Light</button>
               </div>
             </label>
             <div class="creator-color-section">
               <h3>Color Overrides</h3>
               <template x-for="colorKey in $store.onscreenAgent.themeColorKeys" :key="colorKey">
                 <label class="field creator-color-field">
                   <span x-text="colorKey"></span>
                   <div class="creator-color-input-group">
                     <input type="color"
                       :value="$store.onscreenAgent.creatorDraftTheme.colors[colorKey] || $store.onscreenAgent.getBaseColor($store.onscreenAgent.creatorDraftTheme.base, colorKey)"
                       @input="$store.onscreenAgent.creatorDraftTheme.colors[colorKey] = $el.value"
                     />
                     <input type="text"
                       :value="$store.onscreenAgent.creatorDraftTheme.colors[colorKey] || ''"
                       @change="$store.onscreenAgent.creatorDraftTheme.colors[colorKey] = $el.value"
                       placeholder="inherit"
                       class="creator-color-text"
                     />
                     <button type="button" class="secondary-button"
                       @click="delete $store.onscreenAgent.creatorDraftTheme.colors[colorKey]">Reset</button>
                   </div>
                 </label>
               </template>
             </div>
             <div class="creator-preview">
               <h3>Live Preview</h3>
               <div class="creator-preview-box" :style="$store.onscreenAgent.creatorThemeColorPreviewStyle()">
                 <div class="creator-preview-surface">
                   <span class="creator-preview-text">Sample text</span>
                   <button type="button" class="secondary-button">Button</button>
                   <input type="text" placeholder="Input field" class="creator-preview-input" />
                 </div>
               </div>
             </div>
           </div>
         </template>

         <!-- CHARACTER CREATOR FIELDS -->
         <template x-if="$store.onscreenAgent.creatorDialogMode === 'character'">
           <div class="creator-section">
             <label class="field">
               <span>Character ID</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftCharacter.id" placeholder="custom-my-character" />
             </label>
             <label class="field">
               <span>Display Name</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftCharacter.name" placeholder="My Character" maxlength="30" />
             </label>
             <label class="field">
               <span>Emoji</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftCharacter.emoji" placeholder="🙂" />
             </label>
             <label class="field">
               <span>Description</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftCharacter.description" placeholder="A short description" maxlength="80" />
             </label>
             <label class="field">
               <span>Avatar</span>
               <div class="creator-avatar-field">
                 <div class="creator-avatar-preview">
                   <img x-show="$store.onscreenAgent.creatorDraftCharacter.avatar"
                     :src="$store.onscreenAgent.creatorDraftCharacter.avatar" alt="avatar" />
                   <span x-show="!$store.onscreenAgent.creatorDraftCharacter.avatar"
                     class="creator-avatar-emoji"
                     x-text="$store.onscreenAgent.creatorDraftCharacter.emoji"></span>
                 </div>
                 <input type="file" accept="image/*" class="creator-avatar-input"
                   @change="$store.onscreenAgent.handleCreatorAvatarUpload($event)" />
                 <button type="button" class="secondary-button"
                   @click="$store.onscreenAgent.creatorDraftCharacter.avatar = ''">Clear</button>
               </div>
             </label>
             <label class="field">
               <span>Avatar URL (optional)</span>
               <input type="text" x-model="$store.onscreenAgent.creatorDraftCharacter.avatar" placeholder="https://..." />
             </label>
             <label class="field">
               <span>System Prompt Prefix</span>
               <textarea x-model="$store.onscreenAgent.creatorDraftCharacter.systemPromptPrefix"
                 placeholder="You are..." rows="4" maxlength="2000"></textarea>
             </label>
             <div class="creator-preview">
               <h3>Live Preview</h3>
               <div class="creator-preview-character-card">
                 <div class="character-option">
                   <img class="character-option-avatar"
                     :src="$store.onscreenAgent.creatorDraftCharacter.avatar"
                     x-show="$store.onscreenAgent.creatorDraftCharacter.avatar" />
                   <span class="character-option-emoji"
                     x-text="$store.onscreenAgent.creatorDraftCharacter.emoji"
                     x-show="!$store.onscreenAgent.creatorDraftCharacter.avatar"></span>
                   <span class="character-option-label"
                     x-text="$store.onscreenAgent.creatorDraftCharacter.name || 'Character Name'"></span>
                 </div>
                 <p class="creator-preview-description"
                   x-text="$store.onscreenAgent.creatorDraftCharacter.description || 'Character description'"></p>
               </div>
             </div>
           </div>
         </template>
       </div>
       <footer class="dialog-footer">
         <button type="button" class="secondary-button"
           x-show="$store.onscreenAgent.creatorEditingId"
           @click="$store.onscreenAgent.creatorDeleteCurrentItem()"
           style="color: var(--color-status-danger)">
           Delete
         </button>
         <div style="flex:1"></div>
         <button type="button" class="secondary-button" @click="$store.onscreenAgent.closeCreatorDialog()">Cancel</button>
         <button type="button" class="primary-button"
           x-text="$store.onscreenAgent.creatorDialogMode === 'theme'
             ? ($store.onscreenAgent.creatorEditingId ? 'Update Theme' : 'Save Theme')
             : ($store.onscreenAgent.creatorEditingId ? 'Update Character' : 'Save Character')"
           @click="$store.onscreenAgent.creatorDialogMode === 'theme'
             ? $store.onscreenAgent.creatorSaveTheme()
             : $store.onscreenAgent.creatorSaveCharacter()"
         ></button>
       </footer>
     </form>
   </dialog>
   ```

### 5D. `onscreen-agent.css` — New styles

**Location:** Append to end of file (after line 1233).

**Add:**
```css
/* ─── Creator open buttons ───────────────────────────────────────────────── */

.creator-open-button {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.6rem;
  border: 1px dashed var(--color-border-soft);
  border-radius: 0.7rem;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  transition: border-color 140ms ease, color 140ms ease;
  align-self: center;
}

.creator-open-button:hover {
  border-color: var(--color-accent-primary-strong);
  color: var(--color-text-primary);
}

/* ─── Creator edit/delete buttons on custom items ────────────────────────── */

.theme-option,
.character-option {
  position: relative;
}

.creator-edit-button {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--color-border-soft);
  background: var(--color-surface-1);
  color: var(--color-text-secondary);
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0;
  z-index: 1;
}

.theme-option:hover .creator-edit-button,
.character-option:hover .creator-edit-button {
  display: flex;
}

.creator-edit-button:hover {
  border-color: var(--color-accent-primary-strong);
  color: var(--color-text-primary);
}

/* ─── Creator dialog ─────────────────────────────────────────────────────── */

.creator-dialog {
  min-width: 540px;
  max-width: 90vw;
}

.creator-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.creator-base-toggle {
  display: flex;
  gap: 0.5rem;
}

.creator-base-toggle button {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--space-field-border);
  border-radius: 0.7rem;
  background: var(--space-field-bg);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  transition: border-color 140ms ease;
}

.creator-base-toggle button.is-active {
  border-color: var(--color-accent-primary-strong);
  background: rgba(125, 220, 255, 0.08);
}

/* ─── Color fields ───────────────────────────────────────────────────────── */

.creator-color-section {
  border-top: 1px solid var(--color-border-soft);
  padding-top: 0.75rem;
  margin-top: 0.25rem;
}

.creator-color-section h3 {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0 0 0.5rem;
}

.creator-color-field {
  margin-bottom: 0.4rem;
}

.creator-color-field > span {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--color-text-tertiary);
}

.creator-color-input-group {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.creator-color-input-group input[type="color"] {
  width: 32px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--space-field-border);
  border-radius: 0.4rem;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}

.creator-color-text {
  flex: 1;
  font-family: monospace;
  font-size: 0.8rem;
  min-width: 0;
}

.creator-color-input-group .secondary-button {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

/* ─── Avatar field ───────────────────────────────────────────────────────── */

.creator-avatar-field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.creator-avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--color-border-soft);
  background: var(--color-surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.creator-avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creator-avatar-emoji {
  font-size: 1.5rem;
}

.creator-avatar-input {
  font-size: 0.8rem;
}

/* ─── Live preview ───────────────────────────────────────────────────────── */

.creator-preview {
  border-top: 1px solid var(--color-border-soft);
  padding-top: 0.75rem;
  margin-top: 0.25rem;
}

.creator-preview h3 {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0 0 0.5rem;
}

.creator-preview-box {
  border: 1px solid var(--color-border-soft);
  border-radius: 0.7rem;
  padding: 1rem;
  background: var(--color-canvas);
  color: var(--color-text-primary);
}

.creator-preview-surface {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.creator-preview-text {
  color: var(--color-text-primary);
}

.creator-preview-input {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 0.4rem;
  background: var(--color-surface-1);
  color: var(--color-text-primary);
  font-size: 0.8rem;
}

.creator-preview-character-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.creator-preview-description {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0;
}

/* ─── Dialog footer ──────────────────────────────────────────────────────── */

.dialog-footer {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border-soft);
}
```

### 5E. `storage.js` — No changes needed

The server-side YAML persistence already handles `theme` and `characterId` fields. Custom definitions stay in localStorage only. No changes to `storage.js`.

---

## 6. CSS Architecture — How Dynamic Theme Classes Work

### Mechanism

Instead of generating a `.theme-{id}` class, we inject a `<style>` tag that redefines `:root` variables. This is simpler and avoids specificity wars with the existing `.theme-light` class.

**Flow:**

```
User creates "custom-ocean" theme with base "dark"
  → Store calls applyTheme("custom-ocean")
  → applyTheme reads custom theme from localStorage
  → Gets base dark colors from getThemeBaseColors("dark")
  → Merges: { ...baseDarkColors, ...userOverrides }
  → Creates <style data-custom-theme="custom-ocean">
      :root {
        --color-canvas: #040b18;
        --color-surface-1: #0e1c30;
        ... (all 30+ vars)
      }
    </style>
  → Appends to <head>
  → All existing CSS immediately uses new values via var()
```

**On theme switch away:**
```js
// Remove old custom theme style
document.querySelectorAll("style[data-custom-theme]").forEach(el => el.remove());
// applyTheme for the new theme handles its own injection
```

**On page load:**
```js
// init() calls applyTheme(savedThemeId) which re-injects if custom
```

### Why not `.theme-{id}` classes?

The existing system uses `.theme-light` on `<html>` to toggle between two palettes. Adding `.theme-custom-ocean` would require duplicating every `.theme-light` rule under the new class — 30+ rules × 2 palettes. The `<style>` injection approach is:
- **Simpler**: one injection point, no selector duplication
- **Complete**: covers all CSS vars in one shot
- **Compatible**: works alongside `.theme-light` (custom light themes add the class)
- **Removable**: `data-custom-theme` attribute makes cleanup trivial

### Style tag lifecycle

| Event | Action |
|-------|--------|
| Custom theme created | Inject `<style data-custom-theme="{id}">` |
| Custom theme activated | Inject its style (removes any other custom style first) |
| Custom theme deactivated | Remove its `<style>` tag |
| Custom theme deleted | Remove its `<style>` tag, fall back to default |
| Custom theme updated | Remove old `<style>`, re-inject if currently active |
| Page load (custom theme active) | `applyTheme()` re-injects from localStorage |

---

## 7. Quick Reference Card

*For agents — paste this into your context to use the creator API.*

```
╔══════════════════════════════════════════════════════════════╗
║           THEME & CHARACTER CREATOR — QUICK REF             ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  THEME SCHEMA:                                               ║
║  { id, label, icon, description, base:"dark"|"light",       ║
║    colors: { "--color-canvas": "#hex", ... } }              ║
║                                                              ║
║  CHARACTER SCHEMA:                                           ║
║  { id, name, emoji, description, avatar,                     ║
║    systemPromptPrefix }                                      ║
║                                                              ║
║  STORE METHODS:                                              ║
║  $store.onscreenAgent.createCustomTheme({...})               ║
║  $store.onscreenAgent.updateCustomTheme(id, {...})           ║
║  $store.onscreenAgent.deleteCustomTheme(id)                  ║
║  $store.onscreenAgent.createCustomCharacter({...})           ║
║  $store.onscreenAgent.updateCharacter(id, {...})             ║
║  $store.onscreenAgent.deleteCustomCharacter(id)              ║
║  $store.onscreenAgent.getCustomThemes()                      ║
║  $store.onscreenAgent.getCustomCharacters()                  ║
║  $store.onscreenAgent.openCreatorDialog("theme"|"character") ║
║                                                              ║
║  LOCALSTORAGE KEYS:                                          ║
║  "space.customThemes"     — JSON array of theme objects      ║
║  "space.customCharacters" — JSON array of character objects  ║
║                                                              ║
║  VALIDATION:                                                 ║
║  - ids must be unique across built-in + custom              ║
║  - theme base must be "dark" or "light"                      ║
║  - color keys must start with "--color-"                     ║
║  - character name ≤30 chars, description ≤80 chars           ║
║  - systemPromptPrefix ≤2000 chars                            ║
║                                                              ║
║  CSS INJECTION:                                              ║
║  Custom themes inject <style data-custom-theme="{id}">       ║
║  with full :root { --color-*: value; } block into <head>    ║
║                                                              ║
║  BUILT-IN THEMES: dark, light, oled, high-contrast, system  ║
║  BUILT-IN CHARACTERS: default, robot, sage, cat,             ║
║    professional, pirate, admin, engineer, alien, detective   ║
╚══════════════════════════════════════════════════════════════╝
```

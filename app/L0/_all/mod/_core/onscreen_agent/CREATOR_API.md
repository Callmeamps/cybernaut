# Theme & Character Creator — Agent Quick Reference

## Purpose

The creator wizard lets users and agents design custom visual themes and agent characters
from within the onscreen agent settings. Custom themes inject dynamic `<style>` tags;
custom characters extend the built-in roster. Everything persists in localStorage.

---

## Data Schemas

### Custom Theme

```js
{
  id: "custom-ocean",            // required, unique kebab-case id
  label: "Ocean Depths",         // required, ≤40 chars
  icon: "\uD83C\uDF0A",           // required, single emoji (defaults to 🎨)
  description: "Deep blues",     // optional
  base: "dark",                  // "dark" | "light" — which built-in palette to extend
  colors: {                      // required, key-value overrides
    "--color-canvas": "#040b18",
    "--color-accent-primary": "#5bb8ff",
    // ... any --color-* vars from THEME_COLOR_KEYS
  }
}
```

### Custom Character

```js
{
  id: "custom-alien",            // required, unique kebab-case id
  name: "Zyx",                   // required, ≤30 chars
  emoji: "\uD83D\uDE42",          // required, single emoji
  description: "Alien scientist", // optional, ≤80 chars
  avatar: "",                    // optional URL / data URI (empty = show emoji)
  systemPromptPrefix: "You are..." // optional, ≤2000 chars, prepended to system prompt
}
```

---

## Store Methods (Agent API)

All methods are on `$store.onscreenAgent`. Return `{ success: true, ... }` or `{ success: false, errors: [...] }`.

### Theme CRUD

```js
// Create — validates, persists to localStorage, injects <style>, re-renders
$store.onscreenAgent.createCustomTheme({ id, label, icon, description, base, colors })

// Update — partial update, re-injects <style> if active
$store.onscreenAgent.updateCustomTheme(themeId, { label, colors })

// Delete — removes from localStorage, removes <style>, falls back if active
$store.onscreenAgent.deleteCustomTheme(themeId)

// List all custom themes
$store.onscreenAgent.getCustomThemes()     // → [{...}, ...]
$store.onscreenAgent.isCustomTheme(id)      // → boolean
```

### Character CRUD

```js
// Create — validates, persists to localStorage, re-renders
$store.onscreenAgent.createCustomCharacter({ id, name, emoji, description, avatar, systemPromptPrefix })

// Update — partial update, refreshes avatar if active
$store.onscreenAgent.updateCharacter(characterId, { name, emoji, ... })

// Delete — removes from localStorage, falls back to default if active
$store.onscreenAgent.deleteCustomCharacter(characterId)

// List all custom characters
$store.onscreenAgent.getCustomCharacters()  // → [{...}, ...]
$store.onscreenAgent.isCustomCharacter(id)  // → boolean
```

### Dialog Control

```js
// Open creator dialog (mode: "theme" | "character"; editId: null for new)
$store.onscreenAgent.openCreatorDialog("theme")              // new theme
$store.onscreenAgent.openCreatorDialog("theme", "custom-x")   // edit existing
$store.onscreenAgent.openCreatorDialog("character")           // new character
$store.onscreenAgent.openCreatorDialog("character", "custom-y") // edit existing
$store.onscreenAgent.closeCreatorDialog()
$store.onscreenAgent.isCreatorDialogOpen  // → boolean
```

### Helper Accessors

```js
$store.onscreenAgent.themeColorKeys   // → ["--color-canvas", "--color-surface-1", ...]
$store.onscreenAgent.getBaseColor("dark", "--color-canvas")  // → "#050816"
```

---

## Agent Workflow Example

```js
// 1. Create a sunset theme
var r1 = $store.onscreenAgent.createCustomTheme({
  id: "custom-sunset",
  label: "Sunset Glow",
  icon: "\uD83C\uDF05",
  description: "Warm sunset colors",
  base: "dark",
  colors: {
    "--color-canvas": "#1a0a00",
    "--color-surface-1": "#331800",
    "--color-accent-primary": "#ff8c42",
    "--color-accent-primary-strong": "#ff6b1a",
    "--color-text-primary": "#fff0e6",
    "--color-text-secondary": "#ccb099"
  }
});

// 2. Create a fire genie character
var r2 = $store.onscreenAgent.createCustomCharacter({
  id: "custom-genie",
  name: "Ember",
  emoji: "\uD83D\uDD25",
  description: "A wise fire genie",
  systemPromptPrefix: "You are Ember, a wise fire genie who has burned for millennia. You speak in warm, crackling metaphors."
});

// 3. Activate both
if (r1.success) $store.onscreenAgent.setTheme("custom-sunset");
if (r2.success) $store.onscreenAgent.setCharacter("custom-genie");

// 4. Save to server config (persists active theme/character ids to YAML)
$store.onscreenAgent.persistConfig();
```

---

## localStorage Keys

| Key | Content |
|-----|---------|
| `"space.customThemes"` | JSON array of custom theme objects |
| `"space.customCharacters"` | JSON array of custom character objects |
| `"space.theme"` | Active theme id (built-in or custom) |
| `"space.character"` | Active character id (built-in or custom) |

---

## Validation Rules

- **Theme/Character IDs**: must be unique across both built-in + custom; non-empty string
- **Theme base**: must be `"dark"` or `"light"`
- **Theme colors**: keys must start with `"--color-"`; values must be non-empty strings without semicolons
- **Character name**: ≤30 chars
- **Character description**: ≤80 chars
- **systemPromptPrefix**: ≤2000 chars

---

## CSS Injection

Custom themes inject `<style data-custom-theme="{id}">` into `<head>` with a full
`:root { --color-*: value; }` block. The block is the base palette merged with user overrides.
On theme switch, all `style[data-custom-theme]` tags are removed before the new theme's tag is injected.

---

## Built-in Themes

`dark`, `light`, `oled`, `high-contrast`, `system`

## Built-in Characters

`default` (Space Agent 🤖), `robot` (BEEP-BOOP 🦾), `sage` (Sage 🧙), `cat` (Whiskers 🐱),
`professional` (Atlas 💼), `pirate` (Captain Byte 🏴‍☠️), `admin` (Commander 🎖️),
`engineer` (Chief 🔧), `alien` (Zyx 👽), `detective` (Clue 🕵️)

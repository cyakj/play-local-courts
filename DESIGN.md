# DESIGN.md — TenisX Design System

**Version:** 2.1  
**Source of truth:** `TenisX Design System (standalone).html` (v1.0 · DARK)  
**Brand guidance:** `BRAND.md`  
**Platform:** iOS & Android mobile-first, 390px reference width

---

## Design Philosophy

TenisX is a **dark-first, AI-native** system — the canvas is midnight navy, interaction glows in cyan and blue, live moments spark in volt.

The app is used **on the court**, **in sunlight**, **with one hand**, by players from age 16 to 70. Every design decision must pass four gates:

1. **Is it readable on a dark background in bright sunlight?** (contrast, text size, glow)
2. **Is it tappable with a thumb?** (touch targets, spacing)
3. **Can it be scanned in 2–3 seconds?** (hierarchy, grouping)
4. **Does it feel like a premium sports OS?** (not a booking portal, not enterprise SaaS)

**Creative direction:** "The operating system for tennis" — circuit traces, glowing nodes, segmented chrome. Everything is connected.

---

## Color System

### Brand Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--midnight` | `#080A11` | Deepest background, overlays |
| `--midnight-2` | `#0C0F18` | Page canvas (default bg) |
| `--court-blue` | `#0F2A57` | Header backgrounds, elevated surfaces |
| `--court-blue-2` | `#103A78` | Accent variant of court blue |
| `--blue` | `#2D6BFF` | Primary action (CTAs, buttons) |
| `--blue-hi` | `#5B8CFF` | Hover / pressed state of blue |
| `--blue-lo` | `#1E4FCC` | Active / depressed state of blue |
| `--cyan` | `#2DE0FF` | Accent, glow, live/active state, connected indicator |
| `--cyan-hi` | `#7FF0FF` | Glow highlight, radial halo center |
| `--cyan-lo` | `#15A8C8` | Subdued accent |
| `--ai-glow` | `#BFFCFF` | AI / glow tint, luminous overlay |
| `--volt` | `#D6FF3D` | Athletic spark — live sessions, "Go live" moments |
| `--volt-lo` | `#A8CC1F` | Volt pressed/active state |
| `--positive` | `#2FD98B` | Success, confirmed, optimal |
| `--negative` | `#FF5C6B` | Error, missed, declined, critical |
| `--white` | `#F5F8FF` | Foreground text on dark backgrounds |

### Neutral Ramp (navy-tinted)

| Token | Hex | Role |
|-------|-----|------|
| `--ink-950` | `#080A11` | Same as --midnight |
| `--ink-900` | `#0C0F18` | Same as --midnight-2 |
| `--ink-850` | `#11141F` | Elevated bg |
| `--ink-800` | `#161A26` | Surface |
| `--ink-750` | `#1B2030` | Surface-2 |
| `--ink-700` | `#232838` | Border |
| `--ink-600` | `#333A4D` | Strong border |
| `--ink-500` | `#5A6379` | Disabled / placeholder text |
| `--ink-400` | `#7A839A` | Tertiary / muted text |
| `--ink-300` | `#9AA3B8` | Secondary text |
| `--ink-200` | `#C2C9D8` | Subtle dividers, ghost elements |
| `--ink-100` | `#E2E7F0` | Lightest tint |

### Semantic Tokens

| Token | Resolves To | Usage |
|-------|-------------|-------|
| `--bg` | `#0C0F18` | Page background |
| `--bg-elevated` | `#11141F` | Floating panels, elevated cards |
| `--surface` | `#161A26` | Card backgrounds, sheets |
| `--surface-2` | `#1B2030` | Nested surfaces, inset rows |
| `--border` | `#232838` | Default border color |
| `--border-strong` | `#333A4D` | Emphasized dividers |
| `--border-glow` | `rgba(45,224,255,0.35)` | Active / connected card ring |
| `--fg` | `#F5F8FF` | Primary text (on dark) |
| `--fg-2` | `#9AA3B8` | Secondary text |
| `--fg-3` | `#7A839A` | Tertiary / muted text |
| `--fg-disabled` | `#5A6379` | Disabled text, placeholders |
| `--fg-on-blue` | `#FFFFFF` | Text on blue buttons |
| `--fg-on-volt` | `#11140A` | Text on volt buttons (dark on bright) |
| `--accent` | `#2DE0FF` | Alias for cyan |
| `--action` | `#2D6BFF` | Alias for blue |
| `--warning` | `#D6FF3D` | Alias for volt |

### Gradients

| Token | Value | Usage |
|-------|-------|-------|
| `--grad-court` | `linear-gradient(135deg, #0F2A57 0%, #081427 60%, #080A11 100%)` | Header backgrounds |
| `--grad-signal` | `linear-gradient(90deg, #2D6BFF 0%, #2DE0FF 100%)` | Accent bars, progress |
| `--grad-node` | `radial-gradient(circle, #7FF0FF 0%, #2DE0FF 35%, rgba(45,224,255,0) 70%)` | Node glow effect |

### Text Contrast on Dark Background

| Token | Hex | Contrast on `#0C0F18` | Minimum use |
|-------|-----|-----------------------|-------------|
| `--fg` | `#F5F8FF` | ~18:1 | Primary text, headings |
| `--fg-2` | `#9AA3B8` | ~5.8:1 | Secondary labels, captions |
| `--fg-3` | `#7A839A` | ~4.2:1 | Muted metadata — minimum for readable text |
| `--fg-disabled` | `#5A6379` | ~2.7:1 | Disabled only — never for readable text |

> **Rule:** `--fg-3` (`#7A839A`) is the minimum color for any text a user needs to read. Never use `--fg-disabled` for readable content.

---

## Typography

### Font Stack

| Role | Family | CSS variable |
|------|--------|-------------|
| **Display / Big numbers** | Space Grotesk | `--font-display` |
| **Body / UI labels** | Manrope | `--font-sans` |
| **Mono labels / data / status** | JetBrains Mono | `--font-mono` |

Space Grotesk owns the large, architectural moments — hero text, stat numbers, screen titles.  
Manrope drives all body copy and UI chrome — legible, premium, humanist.  
JetBrains Mono is used for data chips, status badges, telemetry, court codes.

### Scale

| Role | Size (rem) | Size (px) | Weight | Family | Variable |
|------|-----------|-----------|--------|--------|----------|
| Display / hero | clamp(2.6rem–4.5rem) | 42–72px | 700 | Space Grotesk | `--t-display` |
| H1 | 2.25rem | 36px | 700 | Space Grotesk | `--t-h1` |
| H2 | 1.75rem | 28px | 700 | Space Grotesk | `--t-h2` |
| H3 | 1.375rem | 22px | 700 | Space Grotesk | `--t-h3` |
| H4 / Card title | 1.125rem | 18px | 700 | Space Grotesk | `--t-h4` |
| Body | 1rem | 16px | 500 | Manrope | `--t-body` |
| Small / UI label | 0.875rem | 14px | 600 | Manrope | `--t-sm` |
| XSmall / caption | 0.75rem | 12px | 600 | Manrope | `--t-xs` |
| Eyebrow / mono tag | 0.6875rem | 11px | 700 | JetBrains Mono | `--t-eyebrow` |

### Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--w-light` | 400 | Body copy, long-form |
| `--w-med` | 500 | Default body |
| `--w-semi` | 600 | UI labels, button text |
| `--w-bold` | 700 | Headlines, stats |
| `--w-black` | 800 | Hero display (used as "black" weight) |

### Tracking

| Token | Value | Usage |
|-------|-------|-------|
| `--track-eyebrow` | 0.18em | Eyebrow labels, ALL CAPS mono tags |
| `--track-display` | -0.02em | Display and H1 — tight, architectural |
| `--track-tight` | -0.01em | H2/H3 — slightly tight |

### Typography Rules

- **Headlines are tight-tracked and never all-caps** — use negative tracking on h1/h2
- **Eyebrows are all-caps** with wide tracking (`--track-eyebrow`) — "COURT 04", "LIVE", "NTRP 4.0"
- Eyebrow text uses JetBrains Mono at 11px with 0.18em letter-spacing
- Body minimum is **16px** — never below, even for "metadata"
- Use Manrope for all body and UI chrome; use Space Grotesk only for titles and big numbers
- JetBrains Mono for status chips, score values, data labels, court codes

---

## Spacing — 4px Base Grid

| Token | Value | Usage |
|-------|-------|-------|
| `--s-1` | 4px | Micro gap, icon margin |
| `--s-2` | 8px | Tight spacing, tag padding |
| `--s-3` | 12px | Compact row padding |
| `--s-4` | 16px | Card internal gap, row padding |
| `--s-5` | 20px | Page horizontal padding |
| `--s-6` | 24px | Section gap minimum |
| `--s-8` | 32px | Between card sections |
| `--s-10` | 40px | Large section gap |
| `--s-12` | 48px | Touch target height |
| `--s-16` | 64px | Header internal height |
| `--s-20` | 80px | Hero vertical padding |

### Layout Constraints

- **Reference width:** 390px (iPhone 14/15)
- **Page horizontal padding:** 20px (`--s-5`)
- **Max content width on tablet:** 480px centered
- **Card gap:** 16px (`--s-4`)
- **Section gap:** 24px (`--s-6`) minimum — never compress below 20px
- Cards are always full-width, stacked vertically — no horizontal grid on mobile
- Stats rows: maximum 3 columns on mobile (4-col makes cells too narrow)

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--r-xs` | 6px | Small tags, inline chips |
| `--r-sm` | 10px | Inputs, small buttons |
| `--r-md` | 14px | Default card radius |
| `--r-lg` | 20px | Large cards, sheets, modals |
| `--r-xl` | 28px | Bottom sheet top corners |
| `--r-pill` | 999px | Status pills, filter chips, badges |

House radius is 14–20px (`--r-md` to `--r-lg`).

---

## Elevation — Glow System

Depth comes from **glow**, not from box shadows alone.

### Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--e-0` | none | Flat elements |
| `--e-1` | `0 1px 2px rgba(0,0,0,0.4)` | Subtle lift |
| `--e-2` | `0 4px 16px -4px rgba(0,0,0,0.5)` | Cards |
| `--e-3` | `0 12px 40px -8px rgba(0,0,0,0.6)` | Modals, overlays |
| `--e-card` | `inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 30px -12px rgba(0,0,0,0.7)` | Card with inner highlight |

### Glow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--glow-cyan` | `0 0 0 1px rgba(45,224,255,0.4), 0 0 24px -4px rgba(45,224,255,0.55)` | Active/live/connected card ring |
| `--glow-blue` | `0 0 24px -6px rgba(45,107,255,0.65)` | Action button hover glow |

Cyan glow (`--glow-cyan`) signals **live, active, or synced** state. Apply to connected court cards, live session indicators, active booking rows. Do not use decoratively.

---

## Motion

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-signal` | `cubic-bezier(0.22, 1, 0.36, 1)` | Standard transitions — smooth, confident |
| `--ease-snap` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Snappy micro-interactions with spring |
| `--t-fast` | 140ms | Tap feedback, state toggles |
| `--t-base` | 220ms | Card transitions, expand/collapse |
| `--t-slow` | 420ms | Sheet/modal entrance |

### Interaction Patterns

- **Tap feedback:** `scale(0.97)` at `--t-fast` with `--ease-snap` — tactile, responsive
- **Card entrance:** fade + translateY(8px) → 0 at `--t-base` with `--ease-signal`
- **Glow pulse:** live sessions use a 2s cyan glow pulse (`opacity 0.6 → 1`)

---

## Touch Targets — Outdoor / Thumb Standards

> Assume: bright sunlight, sweaty hands, one-handed use, older adults, walking to the court.

| Element | Minimum Height | Preferred | Notes |
|---------|---------------|-----------|-------|
| Primary action button | **48px** | 52px | Full-width CTAs: 52px |
| Secondary / ghost button | **48px** | 48px | |
| Destructive button | **48px** | 48px | |
| List row / item | **56px** | 60px | Never below 56px |
| Icon button (bell, back, settings) | **44×44px** | 44×44px | Use `hitSlop` if visual is smaller |
| Filter chip / pill | **40px** | 44px | Height only |
| Input field | **52px** | 56px | 16px font prevents iOS keyboard zoom |
| Tab bar total height | **72px** | 72px | Includes safe area padding |
| Bottom nav tap zone per tab | **48px wide** | 56px | Centered per tab |

---

## Cards

### Base Style (dark)
```
background: #161A26  (--surface)
border: 1px solid #232838  (--border)
border-radius: 14px  (--r-md)
padding: 20px
box-shadow: var(--e-card)
```

### Card Variants

| Variant | Additional style |
|---------|-----------------|
| Standard | Base style |
| Connected / Live | + `box-shadow: var(--glow-cyan)` + `border-color: rgba(45,224,255,0.35)` |
| Elevated | `background: #11141F` (`--bg-elevated`) |
| Action state | `border-left: 3px solid #2D6BFF` |
| Negative state | `border-left: 3px solid #FF5C6B` |

### Card Padding Minimums
- **Standard cards:** 20px internal padding — never below
- **Compact info rows within a card:** 16px padding
- **Action cards (Book, Challenge):** 20–24px — feel substantial

### List Rows Inside Cards
```
min-height: 56px
padding: 12px 0
border-bottom: 1px solid #232838  (--border)
```

---

## Buttons

### Primary Action (Blue)
```
background: #2D6BFF  (--blue)
color: #FFFFFF
border-radius: 10px  (--r-sm)
padding: 14px 24px
font: 600 16px Manrope
min-height: 48px
width: 100%
```

### Accent / Confirm — Live ("Go live", "Book now")
```
background: #D6FF3D  (--volt)
color: #11140A  (--fg-on-volt)
border-radius: 10px
font: 700 16px Manrope
min-height: 52px
width: 100%
```

### Cyan Ghost ("Connect", "Join")
```
background: rgba(45,224,255,0.10)
color: #2DE0FF
border: 1px solid rgba(45,224,255,0.30)
border-radius: 10px
font: 600 16px Manrope
min-height: 48px
```

### Outline / Ghost
```
background: transparent
color: #F5F8FF
border: 1px solid #333A4D  (--border-strong)
border-radius: 10px
font: 600 16px Manrope
min-height: 48px
```

### Surface / Secondary
```
background: #161A26  (--surface)
color: #F5F8FF
border: 1px solid #232838  (--border)
border-radius: 10px
font: 600 16px Manrope
min-height: 48px
```

### Destructive
```
background: transparent
color: #FF5C6B
border: 1.5px solid #FF5C6B
border-radius: 10px
font: 600 16px Manrope
min-height: 48px
```

---

## Status Pills / Chips

All pills: `border-radius: 999px` (`--r-pill`), `padding: 4px 12px`

| State | Bg | Text | Font |
|-------|----|------|------|
| Live / Active | `rgba(45,224,255,0.15)` | `#2DE0FF` | 12px JetBrains Mono SemiBold, UPPERCASE |
| Confirmed | `rgba(47,217,139,0.15)` | `#2FD98B` | 12px JetBrains Mono SemiBold |
| Pending | `rgba(45,107,255,0.15)` | `#5B8CFF` | 12px JetBrains Mono SemiBold |
| Error / Missed | `rgba(255,92,107,0.15)` | `#FF5C6B` | 12px JetBrains Mono SemiBold |
| Neutral | `rgba(122,131,154,0.15)` | `#9AA3B8` | 12px JetBrains Mono SemiBold |

Pill text uses JetBrains Mono — this is a deliberate mono-data aesthetic.  
Minimum pill text: **12px** — never smaller for status users act on.

---

## Bottom Navigation

```
/* Container */
min-height: 72px
padding-top: 10px
padding-bottom: 20px  /* iOS home indicator */
background: rgba(12,15,24,0.90)
backdrop-filter: blur(16px)
border-top: 1px solid #232838  (--border)
```

### Resident Tabs: Home · Courts · Match · Coaches · Me

| State | Icon color | Label color | Indicator |
|-------|-----------|-------------|-----------|
| Active | `#2DE0FF` | `#2DE0FF` | 3px cyan dot above icon |
| Inactive | `#7A839A` (`--fg-3`) | `#7A839A` | none |

- **Icon size:** 26px (minimum 24px)
- **Stroke width:** 1.5px — medium weight, not hairline
- **Label:** JetBrains Mono 11px, ALL CAPS, letter-spacing 0.1em
- **Tab hit zone:** minimum 48px wide per tab

---

## Page Headers

All header variants:
```
background: var(--grad-court)  /* or solid --court-blue */
padding-top: 48px  /* clears iOS status bar */
padding-horizontal: 20px
padding-bottom: 28px
```

### Variant 1 — Home (Resident)
1. **Top bar** — TenisX logo left, Bell + Settings icons right (white, 24px, 44×44 touch zone)
2. **Eyebrow** — 11px JetBrains Mono, ALL CAPS, `#2DE0FF`, `letter-spacing: 0.18em`
3. **Greeting h1** — 36px Space Grotesk Bold, `#F5F8FF`, `letter-spacing: -0.02em`, line-height 1.1
4. **Player context** (optional) — 14px Manrope, `rgba(45,224,255,0.8)` — NTRP badge if available

### Variant 2 — Section Header (Courts, Match, Coaches, Me)
1. **Top bar** — TenisX logo left, Bell + Settings right
2. **Eyebrow** — 11px JetBrains Mono, ALL CAPS, `#2DE0FF`
3. **Page title** — 28–36px Space Grotesk Bold, `#F5F8FF`

### Variant 3 — Inner Screen Header
1. **Top bar** — `ArrowLeft` back icon left (white, 24px), screen title center (18px Space Grotesk Bold white), optional action right
2. Shorter: `padding-bottom: 20px`
3. No greeting, no sub-copy

---

## Icons

- **Library:** Lucide React Native (SVG stroke)
- **No emoji in the UI**
- **Stroke width:** 1.5px — never hairline (1.0px), never heavy (2.5px+)

| Context | Size |
|---------|------|
| Bottom nav | 26px |
| Header action (bell, settings, back) | 24px |
| Card accent | 24px |
| Inline / list row | 22px |
| Small status indicator | 18px |
| Minimum for any user-facing icon | 20px |

**Colors on dark surfaces:**
- Active/primary: `#2DE0FF` (cyan)
- Neutral: `#9AA3B8` (`--fg-2`)
- Muted: `#7A839A` (`--fg-3`)

---

## Form Inputs

```
/* Default */
background: #161A26  (--surface)
border: 1.5px solid #232838  (--border)
border-radius: 10px  (--r-sm)
padding: 16px
min-height: 52px
font: 500 16px Manrope  /* 16px prevents iOS zoom on focus */
color: #F5F8FF

/* Focus */
border-color: #2DE0FF
box-shadow: 0 0 0 3px rgba(45,224,255,0.15)

/* Error */
border-color: #FF5C6B
box-shadow: 0 0 0 3px rgba(255,92,107,0.15)

/* Disabled */
background: #11141F
color: #5A6379
```

### Label
```
font: 600 14px Manrope
color: #9AA3B8  (--fg-2)
margin-bottom: 8px
letter-spacing: 0.02em
```

---

## Filter Chips / Pill Tabs

```
/* Active */
background: rgba(45,224,255,0.12)
color: #2DE0FF
border: 1px solid rgba(45,224,255,0.35)
border-radius: 999px
font: 600 14px Manrope
padding: 8px 18px
min-height: 40px

/* Inactive */
background: #161A26  (--surface)
color: #9AA3B8
border: 1px solid #232838
min-height: 40px
```

---

## Loading States

### Skeleton
```
background: #161A26  (--surface)
shimmer: linear-gradient(90deg, #161A26, #1B2030, #161A26)
border-radius: matches element
```

### Spinner
```
width: 40px; height: 40px
border: 2px solid rgba(45,224,255,0.15)
border-top-color: #2DE0FF
animation: spin 0.7s linear infinite
```

---

## Empty States

```
/* Container */
padding: 48px 20px
align-items: center

/* Icon */
size: 52px
color: #7A839A  (--fg-3)

/* Title */
font: 700 20px "Space Grotesk"
color: #F5F8FF
margin-top: 16px

/* Subtitle */
font: 500 16px Manrope
color: #9AA3B8

/* CTA */
min-height: 52px
margin-top: 20px
```

---

## Modal / Sheet Overlay

```
/* Backdrop */
background: rgba(0,0,0,0.7)

/* Sheet */
background: #161A26
border-radius: 28px 28px 0 0  (--r-xl)
border-top: 1px solid #232838
padding: 24px 20px
```

- Close button: `--fg-3` X icon, 24px, 44×44 tap zone, top-right
- Title: 20px Space Grotesk Bold, `#F5F8FF`
- Body text: 16px Manrope, `#9AA3B8`
- Cancel: 16px Manrope Medium, `#7A839A`, centered

---

## Stats Grid

3 columns on mobile (4-col makes text too small):

```
┌──────────┬──────────┬──────────┐
│  24      │  8       │  3       │
│  COURTS  │ MATCHES  │ COACHES  │
└──────────┴──────────┴──────────┘
```

- Value: Space Grotesk Bold 24px, `#F5F8FF`
- Label: JetBrains Mono 11px, ALL CAPS, `#7A839A`, `letter-spacing: 0.18em`
- Centered per column, no dividers
- Min height per cell: 56px

---

## Quick Action Buttons

```
background: #161A26  (--surface)
border-radius: 14px  (--r-md)
padding: 16px
min-height: 72px
border: 1px solid #232838  (--border)
box-shadow: var(--e-2)

/* Icon: 28px, color #2DE0FF */
/* Label: 14px Manrope SemiBold, #F5F8FF */
/* Sub-label: 12px Manrope, #7A839A */
```

---

## Health Score Color Logic

```ts
const getHealthColor = (score: number) => {
  if (score >= 70) return '#2DE0FF'; // cyan — optimal
  if (score >= 40) return '#D6FF3D'; // volt — warning
  return '#FF5C6B';                  // negative — critical
};
```

---

## Outdoor Anti-Patterns (Banned)

| Anti-Pattern | Why Banned | Fix |
|---|---|---|
| `--fg-disabled` (`#5A6379`) for readable text | 2.7:1 contrast — invisible outdoors | Use `--fg-3` minimum |
| `font-size < 16px` on body copy | Too small in sunlight / for older users | 16px minimum |
| `min-height: 44px` buttons | Barely tappable with sweaty hands | 48px minimum |
| Buttons side-by-side on mobile | Tap targets halved | Stack vertically |
| 4-column stat grids | Cells too narrow | 3-column on mobile |
| `strokeWidth: 1.0` icons | Hairline — invisible in bright light | 1.5px minimum |
| All-caps on headlines (h1/h2/h3) | Reduces readability at large sizes | All-caps only for eyebrows/mono tags |
| Eyebrow text without mono font | Loses data-chip aesthetic | Use JetBrains Mono for ALL CAPS labels |
| List rows under 56px | Missed taps | 56px minimum |
| Card padding below 20px | Looks compressed on device | 20px minimum |
| Compressed section gaps (< 20px) | Dense, confusing outdoors | 24px minimum |

---

## Do / Don't

| Do | Don't |
|----|-------|
| Dark canvas (`#0C0F18`) | Light/white page backgrounds |
| `#F5F8FF` for primary text | Pure white `#FFFFFF` for text |
| `#7A839A` minimum for readable text | `#5A6379` (`--fg-disabled`) for readable text |
| `#2DE0FF` cyan for active/live states | `#00D4FF` (old cyan) |
| `#2D6BFF` blue for primary actions | Green as a CTA color |
| `#D6FF3D` volt for live/sport moments | Yellow for warnings generically |
| `#2FD98B` for success/confirmed | Green emoji ✅ |
| `#FF5C6B` for errors/missed | Red `#EF4444` (old negative) |
| Space Grotesk for headlines & stats | Inter for headlines |
| JetBrains Mono for chips, status, codes | Manrope for data chips |
| Negative tracking on headlines (-0.02em) | Positive/zero tracking on headlines |
| `--glow-cyan` on live/connected cards | Glow applied decoratively |
| 3-column stat grid | 4-column stat grid on mobile |
| 26px nav icons, 1.5px stroke | 20px icons, hairline stroke |
| Stack CTAs vertically | Side-by-side CTAs on mobile |
| SVG stroke icons (Lucide) | Emoji as icons |

---

## Playwright Design Assertions

Assertions for `tests/design.spec.ts`:

### Typography
```ts
// Body text ≥ 16px
const bodyEl = page.locator('[data-testid="body-text"]').first();
const bodySize = await bodyEl.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
expect(bodySize).toBeGreaterThanOrEqual(16);

// Card titles ≥ 18px
const cardTitle = page.locator('[data-testid="card-title"]').first();
const cardSize = await cardTitle.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
expect(cardSize).toBeGreaterThanOrEqual(18);

// Section headers ≥ 22px
const sectionHeader = page.locator('[data-testid="section-header"]').first();
const sectionSize = await sectionHeader.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
expect(sectionSize).toBeGreaterThanOrEqual(22);

// Page titles ≥ 28px
const pageTitle = page.locator('[data-testid="page-title"]').first();
const titleSize = await pageTitle.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
expect(titleSize).toBeGreaterThanOrEqual(28);
```

### Touch Targets
```ts
// Buttons ≥ 48px
const buttons = page.locator('[data-testid$="-btn"]');
for (const btn of await buttons.all()) {
  const box = await btn.boundingBox();
  if (box) expect(box.height).toBeGreaterThanOrEqual(48);
}

// Icon buttons ≥ 44×44px
const iconButtons = page.locator('[data-testid="bell-icon"], [data-testid="back-icon"]');
for (const btn of await iconButtons.all()) {
  const box = await btn.boundingBox();
  if (box) { expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
}

// List rows ≥ 56px
const listRows = page.locator('[data-testid$="-row"]');
for (const row of await listRows.all()) {
  const box = await row.boundingBox();
  if (box) expect(box.height).toBeGreaterThanOrEqual(56);
}
```

### Navigation
```ts
// Tab bar total height ≥ 72px
const bottomNav = page.locator('[data-testid="bottom-nav"]');
const navBox = await bottomNav.boundingBox();
expect(navBox?.height).toBeGreaterThanOrEqual(72);

// Exactly 5 resident tabs
const tabs = page.locator('[data-testid^="tab-"]');
await expect(tabs).toHaveCount(5);
```

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 2.1 | 2026-05-31 | Dark-first rewrite from authoritative HTML design system v1.0. New color system, Space Grotesk + JetBrains Mono fonts, glow elevation, motion tokens, volt accent. |
| 2.0 | 2026-05-30 | Outdoor-first athletic rewrite. Upgraded typography scale, touch targets, contrast standards, spacing. |
| 1.0 | 2026 (initial) | Original HOA community management design system. |

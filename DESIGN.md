# DESIGN.md — TenisX Lumina Slate Design System

**App:** TenisX  
**Domain:** tenisx.ai  
**Type:** Mobile HOA community management app  
**Platform:** iOS mobile-first, 390px reference width  
**Creative direction:** "The Digital Architect"  
**Inspired by:** Vercel, Linear, Notion AI  
**Feel:** Premium AI-native, tech-forward, precision-clean

---

## Color System

### Core Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| `page-bg` | `#F9FAFB` | App background, screen fill |
| `card-bg` | `#FFFFFF` | Cards, sheets, modals |
| `header-bg` | `#0F1F3D` | Page headers, nav bars |

### Primary Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-cyan` | `#00D4FF` | Primary CTA, active states, key metrics, AI glow |
| `navy` | `#0F1F3D` | Primary text, headings, header backgrounds |
| `border` | `rgba(15,31,61,0.08)` | Card borders, dividers, nav separators |

### Functional Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `coral` | `#F97066` | Warning, needs attention, health 40–69 |
| `red` | `#EF4444` | Critical state, health < 40 |
| `cyan` | `#00D4FF` | Success, optimal state, health >= 70 |
| `blue-mid` | `#0369A1` | Text on cyan light backgrounds (e.g. status pills) |

### Typography Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#0F1F3D` | Body copy, headings |
| `text-muted` | `#8892A4` | Labels, metadata, secondary copy |
| `text-placeholder` | `#9CA3AF` | Input placeholders, empty states |
| `text-subtle` | `#4B5563` | Secondary labels, stat sub-labels |

### Status Pill Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| `optimal-bg` | `#E0F9FF` | Optimal/Perfect/Clear pill background |
| `attention-bg` | `#FFF5F5` | Needs Attention pill background |
| `critical-bg` | `#FEF2F2` | Critical pill background |

---

## Typography

### Font Stack
- **Headlines:** `Manrope, sans-serif` — Black (900) for page greetings, ExtraBold (800) for card/section titles; geometric, architectural
- **Body & UI labels:** `Inter, sans-serif` — Regular (400) and SemiBold (600)
- **Key metrics / data:** `Manrope, sans-serif` — Bold (700), tight tracking (`-0.02em`)

### Scale
| Role | Font | Size | Weight | Notes |
|------|------|------|--------|-------|
| Page greeting | Manrope | 32px | 900 (Black) | Line height 1.1, tight tracking |
| Section title | Manrope | 18px | 700 (Bold) | |
| Card title | Manrope | 16px | 800 (ExtraBold) | |
| Key metric / stat | Manrope | 40px | 900 (Black) | Color-coded by health |
| Stat value (card) | Manrope | 24px | 700 (Bold) | |
| Body copy | Inter | 15px | 400 | Line height 1.6 |
| UI label | Inter | 13px | 600 | |
| Metadata / tag | Inter | 11px | 600 | ALL CAPS, `letter-spacing: 0.08em` |
| Minimum size | Inter | 12px | 400 | Never go below this |

### Rules
- High contrast between large bold headers and small all-caps metadata
- Metadata labels always uppercase with `letter-spacing: 0.08em`
- Minimum contrast: `#8892A4` on white backgrounds (meets AA at body sizes)

---

## Cards

### Base Style
```css
background: #FFFFFF;
border-radius: 16px;
padding: 20px;
box-shadow: 0px 2px 8px rgba(15,31,61,0.04),
            0px 12px 32px rgba(15,31,61,0.04);
border: 1px solid rgba(15,31,61,0.08);
```

### State Variants (left border accent)
```css
/* Optimal */
border-left: 2px solid #00D4FF;

/* Needs Attention */
border-left: 2px solid #F97066;

/* Critical */
border-left: 2px solid #EF4444;
```

> `border-left` overrides the base `border` on the left side only. Implement as `border border-[rgba(15,31,61,0.08)] border-l-2 border-l-[#00D4FF]` — do not add a second border element on top.

### Elevation
- Tonal layering only — no heavy borders
- White card on `#F9FAFB` background creates natural depth
- Hover/focus: background shifts to `#F3F4F6`

### Community Card Anatomy
1. **Name + Status pill** — flex row, space-between
2. **Health score label + value** — uppercase label left, colored value right
3. **Progress bar** — 4px height, color-coded, full width, `rounded-full`
4. **4-column stats row** — Units / Amenities / Members / Alerts, centered text
5. **Manage link** — right-aligned, `→` suffix, `#00D4FF`, font-weight 800, border-top separator

---

## Status Pills

All pills: `border-radius: 99px`, `font-size: 11px`, `font-weight: 700`, `padding: 2px 10px`

| State | bg | text | border |
|-------|----|------|--------|
| Optimal | `#E0F9FF` | `#0369A1` | `1px solid #00D4FF` |
| Needs Attention | `#FFF5F5` | `#C0392B` | `1px solid #F97066` |
| Critical | `#FEF2F2` | `#991B1B` | `1px solid #EF4444` |
| Perfect / Clear | `#E0F9FF` | `#0369A1` | `1px solid #00D4FF` |

---

## Health Score Color Logic

```ts
const getHealthColor = (score: number) => {
  if (score >= 70) return '#00D4FF'; // cyan — healthy
  if (score >= 40) return '#F97066'; // coral — needs attention
  return '#EF4444';                  // red — critical
};
```

Applied to: score display text, progress bar fill, card left-border accent.

---

## Progress Bars

```css
height: 4px;
border-radius: 99px;
background: #F3F4F6; /* track */
/* fill: getHealthColor(score) */
transition: width 0.3s ease;
```

---

## Stats Grid

Always 4 columns in a single row. No internal borders.

```
┌──────────┬──────────┬──────────┬──────────┐
│  24      │  3       │  12      │  2       │
│  UNITS   │ AMENITIES│ MEMBERS  │ ALERTS   │
└──────────┴──────────┴──────────┴──────────┘
```

- Value: Manrope Bold 20px, `#0F1F3D`
- Label: Inter 11px, ALL CAPS, `#4B5563`, `letter-spacing: 0.08em`
- Centered per column, no dividers

> **Pattern is fixed (4-col, no dividers, centered). Column labels are screen-specific** — not locked to "Units / Amenities / Members / Alerts". Use whatever four data points are relevant to that screen.

---

## Page Headers

All header variants share this base:
```css
background-color: #0F1F3D;
padding: 48px 20px 32px; /* pt accounts for iOS status bar */
position: relative;
overflow: visible;
```

### Variant 1 — CM Portfolio Header
Used on: Condo Manager main portfolio screen.

1. **Top bar** — TenisX logo left (`height: 88px`), Bell + Menu icons right (white, 22px)
2. **Welcome tag** — 13px Inter, ALL CAPS, `#00D4FF`, `letter-spacing: 0.15em`
3. **Greeting h1** — 32px Manrope Black (900), white, `line-height: 1.1`
4. **Sub-copy** — 15px Inter, `rgba(0,212,255,0.7)`
5. **Bottom fade** — `linear-gradient(to bottom, #0F1F3D, transparent)`, 32px, z-0

### Variant 2 — Resident Home Header
Used on: Resident dashboard/home screen.

1. **Top bar** — user avatar (40px) left, Bell icon right (white, 22px)
2. **Welcome tag** — 13px Inter, ALL CAPS, `#00D4FF`, `letter-spacing: 0.15em`
3. **Greeting h1** — 32px Manrope Black (900), white, `line-height: 1.1`
4. **Sub-copy** — 15px Inter, `rgba(0,212,255,0.7)`
5. **Bottom fade** — same as Variant 1

### Variant 3 — Inner Screen Header
Used on: all detail / sub-screens (not home/portfolio).

1. **Top bar** — back arrow left (white, 22px, Lucide `ArrowLeft`), screen title center (18px Manrope ExtraBold white), optional action icon right (white, 22px)
2. No greeting, no sub-copy, no bottom fade
3. Shorter: `padding: 48px 20px 20px`

---

## Bottom Navigation

```css
position: fixed;
bottom: 0;
width: 100%;
background: rgba(255,255,255,0.8);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border-top: 1px solid rgba(15,31,61,0.08);
padding: 8px 0 20px; /* 20px bottom for iOS home indicator */
```

### CM Navigation Tabs: Portfolio · Issues · Calendar · Alerts

| State | Icon color | Label color | Indicator |
|-------|-----------|-------------|-----------|
| Active | `#00D4FF` | `#00D4FF` | 4px dot below label, `#00D4FF` |
| Inactive | `#8892A4` | `#8892A4` | none |

- No background pills or filled chips on active state
- Icon size: 22px
- Label: Inter 10px SemiBold, ALL CAPS

---

## Resident Bottom Navigation

Same glassmorphic base as CM nav.

### Resident Navigation Tabs: Home · Book · Reports · Calendar · Docs

| State | Icon color | Label color | Indicator |
|-------|-----------|-------------|-----------|
| Active | `#00D4FF` | `#00D4FF` | 4px dot below label, `#00D4FF` |
| Inactive | `#8892A4` | `#8892A4` | none |

- No background pills or filled chips on active state
- Icon size: 22px
- Label: Inter 10px SemiBold, ALL CAPS

---

## Buttons

### Primary CTA
```css
background: #0F1F3D;
color: #FFFFFF;
border-radius: 12px;
padding: 14px 20px;
font: 600 14px Inter;
min-height: 44px; /* iOS tap target */
```

### Accent / Confirm
```css
background: #00D4FF;
color: #0F1F3D;
border-radius: 12px;
font-weight: 700;
min-height: 44px;
```

### Ghost / Secondary
```css
background: #F3F4F6;
color: #6B7280;
border: 1px solid #E5E7EB;
border-radius: 12px;
min-height: 44px;
```

### Destructive
```css
background: transparent;
color: #EF4444;
border: 1px solid #EF4444;
border-radius: 12px;
```

---

## Form Inputs

### Label
```css
font: 500 13px Inter;
color: #0F1F3D;
margin-bottom: 6px;
```
Required field indicator: `*` in `#F97066`, placed after the label text.

### States

```css
/* Default */
border: 1px solid rgba(15,31,61,0.15);
border-radius: 8px;
padding: 14px 16px;
font: 400 14px Inter;
color: #0F1F3D;
background: #FFFFFF;
outline: none;
transition: border-color 0.15s, box-shadow 0.15s;

/* Focus */
border-color: #00D4FF;
box-shadow: 0 0 0 3px rgba(0,212,255,0.15);

/* Error */
border-color: #F97066;
box-shadow: 0 0 0 3px rgba(249,112,102,0.15);

/* Disabled */
background: #F9FAFB;
color: #8892A4;
border-color: rgba(15,31,61,0.08);
cursor: not-allowed;
```

### Error Message
```css
font: 400 12px Inter;
color: #F97066;
margin-top: 4px;
```

---

## Select / Dropdown

Same base style as input default. Additional states:

```css
/* Open */
border-color: #00D4FF;

/* Option item hover */
background: #F9FAFB;

/* Selected option text */
color: #00D4FF;

/* Checkmark icon */
color: #00D4FF; /* 16px Lucide Check */
```

---

## Checkbox / Radio / Switch

### Checkbox & Radio
```css
/* Unchecked */
width: 20px; height: 20px;
border: 2px solid rgba(15,31,61,0.2);
border-radius: 4px; /* checkbox */ /* or 50% for radio */
background: #FFFFFF;

/* Checked */
background: #0F1F3D;
border-color: #0F1F3D;
/* Check/dot icon: white */
```

### Switch (Toggle)
```css
/* Off */
width: 44px; height: 24px;
background: #E5E7EB;
border-radius: 99px;

/* On */
background: #00D4FF;

/* Thumb */
width: 20px; height: 20px;
background: #FFFFFF;
border-radius: 50%;
box-shadow: 0 1px 4px rgba(0,0,0,0.15);
transition: transform 0.2s ease;
```

---

## Avatar

| Size | Diameter |
|------|----------|
| `sm` | 32px |
| `md` | 40px |
| `lg` | 48px |

```css
border-radius: 50%;
border: 2px solid rgba(15,31,61,0.08);

/* Fallback initials (no image) */
background: #0F1F3D;
color: #FFFFFF;
font: 700 Manrope; /* size scales with avatar */
```

---

## Tabs (in-screen)

### Variant 1 — Underline Tabs
Used for: content switching within a screen (e.g. "Upcoming / Past").

| State | Text color | Underline |
|-------|-----------|-----------|
| Active | `#00D4FF` | `2px solid #00D4FF` below label |
| Inactive | `#8892A4` | none |

- Font: Inter 14px SemiBold
- Tab padding: `12px 16px`
- Bottom border on container: `1px solid rgba(15,31,61,0.08)`

### Variant 2 — Pill Tabs
Used for: compact filter switching (e.g. "All / Open / Resolved").

| State | Background | Text color |
|-------|-----------|------------|
| Active | `#0F1F3D` | `#FFFFFF` |
| Inactive | `#F9FAFB` | `#8892A4` |

- Border-radius: 99px
- Font: Inter 13px SemiBold
- Padding: `6px 16px`

---

## Badge / Notification Dot

Used for: unread counts on bottom nav icons, alert indicators.

```css
width: 18px; height: 18px;
background: #EF4444;
border-radius: 50%;
font: 700 10px Inter;
color: #FFFFFF;
position: absolute;
top: -4px; right: -4px;
```

Single-digit counts show the number. Counts > 9 show `9+`.

---

## Icons

- **Library:** Lucide React (SVG stroke only)
- **No emoji anywhere in the UI**
- **Stroke width:** 1.5–2px
- **Sizes:**
  - Stats / header actions: 20px
  - Card icons: 18px
  - Inline / small: 16px
- **Colors:**
  - On dark (navy) header: white or `#00D4FF`
  - On light (card): `#00D4FF` for accent, `#8892A4` for neutral, contextual for status

---

## Special Effects

### Cyan Glow (AI / key metrics)
```css
box-shadow: 0 0 20px rgba(0,212,255,0.3);
```
Use on: health score numbers, AI-sourced data highlights, primary stat values.

### Glassmorphic Surfaces
```css
background: rgba(255,255,255,0.8);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
```
Apply **only** to:
- Bottom navigation bar
- Modal/sheet overlays
- Sticky sub-headers when the page has scrolled > 0px

Do not apply to cards, static headers, or decorative elements.

### Micro-interactions
```css
/* Tap feedback */
transform: scale(0.97);
transition: transform 0.1s ease;

/* active:scale-95 for destructive / high-impact actions */
transform: scale(0.95);
```

---

## Spacing & Layout

| Token | Value | Usage |
|-------|-------|-------|
| `page-px` | `20px` | Horizontal page padding |
| `card-gap` | `12px` | Gap between stacked cards |
| `section-gap` | `16px` | Gap between page sections |
| `card-padding` | `20px` | Internal card padding |
| `header-pt` | `48px` | Top padding (clears iOS status bar) |
| `bottom-nav-h` | `64px` | Bottom nav height + safe area |
| `tap-target` | `44px` | Minimum tappable height |

### Mobile Layout Rules
- Reference width: 390px (iPhone 14 / 15)
- **Never** use horizontal card layouts on mobile
- Community cards: full width, stacked vertically
- Stats: always 4 columns in a single row (`grid-cols-4`)
- Max content width on larger screens: `max-w-[480px] mx-auto` — use on all page container divs to prevent wall-to-wall stretch on iPad/tablet

### Spacing Relationships
- `card-gap` (12px / `gap-3`): space **between cards** within the same section
- `section-gap` (16px / `gap-4`): space **between sections** (e.g. between the stats row and the community list)
- These should not be swapped — section spacing is always larger than card spacing

---

## Loading States

### Spinner
```css
width: 40px;
height: 40px;
border: 2px solid rgba(0,212,255,0.2); /* track */
border-top-color: #00D4FF;             /* fill */
border-radius: 50%;
animation: spin 0.7s linear infinite;
```

### Skeleton
- Base color: `#F3F4F6`
- Shimmer: `linear-gradient(90deg, #F3F4F6, #E5E7EB, #F3F4F6)`
- Animation: `animate-pulse` at 1.5s intervals
- Border-radius matches the element it replaces

**Card skeleton structure:**
1. Title bar — 60% width, 16px height
2. Body line 1 — 100% width, 12px height
3. Body line 2 — 100% width, 12px height
4. Short line — 40% width, 12px height

---

## Empty States

- Centered, `py-10`
- Icon: 48px SVG stroke, `#8892A4`
- Title: 18px Manrope Bold, `#0F1F3D`
- Subtitle: 14px Inter, `#8892A4`
- CTA button (if applicable): Primary CTA style (`#0F1F3D` bg, white text, 12px radius, `min-height: 44px`)

---

## Modal / Sheet Overlay

```css
/* Backdrop */
background: rgba(0,0,0,0.5);

/* Sheet */
background: #FFFFFF;
border-radius: 20px 20px 0 0; /* bottom sheet */
/* or 20px for centered modals */
padding: 20px;
```

- Close button: `#9CA3AF` X icon, top-right
- Title: 18px Manrope ExtraBold, `#0F1F3D`
- Cancel link: 15px Inter Medium (500), `#0F1F3D`, underline, centered below primary CTA — AAA contrast compliant

---

## Toast / Sonner Notifications

Position: bottom center, above the bottom nav bar (add `mb-16` or equivalent offset).

| Type | Background | Text |
|------|-----------|------|
| Success | `#0F1F3D` | `#FFFFFF` |
| Error | `#F97066` | `#FFFFFF` |
| Info | `#00D4FF` | `#0F1F3D` |

```css
border-radius: 12px;
padding: 14px 20px;
font: 500 14px Inter;
min-width: 280px;
max-width: calc(100vw - 40px);
box-shadow: 0px 4px 16px rgba(15,31,61,0.12);
```

Duration: 3 seconds. No action buttons unless the use case requires undo.

---

## Do / Don't

| Do | Don't |
|----|-------|
| Use `#00D4FF` for active / positive states | Use green (`#059669`, `#34D399`, `emerald-*`) anywhere |
| Use `#0F1F3D` for dark text and headers | Use black `#000000` for text |
| Use `#F97066` coral for warnings | Use yellow for warnings |
| Use SVG stroke icons from Lucide | Use emoji as icons |
| Stack cards vertically on mobile | Use side-by-side card layouts on mobile |
| Label ALL metadata in ALL CAPS with letter-spacing | Mix case in metadata labels |
| Min 44px tap targets for all interactive elements | Use tap targets below 44px |
| Glassmorphic blur on overlapping surfaces | Solid opaque navbars over content |
| Cyan glow effect on AI / key data metrics | Apply glow to decorative or non-data elements |

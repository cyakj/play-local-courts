@AGENTS.md
# CLAUDE.md — play-local-courts

HOA community management mobile app for tennis/sports court bookings.
Target: App Store launch end of April 2026.

## Brand
- **App name:** TenisX
- **Domain:** tenisx.ai
- **Logo:** `/public/images/TenisX_logo-removebg-preview.png`
- **Theme:** Dark-first — the canvas is midnight navy (`#0C0F18`), never white or light gray
- **Design spec:** `DESIGN.md` — authoritative source for all visual decisions
- **Brand spec:** `BRAND.md` — identity, voice, logo guidance, color meaning

## Commands

- **Dev server**: `npm run dev` (alias for `expo start`)
- **Build**: `npm run build` (alias for `expo export`)
- **Lint**: `npm run lint`

## Architecture

React Native + TypeScript app for HOA community court/amenity booking,
built with Expo (expo-router) and Supabase as the backend.

### Tech Stack
- React Native 0.85 with TypeScript
- Expo SDK 56 / expo-router 56 for routing
- Supabase (auth, database, RLS, edge functions)
- Lucide React Native for icons
- Custom design tokens in `src/constants/design.ts`

### Key Directories
- `src/app/` — Expo Router file-based routes
- `src/components/ui/` — React Native UI components (Button, Card, Header, etc.)
- `src/constants/design.ts` — Design tokens (Colors, FontFamily, FontSize, etc.)
- `src/lib/supabase.ts` — Supabase client
- `src/lib/types.ts` — Auto-generated DB types
- `supabase/functions/` — Edge functions
- `supabase/migrations/` — All DB changes go here

### User Roles
1. **Condo Manager** — portfolio dashboard, issues, communities
2. **HOA Board Admin** — community-level management
3. **Resident** — bookings, reports, calendar
- **Platform reviewers**: superusers above HOA hierarchy

New HOA members start as `pending` until admin approves them.

### Path Alias
Use `@/` to import from `src/`

### Tailwind Usage
- Always use inline hex for brand colors: `bg-[#0C0F18]`, `text-[#2DE0FF]`, `border-[#232838]`
- **NEVER** use `cm-*` Tailwind tokens in new code — they are legacy-only
- The app is dark-first — page background is `#0C0F18`, cards are `#161A26`

### Database Types
Auto-generated in `src/lib/types.ts`.

### Real-time Updates
Supabase real-time subscriptions via `useRealtimeSubscription` hook.

## Critical Rules
- NEVER break existing RLS policies without creating a migration
- ALWAYS use TypeScript — no implicit any
- ALWAYS mobile-first — no horizontal layouts on mobile
- NEVER hardcode user IDs or community IDs
- Keep Capacitor compatibility — no browser-only APIs

## Active vs Hidden Features
Features are hidden via feature flags in src/config/
or via environment variables. DO NOT redesign or modify
hidden/disabled components.

### Stage 1 (ACTIVE - App Store launch):
- /admin → AdminHub (Condo Manager portfolio)
- /admin/maintenance → MaintenanceReports
- /manage-amenities → ManageAmenities
- /manage-courts → ManageCourts
- /pending-requests → PendingRequests
- Resident booking flow
- Resident issue reporting

### Stage 2 (HIDDEN - do not touch):
- Everything else not listed above

When asked to work on a screen, only touch Stage 1
components unless explicitly told otherwise.

## UI Design System

> **All visual decisions live in `DESIGN.md` and `BRAND.md`. When in doubt, read those files first.**

**Creative Direction:** "The operating system for tennis" — dark-first, AI-native, circuit traces and glowing nodes.

### Fonts
- **Display / Headlines:** Space Grotesk — Bold (700) for titles and big numbers; tight negative tracking
- **Body & UI:** Manrope — SemiBold (600) for labels, Medium (500) for body copy
- **Data / Chips / Status:** JetBrains Mono — for ALL CAPS tags, court codes, scores, status pills
- **Never use:** Inter (replaced), all-caps headlines (all-caps is for eyebrows/mono tags only)

### Colors (quick reference — full system in DESIGN.md)

#### Backgrounds
- Page canvas: `#0C0F18` (Midnight)
- Cards / surfaces: `#161A26`
- Elevated bg: `#11141F`
- Header: `--grad-court` gradient or `#0F2A57` (Court Blue)

#### Primary Accents
- Primary action (CTA buttons): `#2D6BFF` (Intelligent Blue)
- Active / live / connected: `#2DE0FF` (Electric Cyan) + cyan glow
- Athletic / live moments: `#D6FF3D` (Tennis Volt)

#### Functional Colors
- Positive / confirmed: `#2FD98B`
- Negative / error: `#FF5C6B`
- Warning: `#D6FF3D` (volt)

#### Text (on dark backgrounds)
- Primary text: `#F5F8FF`
- Secondary text: `#9AA3B8`
- Muted text (minimum readable): `#7A839A`
- Disabled (never for readable text): `#5A6379`
- Borders: `#232838`

### Cards
- Background: `#161A26`, border: `#232838`, radius: 14px
- Connected/live cards: cyan glow ring (`--glow-cyan`)
- Shadow: `--e-card` (ambient dark shadow with inner highlight)
- Minimum padding: 20px

### Typography Scale (minimum enforced values)
- Hero / page title: Space Grotesk Bold, 36px, tracking -0.02em
- Section header: Space Grotesk Bold, 22px+
- Card title: Space Grotesk Bold, 18px+
- Body: Manrope 500, 16px minimum
- UI label: Manrope 600, 14px minimum
- Eyebrow / data chip: JetBrains Mono, 11px, ALL CAPS, tracking 0.18em

### Components
- Status pills: `border-radius: 999px`, JetBrains Mono, 12px, color-tinted bg
- Bottom nav: dark glass (`rgba(12,15,24,0.90)` + blur), active in cyan `#2DE0FF`
- Stats grid: 3-column (not 4), Space Grotesk values, JetBrains Mono labels
- Quick actions: `#161A26` surface cards, 72px height, cyan accent icon

### Interaction Patterns
- Tap feedback: `scale(0.97)` at 140ms with spring easing
- Glow pulse: live sessions animate cyan glow opacity
- Cyan glow (`--glow-cyan`) = live, active, connected state only — not decorative

### Layout Rules
- Mobile-first, 390px reference width
- Page padding: 20px horizontal
- Max content width on tablet: `max-w-[480px] mx-auto`
- Cards: full-width, stacked vertically — no horizontal grid on mobile
- Section gaps: 24px minimum — never compress below 20px

## Autonomous Mode Rules
When running unattended (e.g. overnight-ui.sh):
- Never ask clarifying questions
- Always run `npm run dev` before committing to verify compilation
- Commit after each screen with a descriptive message
- Never modify Stage 2 hidden components
- Always read CMPortfolio.tsx first for style consistency
- No emoji icons — SVG stroke icons only

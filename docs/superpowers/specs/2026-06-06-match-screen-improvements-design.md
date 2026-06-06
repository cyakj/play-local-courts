# Match Screen Improvements — Design Spec
**Date:** 2026-06-06  
**Status:** Approved  
**Scope:** `src/app/(resident)/match.tsx`, `src/app/(resident)/courts.tsx`, one Supabase migration, `src/lib/types.ts`

---

## 1. NTRP Level Multi-select Filter

### Problem
Users can only select a single NTRP range. Too restrictive for players who want to match across adjacent skill levels.

### Data Model Change
Replace `ntrpMin: number` / `ntrpMax: number` in `MatchFilters` with:
```ts
selectedNtrpLevels: number[]   // e.g. [3.5, 4.0, 4.5]
```

NTRP levels offered: **3.0 · 3.5 · 4.0 · 4.5 · 5.0**

Default: `[3.5, 4.0, 4.5]` (preserves the previous 3.5–4.5 default range).

### Filter Logic
A recommended player is shown if:
- `ntrpRating` is `null` (unrated — always shown), OR
- `selectedNtrpLevels.includes(player.ntrpRating)` — exact match against the stored NTRP value

### `MatchFiltersSheet` — NTRP section
Each level chip (3.0 / 3.5 / 4.0 / 4.5 / 5.0) is an independent toggle. Tapping adds/removes the level from `draft.selectedNtrpLevels`. Multiple can be active simultaneously (blue border + text when active). At least one must remain selected — tapping the last active chip is a no-op.

"Reset" restores `selectedNtrpLevels` to `[3.5, 4.0, 4.5]`.

### `FilterBar` Chip Rendering
The single NTRP chip is replaced by dynamic chip rendering based on selection count:

| Selected | Chips displayed |
|---|---|
| 1 | `NTRP 4.0` |
| 2 | `NTRP 3.5` · `NTRP 4.0` |
| 3+ | `NTRP 3.5` · `NTRP 4.0` · `+N more` |

### `ResultsContext`
NTRP label: comma-joined selected levels (e.g. `NTRP 3.5, 4.0, 4.5`). If all 5 levels selected: `Any NTRP`.

---

## 2. Match Request Scheduling Modal

### Problem
"Request" immediately sends a bare match request with no scheduling information. The recipient receives a request with no date, time, or type — poor experience.

### Flow
```
Recommended Player Card  →  Tap "Request"
                         →  Open MatchRequestSheet
                         →  User fills required fields
                         →  Tap "Send Match Request"
                         →  Write to Supabase → close sheet → reload
```

The same flow applies to the "Request" button in `PlayerLookupModal`.

### Component: `MatchRequestSheet`
Bottom-sheet modal (same visual style as `MatchFiltersSheet`). Controlled by `requestTarget: RecommendedPlayer | MatchPlayer | null` state in `MatchScreen`. Sheet opens when `requestTarget !== null`.

#### Fields

**Match Type** (required, default: Singles)  
Four pill toggles: Singles · Doubles · Mixed Doubles · Practice Session  
(stores as `match_type` enum: `singles`, `doubles`, `mixed_doubles`, `hitting_session`)

**Availability Type** (required, default: One Time Match)  
Two pill toggles: One Time Match · Recurring Hitting Partner  
(stores as `availability_type: 'one_time' | 'recurring'`)

**Date** (required)  
Tappable row → opens `DateTimePicker` in `date` mode. Displays formatted date when selected. Placeholder: "Select date" in muted text. Must be today or future.

**Start Time** (required)  
Tappable row → opens `DateTimePicker` in `time` mode. Displays formatted time when selected. Placeholder: "Select time" in muted text.

**Duration** (required, default: 90 min)  
Three pill toggles: 60 min · 90 min · 120 min  
`time_end` is computed as `startTime + duration` before writing.

**Preferred Court Surface** (optional, default: Any)  
Four pill toggles: Hard · Clay · Grass · Any  
(stores as `court_type` enum or `null` when "Any")

**Message** (optional)  
`TextInput`, multiline, 3 lines visible, max 300 chars. Placeholder: "Looking for competitive practice. Available evenings."

#### Summary Section
Shown below the fields, always visible:

```
Playing with:   [Player Name]
Date:           [Selected Date or —]
Time:           [Selected Time or —]
Duration:       [60 / 90 / 120 min or —]
Type:           [Match Type label or —]
Availability:   [One Time Match / Recurring Hitting Partner]
```

#### CTA
"Send Match Request" button (blue, full-width). **Disabled** unless Date and Start Time are both filled.

On press:
1. Compute `time_end = startTime + duration`
2. `supabase.from('match_requests').insert({ challenger_id: userId, opponent_id: requestTarget.id, match_type, date, time_start, time_end, duration, court_type, availability_type, message, status: 'pending' })`
3. Close sheet, reload data

Mock-ID guard: if `requestTarget.id.startsWith('mock-')`, skip the insert (dev only).

---

## 3. Circular Avatars Everywhere on Match Screen

### Problem
`PlayerAvatar` in `RecommendedPlayerCard` uses `square` prop (borderRadius ≈ 24%), making it rounded-square instead of circular.

### Fix
Remove the `square` prop from all `PlayerAvatar` usages in `match.tsx`. The component renders a perfect circle by default (`borderRadius = size / 2`). No changes to `PlayerAvatar` component itself.

**Locations to update:**
- `RecommendedPlayerCard` — line ~1086: `<PlayerAvatar player={player} size={52} square />` → remove `square`
- Verify all other `PlayerAvatar` usages in `match.tsx` — already circular (no action needed)

---

## 4. "Practice Session" Rename

### Problem
"Hitting Session" is renamed to "Practice Session" in the UI. The DB enum value `hitting_session` is unchanged — the rename is display-label only.

### Fix
Update `matchTypeLabel` function:
```ts
case 'hitting_session': return 'Practice Session';  // was 'Hitting Session'
```

Also update the formats array in `MatchFiltersSheet` and the new `MatchRequestSheet` to display "Practice Session".

---

## 5. match_requests Data Model — Migration

### Current columns
`id`, `challenger_id`, `opponent_id`, `match_type`, `court_type`, `date`, `time_start`, `time_end`, `location`, `status`, `created_at`, `updated_at`

### Missing columns (add via migration)
| Column | Type | Default | Notes |
|---|---|---|---|
| `duration` | `integer` | `null` | Match duration in minutes (60, 90, or 120) |
| `message` | `text` | `null` | Optional message from requester |
| `availability_type` | `text` | `'one_time'` | `'one_time'` or `'recurring'` |
| `expires_at` | `timestamptz` | `NOW() + INTERVAL '72 hours'` | Auto-set; expired requests hidden |

### Migration SQL
```sql
ALTER TABLE public.match_requests
  ADD COLUMN IF NOT EXISTS duration         integer,
  ADD COLUMN IF NOT EXISTS message          text,
  ADD COLUMN IF NOT EXISTS availability_type text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS expires_at       timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '72 hours');
```

No new RLS policies needed — existing column-level policies cover these fields.

### types.ts update
Add the four new fields to `match_requests.Row`, `match_requests.Insert`, and `match_requests.Update`.

### Expiration filtering
In `useMatchData`, update the incoming requests query:
```ts
.eq('status', 'pending')
.gt('expires_at', new Date().toISOString())   // ← add this filter
```

Expired requests remain in the database but are not fetched.

---

## 6. Reservation Sheet — Summary in Sticky Footer

### Problem
The `selectedSummary` view renders inside `sheetConfirmArea` (already sticky), but adds 40–60px of height when a slot is selected, pushing up over the last visible time slots.

### Fix (Option A)
Remove `selectedSummary` as a separate block. Place reservation details as a compact two-line text directly inside `sheetConfirmArea`, above the confirm button:

```
The Greens Court · Doubles · 90 min
Sun Jun 7 · 8:00 AM – 9:30 AM    ☀ Sunny
```

**Implementation:**
- Delete the `selectedSummary` StyleSheet entry and its conditional `View` block (lines ~1185–1206 in courts.tsx)
- Replace with a single `selectedSlot ?` conditional that renders a two-line summary:
  - Line 1: `{courtName} · {playType} · {duration} min` (Manrope SemiBold 13, primary text)
  - Line 2: `{formattedDate} · {formattedTime}` + optional weather icon (Manrope Medium 12, secondary text)
- Total added height when slot selected: ~36px (two text lines + 8px margin-bottom) instead of ~60px
- The confirm button text remains: `'Confirm Reservation'` (no slot details in the button itself)
- `sheetConfirmArea` `paddingTop` stays as-is; no restructuring of the ScrollView

### Acceptance
- More time slots remain visible after selecting a slot
- Selected slot row itself is not obscured by the footer
- Confirm button always visible
- No functionality removed

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/app/(resident)/match.tsx` | NTRP multi-select, MatchRequestSheet, circular avatars, Practice Session rename, expiry filter |
| `src/app/(resident)/courts.tsx` | Reservation footer — remove summary card, inline compact summary |
| `supabase/migrations/<timestamp>_match_request_schema.sql` | Add `duration`, `message`, `availability_type`, `expires_at` |
| `src/lib/types.ts` | Add 4 new fields to match_requests types |

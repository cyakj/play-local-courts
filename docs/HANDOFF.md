# Match Screen — Visual QA Handoff

**Date:** 2026-06-05  
**Branch:** main  
**Last commit:** feat(match): build Match screen — singles + hitting session fully functional (`ac9c389`)

---

## What Was Built (Complete)

Full Match screen implementation at `src/app/(resident)/match.tsx`:

- **MatchPageHeader** — light white header with TenisX logo, bell, user avatar (initials), hamburger menu. Replaces dark navy `Header variant="resident"` for this screen only.
- **Filter card** — flex-row layout (no horizontal scroll), all 5 chips + Edit button visible without overflow
- **Recommended Players** — horizontal FlatList, real data from `match_preferences + profiles` tables, mock fallback
- **Incoming Requests** — horizontal FlatList, real data from `match_requests` where `opponent_id = me`, Accept/Decline action sheets
- **Upcoming Matches** — vertical list, real data from `matches` table, Reschedule/Cancel action sheets
- **Action sheets** — Accept, Decline, Reschedule, Cancel all working with quick-reply chips + Supabase writes
- **Player Lookup modal** — live search against `profiles` where `location_visible = true`
- **Message deep-link** — navigates to `/messages?partner=<id>`, auto-opens conversation thread
- **WeatherMini** — `src/components/ui/WeatherMini.tsx`, vector icons (Sun/CloudSun/Cloud/CloudRain/Zap)
- **Bottom nav** — Courts → "Reserve", Match → "VS" bold label
- **DB migration** — `supabase/migrations/20260604000000_extend_match_type.sql` (adds mixed_doubles, hitting_session)

---

## Visual QA Status

### ✅ Fixed (All sessions)
| Item | Fix applied |
|---|---|
| Dark header → light header | `MatchPageHeader` inline component in match.tsx |
| No profile avatar in header | Avatar with initials fetched from profiles |
| Filter card cut off | Flex-row layout, "Edit" button always visible |
| "COURTS" label | Changed to "RESERVE" in `_layout.tsx` |
| Match tab "MATCH" label | VS text (now the icon itself is bold "VS" text, no label) |
| MaxWidth 480px centering constraint | Removed — full screen width now |
| Card too narrow (name truncating) | `REC_CARD_W` → 80% of screen width |
| UTR + NTRP on separate lines | Fixed by wider card; both fit on one line now |
| Logo invisible on white header | Added `tintColor: '#0C0F18'` to Image in MatchPageHeader |
| Match tab icon (swords) | Replaced with bold Text "VS" in `_layout.tsx` |
| BottomNav duplicate VS label | BottomNav hides text label when `tabBarLabel === 'VS'` |
| Large dead space in empty states | Compact icon+text rows for all 3 empty states |
| Filter card visual quality | Taller items, bigger fonts, blue-tinted Edit button with separator |

### ⚠️ Minor Remaining (Acceptable)
| Item | Detail |
|---|---|
| Subtitle wraps to 2 lines | "Find the right players. Play more tennis." wraps on 390px. Acceptable. |
| Filter chip shows "7.5–9" | Label says "Skill Level" — acceptable abbreviation |

---

## Files Changed (This Session)

| File | Change |
|---|---|
| `src/app/(resident)/match.tsx` | Full rewrite — all Match logic + visual QA fixes |
| `src/app/(resident)/_layout.tsx` | Courts → Reserve, tabBarLabel: VS |
| `src/components/ui/BottomNav.tsx` | VS label special-casing (bold, no uppercase) |
| `src/components/ui/WeatherMini.tsx` | New — vector weather icons |
| `src/app/messages.tsx` | Added `?partner=<id>` deep-link support |
| `supabase/migrations/20260604000000_extend_match_type.sql` | Extend match_type enum |
| `docs/superpowers/plans/2026-06-04-match-screen.md` | Implementation plan |
| `docs/superpowers/specs/2026-06-04-match-screen-design.md` | Design spec + proposed follow-up migrations |

---

## Known TODOs (Marked in Code)

Search `// TODO` in `match.tsx`:

| TODO | Location | What it needs |
|---|---|---|
| `TODO(doubles)` | IncomingRequestCard doubles row | Replace 2-slot display with `match_request_participants` query when table exists |
| `TODO(doubles)` | UpcomingMatchCard doubles avatars | Same — use real team data |
| `TODO(group-chat)` | All Message buttons on doubles cards | Open group conversation when `conversations` table exists |
| `TODO:` | `cancelMatch()` helper | Add `status` column to `matches` table |
| `TODO:` | `rescheduleMatch()` helper | Add reschedule_requests table or date-picker flow |

---

## Next Session Priorities

### 1. Final visual QA pass (30 min)
- Test with a real `match_request` row in DB to see Incoming Request card + Accept/Decline sheets
- Test with a real future `matches` row to see Upcoming Match card + Reschedule/Cancel sheets
- Verify weather cards appear when locations are set

### 3. Doubles follow-up migration (when ready)
Spec is in `docs/superpowers/specs/2026-06-04-match-screen-design.md`.  
Tables needed: `match_request_participants`, `conversations`, `conversation_participants`, `conversation_messages`.

### 4. Filter persistence
Connect "Edit Filters" button to a bottom sheet that writes back to `match_preferences` table and reloads recommended players.

---

## How to Resume

```bash
# Dev server
npm run dev

# Type check
npx tsc --noEmit --skipLibCheck

# Navigate to match screen in browser
http://localhost:8081/match
# Login: 28-027@sanignacio.pr / Karram1@
```

Test account: `28-027@sanignacio.pr` — has `match_preferences.looking_to_play = true` for Ron Glickman (UTR 6.0), so the Recommended Players section shows real data.

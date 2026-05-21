# Session Handoff — TenisX Stage 1 Native Rebuild

**Date:** 2026-05-21  
**Branch:** main  
**Last clean commit:** `be0fdbf` — fix: manage-amenities reads hoaId param; pending-requests shows count in title

---

## What Was Completed This Session

Tasks 1–11 of the 13-task implementation plan are done and committed.

| Task | Status | Commit |
|------|--------|--------|
| T1: Install Dependencies | ✅ Done | `2dda8c9` |
| T2: Design Tokens | ✅ Done | `a974688` |
| T3: Supabase Client + Types | ✅ Done | `213b378` |
| T4: Root Layout (auth gate, fonts) | ✅ Done | `aa23165` |
| T5: Header component | ✅ Done | `4699eb3` |
| T6: Card/StatusPill/StatsGrid/HealthBar | ✅ Done | `f124a5e` |
| T7: Button/EmptyState/Skeleton/BottomNav | ✅ Done | `510cef1` |
| T8: CM Navigation Layout | ✅ Done | `54c137c` |
| T9: AdminHub screen | ✅ Done | `1732420` |
| T10: MaintenanceReports screen | ✅ Done | `bd68bf9` |
| T11: Admin Screens (ManageAmenities/ManageCourts/PendingRequests) | ✅ Done | `d223d54` + `be0fdbf` |
| T12: Resident Screens | ⏳ Not started | — |
| T13: Cleanup + Final Compile Check | ⏳ Not started | — |

---

## Critical Issue: Shadcn/Web Components Injected

**A merge from commit `6236cde` ("Add Google Stitch skills") injected shadcn/ui web components into `src/components/ui/`.** This overwrote several React Native components with web-only HTML versions.

### Files that were overwritten (and need attention):
- `src/components/ui/button.tsx` — shadcn version (our `Button.tsx` uppercase is CORRECT)
- `src/components/ui/card.tsx` — shadcn version (our `Card.tsx` uppercase is CORRECT)
- `src/components/ui/Skeleton.tsx` — was overwritten, restored to React Native version
- `src/components/ui/collapsible.tsx` — may have been overwritten (was a template file)

### New junk files that do NOT belong (shadcn components, all web-only):
The following files in `src/components/ui/` are shadcn web components that must be deleted in Task 13:
- `accordion.tsx`, `alert.tsx`, `alert-dialog.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`
- `breadcrumb.tsx`, `calendar.tsx` (shadcn, NOT the CM calendar stub), `carousel.tsx`, `chart.tsx`
- `checkbox.tsx`, `command.tsx`, `context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`
- `form.tsx`, `hover-card.tsx`, `input.tsx`, `input-otp.tsx`, `label.tsx`, `menubar.tsx`
- `navigation-menu.tsx`, `notification-banner.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`
- `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`
- `sidebar.tsx`, `slider.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`
- `time-select.tsx`, `toast.tsx`, `toaster.tsx`, `toggle.tsx`, `toggle-group.tsx`, `tooltip.tsx`
- `use-toast.ts`
- Also: `CoachNavbar.tsx`, `Navbar.tsx`, `profile-link.tsx` — unknown origin, not part of TenisX

### Our React Native UI components (KEEP these, they are correct):
- `Button.tsx` (capital B)
- `Card.tsx` (capital C)
- `BottomNav.tsx`
- `EmptyState.tsx`
- `Header.tsx`
- `HealthBar.tsx`
- `Skeleton.tsx` (restored)
- `StatsGrid.tsx`
- `StatusPill.tsx`

---

## Remaining Tasks

### Task 12: Resident Screens
**Files to create:**
- `src/app/(resident)/_layout.tsx` — Tabs navigator with Home/Book/Reports/Calendar/Docs
- `src/app/(resident)/index.tsx` — Resident home + booking flow
- `src/app/(resident)/report.tsx` — Issue reporting form
- Stubs: `src/app/(resident)/book.tsx`, `calendar.tsx`, `docs.tsx`

**Schema facts verified this session:**
- `profiles` table has `full_name` (NOT `first_name`/`last_name`)
- `bookings` links to HOA via `court_id → courts.hoa_id` (no direct `hoa_id` on bookings)
- `courts` table has `court_type` column (NOT `amenity_type`)
- `bookings` has `start_time`, `end_time`, `status`, `court_id`, `user_id`, `date` columns
- `maintenance_reports` has NO `title` column — uses `description` as primary text

**DO NOT use `date-fns`** — already installed but use vanilla JS helpers to avoid adding a dep.

**Resident Home screen** (`index.tsx`):
- Uses `Header variant="resident-home"` with `greeting`, `subCopy`, `avatarInitials` props
- Court selector pills → date selector → time slot grid → booking confirmation modal
- Pull-to-refresh, upcoming bookings section
- Available slots colored `Colors.optimalBg`, booked slots `Colors.attentionBg`

**Report screen** (`report.tsx`):
- Category pill selector (plumbing/electrical/structural/cleanliness/equipment/safety/other)
- Amenity picker (optional, loads from `courts` table)
- Description field (this IS the `description` column in `maintenance_reports`)
- Submit inserts into `maintenance_reports` with `status: 'open'`
- Success state with CheckCircle icon

### Task 13: Cleanup + Final Compile Check
1. **Delete all shadcn junk files** from `src/components/ui/` (listed above)
2. Check if old template files still need removal: `src/app/index.tsx`, `src/app/explore.tsx`, `src/components/app-tabs.tsx`
3. Run `npx tsc --noEmit` — fix any NEW errors (2 pre-existing CSS errors are OK)
4. Run `npx expo export --platform web` — verify bundle succeeds
5. Commit

---

## Verified Schema (from `src/lib/types.ts`)

- `hoas`: `id`, `name`, `created_at`, `updated_at`
- `hoa_memberships`: `id`, `hoa_id`, `user_id`, `role`, `created_at`
- `courts`: `id`, `name`, `court_type`, `hoa_id`, `created_at`, `updated_at`
- `bookings`: `id`, `court_id`, `user_id`, `start_time`, `end_time`, `status`, `date`, `created_at`
- `maintenance_reports`: `id`, `description`, `category`, `report_type`, `status`, `admin_notes`, `location_text`, `resolution_notes`, `created_at`, `hoa_id`
- `community_join_requests`: `id`, `user_id`, `hoa_id`, `status`, `message`, `created_at`, `updated_at`
- `profiles`: `id`, `full_name`, `username`, `created_at`, `updated_at`
- `court_maintenance`: `id`, `court_id`, `date`, `start_time`, `end_time`, `created_at`

---

## Design System Reminder

All files at: `src/constants/design.ts`

- **Header inner variant props:** `title: string`, `onBack: () => void`, `rightIcon?: React.ReactNode`
- **Header cm-portfolio props:** `greeting: string`, `subCopy: string`
- **Header resident-home props:** `greeting: string`, `subCopy: string`, `avatarInitials: string`
- **Button variants:** `primary` (navy bg), `accent` (cyan bg), `ghost` (gray), `destructive` (red border)
- **StatusPill statuses:** `optimal`, `needs-attention`, `critical`, `pending`, `approved`, `rejected`, `open`, `in-progress`, `resolved`
- **BottomNav:** pass `{...(props as any)}` from Tabs `tabBar` prop due to expo-router/react-navigation type mismatch

---

## Git Notes

- `git status` will show `M src/components/ui/button.tsx` and `M src/components/ui/card.tsx` (lowercase) — these are the SHADCN files tracking differently from our uppercase `Button.tsx`/`Card.tsx`. Our uppercase React Native versions are correct and unmodified.
- The "Add Google Stitch skills" merge (`6236cde`) is the source of all the shadcn contamination

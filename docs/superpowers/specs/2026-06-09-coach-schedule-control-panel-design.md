# Coach Schedule Control Panel — Design Spec (All Phases)

**Date:** 2026-06-09  
**Status:** Phase 1 ready to implement. Phase 2–3 pending.

---

## Overview

Replace the simple hourly grid with a layered scheduling system. Coaches manage their schedule through a dedicated Control Panel screen rather than by painting cells on a grid. The final public-facing schedule is calculated from the intersection of all layers.

---

## Layer Model

```
Global Coaching Hours      ← outer boundary, always private
  ↓ intersect
Facility Hours             ← blue, public or private
  ↓ union
Travel Hours               ← yellow, public or private
  ↓ minus
Blockouts                  ← gray, overrides everything
  ↓ minus
Booked Lessons             ← navy (from lesson_requests)
  ↓ remaining
= Available Public Slots   ← what students see
```

---

## Phase 1 — Schedule Control Panel + Data Model

### New DB Tables

**`coach_global_hours`** — weekly outer bounds per day
```sql
coach_id uuid, day_of_week int (0=Sun–6=Sat),
start_time time, end_time time, is_closed boolean
unique(coach_id, day_of_week)
```

**`coach_facility_hours`** — structured facility teaching windows
```sql
coach_id uuid, facility_name text, facility_address text,
court_type text, days_of_week int[], start_time time, end_time time,
publicly_bookable boolean, notes text, is_active boolean
```

**`coach_travel_hours`** — structured travel availability windows
```sql
coach_id uuid, travel_base_address text (private),
travel_radius_miles int, areas_served text[],
days_of_week int[], start_time time, end_time time,
publicly_bookable boolean, travel_notes text, is_active boolean
```

Existing `coach_availability` and `coach_unavailability` tables kept intact — booking flow must not break.

### New Screen: `src/app/(coach)/schedule-settings.tsx`

Replaces the inline grid editor. Sections (collapsible cards):

1. **Global Coaching Hours** — 7 day rows, each shows time range or "Closed"; tap to edit
2. **Facility Hours** — list of facility records + Add button; each row shows name, days, hours, public badge
3. **Travel Availability** — list of travel window records + Add button
4. **Blockouts** — existing `coach_unavailability` data, enhanced UI with type icons
5. **Public Visibility** — summary showing which sections have public slots
6. **Color Key** — Facility=Blue, Travel=Yellow, Either=Cyan, Blockout=Gray, Lesson=Navy, Pending=Orange

### Updated Schedule Screen: `src/app/(coach)/schedule.tsx`

Remove `CoachAvailabilityGridEditor`. Add a "Manage Schedule →" card that navigates to `schedule-settings`.

### New Hooks

- `useCoachGlobalHours(coachId)` — CRUD for global hours
- `useCoachFacilityHours(coachId)` — CRUD for facility hours
- `useCoachTravelHours(coachId)` — CRUD for travel hours

### Components

- `ScheduleControlPanel` — parent screen layout
- `GlobalHoursSection` — 7-day grid of time pickers
- `FacilityHoursSection` — list + add/edit sheet
- `TravelHoursSection` — list + add/edit sheet
- `BlockoutsSection` — enhanced wrapper around existing `coach_unavailability`
- `ScheduleColorKey` — legend card
- `DayTimePickerSheet` — reusable bottom sheet: day selector + time range picker

---

## Phase 2 — Calendar Layer View (future)

Visual week grid that overlays all layers simultaneously. Colors per the key. Tap any block to edit/remove/broadcast. Reads from all 3 new tables + `lesson_requests` + `coach_unavailability`.

---

## Phase 3 — Cancellation Fill + Push Notifications (future)

### New DB Tables
- `coach_cancellation_fill_rules` — per-coach config (mode, eligibility, approval required, template)
- `open_slot_notifications` — tracks broadcast events and fill status

### Push Infrastructure
- Add `expo_push_token` to `profiles`
- Expo Notifications registration in `_layout.tsx`
- Supabase edge function `send-open-slot-notification` — triggered on lesson cancellation, queries eligible students, calls Expo push API

### Cancellation Fill Modes
- Off
- Notify waitlist only
- Notify selected students
- Notify all eligible
- Notify matching (lesson type / skill level / location)

### UI Additions
- `CancellationFillSection` in Schedule Control Panel
- "Send Open Slot Alert" button on lesson detail when status=cancelled

---

## Color Key Reference

| Type | Color | Label |
|---|---|---|
| Facility | `#2D6BFF` Blue | F |
| Travel | `#D6FF3D` Volt | T |
| Either | `#2DE0FF` Cyan | E |
| Blockout | `#5A6379` Gray | B |
| Booked Lesson | `#0C0F18` Navy | L |
| Pending Request | `#FF8C42` Orange | P |
| Public slot | Outlined ring | — |
| Private/internal | Muted, no ring | — |

---

## QA Checklist (Phase 1)

- [ ] Coach can set global operating hours per day (or mark Closed)
- [ ] Coach can add a facility teaching window with all fields
- [ ] Coach can add a travel availability window with all fields
- [ ] Coach can toggle publicly_bookable on each facility/travel record
- [ ] Blockouts display with type icons and date ranges
- [ ] Color key is visible and correct
- [ ] Navigating from schedule screen to control panel works
- [ ] Existing lesson_requests / booking flow unaffected
- [ ] All DB writes use RLS — coach can only write own rows

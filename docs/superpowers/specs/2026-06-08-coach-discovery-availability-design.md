# Coach Discovery & Availability — Design Spec

**Date:** 2026-06-08  
**Scope:** Part 1 — Player-side coach discovery (filters, sort, cards); Part 2 — Coach-side availability grid editor  
**Status:** Approved

---

## 1. Context

### Current State
- `CoachFiltersSheet` has 5 working sections: Distance, Skill Level, Price Range, Lesson Type, Availability
- Lesson Type filter is a **no-op** — `lesson_types_offered` doesn't exist on `coaches`; the current `me.tsx` toggles `sports_offered` by mistake
- No sort control exists
- `CoachAvailabilityEditor` uses a manual start/end time picker with no visual grid
- `coach_availability` schema: `id, coach_id, day_of_week, start_time, end_time, location_mode`
- `coach_unavailability` table already exists (`type, start_date, end_date, recurs_annually, title`)
- `CoachAvailabilityGrid` already has an `interactive` mode stub with `selectedBand`/`onSelectBand` props

---

## 2. Database Migrations

### Migration 1 — coaches table additions
```sql
ALTER TABLE coaches ADD COLUMN lesson_types_offered TEXT[] DEFAULT '{}';
ALTER TABLE coaches ADD COLUMN default_location_mode TEXT DEFAULT 'coach_facility';
```

### Migration 2 — coach_availability uniqueness
Enforce at DB level to complement the application-level upsert:
```sql
ALTER TABLE coach_availability
  ADD CONSTRAINT coach_availability_unique_slot
  UNIQUE (coach_id, day_of_week, start_time);
```
Only apply if constraint doesn't exist. Check `pg_constraint` first.

### Type regeneration
After migrations, regenerate `src/lib/types.ts` via Supabase CLI so TypeScript picks up new columns.

---

## 3. Part 1 — Player Discovery

### 3.1 New types (`useCoachData.ts`)

```typescript
export type RatingFilter = '4.0' | '4.5' | '4.8' | null;
export type ExperienceFilter = '0to2' | '3to5' | '5to10' | '10plus' | null;
export type LocationModeFilter = 'coach_facility' | 'traveling' | null;
export type GenderFilter = 'male' | 'female' | 'unspecified' | null;
export type SortOption =
  | 'best_match' | 'highest_rated' | 'most_reviews' | 'most_experienced'
  | 'lowest_price' | 'highest_price' | 'closest_distance';
```

### 3.2 CoachWithProfile additions

```typescript
gender: string | null;          // from profiles.gender (fetched in existing profile join)
lessonTypesOffered: string[];   // from coaches.lesson_types_offered
```

Profiles query in `useCoachData` already joins `profiles` — add `gender` to the select. Add `lesson_types_offered` to the coaches select.

### 3.3 CoachFilters additions

```typescript
rating:       RatingFilter;
experience:   ExperienceFilter;
locationMode: LocationModeFilter;
gender:       GenderFilter;
sort:         SortOption;
```

### 3.4 CoachFiltersState additions (CoachFiltersSheet)

Same 4 new fields. `DEFAULT_FILTERS` gets: `rating: null, experience: null, locationMode: null, gender: null`. Update `activeFilterCount` to count them.

### 3.5 New filter sections in CoachFiltersSheet

**Rating** (single-select, below Availability):
- Options: Any · 4.0+ · 4.5+ · 4.8+

**Years of Experience** (single-select):
- Options: Any · 0–2 yrs · 3–5 yrs · 5–10 yrs · 10+ yrs

**Location Mode** (single-select):
- Options: Either · Coach Facility · Travels to You

**Gender** (single-select):
- Options: Any · Male · Female · Unspecified
- Only filters when gender data is present; coaches without gender data pass through unless "Unspecified" is selected

### 3.6 Lesson Type filter activation

Update `CoachFiltersSheet.LESSON_TYPE_OPTIONS` to match new 8-type list:
```
Private Lesson · Semi-Private Lesson · Group Lesson · Hitting Partner
· Match Play · Junior Development · Adult Beginner · Advanced Training
```

Filter logic in `useCoachData`: `c.lessonTypesOffered.some(lt => filters.lessonTypes.includes(lt))`.  
Coaches with empty `lesson_types_offered` pass through (same as "Rate TBD" for price).

### 3.7 Client-side filter logic additions

```
Rating:       c.avgRating != null && c.avgRating >= parseFloat(filter)
Experience:   range check on c.yearsExperience (null passes through)
LocationMode: 'traveling'      → c.willingToTravel === true
              'coach_facility' → c.willingToTravel !== true OR has any facility slot
Gender:       c.gender?.toLowerCase() matches filter value; 'unspecified' matches null/''
```

### 3.8 Sort (new CoachSortSheet component)

**File:** `src/components/coaching/CoachSortSheet.tsx`  
Same modal pattern as `CoachFiltersSheet` but single-select, no Apply — changes are immediate on selection (optimistic). Shows radio-style active indicator.

Sort options and implementation:

| Option | Logic |
|---|---|
| Best Match | Weighted score (see below) |
| Highest Rated | `avgRating` desc, nulls last |
| Most Reviews | `reviewCount` desc |
| Most Experienced | `yearsExperience` desc, nulls last |
| Lowest Price | `hourlyRate` asc, nulls last |
| Highest Price | `hourlyRate` desc, nulls last |
| Closest Distance | `distanceKm` asc, nulls last |

**Best Match score:**
```typescript
function bestMatchScore(c: CoachWithProfile): number {
  const ratingScore   = ((c.avgRating ?? 0) / 5) * 0.35;
  const reviewScore   = Math.min(c.reviewCount / 20, 1) * 0.25;
  const distScore     = c.distanceKm != null
    ? Math.max(0, 1 - c.distanceKm / 100) * 0.20
    : 0.5 * 0.20;
  const availScore    = (c.availableDays.size / 7) * 0.10;
  const expScore      = (Math.min(c.yearsExperience ?? 0, 20) / 20) * 0.10;
  return ratingScore + reviewScore + distScore + availScore + expScore;
}
```

### 3.9 Sort button in coaches.tsx

In the filter bar row (alongside Filters button), add an `ArrowUpDown` icon button labeled "Sort" (or active sort label when non-default). Opens `CoachSortSheet`. Sort state is separate from filter state — `useState<SortOption>('best_match')`.

### 3.10 Coach card enhancement (CoachCard.tsx)

Add years of experience in the rating row, between the rating and the price dot:
```
★ 4.8 (12) · 7 yrs · $95/hr
```
Only shown when `coach.yearsExperience != null`.

---

## 4. Coach Profile Editor Updates

### 4.1 useCoachProfile.ts additions

```typescript
// CoachProfileData additions
lessonTypesOffered: string[] | null;
defaultLocationMode: string | null;

// save() mapping additions
if (updates.lessonTypesOffered !== undefined)
  dbUpdates.lesson_types_offered = updates.lessonTypesOffered;
if (updates.defaultLocationMode !== undefined)
  dbUpdates.default_location_mode = updates.defaultLocationMode;
```

### 4.2 me.tsx changes

**Fix LESSON TYPES section:**
- Change `toggleLessonType` to use `lessonTypesOffered` instead of `sportsOffered`
- Update `LESSON_TYPES` constant to 8 types matching the filter list

**Add YEARS OF EXPERIENCE field** in the PROFILE card:
- Numeric text input for `years_experience`
- Saved along with other profile fields in `handleSaveProfile`

**Add DEFAULT LOCATION MODE section** (new chip group, saves immediately):
```
MY FACILITY   |   TRAVELS TO YOU   |   EITHER
```
Maps to: `'coach_facility'` | `'traveling'` | `'both'`

---

## 5. Part 2 — Availability Grid Editor

### 5.1 TIME_BANDS (unchanged)
```
MORNING    06:00–12:00
AFTERNOON  12:00–17:00
EVENING    17:00–21:00
```
Band-aligned slots use these exact `start_time`/`end_time` values. Overlap is structurally impossible within the band system.

### 5.2 New component: CoachAvailabilityGridEditor

**File:** `src/components/coach/CoachAvailabilityGridEditor.tsx`

**Replaces:** `CoachAvailabilityEditor` in `schedule.tsx`

**Props:**
```typescript
interface Props {
  weeklySlots: CoachAvailabilitySlot[];
  defaultLocationMode: string | null;
  onRefresh: () => void;
}
```

**Local state:**
```typescript
type CellKey = string; // `${dow}-${band.label}`
type CellMode = 'coach_facility' | 'traveling' | 'both' | null; // null = not available
type DraftMap = Map<CellKey, CellMode>;
```

**Initialization (on weeklySlots change):**
1. For each slot, find all bands it `overlaps()` — those cells get `slot.location_mode ?? 'coach_facility'`
2. Slots that overlap **no** bands → add to `legacySlots` list
3. Saved state snapshot stored separately for dirty detection

**Cell interaction:**
- Tap empty cell → set to `defaultLocationMode` (or `'coach_facility'` if null)
- Tap active cell → open compact `LocationModeActionSheet`:
  - [My Facility] [Traveling] [Either] [Remove]
  - Selection updates draft map
- Default location mode picker above the grid (3 chips) — updates `defaultLocationMode` state and saves to `coaches.default_location_mode` immediately

**Dirty tracking:**
Show "Save Changes" button when `draft !== savedState`. Disabled when no changes.

**Save logic:**
```typescript
async function saveGrid() {
  // 1. Delete existing band-aligned slots that are no longer in draft
  const toDelete = savedBandSlots.filter(s => {
    const band = TIME_BANDS.find(b => b.start === s.start_time);
    if (!band) return false; // legacy, don't touch
    const key = `${s.day_of_week}-${band.label}`;
    return draft.get(key) == null;
  });
  
  // 2. Upsert slots that are in draft
  const toUpsert = Array.from(draft.entries())
    .filter(([, mode]) => mode != null)
    .map(([key, mode]) => {
      const [dow, bandLabel] = key.split('-');
      const band = TIME_BANDS.find(b => b.label === bandLabel)!;
      return {
        coach_id: coachId,
        day_of_week: Number(dow),
        start_time: band.start,
        end_time: band.end,
        location_mode: mode,
      };
    });
  
  await supabase.from('coach_availability').delete().in('id', toDelete.map(s => s.id));
  if (toUpsert.length > 0) {
    await supabase.from('coach_availability')
      .upsert(toUpsert, { onConflict: 'coach_id,day_of_week,start_time' });
  }
}
```

### 5.3 Cell visual encoding

Grid cells have 4 visible states:

| State | Visual |
|---|---|
| Not available | Muted grey (`rgba(154,163,184,0.06)`) |
| Facility | Blue tint (`rgba(45,107,255,0.15)`) + small blue dot |
| Traveling | Volt tint (`rgba(214,255,61,0.12)`) + small volt dot |
| Both (Either) | Cyan tint (`rgba(45,224,255,0.12)`) + small cyan dot |

Legend shown below grid. Dot size: 6px, centered in cell.

### 5.4 Legacy slots section

Shown below the grid when `legacySlots.length > 0`:

```
─────────────────────────────────────────
  LEGACY AVAILABILITY

  Monday  9:00am – 1:00pm  (My Facility)   [Convert]  [🗑]
  Friday  7:00pm – 9:30pm  (Traveling)     [Convert]  [🗑]
─────────────────────────────────────────
```

**Convert button:** Maps legacy slot to all overlapping bands and adds them to the draft map (with slot's location_mode). Prompts confirmation if a band is already set.

**Delete button:** Alert confirmation, then `supabase.from('coach_availability').delete().eq('id', slot.id)` + `onRefresh()`.

If all legacy slots are converted/deleted, section disappears.

### 5.5 CoachAvailabilityGrid extensions

Extend component props for editor mode (backward-compatible — all new props optional):

```typescript
// Editor-mode props (optional, all default to undefined)
getCellMode?: (dow: number, band: TimeBand) => CellMode;
onCellPress?: (dow: number, band: TimeBand) => void;
```

When `onCellPress` is provided, individual cells respond to tap (not just band rows). When `getCellMode` is provided, cells render with mode-colored tint instead of binary available/unavailable.

### 5.6 schedule.tsx update

Replace:
```tsx
<CoachAvailabilityEditor slots={weeklySlots} onRefresh={refreshSchedule} />
```
With:
```tsx
<CoachAvailabilityGridEditor
  weeklySlots={weeklySlots}
  defaultLocationMode={coachProfile?.defaultLocationMode ?? null}
  onRefresh={refreshSchedule}
/>
```

Requires `useCoachProfile` import in schedule.tsx.

---

## 6. Q4 — Availability Architecture

The 3-layer schedule model is already supported by the schema:

```
coach_availability      (recurring weekly base — what this spec manages)
+ coach_unavailability  (exceptions: vacation, travel, sick, holidays)
+ lesson_requests       (confirmed bookings)
= Final available schedule
```

`coach_unavailability` schema already supports all exception types:
- `type TEXT` — 'vacation', 'tournament', 'sick', 'holiday', custom
- `start_date / end_date DATE`
- `recurs_annually BOOLEAN`
- `title TEXT | null`

`useCoachAvailability.isAvailableOnDate()` already implements the 3-layer check. No DB redesign needed. V2 will add a UI screen for exception management under the Schedule tab.

---

## 7. Files Changed

### New files
| File | Purpose |
|---|---|
| `src/components/coaching/CoachSortSheet.tsx` | Sort picker modal |
| `src/components/coach/CoachAvailabilityGridEditor.tsx` | New grid-based availability editor |
| `supabase/migrations/[timestamp]_coach_lesson_types_location.sql` | Migrations 1 + 2 |

### Modified files
| File | Changes |
|---|---|
| `src/lib/types.ts` | Regenerated after migration |
| `src/hooks/useCoachData.ts` | New filter types, sort, gender/lessonTypes fields, Best Match |
| `src/hooks/useCoachProfile.ts` | `lessonTypesOffered`, `defaultLocationMode` |
| `src/hooks/useCoachAvailability.ts` | No changes needed (architecture already correct) |
| `src/components/coaching/CoachFiltersSheet.tsx` | 4 new sections, updated lesson types list |
| `src/components/coaching/CoachCard.tsx` | Years of experience in meta row |
| `src/components/coaching/CoachAvailabilityGrid.tsx` | `getCellMode`, `onCellPress` props |
| `src/app/(resident)/coaches.tsx` | Sort button, sort state |
| `src/app/(coach)/me.tsx` | Fix lesson types field, add years exp, add default location |
| `src/app/(coach)/schedule.tsx` | Swap editor component |

---

## 8. Acceptance Criteria

- [ ] All 9 filter sections render in CoachFiltersSheet and actually affect results
- [ ] Sort control changes coach order; Best Match is the default
- [ ] Gender filter works when profile data exists; coaches without gender data pass through unless "Unspecified" selected
- [ ] Lesson type filter is fully functional (not a no-op)
- [ ] Coach cards show years of experience when set
- [ ] Availability grid pre-populates from existing slots
- [ ] Tapping empty cell creates a band slot with coach default location mode
- [ ] Tapping active cell allows changing location mode or removing slot
- [ ] Save Changes button only visible when grid has unsaved changes
- [ ] Legacy slots visible in dedicated section with Convert and Delete actions
- [ ] No existing availability is lost or hidden by the migration
- [ ] `default_location_mode` picker in coach profile saves to `coaches` table
- [ ] Lesson types in coach profile editor use `lesson_types_offered` not `sports_offered`
- [ ] No TypeScript errors

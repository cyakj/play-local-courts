# Coach Discovery & Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new discovery filters + sort control to player coach search, activate lesson-type filtering end-to-end, and replace the manual slot picker with a weekly grid editor for coaches.

**Architecture:** Client-side filtering and sorting on top of a single Supabase fetch; two new DB columns on `coaches`; a new `CoachAvailabilityGridEditor` component that replaces `CoachAvailabilityEditor` and drives cell-level toggles via extended `CoachAvailabilityGrid` props.

**Tech Stack:** React Native 0.85 · Expo SDK 56 · expo-router · Supabase · TypeScript · Lucide React Native

**Spec:** `docs/superpowers/specs/2026-06-08-coach-discovery-availability-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `supabase/migrations/[ts]_coach_lesson_types_location.sql` | Add `lesson_types_offered`, `default_location_mode`, unique constraint |
| Create | `src/components/coaching/CoachSortSheet.tsx` | Sort picker modal (7 options) |
| Create | `src/components/coach/CoachAvailabilityGridEditor.tsx` | Grid-based availability editor |
| Modify | `src/hooks/useCoachAvailability.ts` | Export `CellMode` type |
| Modify | `src/hooks/useCoachData.ts` | New filter/sort types, gender, lessonTypesOffered, sort logic |
| Modify | `src/hooks/useCoachProfile.ts` | Add `lessonTypesOffered`, `defaultLocationMode` |
| Modify | `src/components/coaching/CoachFiltersSheet.tsx` | 4 new sections, updated lesson type list |
| Modify | `src/components/coaching/CoachAvailabilityGrid.tsx` | `getCellMode`, `onCellPress` cell-level props |
| Modify | `src/components/coaching/CoachCard.tsx` | Years of experience in meta row |
| Modify | `src/app/(resident)/coaches.tsx` | Sort state + Sort button |
| Modify | `src/app/(coach)/me.tsx` | Fix lesson types field, add years exp + default location |
| Modify | `src/app/(coach)/schedule.tsx` | Swap to `CoachAvailabilityGridEditor` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260608000000_coach_lesson_types_location.sql`

- [ ] **Step 1: Write migration file**

```sql
-- Add lesson_types_offered and default_location_mode to coaches
ALTER TABLE coaches
  ADD COLUMN IF NOT EXISTS lesson_types_offered TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_location_mode TEXT DEFAULT 'coach_facility';

-- Enforce uniqueness on coach_availability slots (band-aligned grid relies on this)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_availability_unique_slot'
      AND conrelid = 'coach_availability'::regclass
  ) THEN
    ALTER TABLE coach_availability
      ADD CONSTRAINT coach_availability_unique_slot
      UNIQUE (coach_id, day_of_week, start_time);
  END IF;
END$$;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with the SQL above. Target the active project.

- [ ] **Step 3: Regenerate TypeScript types**

```powershell
npx supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/types.ts
```

Verify `src/lib/types.ts` now contains `lesson_types_offered` and `default_location_mode` under the `coaches` Row type.

- [ ] **Step 4: Compile check**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/20260608000000_coach_lesson_types_location.sql src/lib/types.ts
git commit -m "feat(db): add lesson_types_offered, default_location_mode to coaches; enforce availability uniqueness"
```

---

## Task 2: Export CellMode from useCoachAvailability

**Files:**
- Modify: `src/hooks/useCoachAvailability.ts`

- [ ] **Step 1: Add CellMode export**

In `src/hooks/useCoachAvailability.ts`, after the imports, add:

```typescript
export type CellMode = 'coach_facility' | 'traveling' | 'both';
```

Update `CoachAvailabilitySlot.location_mode` to use it:

```typescript
export interface CoachAvailabilitySlot {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_mode: CellMode | null;
}
```

- [ ] **Step 2: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/hooks/useCoachAvailability.ts
git commit -m "feat(coach): export CellMode type from useCoachAvailability"
```

---

## Task 3: useCoachProfile — add new fields

**Files:**
- Modify: `src/hooks/useCoachProfile.ts`

- [ ] **Step 1: Add fields to CoachProfileData**

In `CoachProfileData`, add after `isActive`:

```typescript
lessonTypesOffered: string[] | null;
defaultLocationMode: string | null;
```

- [ ] **Step 2: Add to setProfile() call**

In the `load()` function, extend the `setProfile({...})` call:

```typescript
lessonTypesOffered:  data.lesson_types_offered as string[] | null,
defaultLocationMode: data.default_location_mode as string | null,
```

- [ ] **Step 3: Add to save() mapping**

In `save()`, after the `is_active` mapping:

```typescript
if (updates.lessonTypesOffered !== undefined)
  dbUpdates.lesson_types_offered = updates.lessonTypesOffered;
if (updates.defaultLocationMode !== undefined)
  dbUpdates.default_location_mode = updates.defaultLocationMode;
```

- [ ] **Step 4: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```powershell
git add src/hooks/useCoachProfile.ts
git commit -m "feat(coach): add lessonTypesOffered and defaultLocationMode to useCoachProfile"
```

---

## Task 4: Coach me.tsx — fix lesson types + years exp + default location

**Files:**
- Modify: `src/app/(coach)/me.tsx`

- [ ] **Step 1: Replace LESSON_TYPES constant**

Replace the existing `LESSON_TYPES` array at the top of the file:

```typescript
const LESSON_TYPES = [
  { value: 'private_lesson',      label: 'Private'        },
  { value: 'semi_private_lesson', label: 'Semi-Private'   },
  { value: 'group_lesson',        label: 'Group'          },
  { value: 'hitting_partner',     label: 'Hitting Partner'},
  { value: 'match_play',          label: 'Match Play'     },
  { value: 'junior_development',  label: 'Junior Dev'     },
  { value: 'adult_beginner',      label: 'Adult Beginner' },
  { value: 'advanced_training',   label: 'Advanced'       },
];
```

Add below it:

```typescript
const LOCATION_MODE_OPTIONS = [
  { value: 'coach_facility', label: 'My Facility'   },
  { value: 'traveling',      label: 'Travels to You'},
  { value: 'both',           label: 'Either'        },
];
```

- [ ] **Step 2: Add yearsExperience state**

In the component, alongside the other `useState` calls:

```typescript
const [yearsExperience, setYearsExperience] = useState('');
```

In the `useMemo` initialization block, add:

```typescript
setYearsExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : '');
```

- [ ] **Step 3: Update handleSaveProfile to include yearsExperience**

```typescript
async function handleSaveProfile() {
  const rate  = parseFloat(hourlyRate);
  const years = parseInt(yearsExperience, 10);
  const err = await save({
    businessName:    businessName.trim() || null,
    bio:             bio.trim() || null,
    hourlyRate:      isNaN(rate)  ? null : rate,
    homeBase:        homeBase.trim() || null,
    yearsExperience: isNaN(years) ? null : years,
  });
  if (err) Alert.alert('Error', err);
  else Alert.alert('Saved', 'Profile updated.');
}
```

- [ ] **Step 4: Add Years of Experience field in PROFILE card**

After the Hourly Rate `TextInput` and before the Save button:

```typescript
<Text style={styles.fieldLabel}>Years of Experience</Text>
<TextInput
  style={styles.input}
  value={yearsExperience}
  onChangeText={setYearsExperience}
  placeholder="e.g. 5"
  placeholderTextColor={Colors.fgDisabled}
  keyboardType="numeric"
/>
```

- [ ] **Step 5: Fix toggleLessonType to use lessonTypesOffered**

Replace the existing `toggleLessonType` function:

```typescript
async function toggleLessonType(val: string) {
  if (!profile) return;
  const current = profile.lessonTypesOffered ?? [];
  const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
  await save({ lessonTypesOffered: next });
}
```

Update the LESSON TYPES chip rendering to use `profile.lessonTypesOffered`:

```typescript
{LESSON_TYPES.map(t => {
  const active = (profile.lessonTypesOffered ?? []).includes(t.value);
  return (
    <TouchableOpacity
      key={t.value}
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => toggleLessonType(t.value)}
      activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
    </TouchableOpacity>
  );
})}
```

- [ ] **Step 6: Add DEFAULT LOCATION section**

After the LESSON TYPES section and before BOOKING WINDOW:

```typescript
<Text style={styles.sectionLabel}>DEFAULT LOCATION</Text>
<View style={styles.chipWrap}>
  {LOCATION_MODE_OPTIONS.map(m => {
    const active = (profile.defaultLocationMode ?? 'coach_facility') === m.value;
    return (
      <TouchableOpacity
        key={m.value}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => save({ defaultLocationMode: m.value })}
        activeOpacity={0.7}>
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
      </TouchableOpacity>
    );
  })}
</View>
```

- [ ] **Step 7: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```powershell
git add src/app/(coach)/me.tsx
git commit -m "feat(coach): fix lesson types field, add years experience + default location mode to coach profile"
```

---

## Task 5: useCoachData — new filter/sort types + logic

**Files:**
- Modify: `src/hooks/useCoachData.ts`

- [ ] **Step 1: Add new exported types**

After the existing type exports, add:

```typescript
export type RatingFilter     = '4.0' | '4.5' | '4.8' | null;
export type ExperienceFilter = '0to2' | '3to5' | '5to10' | '10plus' | null;
export type LocationModeFilter = 'coach_facility' | 'traveling' | null;
export type GenderFilter     = 'male' | 'female' | 'unspecified' | null;
export type SortOption =
  | 'best_match' | 'highest_rated' | 'most_reviews' | 'most_experienced'
  | 'lowest_price' | 'highest_price' | 'closest_distance';
```

- [ ] **Step 2: Extend CoachWithProfile**

Add after `availableDays`:

```typescript
gender: string | null;
lessonTypesOffered: string[];
```

- [ ] **Step 3: Extend CoachFilters**

```typescript
export interface CoachFilters {
  search:       string;
  distanceKm:   DistanceFilterKm;
  levels:       LevelFilter[];
  priceRange:   PriceRange;
  lessonTypes:  string[];
  availability: AvailabilityFilter;
  rating:       RatingFilter;
  experience:   ExperienceFilter;
  locationMode: LocationModeFilter;
  gender:       GenderFilter;
  sort:         SortOption;
}
```

- [ ] **Step 4: Update coaches DB query to include lesson_types_offered**

Find the `supabase.from('coaches').select(...)` call and add `lesson_types_offered` to the select string:

```typescript
supabase
  .from('coaches')
  .select('id, user_id, business_name, credentials, years_experience, sports_offered, home_base, willing_to_travel, hourly_rate, bio, profile_image_url, levels_served, latitude, longitude, lesson_types_offered')
  .eq('is_active', true)
  .limit(50),
```

- [ ] **Step 5: Update profiles DB query to include gender**

Find the profiles query in the `if (userIds.length > 0)` block and add `gender`:

```typescript
supabase
  .from('profiles')
  .select('id, full_name, avatar_url, gender')
  .in('id', userIds),
```

Update the `profilesData` type annotation:

```typescript
let profilesData: { id: string; full_name: string | null; avatar_url: string | null; gender: string | null }[] = [];
```

- [ ] **Step 6: Add gender and lessonTypesOffered to merged coaches**

In the `rawCoaches.map(c => {...})` block, add after `availableDays`:

```typescript
gender:             (profileMap.get(uid)?.gender as string | null) ?? null,
lessonTypesOffered: (c.lesson_types_offered as string[]) ?? [],
```

- [ ] **Step 7: Add sort helper functions**

After `matchesPriceRange`, add:

```typescript
function bestMatchScore(c: CoachWithProfile): number {
  const ratingScore = ((c.avgRating ?? 0) / 5) * 0.35;
  const reviewScore = Math.min(c.reviewCount / 20, 1) * 0.25;
  const distScore   = c.distanceKm != null
    ? Math.max(0, 1 - c.distanceKm / 100) * 0.20
    : 0.5 * 0.20;
  const availScore  = (c.availableDays.size / 7) * 0.10;
  const expScore    = (Math.min(c.yearsExperience ?? 0, 20) / 20) * 0.10;
  return ratingScore + reviewScore + distScore + availScore + expScore;
}

function applySorting(list: CoachWithProfile[], sort: SortOption): CoachWithProfile[] {
  const sorted = [...list];
  switch (sort) {
    case 'best_match':
      return sorted.sort((a, b) => bestMatchScore(b) - bestMatchScore(a));
    case 'highest_rated':
      return sorted.sort((a, b) => {
        if (a.avgRating == null) return 1;
        if (b.avgRating == null) return -1;
        return b.avgRating - a.avgRating;
      });
    case 'most_reviews':
      return sorted.sort((a, b) => b.reviewCount - a.reviewCount);
    case 'most_experienced':
      return sorted.sort((a, b) => {
        if (a.yearsExperience == null) return 1;
        if (b.yearsExperience == null) return -1;
        return b.yearsExperience - a.yearsExperience;
      });
    case 'lowest_price':
      return sorted.sort((a, b) => {
        if (a.hourlyRate == null) return 1;
        if (b.hourlyRate == null) return -1;
        return a.hourlyRate - b.hourlyRate;
      });
    case 'highest_price':
      return sorted.sort((a, b) => {
        if (a.hourlyRate == null) return 1;
        if (b.hourlyRate == null) return -1;
        return b.hourlyRate - a.hourlyRate;
      });
    case 'closest_distance':
      return sorted.sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    default:
      return sorted;
  }
}
```

- [ ] **Step 8: Add new filter conditions in the `.filter()` block**

Inside `allCoaches.filter(c => {...})`, after the existing availability check, add:

```typescript
// Rating
if (filters.rating != null) {
  const threshold = parseFloat(filters.rating);
  if (c.avgRating == null || c.avgRating < threshold) return false;
}

// Experience
if (filters.experience != null) {
  const yrs = c.yearsExperience;
  if (yrs != null) {
    if (filters.experience === '0to2'   && !(yrs >= 0  && yrs <= 2))  return false;
    if (filters.experience === '3to5'   && !(yrs >= 3  && yrs <= 5))  return false;
    if (filters.experience === '5to10'  && !(yrs >= 5  && yrs <= 10)) return false;
    if (filters.experience === '10plus' && yrs < 10)                   return false;
  }
}

// Location mode
if (filters.locationMode === 'traveling' && !c.willingToTravel) return false;
if (filters.locationMode === 'coach_facility' && c.willingToTravel === true) {
  // Pass through — willing_to_travel coaches may also teach at facilities
}

// Gender
if (filters.gender != null) {
  const g = (c.gender ?? '').toLowerCase();
  if (filters.gender === 'unspecified') {
    if (g !== '' && g != null) return false;
  } else {
    if (g !== filters.gender) return false;
  }
}

// Lesson types — now functional
if (filters.lessonTypes.length > 0 && c.lessonTypesOffered.length > 0) {
  if (!filters.lessonTypes.some(lt => c.lessonTypesOffered.includes(lt))) return false;
}
```

- [ ] **Step 9: Apply sort after filter**

Replace the final `return { coaches, ... }` section. Currently it returns `coaches` which is the filtered `allCoaches`. Change the filter result variable name to `filtered` and apply sort:

```typescript
const filtered = allCoaches.filter(c => {
  // ... all existing + new filter conditions ...
  return true;
});

const coaches = applySorting(filtered, filters.sort);

return { coaches, loading, error, refresh, favoriteIds, toggleFavorite, playerHasCoordinates };
```

- [ ] **Step 10: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 11: Commit**

```powershell
git add src/hooks/useCoachData.ts
git commit -m "feat(discovery): add rating/experience/location/gender filters, sort logic, lesson type activation"
```

---

## Task 6: CoachFiltersSheet — 4 new sections + updated lesson types

**Files:**
- Modify: `src/components/coaching/CoachFiltersSheet.tsx`

- [ ] **Step 1: Update imports**

Add new types to the import from `@/hooks/useCoachData`:

```typescript
import type {
  DistanceFilterKm, LevelFilter, PriceRange, AvailabilityFilter,
  RatingFilter, ExperienceFilter, LocationModeFilter, GenderFilter,
} from '@/hooks/useCoachData';
```

- [ ] **Step 2: Update LESSON_TYPE_OPTIONS**

```typescript
export const LESSON_TYPE_OPTIONS = [
  'Private Lesson',
  'Semi-Private Lesson',
  'Group Lesson',
  'Hitting Partner',
  'Match Play',
  'Junior Development',
  'Adult Beginner',
  'Advanced Training',
] as const;
```

- [ ] **Step 3: Add new option arrays**

After `AVAILABILITY_OPTIONS`, add:

```typescript
const RATING_OPTIONS: { label: string; value: RatingFilter }[] = [
  { label: 'Any',  value: null  },
  { label: '4.0+', value: '4.0' },
  { label: '4.5+', value: '4.5' },
  { label: '4.8+', value: '4.8' },
];

const EXPERIENCE_OPTIONS: { label: string; value: ExperienceFilter }[] = [
  { label: 'Any',      value: null     },
  { label: '0–2 yrs',  value: '0to2'   },
  { label: '3–5 yrs',  value: '3to5'   },
  { label: '5–10 yrs', value: '5to10'  },
  { label: '10+ yrs',  value: '10plus' },
];

const LOCATION_FILTER_OPTIONS: { label: string; value: LocationModeFilter }[] = [
  { label: 'Either',         value: null             },
  { label: 'Coach Facility', value: 'coach_facility' },
  { label: 'Travels to You', value: 'traveling'      },
];

const GENDER_OPTIONS: { label: string; value: GenderFilter }[] = [
  { label: 'Any',         value: null          },
  { label: 'Male',        value: 'male'        },
  { label: 'Female',      value: 'female'      },
  { label: 'Unspecified', value: 'unspecified' },
];
```

- [ ] **Step 4: Extend CoachFiltersState and DEFAULT_FILTERS**

```typescript
export interface CoachFiltersState {
  distanceKm:   DistanceFilterKm;
  levels:       LevelFilter[];
  priceRange:   PriceRange;
  lessonTypes:  string[];
  availability: AvailabilityFilter;
  rating:       RatingFilter;
  experience:   ExperienceFilter;
  locationMode: LocationModeFilter;
  gender:       GenderFilter;
}

export const DEFAULT_FILTERS: CoachFiltersState = {
  distanceKm:   null,
  levels:       [],
  priceRange:   null,
  lessonTypes:  [],
  availability: null,
  rating:       null,
  experience:   null,
  locationMode: null,
  gender:       null,
};
```

- [ ] **Step 5: Update activeFilterCount**

```typescript
export function activeFilterCount(f: CoachFiltersState): number {
  let n = 0;
  if (f.distanceKm   != null)   n++;
  if (f.levels.length > 0)      n += f.levels.length;
  if (f.priceRange   != null)   n++;
  if (f.lessonTypes.length > 0) n += f.lessonTypes.length;
  if (f.availability != null)   n++;
  if (f.rating       != null)   n++;
  if (f.experience   != null)   n++;
  if (f.locationMode != null)   n++;
  if (f.gender       != null)   n++;
  return n;
}
```

- [ ] **Step 6: Add 4 new sections to the ScrollView body**

After the existing `{/* ── Availability ── */}` section closing `</View>`, add:

```typescript
{/* ── Rating ── */}
<View style={styles.section}>
  <Text style={styles.sectionLabel}>Rating</Text>
  <View style={styles.chipRow}>
    {RATING_OPTIONS.map(opt => {
      const active = draft.rating === opt.value;
      return (
        <TouchableOpacity
          key={String(opt.value)}
          style={[styles.chip, active && styles.chipActive]}
          onPress={() => setDraft(d => ({ ...d, rating: opt.value }))}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
</View>

{/* ── Years of Experience ── */}
<View style={styles.section}>
  <Text style={styles.sectionLabel}>Years of Experience</Text>
  <View style={styles.chipRow}>
    {EXPERIENCE_OPTIONS.map(opt => {
      const active = draft.experience === opt.value;
      return (
        <TouchableOpacity
          key={String(opt.value)}
          style={[styles.chip, active && styles.chipActive]}
          onPress={() => setDraft(d => ({ ...d, experience: opt.value }))}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
</View>

{/* ── Location Mode ── */}
<View style={styles.section}>
  <Text style={styles.sectionLabel}>Location</Text>
  <View style={styles.chipRow}>
    {LOCATION_FILTER_OPTIONS.map(opt => {
      const active = draft.locationMode === opt.value;
      return (
        <TouchableOpacity
          key={String(opt.value)}
          style={[styles.chip, active && styles.chipActive]}
          onPress={() => setDraft(d => ({ ...d, locationMode: opt.value }))}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
</View>

{/* ── Gender ── */}
<View style={styles.section}>
  <Text style={styles.sectionLabel}>Coach Gender</Text>
  <View style={styles.chipRow}>
    {GENDER_OPTIONS.map(opt => {
      const active = draft.gender === opt.value;
      return (
        <TouchableOpacity
          key={String(opt.value)}
          style={[styles.chip, active && styles.chipActive]}
          onPress={() => setDraft(d => ({ ...d, gender: opt.value }))}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
</View>
```

- [ ] **Step 7: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```powershell
git add src/components/coaching/CoachFiltersSheet.tsx
git commit -m "feat(discovery): add rating, experience, location, gender filter sections; activate lesson types"
```

---

## Task 7: CoachSortSheet — new component

**Files:**
- Create: `src/components/coaching/CoachSortSheet.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { SortOption } from '@/hooks/useCoachData';

const SORT_OPTIONS: { label: string; value: SortOption; description: string }[] = [
  { label: 'Best Match',       value: 'best_match',       description: 'Rating, reviews, distance & availability' },
  { label: 'Highest Rated',    value: 'highest_rated',    description: 'Average star rating'                      },
  { label: 'Most Reviews',     value: 'most_reviews',     description: 'Number of reviews'                        },
  { label: 'Most Experienced', value: 'most_experienced', description: 'Years of experience'                      },
  { label: 'Lowest Price',     value: 'lowest_price',     description: 'Hourly rate, low to high'                 },
  { label: 'Highest Price',    value: 'highest_price',    description: 'Hourly rate, high to low'                 },
  { label: 'Closest Distance', value: 'closest_distance', description: 'Nearest coaches first'                    },
];

interface Props {
  visible:  boolean;
  onClose:  () => void;
  sort:     SortOption;
  onSelect: (s: SortOption) => void;
}

export function CoachSortSheet({ visible, onClose, sort, onSelect }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} strokeWidth={2} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sort By</Text>
          <View style={{ width: 20 }} />
        </View>

        <View style={styles.list}>
          {SORT_OPTIONS.map(opt => {
            const active = sort === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => { onSelect(opt.value); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.rowDesc}>{opt.description}</Text>
                </View>
                {active && <Check size={16} strokeWidth={2.5} color={Colors.cyan} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

export const SORT_LABELS: Record<SortOption, string> = {
  best_match:       'Best Match',
  highest_rated:    'Top Rated',
  most_reviews:     'Most Reviews',
  most_experienced: 'Most Exp.',
  lowest_price:     'Lowest Price',
  highest_price:    'Highest Price',
  closest_distance: 'Closest',
};

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: theme.pageBg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    list: {
      paddingTop: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowActive: {
      backgroundColor: 'rgba(45,224,255,0.04)',
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    rowLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    rowLabelActive: {
      color: Colors.cyan,
    },
    rowDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
  }), [theme]);
}
```

- [ ] **Step 2: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/coaching/CoachSortSheet.tsx
git commit -m "feat(discovery): add CoachSortSheet with 7 sort options"
```

---

## Task 8: coaches.tsx — wire sort state + Sort button

**Files:**
- Modify: `src/app/(resident)/coaches.tsx`

- [ ] **Step 1: Add imports**

Add to imports:

```typescript
import { ArrowUpDown } from 'lucide-react-native';
import { CoachSortSheet, SORT_LABELS } from '@/components/coaching/CoachSortSheet';
import type { SortOption } from '@/hooks/useCoachData';
```

- [ ] **Step 2: Add sort state**

After the existing `useState` declarations:

```typescript
const [sort,        setSort]        = useState<SortOption>('best_match');
const [sortVisible, setSortVisible] = useState(false);
```

- [ ] **Step 3: Add sort and new filter fields to the filters memo**

Replace the existing `filters` useMemo:

```typescript
const filters: CoachFilters = useMemo(() => ({
  search:       debouncedSearch,
  distanceKm:   appliedFilters.distanceKm,
  levels:       appliedFilters.levels,
  priceRange:   appliedFilters.priceRange,
  lessonTypes:  appliedFilters.lessonTypes,
  availability: appliedFilters.availability,
  rating:       appliedFilters.rating,
  experience:   appliedFilters.experience,
  locationMode: appliedFilters.locationMode,
  gender:       appliedFilters.gender,
  sort,
}), [debouncedSearch, appliedFilters, sort]);
```

- [ ] **Step 4: Add Sort button in filter bar**

In the `filterBar` View (in `ListHeader`), after the Filters button `TouchableOpacity`:

```typescript
<TouchableOpacity
  style={[styles.filtersBtn, sort !== 'best_match' && styles.filtersBtnActive]}
  onPress={() => setSortVisible(true)}
  activeOpacity={0.8}
>
  <ArrowUpDown
    size={14}
    strokeWidth={2}
    color={sort !== 'best_match' ? Colors.cyan : theme.textSecondary}
  />
  <Text style={[styles.filtersBtnLabel, sort !== 'best_match' && styles.filtersBtnLabelActive]}>
    {sort === 'best_match' ? 'Sort' : SORT_LABELS[sort]}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 5: Add CoachSortSheet to JSX**

After `<CoachFiltersSheet ... />`, add:

```typescript
<CoachSortSheet
  visible={sortVisible}
  onClose={() => setSortVisible(false)}
  sort={sort}
  onSelect={setSort}
/>
```

- [ ] **Step 6: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```powershell
git add src/app/(resident)/coaches.tsx
git commit -m "feat(discovery): add Sort button and CoachSortSheet to coach discovery screen"
```

---

## Task 9: CoachCard — years of experience

**Files:**
- Modify: `src/components/coaching/CoachCard.tsx`

- [ ] **Step 1: Add years of experience to ratingRow**

Find the `ratingRow` View. After the `reviewCount` text and before the separator dot + rate, add:

```typescript
{coach.yearsExperience != null && (
  <>
    <View style={styles.dot} />
    <Text style={styles.rate}>{coach.yearsExperience} yrs</Text>
  </>
)}
```

The full ratingRow becomes:

```typescript
<View style={styles.ratingRow}>
  <Star
    size={12}
    strokeWidth={0}
    fill={ratingText ? '#F59E0B' : theme.textMuted}
    color={ratingText ? '#F59E0B' : theme.textMuted}
  />
  {ratingText ? (
    <Text style={styles.ratingTxt}>
      {ratingText}
      <Text style={styles.reviewCount}> ({coach.reviewCount})</Text>
    </Text>
  ) : (
    <Text style={styles.noRating}>No reviews yet</Text>
  )}
  {coach.yearsExperience != null && (
    <>
      <View style={styles.dot} />
      <Text style={styles.rate}>{coach.yearsExperience} yrs</Text>
    </>
  )}
  <View style={styles.dot} />
  <Text style={styles.rate}>
    {coach.hourlyRate != null ? `$${Math.round(coach.hourlyRate)}/hr` : 'Rate TBD'}
  </Text>
</View>
```

- [ ] **Step 2: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/coaching/CoachCard.tsx
git commit -m "feat(discovery): show years of experience on coach card"
```

---

## Task 10: CoachAvailabilityGrid — cell-level interaction props

**Files:**
- Modify: `src/components/coaching/CoachAvailabilityGrid.tsx`

- [ ] **Step 1: Update imports and Props type**

Add `CellMode` import:

```typescript
import { TIME_BANDS, type TimeBand, type CoachAvailabilitySlot, type CoachUnavailabilityBlock, type CellMode } from '@/hooks/useCoachAvailability';
```

Extend `Props`:

```typescript
interface Props {
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks?: CoachUnavailabilityBlock[];
  // existing band-level interactive mode
  interactive?: boolean;
  selectedBand?: TimeBand | null;
  onSelectBand?: (band: TimeBand) => void;
  // new cell-level interaction (editor mode)
  getCellMode?: (dow: number, band: TimeBand) => CellMode | null;
  onCellPress?: (dow: number, band: TimeBand) => void;
  // layout
  compact?: boolean;
}
```

- [ ] **Step 2: Update band row + cell rendering**

Replace the existing `{grid.map(...)}` block inside the `ScrollView`:

```typescript
{grid.map(({ band, days }) => {
  const isSelected = interactive && selectedBand?.label === band.label;
  const isCellInteractive = !!onCellPress;

  const bandContent = (
    <>
      <View style={styles.bandLabelCell}>
        <Text style={[styles.bandLabel, isSelected && styles.bandLabelSelected]}>
          {band.label}
        </Text>
        <Text style={[styles.bandTime, isSelected && styles.bandTimeSelected]}>
          {band.start}–{band.end}
        </Text>
      </View>
      {days.map((available, dow) => {
        const cellMode = getCellMode?.(dow, band) ?? null;
        const cellVisualStyle = isCellInteractive
          ? (cellMode === 'coach_facility' ? styles.cellFacility
             : cellMode === 'traveling'    ? styles.cellTraveling
             : cellMode === 'both'         ? styles.cellBoth
             : null)
          : (available ? (isSelected ? styles.cellAvailableSelected : styles.cellAvailable) : null);

        return isCellInteractive ? (
          <TouchableOpacity
            key={dow}
            style={[styles.cell, cellVisualStyle]}
            onPress={() => onCellPress(dow, band)}
            activeOpacity={0.7}
          />
        ) : (
          <View key={dow} style={[styles.cell, cellVisualStyle]} />
        );
      })}
    </>
  );

  if (isCellInteractive) {
    return (
      <View key={band.label} style={[styles.bandRow, isSelected && styles.bandRowSelected]}>
        {bandContent}
      </View>
    );
  }
  return (
    <TouchableOpacity
      key={band.label}
      activeOpacity={interactive ? 0.7 : 1}
      onPress={interactive ? () => onSelectBand?.(band) : undefined}
      style={[styles.bandRow, isSelected && styles.bandRowSelected]}
    >
      {bandContent}
    </TouchableOpacity>
  );
})}
```

- [ ] **Step 3: Add new cell styles**

In `useStyles`, after `cellAvailableSelected`:

```typescript
cellFacility: {
  backgroundColor: 'rgba(45,107,255,0.15)',
  borderColor:     'rgba(45,107,255,0.35)',
},
cellTraveling: {
  backgroundColor: 'rgba(214,255,61,0.12)',
  borderColor:     'rgba(214,255,61,0.30)',
},
cellBoth: {
  backgroundColor: 'rgba(45,224,255,0.12)',
  borderColor:     'rgba(45,224,255,0.30)',
},
```

- [ ] **Step 4: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```powershell
git add src/components/coaching/CoachAvailabilityGrid.tsx
git commit -m "feat(coach): add getCellMode and onCellPress cell-level interaction to CoachAvailabilityGrid"
```

---

## Task 11: CoachAvailabilityGridEditor — new component

**Files:**
- Create: `src/components/coach/CoachAvailabilityGridEditor.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { CoachAvailabilityGrid } from '@/components/coaching/CoachAvailabilityGrid';
import {
  TIME_BANDS,
  type TimeBand,
  type CoachAvailabilitySlot,
  type CellMode,
} from '@/hooks/useCoachAvailability';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

type DraftMap = Map<string, CellMode>; // key = `${dow}|${band.label}`

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const LOCATION_OPTIONS: { value: CellMode; label: string }[] = [
  { value: 'coach_facility', label: 'My Facility' },
  { value: 'traveling',      label: 'Traveling'   },
  { value: 'both',           label: 'Either'      },
];

function makeCellKey(dow: number, band: TimeBand): string {
  return `${dow}|${band.label}`;
}

function isBandAligned(slot: CoachAvailabilitySlot): boolean {
  return TIME_BANDS.some(b => b.start === slot.start_time && b.end === slot.end_time);
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12  = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

interface Props {
  weeklySlots:         CoachAvailabilitySlot[];
  defaultLocationMode: string | null;
  onRefresh:           () => void;
}

export function CoachAvailabilityGridEditor({ weeklySlots, defaultLocationMode, onRefresh }: Props) {
  const { theme } = useTheme();
  const styles    = useStyles(theme);

  const coachDefault = (defaultLocationMode as CellMode | null) ?? 'coach_facility';

  const { bandSlots, legacySlots } = useMemo(() => ({
    bandSlots:   weeklySlots.filter(isBandAligned),
    legacySlots: weeklySlots.filter(s => !isBandAligned(s)),
  }), [weeklySlots]);

  const buildInitialDraft = useCallback((): DraftMap => {
    const map: DraftMap = new Map();
    for (const slot of bandSlots) {
      const band = TIME_BANDS.find(b => b.start === slot.start_time)!;
      map.set(makeCellKey(slot.day_of_week, band), (slot.location_mode as CellMode) ?? 'coach_facility');
    }
    return map;
  }, [bandSlots]);

  const [draft,  setDraft]  = useState<DraftMap>(() => buildInitialDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(buildInitialDraft());
  }, [buildInitialDraft]);

  const isDirty = useMemo(() => {
    const saved = buildInitialDraft();
    if (saved.size !== draft.size) return true;
    for (const [k, v] of draft) {
      if (saved.get(k) !== v) return true;
    }
    return false;
  }, [draft, buildInitialDraft]);

  function getCellMode(dow: number, band: TimeBand): CellMode | null {
    return draft.get(makeCellKey(dow, band)) ?? null;
  }

  function handleCellPress(dow: number, band: TimeBand) {
    const key     = makeCellKey(dow, band);
    const current = draft.get(key);

    if (current == null) {
      setDraft(prev => new Map(prev).set(key, coachDefault));
      return;
    }

    const options    = ['My Facility', 'Traveling', 'Either', 'Remove', 'Cancel'];
    const modeValues: CellMode[] = ['coach_facility', 'traveling', 'both'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 4, destructiveButtonIndex: 3 },
        (idx) => {
          if (idx === 4) return;
          if (idx === 3) {
            setDraft(prev => { const m = new Map(prev); m.delete(key); return m; });
            return;
          }
          setDraft(prev => new Map(prev).set(key, modeValues[idx]));
        },
      );
    } else {
      Alert.alert(
        `${DAY_NAMES[dow]} ${band.label.charAt(0) + band.label.slice(1).toLowerCase()}`,
        'Set location:',
        [
          { text: 'My Facility', onPress: () => setDraft(p => new Map(p).set(key, 'coach_facility')) },
          { text: 'Traveling',   onPress: () => setDraft(p => new Map(p).set(key, 'traveling'))      },
          { text: 'Either',      onPress: () => setDraft(p => new Map(p).set(key, 'both'))            },
          { text: 'Remove', style: 'destructive',
            onPress: () => setDraft(p => { const m = new Map(p); m.delete(key); return m; }) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const toDeleteIds = bandSlots
      .filter(s => {
        const band = TIME_BANDS.find(b => b.start === s.start_time)!;
        return !draft.has(makeCellKey(s.day_of_week, band));
      })
      .map(s => s.id);

    const toUpsert = Array.from(draft.entries()).map(([key, mode]) => {
      const [dowStr, bandLabel] = key.split('|');
      const band = TIME_BANDS.find(b => b.label === bandLabel)!;
      return {
        coach_id:      user.id,
        day_of_week:   Number(dowStr),
        start_time:    band.start,
        end_time:      band.end,
        location_mode: mode,
      };
    });

    try {
      if (toDeleteIds.length > 0) {
        await supabase.from('coach_availability').delete().in('id', toDeleteIds);
      }
      if (toUpsert.length > 0) {
        await supabase
          .from('coach_availability')
          .upsert(toUpsert, { onConflict: 'coach_id,day_of_week,start_time' });
      }
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to save availability. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLegacy(slotId: string, label: string) {
    Alert.alert('Remove Slot', `Remove "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('coach_availability').delete().eq('id', slotId);
          onRefresh();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>WEEKLY AVAILABILITY</Text>
        {isDirty && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.hint}>
        Tap empty cell to add availability. Tap filled cell to change location or remove.
      </Text>

      <View style={styles.gridCard}>
        <CoachAvailabilityGrid
          weeklySlots={[]}
          getCellMode={getCellMode}
          onCellPress={handleCellPress}
        />
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotFacility]} />
            <Text style={styles.legendLabel}>Facility</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotTraveling]} />
            <Text style={styles.legendLabel}>Traveling</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotBoth]} />
            <Text style={styles.legendLabel}>Either</Text>
          </View>
        </View>
      </View>

      {legacySlots.length > 0 && (
        <View style={styles.legacySection}>
          <Text style={styles.legacyTitle}>LEGACY AVAILABILITY</Text>
          <Text style={styles.legacyNote}>
            These slots have custom time ranges from before the grid editor. They remain active — delete if no longer needed.
          </Text>
          {legacySlots.map(slot => {
            const timeLabel = `${DAY_NAMES[slot.day_of_week]}  ${fmtTime(slot.start_time)} – ${fmtTime(slot.end_time)}`;
            const locLabel  = LOCATION_OPTIONS.find(o => o.value === slot.location_mode)?.label
              ?? slot.location_mode ?? '—';
            return (
              <View key={slot.id} style={styles.legacyRow}>
                <View style={styles.legacyInfo}>
                  <Text style={styles.legacyTime}>{timeLabel}</Text>
                  <Text style={styles.legacyLoc}>{locLabel}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteLegacy(slot.id, timeLabel)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color={Colors.negative} strokeWidth={1.8} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    container:   { gap: 12 },
    headerRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontFamily:    FontFamily.jetbrainsMonoSemiBold,
      fontSize:      FontSize.eyebrow,
      color:         theme.textMuted,
      letterSpacing: 0.18,
    },
    saveBtn: {
      backgroundColor: Colors.blue,
      borderRadius:    Radius.sm,
      paddingHorizontal: 14,
      paddingVertical:   8,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize:   FontSize.label,
      color:      Colors.white,
    },
    hint: {
      fontFamily: FontFamily.manropeMedium,
      fontSize:   FontSize.label,
      color:      theme.textMuted,
      fontStyle:  'italic',
    },
    gridCard: {
      backgroundColor: theme.cardBg,
      borderRadius:    Radius.card,
      borderWidth:     1,
      borderColor:     theme.border,
      padding:         Spacing.cardPadding,
      gap:             12,
    },
    legend: {
      flexDirection:  'row',
      gap:            16,
      paddingTop:     8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           5,
    },
    legendDot: {
      width:        10,
      height:       10,
      borderRadius: 5,
      borderWidth:  1,
    },
    dotFacility: {
      backgroundColor: 'rgba(45,107,255,0.30)',
      borderColor:     'rgba(45,107,255,0.55)',
    },
    dotTraveling: {
      backgroundColor: 'rgba(214,255,61,0.25)',
      borderColor:     'rgba(214,255,61,0.45)',
    },
    dotBoth: {
      backgroundColor: 'rgba(45,224,255,0.25)',
      borderColor:     'rgba(45,224,255,0.45)',
    },
    legendLabel: {
      fontFamily: FontFamily.manropeMedium,
      fontSize:   12,
      color:      theme.textMuted,
    },
    legacySection: {
      backgroundColor: theme.cardBg,
      borderRadius:    Radius.card,
      borderWidth:     1,
      borderColor:     theme.border,
      padding:         Spacing.cardPadding,
      gap:             10,
    },
    legacyTitle: {
      fontFamily:    FontFamily.jetbrainsMonoSemiBold,
      fontSize:      FontSize.eyebrow,
      color:         Colors.volt,
      letterSpacing: 0.18,
    },
    legacyNote: {
      fontFamily: FontFamily.manropeMedium,
      fontSize:   FontSize.label,
      color:      theme.textMuted,
      lineHeight: 20,
    },
    legacyRow: {
      flexDirection:  'row',
      alignItems:     'center',
      backgroundColor: theme.bgElevated,
      borderRadius:    Radius.sm,
      borderWidth:     1,
      borderColor:     theme.border,
      paddingHorizontal: 14,
      paddingVertical:   11,
    },
    legacyInfo: { flex: 1, gap: 2 },
    legacyTime: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize:   FontSize.label,
      color:      theme.textPrimary,
    },
    legacyLoc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize:   FontSize.label,
      color:      theme.textMuted,
    },
  }), [theme]);
}
```

- [ ] **Step 2: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/coach/CoachAvailabilityGridEditor.tsx
git commit -m "feat(coach): add CoachAvailabilityGridEditor with cell-level toggles, per-cell location mode, legacy slot management"
```

---

## Task 12: schedule.tsx — swap editor + wire coach profile

**Files:**
- Modify: `src/app/(coach)/schedule.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { CoachAvailabilityEditor } from '@/components/coach/CoachAvailabilityEditor';
```
With:
```typescript
import { CoachAvailabilityGridEditor } from '@/components/coach/CoachAvailabilityGridEditor';
import { useCoachProfile } from '@/hooks/useCoachProfile';
```

- [ ] **Step 2: Add useCoachProfile call**

After `const { weeklySlots, loading: slotsLoading, hasScheduleForBandOnDay } = useCoachAvailability(coachId);`, add:

```typescript
const { profile: coachProfile } = useCoachProfile();
```

- [ ] **Step 3: Replace CoachAvailabilityEditor with CoachAvailabilityGridEditor**

Find:
```typescript
<CoachAvailabilityEditor
  slots={weeklySlots}
  onRefresh={refreshSchedule}
/>
```

Replace with:
```typescript
<CoachAvailabilityGridEditor
  weeklySlots={weeklySlots}
  defaultLocationMode={coachProfile?.defaultLocationMode ?? null}
  onRefresh={refreshSchedule}
/>
```

- [ ] **Step 4: Compile check**

```powershell
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```powershell
git add src/app/(coach)/schedule.tsx
git commit -m "feat(coach): replace CoachAvailabilityEditor with CoachAvailabilityGridEditor in schedule screen"
```

---

## Task 13: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```powershell
npm run dev
```

- [ ] **Step 2: Test Part 1 — Player Discovery**

Open the Coaches tab as a resident:
- [ ] Tap **Filters** — sheet opens with 9 sections: Distance, Skill Level, Price Range, Lesson Type, Availability, Rating, Years of Experience, Location, Coach Gender
- [ ] Select Rating 4.5+ → only coaches with avgRating ≥ 4.5 remain (or all if none have ratings below)
- [ ] Select "Group Lesson" lesson type → filters to coaches with that in `lesson_types_offered` (or all pass if none have it set yet)
- [ ] Tap **Sort** → sheet opens with 7 options, checkmark on Best Match
- [ ] Select Highest Rated → coaches reorder, Sort button shows "Top Rated"
- [ ] Select Closest Distance → Sort button shows "Closest"

- [ ] **Step 3: Test Part 2 — Coach Availability Grid**

Sign in as a coach, open Schedule tab:
- [ ] Grid renders with 3 rows (MORNING / AFTERNOON / EVENING) × 7 columns
- [ ] Tap an empty cell → cell turns blue (Facility by default)
- [ ] Tap the same cell → iOS action sheet or Android alert opens with Facility / Traveling / Either / Remove
- [ ] Select Traveling → cell turns volt/yellow
- [ ] "Save Changes" button appears; tap it → cells persist after refresh
- [ ] If any legacy slots exist → "LEGACY AVAILABILITY" section visible below grid with trash icons

- [ ] **Step 4: Test Coach Profile (me tab)**

Open Me tab as coach:
- [ ] "LESSON TYPES" section shows 8 types including Hitting Partner, Match Play, etc.
- [ ] Toggling lesson types saves correctly
- [ ] "DEFAULT LOCATION" section shows 3 options — selecting one saves immediately
- [ ] "Years of Experience" field in the Profile card saves on "Save Profile" tap

- [ ] **Step 5: Final lint check**

```powershell
npm run lint
```

Fix any warnings if present, then:

```powershell
git add -A
git commit -m "chore: fix any lint issues from coach discovery & availability implementation"
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task |
|---|---|
| Distance / Price / Skill / Lesson / Availability filters | Already existed; Lesson Type activated in Task 5 |
| Rating filter | Task 5 (sheet) + Task 5 (useCoachData) |
| Experience filter | Task 5 |
| Location Mode filter | Task 5 |
| Gender filter | Task 5 |
| Sort control (7 options + Best Match score) | Tasks 7 + 8 |
| Coach card: years of experience | Task 9 |
| `lesson_types_offered` migration + coach profile editor | Tasks 1 + 4 |
| `default_location_mode` migration + coach profile editor | Tasks 1 + 4 |
| Availability grid: weekly timetable | Tasks 10–12 |
| Per-cell location mode | Tasks 10–11 |
| Coach-level default location mode | Tasks 3 + 4 + 12 |
| Legacy slot visibility + delete | Task 11 |
| Overlap prevention (structural via bands) | Task 1 (unique constraint) + Task 11 (upsert) |
| Q4 architecture (3-layer model) | No code change needed — already correct |

# TenisX Coach Marketplace & Availability System Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full refactor — hourly availability grid (16 hourly slots, 6AM–10PM), 4-lesson-type model, expanded coach profile (ITF cert + coaching location type + travel/facility sub-fields), improved request UX, reviews screen, discovery filter updates, and coach header avatar + messages icon.

**Architecture:** 11 tasks in dependency order. Task 1 (DB migration + type regen) is a hard prerequisite. Tasks 4 → 5 are sequential. Task 11 → 10 are sequential. All others independent after Task 1.

**Tech Stack:** React Native 0.85 + TypeScript, Expo SDK 56, Supabase (MCP tools), expo-router, Lucide icons, `@/constants/design` tokens.

---

### Task 1: DB Migration + Type Regeneration

**Files:**
- Create: `supabase/migrations/20260608010000_coach_marketplace_refactor.sql`
- Modify: `src/lib/types.ts` (auto-generated via MCP)

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260608010000_coach_marketplace_refactor.sql

-- 1a. Add new columns to coaches
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS itf_certification      TEXT,
  ADD COLUMN IF NOT EXISTS coaching_location_type TEXT NOT NULL DEFAULT 'facility_coach',
  ADD COLUMN IF NOT EXISTS travel_radius_km       INTEGER,
  ADD COLUMN IF NOT EXISTS travel_areas           TEXT,
  ADD COLUMN IF NOT EXISTS travel_notes           TEXT,
  ADD COLUMN IF NOT EXISTS facility_address       TEXT,
  ADD COLUMN IF NOT EXISTS facility_notes         TEXT,
  ADD COLUMN IF NOT EXISTS court_type             TEXT;

-- 1b. Migrate default_location_mode → coaching_location_type
UPDATE public.coaches
SET coaching_location_type = CASE
  WHEN default_location_mode = 'traveling' THEN 'traveling_coach'
  WHEN default_location_mode = 'both'      THEN 'facility_travel'
  ELSE                                          'facility_coach'
END;

-- 1c. Expand band-aligned availability slots into hourly slots
-- MORNING 06:00-12:00 → slots 06:00, 07:00, 08:00, 09:00, 10:00, 11:00
-- AFTERNOON 12:00-17:00 → slots 12:00, 13:00, 14:00, 15:00, 16:00
-- EVENING 17:00-21:00 → slots 17:00, 18:00, 19:00, 20:00
DO $$
DECLARE
  slot         RECORD;
  band_start_h INTEGER;
  band_end_h   INTEGER;
  h            INTEGER;
BEGIN
  FOR slot IN
    SELECT id, coach_id, day_of_week, start_time, end_time, location_mode
    FROM public.coach_availability
    WHERE (start_time::time = '06:00'::time AND end_time::time = '12:00'::time)
       OR (start_time::time = '12:00'::time AND end_time::time = '17:00'::time)
       OR (start_time::time = '17:00'::time AND end_time::time = '21:00'::time)
  LOOP
    band_start_h := EXTRACT(HOUR FROM slot.start_time::time)::int;
    band_end_h   := EXTRACT(HOUR FROM slot.end_time::time)::int;
    FOR h IN band_start_h..(band_end_h - 1) LOOP
      INSERT INTO public.coach_availability (coach_id, day_of_week, start_time, end_time, location_mode)
      VALUES (
        slot.coach_id,
        slot.day_of_week,
        (LPAD(h::text, 2, '0') || ':00')::time,
        (LPAD((h + 1)::text, 2, '0') || ':00')::time,
        slot.location_mode
      )
      ON CONFLICT (coach_id, day_of_week, start_time) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 1d. Delete original band-aligned slots (now replaced by hourly)
DELETE FROM public.coach_availability
WHERE (start_time::time = '06:00'::time AND end_time::time = '12:00'::time)
   OR (start_time::time = '12:00'::time AND end_time::time = '17:00'::time)
   OR (start_time::time = '17:00'::time AND end_time::time = '21:00'::time);
```

- [ ] **Step 2: Apply migration via MCP**

Use `mcp__supabase__apply_migration` with the SQL above. Confirm cost if prompted.

- [ ] **Step 3: Regenerate TypeScript types**

Use `mcp__supabase__generate_typescript_types`, overwrite `src/lib/types.ts`.

Verify `coaches.Row` now contains:
```typescript
itf_certification: string | null
coaching_location_type: string
travel_radius_km: number | null
travel_areas: string | null
travel_notes: string | null
facility_address: string | null
facility_notes: string | null
court_type: string | null
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260608010000_coach_marketplace_refactor.sql src/lib/types.ts
git commit -m "feat(db): add ITF cert + coaching location columns, migrate band availability to hourly slots"
```

---

### Task 2: Fix Accept Request Loading State

**Files:**
- Modify: `src/app/(coach)/requests.tsx`
- Modify: `src/components/coach/CoachRequestCard.tsx`

- [ ] **Step 1: Add `accepting` prop to `CoachRequestCard`**

Update `Props` interface (add `accepting?: boolean`) and the Accept button:

```typescript
interface Props {
  request: CoachLessonRequest;
  onAccept: (req: CoachLessonRequest) => void;
  onDecline: (id: string, reason?: string) => Promise<void>;
  accepting?: boolean;
}

export function CoachRequestCard({ request, onAccept, onDecline, accepting = false }: Props) {
```

Change the Accept `TouchableOpacity`:
```tsx
<TouchableOpacity
  style={[styles.acceptBtn, accepting && styles.btnDisabled]}
  onPress={() => onAccept(request)}
  disabled={accepting}
  activeOpacity={0.85}>
  <Text style={styles.acceptBtnText}>{accepting ? 'Accepting…' : 'Accept'}</Text>
</TouchableOpacity>
```

Add to StyleSheet:
```typescript
btnDisabled: { opacity: 0.55 },
```

- [ ] **Step 2: Update `handleAccept` in `requests.tsx`**

Remove the `Alert.alert` confirmation wrapper. Add loading state:

```typescript
const [acceptingId, setAcceptingId] = useState<string | null>(null);

async function handleAccept(req: CoachLessonRequest) {
  setAcceptingId(req.id);
  const err = await accept(
    req.id,
    req.preferredDate,
    req.preferredTimeStart,
    req.preferredTimeEnd,
  );
  setAcceptingId(null);
  if (err) Alert.alert('Error', err);
}
```

Pass `accepting` prop to each `CoachRequestCard`:
```tsx
<CoachRequestCard
  key={req.id}
  request={req}
  onAccept={handleAccept}
  onDecline={handleDecline}
  accepting={acceptingId === req.id}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(coach)/requests.tsx src/components/coach/CoachRequestCard.tsx
git commit -m "fix(requests): remove accept confirmation alert, add per-card loading state"
```

---

### Task 3: Reduce Lesson Types to 4 Everywhere

**Files:**
- Modify: `src/app/(coach)/me.tsx`
- Modify: `src/components/coach/CoachRequestCard.tsx`
- Modify: `src/components/coach/CoachTodayCard.tsx`
- Modify: `src/app/messages.tsx`
- Modify: `src/components/coaching/CoachFiltersSheet.tsx`

The 4 canonical types: `private_lesson`, `semi_private_lesson`, `group_lesson`, `hitting_partner`.

- [ ] **Step 1: Update `me.tsx` LESSON_TYPES array**

```typescript
const LESSON_TYPES = [
  { value: 'private_lesson',      label: 'Private Lesson'  },
  { value: 'semi_private_lesson', label: 'Semi-Private'    },
  { value: 'group_lesson',        label: 'Group Lesson'    },
  { value: 'hitting_partner',     label: 'Hitting Partner' },
];
```

- [ ] **Step 2: Update LESSON_TYPE_LABELS in `CoachRequestCard.tsx`, `CoachTodayCard.tsx`, `messages.tsx`**

Same map in all three files (keep old keys for display backwards compat):
```typescript
const LESSON_TYPE_LABELS: Record<string, string> = {
  private_lesson:      'Private Lesson',
  semi_private_lesson: 'Semi-Private',
  group_lesson:        'Group Lesson',
  hitting_partner:     'Hitting Partner',
  group_clinic:        'Group Lesson',    // legacy
  practice_session:    'Hitting Partner', // legacy
  private:             'Private Lesson',
  'semi-private':      'Semi-Private',
  group:               'Group Lesson',
};
```

- [ ] **Step 3: Update `CoachFiltersSheet.tsx` LESSON_TYPE_OPTIONS**

Change from a plain string `as const` array to value+label pairs so filter state stores DB values (not display strings):

```typescript
export const LESSON_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'private_lesson',      label: 'Private Lesson'  },
  { value: 'semi_private_lesson', label: 'Semi-Private'    },
  { value: 'group_lesson',        label: 'Group Lesson'    },
  { value: 'hitting_partner',     label: 'Hitting Partner' },
];
```

Update the chip rendering in `CoachFiltersSheet` to use `o.value` for filter state and `o.label` for display:
```tsx
{LESSON_TYPE_OPTIONS.map(o => {
  const active = local.lessonTypes.includes(o.value);
  return (
    <TouchableOpacity
      key={o.value}
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => setLocal(s => ({
        ...s,
        lessonTypes: active
          ? s.lessonTypes.filter(v => v !== o.value)
          : [...s.lessonTypes, o.value],
      }))}
      activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
    </TouchableOpacity>
  );
})}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(coach)/me.tsx src/components/coach/CoachRequestCard.tsx src/components/coach/CoachTodayCard.tsx src/app/messages.tsx src/components/coaching/CoachFiltersSheet.tsx
git commit -m "feat(lessons): reduce to 4 canonical lesson types, update labels + filter options everywhere"
```

---

### Task 4: Extend useCoachProfile with New DB Fields

**Files:**
- Modify: `src/hooks/useCoachProfile.ts`

- [ ] **Step 1: Expand `CoachProfileData`**

```typescript
export interface CoachProfileData {
  id: string;
  userId: string;
  fullName: string | null;           // from profiles
  gender: string | null;             // from profiles
  businessName: string | null;
  bio: string | null;
  credentials: string | null;
  homeBase: string | null;
  hourlyRate: number | null;
  yearsExperience: number | null;
  levelsServed: string[] | null;
  sportsOffered: string[] | null;
  minimumNoticeHours: number | null;
  maxAdvanceBookingDays: number | null;
  primeTimeStart: string | null;
  primeTimeEnd: string | null;
  cancellationPolicyHours: number | null;
  profileImageUrl: string | null;
  isActive: boolean | null;
  lessonTypesOffered: string[] | null;
  defaultLocationMode: string | null;
  itfCertification: string | null;
  coachingLocationType: string;
  travelRadiusKm: number | null;
  travelAreas: string | null;
  travelNotes: string | null;
  facilityAddress: string | null;
  facilityNotes: string | null;
  courtType: string | null;
}
```

- [ ] **Step 2: Update `load()` to parallel-fetch `profiles`**

Replace the single `supabase.from('coaches')` query with a `Promise.all`:

```typescript
const [coachRes, profileRes] = await Promise.all([
  supabase.from('coaches').select('*').eq('user_id', user.id).single(),
  supabase.from('profiles').select('full_name, gender').eq('id', user.id).single(),
]);

if (cancelled) return;
const data = coachRes.data;
if (!data) { setLoading(false); return; }

setProfile({
  id:                     data.id as string,
  userId:                 data.user_id as string,
  fullName:               (profileRes.data?.full_name as string | null) ?? null,
  gender:                 (profileRes.data?.gender as string | null) ?? null,
  businessName:           data.business_name as string | null,
  bio:                    data.bio as string | null,
  credentials:            data.credentials as string | null,
  homeBase:               data.home_base as string | null,
  hourlyRate:             data.hourly_rate as number | null,
  yearsExperience:        data.years_experience as number | null,
  levelsServed:           data.levels_served as string[] | null,
  sportsOffered:          data.sports_offered as string[] | null,
  minimumNoticeHours:     data.minimum_notice_hours as number | null,
  maxAdvanceBookingDays:  data.max_advance_booking_days as number | null,
  primeTimeStart:         data.prime_time_start as string | null,
  primeTimeEnd:           data.prime_time_end as string | null,
  cancellationPolicyHours:data.cancellation_policy_hours as number | null,
  profileImageUrl:        data.profile_image_url as string | null,
  isActive:               data.is_active as boolean | null,
  lessonTypesOffered:     data.lesson_types_offered as string[] | null,
  defaultLocationMode:    data.default_location_mode as string | null,
  itfCertification:       data.itf_certification as string | null,
  coachingLocationType:   (data.coaching_location_type as string) ?? 'facility_coach',
  travelRadiusKm:         data.travel_radius_km as number | null,
  travelAreas:            data.travel_areas as string | null,
  travelNotes:            data.travel_notes as string | null,
  facilityAddress:        data.facility_address as string | null,
  facilityNotes:          data.facility_notes as string | null,
  courtType:              data.court_type as string | null,
});
```

- [ ] **Step 3: Add new fields to `save()`**

Add to the `dbUpdates` mapping block in `save()`:
```typescript
if (updates.itfCertification !== undefined)    dbUpdates.itf_certification     = updates.itfCertification;
if (updates.coachingLocationType !== undefined) dbUpdates.coaching_location_type = updates.coachingLocationType;
if (updates.travelRadiusKm !== undefined)      dbUpdates.travel_radius_km      = updates.travelRadiusKm;
if (updates.travelAreas !== undefined)         dbUpdates.travel_areas          = updates.travelAreas;
if (updates.travelNotes !== undefined)         dbUpdates.travel_notes          = updates.travelNotes;
if (updates.facilityAddress !== undefined)     dbUpdates.facility_address      = updates.facilityAddress;
if (updates.facilityNotes !== undefined)       dbUpdates.facility_notes        = updates.facilityNotes;
if (updates.courtType !== undefined)           dbUpdates.court_type            = updates.courtType;
```

After the coaches `.update()` call, also save profile fields:
```typescript
const { error } = await supabase.from('coaches').update(dbUpdates).eq('user_id', user.id);

if (!error && (updates.gender !== undefined || updates.fullName !== undefined)) {
  const profileUpdate: { gender?: string | null; full_name?: string | null } = {};
  if (updates.gender    !== undefined) profileUpdate.gender    = updates.gender;
  if (updates.fullName  !== undefined) profileUpdate.full_name = updates.fullName;
  await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCoachProfile.ts
git commit -m "feat(profile-hook): add ITF cert, coaching location type, travel/facility fields, gender + fullName"
```

---

### Task 5: Coach Profile me.tsx Overhaul

**Files:**
- Modify: `src/app/(coach)/me.tsx`

This converts the entire form to single-save with all state in local useState, adds new fields, and removes per-field saves.

- [ ] **Step 1: Replace state variables**

```typescript
const [fullName,           setFullName]           = useState('');
const [businessName,       setBusinessName]       = useState('');
const [bio,                setBio]                = useState('');
const [hourlyRate,         setHourlyRate]         = useState('');
const [homeBase,           setHomeBase]           = useState('');
const [yearsExperience,    setYearsExperience]    = useState('');
const [facilityAddress,    setFacilityAddress]    = useState('');
const [facilityNotes,      setFacilityNotes]      = useState('');
const [travelAreas,        setTravelAreas]        = useState('');
const [travelNotes,        setTravelNotes]        = useState('');
const [travelRadiusKm,     setTravelRadiusKm]     = useState('');
const [gender,             setGender]             = useState('');
const [itfCertification,   setItfCertification]   = useState('none');
const [coachingLocationType, setCoachingLocationType] = useState('facility_coach');
const [courtType,          setCourtType]          = useState('');
const [levelsServed,       setLevelsServed]       = useState<string[]>([]);
const [lessonTypesOffered, setLessonTypesOffered] = useState<string[]>([]);
const [minimumNoticeHours, setMinimumNoticeHours] = useState<number | null>(null);
const [maxAdvanceBookingDays, setMaxAdvanceBookingDays] = useState<number | null>(null);
const [initialized,        setInitialized]        = useState(false);
```

- [ ] **Step 2: Initialize all state from profile**

```typescript
useMemo(() => {
  if (profile && !initialized) {
    setFullName(profile.fullName ?? '');
    setBusinessName(profile.businessName ?? '');
    setBio(profile.bio ?? '');
    setHourlyRate(profile.hourlyRate != null ? String(profile.hourlyRate) : '');
    setHomeBase(profile.homeBase ?? '');
    setYearsExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : '');
    setFacilityAddress(profile.facilityAddress ?? '');
    setFacilityNotes(profile.facilityNotes ?? '');
    setTravelAreas(profile.travelAreas ?? '');
    setTravelNotes(profile.travelNotes ?? '');
    setTravelRadiusKm(profile.travelRadiusKm != null ? String(profile.travelRadiusKm) : '');
    setGender(profile.gender ?? '');
    setItfCertification(profile.itfCertification ?? 'none');
    setCoachingLocationType(profile.coachingLocationType ?? 'facility_coach');
    setCourtType(profile.courtType ?? '');
    setLevelsServed(profile.levelsServed ?? []);
    setLessonTypesOffered(profile.lessonTypesOffered ?? []);
    setMinimumNoticeHours(profile.minimumNoticeHours ?? null);
    setMaxAdvanceBookingDays(profile.maxAdvanceBookingDays ?? null);
    setInitialized(true);
  }
}, [profile, initialized]);
```

- [ ] **Step 3: Replace all save calls with single `handleSave`**

Remove `handleSaveProfile`, `toggleLevel`, `toggleLessonType` that called `save()` directly. Replace with:

```typescript
async function handleSave() {
  const rate   = parseFloat(hourlyRate);
  const years  = parseInt(yearsExperience, 10);
  const radius = parseInt(travelRadiusKm, 10);
  const err = await save({
    fullName:             fullName.trim() || null,
    businessName:         businessName.trim() || null,
    bio:                  bio.trim() || null,
    hourlyRate:           isNaN(rate)   ? null : rate,
    homeBase:             homeBase.trim() || null,
    yearsExperience:      isNaN(years)  ? null : years,
    facilityAddress:      facilityAddress.trim() || null,
    facilityNotes:        facilityNotes.trim() || null,
    travelAreas:          travelAreas.trim() || null,
    travelNotes:          travelNotes.trim() || null,
    travelRadiusKm:       isNaN(radius) ? null : radius,
    gender:               gender || null,
    itfCertification:     itfCertification === 'none' ? null : itfCertification,
    coachingLocationType,
    courtType:            courtType || null,
    levelsServed,
    lessonTypesOffered,
    minimumNoticeHours,
    maxAdvanceBookingDays,
  });
  if (err) Alert.alert('Error', err);
  else Alert.alert('Saved', 'Profile updated.');
}

function toggleLevel(val: string) {
  setLevelsServed(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
}
function toggleLessonType(val: string) {
  setLessonTypesOffered(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
}
```

- [ ] **Step 4: Add isDirty indicator**

```typescript
const isDirty = useMemo(() => {
  if (!profile || !initialized) return false;
  return (
    fullName          !== (profile.fullName ?? '')     ||
    businessName      !== (profile.businessName ?? '') ||
    bio               !== (profile.bio ?? '')          ||
    hourlyRate        !== (profile.hourlyRate != null ? String(profile.hourlyRate) : '') ||
    yearsExperience   !== (profile.yearsExperience != null ? String(profile.yearsExperience) : '') ||
    gender            !== (profile.gender ?? '')       ||
    itfCertification  !== (profile.itfCertification ?? 'none') ||
    coachingLocationType !== (profile.coachingLocationType ?? 'facility_coach') ||
    JSON.stringify([...levelsServed].sort()) !==
      JSON.stringify([...(profile.levelsServed ?? [])].sort()) ||
    JSON.stringify([...lessonTypesOffered].sort()) !==
      JSON.stringify([...(profile.lessonTypesOffered ?? [])].sort())
  );
}, [profile, initialized, fullName, businessName, bio, hourlyRate, yearsExperience,
    gender, itfCertification, coachingLocationType, levelsServed, lessonTypesOffered]);
```

- [ ] **Step 5: Replace the PROFILE section header with dirty indicator**

```tsx
<View style={styles.sectionHeaderRow}>
  <Text style={styles.sectionLabel}>PROFILE</Text>
  {isDirty && <Text style={styles.unsavedBadge}>● UNSAVED</Text>}
</View>
```

- [ ] **Step 6: Add Full Name + Gender + ITF Cert fields to the PROFILE card**

Inside the existing `<View style={styles.card}>`, after the Business Name input:

```tsx
<Text style={styles.fieldLabel}>Full Name</Text>
<TextInput
  style={styles.input}
  value={fullName}
  onChangeText={setFullName}
  placeholder="Your full name"
  placeholderTextColor={Colors.fgDisabled}
/>

<Text style={styles.fieldLabel}>Gender</Text>
<View style={styles.chipWrap}>
  {[
    { value: '',       label: 'Prefer not to say' },
    { value: 'male',   label: 'Male'   },
    { value: 'female', label: 'Female' },
  ].map(g => (
    <TouchableOpacity
      key={g.value}
      style={[styles.chip, gender === g.value && styles.chipActive]}
      onPress={() => setGender(g.value)}
      activeOpacity={0.7}>
      <Text style={[styles.chipText, gender === g.value && styles.chipTextActive]}>{g.label}</Text>
    </TouchableOpacity>
  ))}
</View>

<Text style={styles.fieldLabel}>ITF Certification</Text>
<View style={styles.chipWrap}>
  {[
    { value: 'none',  label: 'None'   },
    { value: 'itf_1', label: 'ITF L1' },
    { value: 'itf_2', label: 'ITF L2' },
    { value: 'itf_3', label: 'ITF L3' },
    { value: 'itf_4', label: 'ITF L4' },
  ].map(c => (
    <TouchableOpacity
      key={c.value}
      style={[styles.chip, itfCertification === c.value && styles.chipActive]}
      onPress={() => setItfCertification(c.value)}
      activeOpacity={0.7}>
      <Text style={[styles.chipText, itfCertification === c.value && styles.chipTextActive]}>{c.label}</Text>
    </TouchableOpacity>
  ))}
</View>
```

- [ ] **Step 7: Replace DEFAULT LOCATION section with COACHING LOCATION + conditional sub-sections**

Remove the existing `DEFAULT LOCATION` section and replace with:

```tsx
<Text style={styles.sectionLabel}>COACHING LOCATION</Text>
<View style={styles.chipWrap}>
  {[
    { value: 'facility_coach',  label: 'Facility Coach'   },
    { value: 'traveling_coach', label: 'Traveling Coach'  },
    { value: 'facility_travel', label: 'Facility + Travel'},
  ].map(m => (
    <TouchableOpacity
      key={m.value}
      style={[styles.chip, coachingLocationType === m.value && styles.chipActive]}
      onPress={() => setCoachingLocationType(m.value)}
      activeOpacity={0.7}>
      <Text style={[styles.chipText, coachingLocationType === m.value && styles.chipTextActive]}>
        {m.label}
      </Text>
    </TouchableOpacity>
  ))}
</View>

{/* Facility fields */}
{(coachingLocationType === 'facility_coach' || coachingLocationType === 'facility_travel') && (
  <View style={styles.card}>
    <Text style={styles.subsectionLabel}>FACILITY</Text>
    <Text style={styles.fieldLabel}>Facility Name</Text>
    <TextInput style={styles.input} value={homeBase} onChangeText={setHomeBase}
      placeholder="e.g. Sunset Park Courts" placeholderTextColor={Colors.fgDisabled} />
    <Text style={styles.fieldLabel}>Address</Text>
    <TextInput style={styles.input} value={facilityAddress} onChangeText={setFacilityAddress}
      placeholder="Street address" placeholderTextColor={Colors.fgDisabled} />
    <Text style={styles.fieldLabel}>Court Type</Text>
    <View style={styles.chipWrap}>
      {['hard','clay','grass','indoor','outdoor'].map(ct => (
        <TouchableOpacity key={ct}
          style={[styles.chip, courtType === ct && styles.chipActive]}
          onPress={() => setCourtType(courtType === ct ? '' : ct)}
          activeOpacity={0.7}>
          <Text style={[styles.chipText, courtType === ct && styles.chipTextActive]}>
            {ct.charAt(0).toUpperCase() + ct.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
    <Text style={styles.fieldLabel}>Facility Notes</Text>
    <TextInput style={[styles.input, styles.multilineInput]} value={facilityNotes}
      onChangeText={setFacilityNotes} placeholder="Parking, access instructions…"
      placeholderTextColor={Colors.fgDisabled} multiline numberOfLines={2}
      textAlignVertical="top" />
  </View>
)}

{/* Travel fields */}
{(coachingLocationType === 'traveling_coach' || coachingLocationType === 'facility_travel') && (
  <View style={styles.card}>
    <Text style={styles.subsectionLabel}>TRAVEL</Text>
    <Text style={styles.fieldLabel}>Radius (km)</Text>
    <TextInput style={styles.input} value={travelRadiusKm} onChangeText={setTravelRadiusKm}
      placeholder="e.g. 25" placeholderTextColor={Colors.fgDisabled} keyboardType="numeric" />
    <Text style={styles.fieldLabel}>Areas Served</Text>
    <TextInput style={styles.input} value={travelAreas} onChangeText={setTravelAreas}
      placeholder="e.g. Downtown, West End" placeholderTextColor={Colors.fgDisabled} />
    <Text style={styles.fieldLabel}>Travel Notes</Text>
    <TextInput style={[styles.input, styles.multilineInput]} value={travelNotes}
      onChangeText={setTravelNotes} placeholder="Any travel conditions…"
      placeholderTextColor={Colors.fgDisabled} multiline numberOfLines={2}
      textAlignVertical="top" />
  </View>
)}
```

- [ ] **Step 8: Update chip sections to use local state setters (not save())**

Level chips: `onPress={() => toggleLevel(l.value)}`
Lesson type chips: `onPress={() => toggleLessonType(t.value)}`
Booking window chips: `onPress={() => setMinimumNoticeHours(h)}` and `onPress={() => setMaxAdvanceBookingDays(d)}`

The single `handleSave` Save button stays the same but is now at the bottom of the PROFILE card (after all the new fields above it). Update its `onPress`:
```tsx
<TouchableOpacity
  style={[styles.saveBtn, saving && styles.btnDisabled]}
  onPress={handleSave}
  disabled={saving}
  activeOpacity={0.85}>
  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save All Changes'}</Text>
</TouchableOpacity>
```

Move this Save button to the bottom of the scroll, just before Sign Out, so it saves everything.

- [ ] **Step 9: Add new styles**

```typescript
sectionHeaderRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 10,
},
unsavedBadge: {
  fontFamily: FontFamily.jetbrainsMonoSemiBold,
  fontSize: 9,
  color: Colors.volt,
  letterSpacing: 0.6,
},
subsectionLabel: {
  fontFamily: FontFamily.jetbrainsMonoSemiBold,
  fontSize: 9,
  color: theme.textMuted,
  letterSpacing: 0.18,
  marginBottom: 2,
},
```

- [ ] **Step 10: Commit**

```bash
git add src/app/(coach)/me.tsx
git commit -m "feat(profile): single-form save, gender/ITF cert/coaching location type with travel+facility sections"
```

---

### Task 6: Hourly Availability Grid Refactor

**Files:**
- Modify: `src/hooks/useCoachAvailability.ts`
- Modify: `src/components/coaching/CoachAvailabilityGrid.tsx`
- Modify: `src/components/coach/CoachAvailabilityGridEditor.tsx`
- Modify: `src/app/(coach)/schedule.tsx`

- [ ] **Step 1: Replace TIME_BANDS with HOURS in `useCoachAvailability.ts`**

Remove `TimeBand` interface and `TIME_BANDS` constant. Replace with:

```typescript
export interface TimeHour {
  label: string;  // '6AM', '12PM', '9PM'
  start: string;  // '06:00'
  end: string;    // '07:00'
  hour: number;   // 6..21
}

export const HOURS: TimeHour[] = Array.from({ length: 16 }, (_, i) => {
  const h = 6 + i;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    label: `${h12}${period}`,
    start: `${String(h).padStart(2, '0')}:00`,
    end:   `${String(h + 1).padStart(2, '0')}:00`,
    hour:  h,
  };
});
// HOURS[0]  = { label: '6AM',  start: '06:00', end: '07:00', hour: 6  }
// HOURS[6]  = { label: '12PM', start: '12:00', end: '13:00', hour: 12 }
// HOURS[15] = { label: '9PM',  start: '21:00', end: '22:00', hour: 21 }
```

Update hook interface — replace `TimeBand` with `TimeHour` everywhere:

```typescript
interface UseCoachAvailabilityResult {
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks: CoachUnavailabilityBlock[];
  loading: boolean;
  error: string | null;
  isAvailableOnDate: (date: Date, hour: TimeHour) => boolean;
  isBlockedOnDate: (date: Date) => boolean;
  hasScheduleForHourOnDay: (dayOfWeek: number, hour: TimeHour) => boolean;
}
```

Remove `overlaps()` and `timeToMinutes()`. Add `normTime()` and replace `hasScheduleForBandOnDay`:

```typescript
function normTime(t: string): string {
  return t.slice(0, 5); // '09:00:00' → '09:00'
}

const hasScheduleForHourOnDay = useCallback(
  (dayOfWeek: number, hour: TimeHour): boolean => {
    return weeklySlots.some(
      s => s.day_of_week === dayOfWeek && normTime(s.start_time) === hour.start,
    );
  },
  [weeklySlots],
);

const isAvailableOnDate = useCallback(
  (date: Date, hour: TimeHour): boolean => {
    return hasScheduleForHourOnDay(date.getDay(), hour) && !isBlockedOnDate(date);
  },
  [hasScheduleForHourOnDay, isBlockedOnDate],
);
```

Return updated result:
```typescript
return { weeklySlots, unavailabilityBlocks, loading, error, isAvailableOnDate, isBlockedOnDate, hasScheduleForHourOnDay };
```

- [ ] **Step 2: Rebuild `CoachAvailabilityGrid.tsx` for hourly mode**

Complete replacement of the file:

```typescript
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import {
  HOURS,
  type TimeHour,
  type CoachAvailabilitySlot,
  type CoachUnavailabilityBlock,
  type CellMode,
} from '@/hooks/useCoachAvailability';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function normTime(t: string): string { return t.slice(0, 5); }

interface Props {
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks?: CoachUnavailabilityBlock[];
  selectedHour?: TimeHour | null;
  onSelectHour?: (hour: TimeHour) => void;
  compact?: boolean;
  getCellMode?: (dow: number, hour: TimeHour) => CellMode | null;
  onCellPress?: (dow: number, hour: TimeHour) => void;
}

export function CoachAvailabilityGrid({
  weeklySlots,
  unavailabilityBlocks = [],
  selectedHour = null,
  onSelectHour,
  compact = false,
  getCellMode,
  onCellPress,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme, compact);
  const isCellInteractive = !!onCellPress;

  const availSet = useMemo(() => {
    const s = new Set<string>();
    for (const slot of weeklySlots) {
      s.add(`${slot.day_of_week}|${normTime(slot.start_time)}`);
    }
    return s;
  }, [weeklySlots]);

  const upcomingBlocks = useMemo(() => {
    if (!unavailabilityBlocks.length) return [];
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 60);
    return unavailabilityBlocks
      .filter(b => b.recurs_annually || (new Date(b.end_date) >= today && new Date(b.start_date) <= cutoff))
      .slice(0, 3);
  }, [unavailabilityBlocks]);

  if (!weeklySlots.length && !isCellInteractive) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Schedule not posted — request any time</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View>
          {/* Day headers */}
          <View style={styles.headerRow}>
            <View style={styles.hourLabelCell} />
            {DAYS.map(day => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Hour rows */}
          {HOURS.map(hour => {
            const isSelected = !isCellInteractive && selectedHour?.start === hour.start;
            const RowComp = (isCellInteractive ? View : TouchableOpacity) as React.ElementType;
            const rowProps = isCellInteractive ? {} : {
              activeOpacity: onSelectHour ? 0.7 : 1,
              onPress: onSelectHour ? () => onSelectHour(hour) : undefined,
            };

            return (
              <RowComp
                key={hour.start}
                {...rowProps}
                style={[styles.hourRow, isSelected && styles.hourRowSelected]}>
                <View style={styles.hourLabelCell}>
                  <Text style={[styles.hourLabel, isSelected && styles.hourLabelSelected]}>
                    {hour.label}
                  </Text>
                </View>
                {DAYS.map((_, dow) => {
                  const cellMode = isCellInteractive ? (getCellMode?.(dow, hour) ?? null) : null;
                  const available = availSet.has(`${dow}|${hour.start}`);
                  const cellStyle = isCellInteractive
                    ? (cellMode === 'coach_facility' ? styles.cellFacility
                       : cellMode === 'traveling'    ? styles.cellTraveling
                       : cellMode === 'both'         ? styles.cellBoth
                       : null)
                    : (available ? (isSelected ? styles.cellAvailableSelected : styles.cellAvailable) : null);

                  if (isCellInteractive) {
                    return (
                      <TouchableOpacity
                        key={dow}
                        activeOpacity={0.7}
                        onPress={() => onCellPress!(dow, hour)}
                        style={[styles.cell, cellStyle]}
                      />
                    );
                  }
                  return <View key={dow} style={[styles.cell, cellStyle]} />;
                })}
              </RowComp>
            );
          })}
        </View>
      </ScrollView>

      {upcomingBlocks.length > 0 && (
        <View style={styles.blocksContainer}>
          {upcomingBlocks.map(block => (
            <View key={block.id} style={styles.blockRow}>
              <Text style={styles.blockDot}>●</Text>
              <Text style={styles.blockText}>
                {block.title ?? 'Away'}{' · '}
                {block.recurs_annually
                  ? `${block.start_date.slice(5)} (annual)`
                  : `${block.start_date}–${block.end_date}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens, compact: boolean) {
  return useMemo(() => StyleSheet.create({
    root: { gap: 8 },
    scroll: { flexGrow: 0 },
    emptyContainer: { paddingVertical: 16, alignItems: 'center' },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    headerRow: { flexDirection: 'row', marginBottom: 2 },
    hourLabelCell: { width: 48, paddingRight: 4, justifyContent: 'center' },
    dayHeaderCell: { width: compact ? 32 : 36, alignItems: 'center' },
    dayHeaderText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.8,
    },
    hourRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: compact ? 1 : 2,
      paddingHorizontal: 2,
      borderRadius: Radius.xs,
      marginBottom: 1,
    },
    hourRowSelected: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.30)',
    },
    hourLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.4,
    },
    hourLabelSelected: { color: Colors.cyan },
    cell: {
      width: compact ? 32 : 36,
      height: compact ? 16 : 20,
      borderRadius: Radius.xs,
      backgroundColor: 'rgba(154,163,184,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(154,163,184,0.10)',
    },
    cellAvailable: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.25)',
    },
    cellAvailableSelected: {
      backgroundColor: 'rgba(45,224,255,0.18)',
      borderColor: Colors.cyan,
    },
    cellFacility: {
      backgroundColor: 'rgba(45,107,255,0.18)',
      borderColor: 'rgba(45,107,255,0.40)',
    },
    cellTraveling: {
      backgroundColor: 'rgba(214,255,61,0.14)',
      borderColor: 'rgba(214,255,61,0.32)',
    },
    cellBoth: {
      backgroundColor: 'rgba(45,224,255,0.14)',
      borderColor: 'rgba(45,224,255,0.32)',
    },
    blocksContainer: { marginTop: 4, gap: 4 },
    blockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    blockDot: { fontFamily: FontFamily.manropeMedium, fontSize: 8, color: Colors.volt },
    blockText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      flex: 1,
    },
  }), [theme, compact]);
}
```

- [ ] **Step 3: Rebuild `CoachAvailabilityGridEditor.tsx`**

Complete replacement (imports HOURS/TimeHour, removes legacy section, changes prop `coachingLocationType`):

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { CoachAvailabilityGrid } from '@/components/coaching/CoachAvailabilityGrid';
import { HOURS, type TimeHour, type CoachAvailabilitySlot, type CellMode } from '@/hooks/useCoachAvailability';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

type DraftMap = Map<string, CellMode>; // key `${dow}|${hour.start}`

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function makeHourKey(dow: number, hour: TimeHour): string { return `${dow}|${hour.start}`; }
function normTime(t: string): string { return t.slice(0, 5); }

interface Props {
  weeklySlots:          CoachAvailabilitySlot[];
  coachingLocationType: string | null;
  onRefresh:            () => void;
}

export function CoachAvailabilityGridEditor({ weeklySlots, coachingLocationType, onRefresh }: Props) {
  const { theme } = useTheme();
  const styles    = useStyles(theme);

  const coachDefault: CellMode =
    coachingLocationType === 'traveling_coach' ? 'traveling' :
    coachingLocationType === 'facility_travel' ? 'both'      : 'coach_facility';

  const buildInitialDraft = useCallback((): DraftMap => {
    const map: DraftMap = new Map();
    for (const slot of weeklySlots) {
      const hour = HOURS.find(h => normTime(slot.start_time) === h.start);
      if (hour) {
        map.set(makeHourKey(slot.day_of_week, hour), (slot.location_mode as CellMode) ?? 'coach_facility');
      }
    }
    return map;
  }, [weeklySlots]);

  const [draft,  setDraft]  = useState<DraftMap>(() => buildInitialDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(buildInitialDraft()); }, [buildInitialDraft]);

  const isDirty = useMemo(() => {
    const saved = buildInitialDraft();
    if (saved.size !== draft.size) return true;
    for (const [k, v] of draft) { if (saved.get(k) !== v) return true; }
    return false;
  }, [draft, buildInitialDraft]);

  function getCellMode(dow: number, hour: TimeHour): CellMode | null {
    return draft.get(makeHourKey(dow, hour)) ?? null;
  }

  function handleCellPress(dow: number, hour: TimeHour) {
    const key     = makeHourKey(dow, hour);
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
          if (idx === 3) { setDraft(prev => { const m = new Map(prev); m.delete(key); return m; }); return; }
          setDraft(prev => new Map(prev).set(key, modeValues[idx]));
        },
      );
    } else {
      Alert.alert(`${DAY_NAMES[dow]} ${hour.label}`, 'Set location:', [
        { text: 'My Facility', onPress: () => setDraft(p => new Map(p).set(key, 'coach_facility')) },
        { text: 'Traveling',   onPress: () => setDraft(p => new Map(p).set(key, 'traveling'))      },
        { text: 'Either',      onPress: () => setDraft(p => new Map(p).set(key, 'both'))            },
        { text: 'Remove', style: 'destructive',
          onPress: () => setDraft(p => { const m = new Map(p); m.delete(key); return m; }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const toDeleteIds = weeklySlots
      .filter(s => {
        const hour = HOURS.find(h => normTime(s.start_time) === h.start);
        return !hour || !draft.has(makeHourKey(s.day_of_week, hour));
      })
      .map(s => s.id);

    const toUpsert = Array.from(draft.entries()).map(([key, mode]) => {
      const [dowStr, hourStart] = key.split('|');
      const hour = HOURS.find(h => h.start === hourStart)!;
      return { coach_id: user.id, day_of_week: Number(dowStr), start_time: hour.start, end_time: hour.end, location_mode: mode };
    });

    try {
      if (toDeleteIds.length > 0) await supabase.from('coach_availability').delete().in('id', toDeleteIds);
      if (toUpsert.length > 0) {
        await supabase.from('coach_availability').upsert(toUpsert, { onConflict: 'coach_id,day_of_week,start_time' });
      }
      onRefresh();
    } catch { Alert.alert('Error', 'Failed to save. Please try again.'); }
    finally  { setSaving(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>WEEKLY AVAILABILITY</Text>
        {isDirty && (
          <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Tap empty cell to add. Tap filled cell to change location or remove.</Text>
      <View style={styles.gridCard}>
        <CoachAvailabilityGrid weeklySlots={[]} getCellMode={getCellMode} onCellPress={handleCellPress} />
        <View style={styles.legend}>
          {[
            { style: styles.dotFacility,  label: 'Facility'  },
            { style: styles.dotTraveling, label: 'Traveling' },
            { style: styles.dotBoth,      label: 'Either'    },
          ].map(({ style, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, style]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    container: { gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.18 },
    saveBtn: { backgroundColor: Colors.blue, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: '#FFFFFF' },
    hint: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: theme.textMuted, fontStyle: 'italic' },
    gridCard: { backgroundColor: theme.cardBg, borderRadius: Radius.card, borderWidth: 1, borderColor: theme.border, padding: Spacing.cardPadding, gap: 12 },
    legend: { flexDirection: 'row', gap: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
    dotFacility:  { backgroundColor: 'rgba(45,107,255,0.30)', borderColor: 'rgba(45,107,255,0.55)' },
    dotTraveling: { backgroundColor: 'rgba(214,255,61,0.25)', borderColor: 'rgba(214,255,61,0.45)' },
    dotBoth:      { backgroundColor: 'rgba(45,224,255,0.25)', borderColor: 'rgba(45,224,255,0.45)' },
    legendLabel:  { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted },
  }), [theme]);
}
```

- [ ] **Step 4: Update `schedule.tsx`**

Remove `hasScheduleForBandOnDay` from destructuring. Change the `CoachAvailabilityGridEditor` prop:

```typescript
const { weeklySlots, loading: slotsLoading } = useCoachAvailability(coachId);

// in JSX:
<CoachAvailabilityGridEditor
  weeklySlots={weeklySlots}
  coachingLocationType={coachProfile?.coachingLocationType ?? null}
  onRefresh={refreshSchedule}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCoachAvailability.ts src/components/coaching/CoachAvailabilityGrid.tsx src/components/coach/CoachAvailabilityGridEditor.tsx src/app/(coach)/schedule.tsx
git commit -m "feat(availability): replace 3-band system with 16-slot hourly grid (6AM–10PM), remove legacy section"
```

---

### Task 7: Dashboard Contrast + Reviews Card

**Files:**
- Modify: `src/components/coach/CoachTodayCard.tsx`
- Modify: `src/hooks/useCoachDashboard.ts`
- Modify: `src/app/(coach)/index.tsx`

- [ ] **Step 1: Fix `CoachTodayCard` contrast**

Change `statValueAmber` from volt to blue (readable on dark card):
```typescript
statValueAmber: { color: Colors.blue },
```

Change `viewRequestsBtn` to solid blue:
```typescript
viewRequestsBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  marginLeft: 'auto',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: Radius.sm,
  backgroundColor: Colors.blue,
},
viewRequestsText: {
  fontFamily: FontFamily.manropeSemiBold,
  fontSize: FontSize.label,
  color: '#FFFFFF',
},
```

Change the `AlertCircle` icon color to `'#FFFFFF'`.

- [ ] **Step 2: Extend `useCoachDashboard` with review count + latest preview**

Add to `CoachDashboardData`:
```typescript
reviewCount: number;
latestReviewText: string | null;
```

Update the ratings query to also select `review_text, created_at` and order descending:
```typescript
supabase
  .from('coach_reviews')
  .select('rating, review_text, created_at')
  .eq('coach_id', user.id)
  .order('created_at', { ascending: false }),
```

Extract review data in the load function:
```typescript
const reviewRows = ratingRes.data ?? [];
const reviewCount = reviewRows.length;
const ratings = reviewRows.map(r => r.rating as number);
const avgRating = ratings.length > 0
  ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
  : null;
const latestReviewText = (reviewRows[0]?.review_text as string | null) ?? null;
```

Add `reviewCount` and `latestReviewText` to `setData(...)`.

- [ ] **Step 3: Add reviews card to `index.tsx`**

Add imports: `import { router } from 'expo-router';` and `import { ChevronRight } from 'lucide-react-native';`

Add after the attendance section:
```tsx
{/* Reviews */}
<Text style={styles.sectionLabel}>REVIEWS</Text>
<TouchableOpacity
  style={styles.reviewsCard}
  onPress={() => router.push('/(coach)/reviews' as any)}
  activeOpacity={0.8}>
  <View style={styles.reviewsLeft}>
    <Text style={styles.reviewsRating}>
      {data.avgRating != null ? data.avgRating.toFixed(1) : '—'}
    </Text>
    <View style={styles.reviewsMeta}>
      <Text style={styles.reviewsCount}>
        {data.reviewCount} review{data.reviewCount !== 1 ? 's' : ''}
      </Text>
      {data.latestReviewText && (
        <Text style={styles.reviewsPreview} numberOfLines={2}>
          "{data.latestReviewText}"
        </Text>
      )}
    </View>
  </View>
  <ChevronRight size={18} color={theme.textMuted} strokeWidth={1.5} />
</TouchableOpacity>
```

Add styles:
```typescript
reviewsCard: {
  backgroundColor: theme.cardBg,
  borderRadius: Radius.card,
  borderWidth: 1,
  borderColor: theme.border,
  padding: Spacing.cardPadding,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
reviewsLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
reviewsRating: {
  fontFamily: FontFamily.spaceGroteskBold,
  fontSize: 28,
  color: theme.textPrimary,
  letterSpacing: -0.4,
},
reviewsMeta: { flex: 1, gap: 4 },
reviewsCount: {
  fontFamily: FontFamily.manropeSemiBold,
  fontSize: FontSize.label,
  color: theme.textSecondary,
},
reviewsPreview: {
  fontFamily: FontFamily.manropeMedium,
  fontSize: FontSize.label,
  color: theme.textMuted,
  fontStyle: 'italic',
  lineHeight: 18,
},
```

Note: `Radius` and `Spacing` need to be imported in `index.tsx` if not already.

- [ ] **Step 4: Commit**

```bash
git add src/components/coach/CoachTodayCard.tsx src/hooks/useCoachDashboard.ts src/app/(coach)/index.tsx
git commit -m "feat(dashboard): fix pending contrast (blue), add reviews summary card"
```

---

### Task 8: Reviews Screen

**Files:**
- Create: `src/app/(coach)/reviews.tsx`
- Modify: `src/app/(coach)/_layout.tsx`

- [ ] **Step 1: Add hidden screen entry to `_layout.tsx`**

Inside `<Tabs>` before `</Tabs>`:
```tsx
<Tabs.Screen name="reviews" options={{ href: null }} />
```

- [ ] **Step 2: Create `src/app/(coach)/reviews.tsx`**

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface ReviewRow {
  id: string;
  rating: number;
  reviewText: string | null;
  playerName: string | null;
  createdAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} strokeWidth={0}
          fill={i <= rating ? '#F59E0B' : 'rgba(154,163,184,0.30)'}
          color={i <= rating ? '#F59E0B' : 'rgba(154,163,184,0.30)'} />
      ))}
    </View>
  );
}

export default function CoachReviewsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const [reviews,   setReviews]   = useState<ReviewRow[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: rows } = await supabase
      .from('coach_reviews')
      .select('id, rating, review_text, player_id, created_at')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false });

    if (!rows) { setLoading(false); return; }

    const playerIds = [...new Set(rows.map(r => r.player_id as string))];
    let nameMap = new Map<string, string>();
    if (playerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', playerIds);
      nameMap = new Map((profiles ?? []).map(p => [p.id as string, (p.full_name as string) ?? 'Player']));
    }

    const avg = rows.length > 0
      ? rows.reduce((s, r) => s + (r.rating as number), 0) / rows.length : null;
    setAvgRating(avg != null ? Math.round(avg * 10) / 10 : null);
    setReviews(rows.map(r => ({
      id:         r.id as string,
      rating:     r.rating as number,
      reviewText: r.review_text as string | null,
      playerName: nameMap.get(r.player_id as string) ?? 'Player',
      createdAt:  r.created_at as string | null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <ArrowLeft color="#FFFFFF" size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reviews</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {avgRating != null && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryRating}>{avgRating.toFixed(1)}</Text>
            <View>
              <StarRow rating={Math.round(avgRating)} />
              <Text style={styles.summaryCount}>
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {loading && <Text style={styles.emptyText}>Loading…</Text>}

        {!loading && reviews.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptySub}>
              Reviews appear here after players rate completed lessons.
            </Text>
          </View>
        )}

        {reviews.map(review => {
          const initials = (review.playerName ?? 'P')
            .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
          return (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewerName} numberOfLines={1}>{review.playerName}</Text>
                  <View style={styles.metaRow}>
                    <StarRow rating={review.rating} />
                    <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                  </View>
                </View>
              </View>
              {review.reviewText && (
                <Text style={styles.reviewText}>"{review.reviewText}"</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    header: {
      backgroundColor: '#0A1628',
      paddingHorizontal: Spacing.pagePx,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(45,224,255,0.18)',
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: '#FFFFFF' },
    content: { padding: Spacing.pagePx, paddingBottom: 100, gap: 12 },
    summaryCard: {
      backgroundColor: theme.cardBg, borderRadius: Radius.card,
      borderWidth: 1, borderColor: theme.border, padding: Spacing.cardPadding,
      flexDirection: 'row', alignItems: 'center', gap: 16,
    },
    summaryRating: {
      fontFamily: FontFamily.spaceGroteskBold, fontSize: 36,
      color: theme.textPrimary, letterSpacing: -0.5,
    },
    summaryCount: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: theme.textMuted, marginTop: 4,
    },
    reviewCard: {
      backgroundColor: theme.cardBg, borderRadius: Radius.card,
      borderWidth: 1, borderColor: theme.border, padding: Spacing.cardPadding, gap: 10,
    },
    reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatar: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(45,107,255,0.20)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    avatarText: { fontFamily: FontFamily.manropeBold, fontSize: 13, color: Colors.blue },
    reviewMeta: { flex: 1, gap: 4 },
    reviewerName: {
      fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: theme.textPrimary,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reviewDate: { fontFamily: FontFamily.manropeMedium, fontSize: 11, color: theme.textMuted },
    reviewText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: theme.textSecondary, lineHeight: 20, fontStyle: 'italic',
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: theme.textMuted, textAlign: 'center', paddingTop: 40,
    },
    emptyState: { paddingTop: 60, alignItems: 'center', gap: 8 },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, color: theme.textSecondary,
    },
    emptySub: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: theme.textMuted, textAlign: 'center',
    },
  }), [theme]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(coach)/reviews.tsx src/app/(coach)/_layout.tsx
git commit -m "feat(coach): reviews screen with avg rating and player review list, pushed from dashboard"
```

---

### Task 9: Coach Header — Avatar + Messages Icon

**Files:**
- Modify: `src/components/ui/Header.tsx`

- [ ] **Step 1: Add `useEffect` and `useState` imports, add `MessageCircle` from lucide**

Add to existing imports at top of file:
```typescript
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
```

- [ ] **Step 2: Add `useCoachInitials` hook above `Header` component**

```typescript
function useCoachInitials(): string {
  const [initials, setInitials] = useState('');
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => {
          if (!data?.full_name) return;
          const parts = (data.full_name as string).trim().split(' ').filter(Boolean);
          setInitials((parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase());
        });
    });
  }, []);
  return initials;
}
```

- [ ] **Step 3: Call hook and update JSX in `Header`**

At the top of `Header` function body (before any early returns), add:
```typescript
const coachInitials = useCoachInitials();
```

In the `resident`/`coach` variant render block, update `topBarRight` to insert avatar + messages buttons before bell (coach only):

```tsx
<View style={styles.topBarRight}>
  {isCoach && (
    <TouchableOpacity
      style={styles.iconBtn}
      onPress={(props as CoachHeaderProps).onSettings ?? (() => router.push('/(coach)/me' as any))}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarCircleText}>{coachInitials || '?'}</Text>
      </View>
    </TouchableOpacity>
  )}
  {isCoach && (
    <TouchableOpacity
      style={styles.iconBtn}
      onPress={(props as CoachHeaderProps).onMessages ?? (() => router.push('/messages'))}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
      <MessageCircle color="#FFFFFF" size={22} strokeWidth={1.5} />
    </TouchableOpacity>
  )}
  <TouchableOpacity
    testID="bell-icon"
    style={styles.iconBtn}
    onPress={props.onBell ?? (() => router.push('/notifications'))}
    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
    <Bell color="#FFFFFF" size={24} strokeWidth={1.5} />
  </TouchableOpacity>
  <TouchableOpacity
    testID="menu-icon"
    style={styles.iconBtn}
    onPress={
      isCoach
        ? ((props as CoachHeaderProps).onSettings ?? (() => router.push('/(coach)/me' as any)))
        : ((props as ResidentHeaderProps).onMenu ?? (() => router.push('/settings')))
    }
    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
    <Menu color="#FFFFFF" size={24} strokeWidth={1.5} />
  </TouchableOpacity>
</View>
```

Add `onMessages?: () => void` to `CoachHeaderProps`:
```typescript
interface CoachHeaderProps {
  variant: 'coach';
  onBell?: () => void;
  onSettings?: () => void;
  onMessages?: () => void;
}
```

Add styles to the static `StyleSheet.create`:
```typescript
avatarCircle: {
  width: 28, height: 28, borderRadius: 14,
  backgroundColor: 'rgba(45,224,255,0.18)',
  borderWidth: 1.5, borderColor: 'rgba(45,224,255,0.45)',
  alignItems: 'center', justifyContent: 'center',
},
avatarCircleText: {
  fontFamily: FontFamily.manropeBold,
  fontSize: 10,
  color: Colors.cyan,
},
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Header.tsx
git commit -m "feat(header): add avatar circle and messages icon to coach header"
```

---

### Task 10: Coach Card Badges + Layout

**Files:**
- Modify: `src/hooks/useCoachData.ts`
- Modify: `src/components/coaching/CoachCard.tsx`

- [ ] **Step 1: Add `coachingLocationType` + `itfCertification` to `CoachWithProfile`**

In `useCoachData.ts`:
```typescript
export interface CoachWithProfile {
  // ... existing fields ...
  coachingLocationType: string | null;
  itfCertification: string | null;
}
```

Update the `coaches` select query to include new columns:
```typescript
.select('id, user_id, business_name, credentials, years_experience, sports_offered, home_base, willing_to_travel, hourly_rate, bio, profile_image_url, levels_served, latitude, longitude, lesson_types_offered, coaching_location_type, itf_certification')
```

In the `merged` map:
```typescript
coachingLocationType: c.coaching_location_type as string | null,
itfCertification:     c.itf_certification     as string | null,
```

- [ ] **Step 2: Restructure `CoachCard.tsx`**

Add constants near top of file:
```typescript
const LOCATION_TYPE_LABELS: Record<string, string> = {
  facility_coach:  'Facility Coach',
  traveling_coach: 'Traveling Coach',
  facility_travel: 'Facility + Travel',
};

const ITF_CERT_LABELS: Record<string, string> = {
  itf_1: 'ITF L1', itf_2: 'ITF L2', itf_3: 'ITF L3', itf_4: 'ITF L4',
};

const LESSON_CHIP_LABELS: Record<string, string> = {
  private_lesson:      'Private',
  semi_private_lesson: 'Semi-Private',
  group_lesson:        'Group',
  hitting_partner:     'Hitting',
};
```

Rewrite the card content section (inside the `<View style={styles.content}>`) in this order:

```tsx
{/* 1. Name */}
<Text style={styles.name} numberOfLines={1}>{displayName}</Text>

{/* 2. Location type badge */}
{coach.coachingLocationType && LOCATION_TYPE_LABELS[coach.coachingLocationType] && (
  <View style={styles.locationBadge}>
    <MapPin size={10} color={Colors.cyan} strokeWidth={2} />
    <Text style={styles.locationBadgeText}>
      {LOCATION_TYPE_LABELS[coach.coachingLocationType]}
    </Text>
  </View>
)}

{/* 3. Lesson type chips */}
{coach.lessonTypesOffered.length > 0 && (
  <View style={styles.lessonRow}>
    {coach.lessonTypesOffered.slice(0, 3).map(lt => (
      <View key={lt} style={styles.lessonChip}>
        <Text style={styles.lessonChipText}>{LESSON_CHIP_LABELS[lt] ?? lt}</Text>
      </View>
    ))}
    {coach.lessonTypesOffered.length > 3 && (
      <Text style={styles.moreText}>+{coach.lessonTypesOffered.length - 3}</Text>
    )}
  </View>
)}

{/* 4. Rating + reviews */}
<View style={styles.ratingRow}>
  <Star size={12} strokeWidth={0}
    fill={ratingText ? '#F59E0B' : theme.textMuted}
    color={ratingText ? '#F59E0B' : theme.textMuted} />
  {ratingText ? (
    <Text style={styles.ratingTxt}>
      {ratingText}<Text style={styles.reviewCount}> ({coach.reviewCount})</Text>
    </Text>
  ) : (
    <Text style={styles.noRating}>No reviews yet</Text>
  )}
</View>

{/* 5. Years + price + distance */}
<View style={styles.statsRow}>
  {coach.yearsExperience != null && (
    <Text style={styles.statText}>{coach.yearsExperience} yrs</Text>
  )}
  {coach.yearsExperience != null && <View style={styles.dot} />}
  <Text style={styles.statText}>
    {coach.hourlyRate != null ? `$${Math.round(coach.hourlyRate)}/hr` : 'Rate TBD'}
  </Text>
  {coach.distanceKm != null && <View style={styles.dot} />}
  {coach.distanceKm != null && (
    <Text style={styles.statText}>{(coach.distanceKm * 0.621371).toFixed(1)} mi</Text>
  )}
</View>

{/* 6. ITF cert badge */}
{coach.itfCertification && coach.itfCertification !== 'none' && (
  <View style={styles.certBadge}>
    <Text style={styles.certBadgeText}>
      {ITF_CERT_LABELS[coach.itfCertification] ?? coach.itfCertification}
    </Text>
  </View>
)}

{/* Level chips */}
{coach.levelsServed.length > 0 && (
  <View style={styles.levelRow}>
    {coach.levelsServed.map(lv => (
      <View key={lv} style={styles.levelChip}>
        <Text style={styles.levelChipText}>{LEVEL_LABELS[lv] ?? lv.toUpperCase()}</Text>
      </View>
    ))}
  </View>
)}
```

Add new / replace obsolete styles:
```typescript
locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
locationBadgeText: { fontFamily: FontFamily.manropeMedium, fontSize: 11, color: Colors.cyan },
lessonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
lessonChip: {
  backgroundColor: 'rgba(45,107,255,0.10)', borderRadius: 4,
  paddingHorizontal: 6, paddingVertical: 2,
},
lessonChipText: { fontFamily: FontFamily.manropeMedium, fontSize: 10, color: Colors.blue },
moreText: { fontFamily: FontFamily.manropeMedium, fontSize: 10, color: theme.textMuted, alignSelf: 'center' },
statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
statText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: theme.textPrimary },
certBadge: {
  backgroundColor: 'rgba(45,224,255,0.10)', borderRadius: 4,
  paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start',
},
certBadgeText: {
  fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 9,
  color: Colors.cyan, letterSpacing: 0.6,
},
```

Remove unused styles: `metaRow`, `credentialChip`, `credentialText`, `homeBase`, `distanceRow`, `distanceTxt`, `unknownTxt`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCoachData.ts src/components/coaching/CoachCard.tsx
git commit -m "feat(coachcard): ITF cert + location type badges, restructure layout order per spec"
```

---

### Task 11: Discovery Filters — Certification + Updated Location Filter

**Files:**
- Modify: `src/hooks/useCoachData.ts`
- Modify: `src/components/coaching/CoachFiltersSheet.tsx`
- Modify: `src/app/(resident)/coaches.tsx`

- [ ] **Step 1: Add `CertificationFilter` type + update `LocationModeFilter` + `CoachFilters`**

In `useCoachData.ts`:
```typescript
export type CertificationFilter = 'certified' | null;

// Update existing type:
export type LocationModeFilter = 'traveling_coach' | 'facility_coach' | null;

// Add field to CoachFilters:
export interface CoachFilters {
  search: string;
  distanceKm: DistanceFilterKm;
  levels: LevelFilter[];
  priceRange: PriceRange;
  lessonTypes: string[];
  availability: AvailabilityFilter;
  rating: RatingFilter;
  experience: ExperienceFilter;
  locationMode: LocationModeFilter;
  gender: GenderFilter;
  sort: SortOption;
  certification: CertificationFilter;
}
```

- [ ] **Step 2: Update filter logic in `useCoachData`**

Replace the location mode filter (currently checks `willingToTravel`):
```typescript
// Location mode — based on coachingLocationType
if (filters.locationMode === 'traveling_coach') {
  if (c.coachingLocationType !== 'traveling_coach' && c.coachingLocationType !== 'facility_travel') return false;
}
if (filters.locationMode === 'facility_coach') {
  if (c.coachingLocationType !== 'facility_coach' && c.coachingLocationType !== 'facility_travel') return false;
}

// Certification
if (filters.certification === 'certified') {
  if (!c.itfCertification || c.itfCertification === 'none') return false;
}
```

- [ ] **Step 3: Update `CoachFiltersSheet.tsx`**

Add `CertificationFilter` import from `useCoachData`.

Add to `CoachFiltersState`:
```typescript
export interface CoachFiltersState {
  distanceKm: DistanceFilterKm;
  levels: LevelFilter[];
  priceRange: PriceRange;
  lessonTypes: string[];
  availability: AvailabilityFilter;
  rating: RatingFilter;
  experience: ExperienceFilter;
  locationMode: LocationModeFilter;
  gender: GenderFilter;
  certification: CertificationFilter;
}
```

Update `LOCATION_FILTER_OPTIONS`:
```typescript
const LOCATION_FILTER_OPTIONS: { label: string; value: LocationModeFilter }[] = [
  { label: 'Either',         value: null              },
  { label: 'Facility Coach', value: 'facility_coach'  },
  { label: 'Travels to You', value: 'traveling_coach' },
];
```

Add certification filter section in the ScrollView (after Gender section):
```tsx
<View style={styles.filterSection}>
  <Text style={styles.filterLabel}>CERTIFICATION</Text>
  <View style={styles.chipRow}>
    {([
      { label: 'Any',       value: null          as CertificationFilter },
      { label: 'Certified', value: 'certified'   as CertificationFilter },
    ] as const).map(o => (
      <TouchableOpacity
        key={String(o.value)}
        style={[styles.chip, local.certification === o.value && styles.chipActive]}
        onPress={() => setLocal(s => ({ ...s, certification: o.value }))}
        activeOpacity={0.7}>
        <Text style={[styles.chipText, local.certification === o.value && styles.chipTextActive]}>
          {o.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
</View>
```

Update `activeFilterCount` to count `certification`:
```typescript
if (applied.certification != null) n++;
```

Update `defaultFilters` const and the reset handler to include `certification: null`.

- [ ] **Step 4: Update `coaches.tsx`**

Add `certification: null` to `appliedFilters` initial state and the `filters` useMemo:
```typescript
const [appliedFilters, setAppliedFilters] = useState<CoachFiltersState>({
  // existing ...
  certification: null,
});

const filters = useMemo((): CoachFilters => ({
  // existing ...
  certification: appliedFilters.certification,
}), [appliedFilters, /* existing deps */]);
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCoachData.ts src/components/coaching/CoachFiltersSheet.tsx src/app/(resident)/coaches.tsx
git commit -m "feat(filters): add ITF cert filter, fix location filter to use coachingLocationType"
```

---

## Spec Coverage Check

| Spec Section | Task(s) |
|---|---|
| 1. Accept/Decline request actions | Task 2 |
| 2. Profile editing UX (single-form save) | Task 5 |
| 3. Profile fields (gender, ITF cert, location type) | Tasks 4, 5 |
| 4. Lesson types reduced to 4 | Task 3 |
| 5. Coaching location model (travel/facility sub-fields) | Tasks 1, 4, 5 |
| 6. Universal Header (avatar + messages) | Task 9 |
| 7. Messaging (message button + header icon) | Task 9 (request card already routes `/messages`) |
| 8. Dashboard contrast fixes | Task 7 |
| 9. Coach reviews system | Tasks 7, 8 |
| 10. Player discovery badges (ITF, experience, location) | Task 10 |
| 11. Coach card layout restructure | Task 10 |
| 12. Discovery filters update | Task 11 |
| 13. Hourly availability grid | Task 6 |
| 14. Legacy availability removed | Tasks 1, 6 |

## Type Consistency Check

- `TimeHour` and `HOURS` used in Tasks 6 only ✓
- `coaching_location_type` values: `'facility_coach' | 'traveling_coach' | 'facility_travel'` consistent across SQL, TS hooks, and UI ✓
- `CertificationFilter = 'certified' | null` consistent between `useCoachData.ts` and `CoachFiltersSheet.tsx` ✓
- `LocationModeFilter = 'traveling_coach' | 'facility_coach' | null` updated consistently ✓
- `DraftMap` key format `${dow}|${hour.start}` used consistently in Task 6 ✓
- `CoachAvailabilityGridEditor` prop `coachingLocationType` matches `schedule.tsx` call-site ✓

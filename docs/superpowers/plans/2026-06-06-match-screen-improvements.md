# Match Screen Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Match screen with multi-select NTRP level filters, a scheduling modal for match requests, circular avatars, a "Practice Session" rename, schema improvements (duration / message / availability_type / expires_at), and a consolidated reservation sheet footer.

**Architecture:** All changes are isolated to two screen files (`match.tsx`, `courts.tsx`), one migration file, and `types.ts`. The new `MatchRequestSheet` is an inline component inside `match.tsx` (same pattern as the existing `MatchFiltersSheet` and `ActionSheet`). No new shared component files are created. The migration adds four nullable/defaulted columns so no existing data is broken.

**Tech Stack:** React Native 0.85 / TypeScript, Expo SDK 56, Supabase (postgres + RLS), Lucide React Native icons, custom design tokens in `src/constants/design.ts`.

---

## File Map

| File | Role |
|---|---|
| `supabase/migrations/<timestamp>_match_request_fields.sql` | Add `duration`, `message`, `availability_type`, `expires_at` to `match_requests` |
| `src/lib/types.ts` | Add the four new columns to `match_requests` Row/Insert/Update typings |
| `src/app/(resident)/match.tsx` | NTRP multi-select, `MatchRequestSheet`, circular avatars, rename, expiry filter |
| `src/app/(resident)/courts.tsx` | Replace card-style slot summary with compact inline footer text |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_match_request_fields.sql`

- [ ] **Step 1: Create the migration file**

Run in PowerShell:
```powershell
$ts = Get-Date -Format "yyyyMMddHHmmss"
New-Item -ItemType File "supabase/migrations/${ts}_match_request_fields.sql"
```
Then open the file and write:
```sql
-- Add scheduling and expiry fields to match_requests
ALTER TABLE public.match_requests
  ADD COLUMN IF NOT EXISTS duration          integer,
  ADD COLUMN IF NOT EXISTS message           text,
  ADD COLUMN IF NOT EXISTS availability_type text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS expires_at        timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '72 hours');
```

- [ ] **Step 2: Apply migration to Supabase**

Use the Supabase MCP `apply_migration` tool with the SQL above, or run:
```bash
npx supabase db push
```
Verify: confirm no errors and the `match_requests` table now has the four new columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add duration, message, availability_type, expires_at to match_requests"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts` — `match_requests` Row, Insert, Update blocks

- [ ] **Step 1: Find the match_requests Row block in types.ts**

It starts around line 2165. The `Row` block currently ends with `updated_at: string | null`. Add the four new fields inside `Row`:
```ts
      match_requests: {
        Row: {
          availability_type: string        // ← add
          challenger_id: string
          court_type: Database["public"]["Enums"]["court_type"] | null
          created_at: string | null
          date: string | null
          duration: number | null          // ← add
          expires_at: string               // ← add (timestamptz → string in JS)
          id: string
          location: string | null
          match_type: Database["public"]["Enums"]["match_type"] | null
          message: string | null           // ← add
          opponent_id: string
          status: Database["public"]["Enums"]["match_status"] | null
          time_end: string | null
          time_start: string | null
          updated_at: string | null
        }
```

- [ ] **Step 2: Add to Insert block**

```ts
        Insert: {
          availability_type?: string       // ← add
          challenger_id: string
          court_type?: Database["public"]["Enums"]["court_type"] | null
          created_at?: string | null
          date?: string | null
          duration?: number | null         // ← add
          expires_at?: string              // ← add
          id?: string
          location?: string | null
          match_type?: Database["public"]["Enums"]["match_type"] | null
          message?: string | null          // ← add
          opponent_id: string
          status?: Database["public"]["Enums"]["match_status"] | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
        }
```

- [ ] **Step 3: Add to Update block**

```ts
        Update: {
          availability_type?: string       // ← add
          challenger_id?: string
          court_type?: Database["public"]["Enums"]["court_type"] | null
          created_at?: string | null
          date?: string | null
          duration?: number | null         // ← add
          expires_at?: string              // ← add
          id?: string
          location?: string | null
          match_type?: Database["public"]["Enums"]["match_type"] | null
          message?: string | null          // ← add
          opponent_id?: string
          status?: Database["public"]["Enums"]["match_status"] | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
        }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run lint
```
Expected: no type errors in types.ts.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add duration, message, availability_type, expires_at to match_requests"
```

---

## Task 3: Practice Session Rename + Circular Avatars

**Files:**
- Modify: `src/app/(resident)/match.tsx`

These are small, isolated changes bundled together.

- [ ] **Step 1: Rename "Hitting Session" → "Practice Session" in matchTypeLabel**

Find `matchTypeLabel` (around line 549) and change:
```ts
// Before:
case 'hitting_session': return 'Hitting Session';
// After:
case 'hitting_session': return 'Practice Session';
```

- [ ] **Step 2: Rename in MatchFiltersSheet formats array**

Find the `formats` array inside `MatchFiltersSheet` (around line 907):
```ts
// Before:
{ label: 'Hitting Session', value: 'hitting_session' },
// After:
{ label: 'Practice Session', value: 'hitting_session' },
```

- [ ] **Step 3: Make RecommendedPlayerCard avatar circular**

Find `RecommendedPlayerCard` (around line 1086) and remove the `square` prop:
```tsx
// Before:
<PlayerAvatar player={player} size={52} square />
// After:
<PlayerAvatar player={player} size={52} />
```

- [ ] **Step 4: Verify no other `square` props remain in match.tsx**

Run:
```bash
grep -n "square" src/app/\(resident\)/match.tsx
```
Expected: zero matches.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(resident\)/match.tsx
git commit -m "fix(match): Practice Session rename, circular avatars on recommended cards"
```

---

## Task 4: NTRP Multi-select Filter

**Files:**
- Modify: `src/app/(resident)/match.tsx`

- [ ] **Step 1: Update the MatchFilters interface**

Find `interface MatchFilters` (around line 120) and replace `ntrpMin`/`ntrpMax` with `selectedNtrpLevels`:
```ts
interface MatchFilters {
  format: MatchType;
  selectedNtrpLevels: number[];
  dateLabel: string;
  timeLabel: string;
  distanceMiles: number;
}
```

- [ ] **Step 2: Update DEFAULT_FILTERS**

Find `DEFAULT_FILTERS` (around line 131):
```ts
const DEFAULT_FILTERS: MatchFilters = {
  format: 'singles',
  selectedNtrpLevels: [3.5, 4.0, 4.5],
  dateLabel: 'Today',
  timeLabel: '5 – 8 PM',
  distanceMiles: 10,
};
```

- [ ] **Step 3: Replace NTRP_RANGES with NTRP_LEVELS**

Find the `NTRP_RANGES` constant (around line 140) and replace it entirely:
```ts
const NTRP_LEVELS = [3.0, 3.5, 4.0, 4.5, 5.0];
```
Delete the old NTRP_RANGES array.

- [ ] **Step 4: Update filteredRecommended logic in MatchScreen**

Find `filteredRecommended` (around line 1816):
```ts
// Before:
const filteredRecommended = recommended.filter((p) => {
  if (p.ntrpRating == null) return true;
  return p.ntrpRating >= filters.ntrpMin && p.ntrpRating <= filters.ntrpMax;
});

// After:
const filteredRecommended = recommended.filter((p) => {
  if (p.ntrpRating == null) return true;
  return filters.selectedNtrpLevels.includes(p.ntrpRating);
});
```

- [ ] **Step 5: Update MatchFiltersSheet — NTRP section**

Find the NTRP section inside `MatchFiltersSheet` (around line 940). Replace the entire NTRP section (the `<Text>` label + `<View>` optionRow) with:
```tsx
<Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>NTRP Level</Text>
<View style={mfS.optionRow}>
  {NTRP_LEVELS.map((level) => {
    const active = draft.selectedNtrpLevels.includes(level);
    return (
      <TouchableOpacity
        key={level}
        style={[mfS.option, {
          borderColor: active ? BLUE : theme.border,
          backgroundColor: active ? theme.selectedBg : theme.cardBg,
        }]}
        onPress={() => {
          if (active && draft.selectedNtrpLevels.length === 1) return;
          setDraft((d) => ({
            ...d,
            selectedNtrpLevels: active
              ? d.selectedNtrpLevels.filter((l) => l !== level)
              : [...d.selectedNtrpLevels, level].sort((a, b) => a - b),
          }));
        }}
        activeOpacity={0.7}>
        <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>
          {level.toFixed(1)}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>
```

Also update the Reset handler (around line 982) — the existing reset already uses `DEFAULT_FILTERS` so it's correct as-is.

- [ ] **Step 6: Update FilterBar chip rendering**

Find the `chips` array inside `FilterBar` (around line 795). Replace the single NTRP chip entry with dynamic chip generation. Replace the whole `chips` array declaration:
```ts
// Build base chips (format, date, time, distance)
const baseChips: FilterChip[] = [
  { icon: <CircleDot size={12} color="#FFF" strokeWidth={1.5} />, label: matchTypeLabel(filters.format) },
  { icon: <Calendar  size={12} color="#FFF" strokeWidth={1.5} />, label: filters.dateLabel },
  { icon: <Clock     size={12} color="#FFF" strokeWidth={1.5} />, label: filters.timeLabel },
  { icon: <MapPin    size={12} color="#FFF" strokeWidth={1.5} />, label: `≤${filters.distanceMiles} mi` },
];

// NTRP chips: first 2 levels, then +N more
const ntrpChips: FilterChip[] = filters.selectedNtrpLevels
  .slice(0, 2)
  .map((lvl) => ({
    icon: <BarChart2 size={12} color="#FFF" strokeWidth={1.5} />,
    label: `NTRP ${lvl.toFixed(1)}`,
  }));
const extraNtrp = filters.selectedNtrpLevels.length - 2;
if (extraNtrp > 0) {
  ntrpChips.push({
    icon: <BarChart2 size={12} color="#FFF" strokeWidth={1.5} />,
    label: `+${extraNtrp} more`,
  });
}

const chips: FilterChip[] = [...ntrpChips, ...baseChips];
```

- [ ] **Step 7: Update ResultsContext**

Find `ResultsContext` (around line 869). Replace the `ntrpLabel` computation and the detail text:
```tsx
function ResultsContext({ filters, matchingCount, loading }: {
  filters: MatchFilters; matchingCount: number; loading: boolean;
}) {
  const { theme } = useTheme();
  if (loading) return null;
  const ntrpLabel  = filters.selectedNtrpLevels.length === 5
    ? 'Any NTRP'
    : filters.selectedNtrpLevels.map((l) => `NTRP ${l.toFixed(1)}`).join(', ');
  const countLabel = matchingCount === 0 ? 'No players match' : `${matchingCount} player${matchingCount !== 1 ? 's' : ''} match`;
  return (
    <View style={rcxS.row}>
      <Text style={[rcxS.count, { color: theme.textSecondary }]}>{countLabel}</Text>
      <Text style={[rcxS.sep, { color: theme.textMuted }]}>·</Text>
      <Text style={[rcxS.detail, { color: theme.textMuted }]} numberOfLines={1}>
        {ntrpLabel} · {matchTypeLabel(filters.format)} · ≤{filters.distanceMiles} mi
      </Text>
    </View>
  );
}
```

- [ ] **Step 8: Verify TypeScript**

```bash
npm run lint
```
Expected: no errors. The old `ntrpMin`/`ntrpMax` references are fully removed.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(resident\)/match.tsx
git commit -m "feat(match): NTRP level multi-select filter with chip overflow display"
```

---

## Task 5: MatchRequestSheet

**Files:**
- Modify: `src/app/(resident)/match.tsx`

This task adds the `MatchRequestSheet` component, wires it into `MatchScreen`, and removes the legacy `sendMatchRequest` call from `RecommendedPlayerCard` and `PlayerLookupModal`.

- [ ] **Step 1: Add ChevronLeft to imports**

Find the lucide import block at the top of match.tsx and add `ChevronLeft`:
```ts
import {
  BarChart2,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,   // ← add
  ChevronRight,
  // ... rest unchanged
} from 'lucide-react-native';
```

Also add `KeyboardAvoidingView` and `Platform` from react-native if not already imported:
```ts
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,   // ← add
  Modal,
  Platform,               // ← add
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
```

- [ ] **Step 2: Add request constants above the data hook**

After the `DISTANCE_OPTIONS` line and before the mock data, insert:
```ts
// ─── Match Request Sheet constants ───────────────────────────────────────────

const REQUEST_MATCH_TYPES: { label: string; value: MatchType }[] = [
  { label: 'Singles',          value: 'singles' },
  { label: 'Doubles',          value: 'doubles' },
  { label: 'Mixed Doubles',    value: 'mixed_doubles' },
  { label: 'Practice Session', value: 'hitting_session' },
];

const REQUEST_AVAILABILITY: { label: string; value: 'one_time' | 'recurring' }[] = [
  { label: 'One Time Match',           value: 'one_time' },
  { label: 'Recurring Hitting Partner', value: 'recurring' },
];

const REQUEST_DURATIONS = [60, 90, 120];

const REQUEST_COURT_TYPES: { label: string; value: string | null }[] = [
  { label: 'Hard',  value: 'hard' },
  { label: 'Clay',  value: 'clay' },
  { label: 'Grass', value: 'grass' },
  { label: 'Any',   value: null },
];

// 30-min increments from 6:00 AM to 10:00 PM (33 slots)
const REQUEST_TIME_SLOTS: string[] = Array.from({ length: 33 }, (_, i) => {
  const totalMins = 6 * 60 + i * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

const REQ_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const REQ_DAY_LABELS  = ['S','M','T','W','T','F','S'];
```

- [ ] **Step 3: Add helper functions for MatchRequestSheet**

After the existing `getInitials` / `matchTypeLabel` helpers, add:
```ts
function formatRequestDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatRequestTime(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function addMinutes(slot: string, mins: number): string {
  const [h, m] = slot.split(':').map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Add inline date picker subcomponent**

Insert this component before `MatchRequestSheet`:
```tsx
// ─── MatchRequestDatePicker — inline month calendar ───────────────────────────

function MatchRequestDatePicker({
  value, onChange,
}: { value: Date | null; onChange: (d: Date) => void }) {
  const { theme } = useTheme();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ?? today;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstDow    = viewMonth.getDay();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = Array.from(
    { length: cells.length / 7 },
    (_, i) => cells.slice(i * 7, (i + 1) * 7),
  );

  return (
    <View style={[mrS.calWrap, { borderColor: theme.border }]}>
      <View style={mrS.calHeader}>
        <TouchableOpacity
          onPress={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={18} color={theme.textSecondary} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={[mrS.calMonthLabel, { color: theme.textPrimary }]}>
          {REQ_MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </Text>
        <TouchableOpacity
          onPress={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronRight size={18} color={theme.textSecondary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      <View style={mrS.calDayRow}>
        {REQ_DAY_LABELS.map((l, i) => (
          <Text key={i} style={[mrS.calDayLabel, { color: theme.textMuted }]}>{l}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={mrS.calWeekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={`e-${wi}-${di}`} style={mrS.calCell} />;
            const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
            cellDate.setHours(0, 0, 0, 0);
            const isPast      = cellDate < today;
            const isSelected  = value != null && cellDate.getTime() === value.getTime();
            const isToday     = cellDate.getTime() === today.getTime();
            return (
              <TouchableOpacity
                key={day}
                style={[
                  mrS.calCell,
                  isSelected  && { backgroundColor: BLUE, borderRadius: 999 },
                  isToday && !isSelected && { borderWidth: 1, borderColor: BLUE, borderRadius: 999 },
                ]}
                onPress={() => { if (!isPast) { onChange(cellDate); } }}
                disabled={isPast}
                activeOpacity={0.7}>
                <Text style={[
                  mrS.calDayNum,
                  { color: isPast ? theme.textDisabled : isSelected ? '#FFF' : theme.textPrimary },
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 5: Add the MatchRequestSheet component**

Insert after `MatchRequestDatePicker`:
```tsx
// ─── MatchRequestSheet ────────────────────────────────────────────────────────

function MatchRequestSheet({
  visible,
  opponent,
  currentUserId,
  onSend,
  onDismiss,
}: {
  visible: boolean;
  opponent: RecommendedPlayer | MatchPlayer | null;
  currentUserId: string;
  onSend: () => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();

  const [matchType,       setMatchType]       = useState<MatchType>('singles');
  const [availType,       setAvailType]       = useState<'one_time' | 'recurring'>('one_time');
  const [date,            setDate]            = useState<Date | null>(null);
  const [timeSlot,        setTimeSlot]        = useState<string | null>(null);
  const [duration,        setDuration]        = useState(90);
  const [courtType,       setCourtType]       = useState<string | null>(null);
  const [message,         setMessage]         = useState('');
  const [showDatePicker,  setShowDatePicker]  = useState(false);
  const [sending,         setSending]         = useState(false);

  useEffect(() => {
    if (visible) {
      setMatchType('singles');
      setAvailType('one_time');
      setDate(null);
      setTimeSlot(null);
      setDuration(90);
      setCourtType(null);
      setMessage('');
      setShowDatePicker(false);
    }
  }, [visible]);

  const canSend = date != null && timeSlot != null && !sending;

  async function handleSend() {
    if (!opponent || !date || !timeSlot) return;
    setSending(true);
    if (!opponent.id.startsWith('mock-')) {
      const yyyy  = date.getFullYear();
      const mm    = String(date.getMonth() + 1).padStart(2, '0');
      const dd    = String(date.getDate()).padStart(2, '0');
      const dateStr  = `${yyyy}-${mm}-${dd}`;
      const timeEnd  = addMinutes(timeSlot, duration);
      await supabase.from('match_requests').insert({
        challenger_id:     currentUserId,
        opponent_id:       opponent.id,
        match_type:        matchType as any,
        availability_type: availType,
        date:              dateStr,
        time_start:        timeSlot,
        time_end:          timeEnd,
        duration,
        court_type:        courtType as any,
        message:           message.trim() || null,
        status:            'pending',
      });
    }
    setSending(false);
    onSend();
    onDismiss();
  }

  const summaryRows: [string, string][] = [
    ['Playing with', opponent?.name ?? '—'],
    ['Date',         date     ? formatRequestDate(date)     : '—'],
    ['Time',         timeSlot ? formatRequestTime(timeSlot) : '—'],
    ['Duration',     `${duration} min`],
    ['Type',         REQUEST_MATCH_TYPES.find((t) => t.value === matchType)?.label ?? '—'],
    ['Availability', REQUEST_AVAILABILITY.find((a) => a.value === availType)?.label ?? '—'],
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[mrS.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[mrS.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
            <View style={[mrS.handle, { backgroundColor: theme.border }]} />
            <View style={mrS.titleRow}>
              <Text style={[mrS.title, { color: theme.textPrimary }]}>Match Request</Text>
              <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={theme.textMuted} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Match Type */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Match Type</Text>
              <View style={mrS.pillRow}>
                {REQUEST_MATCH_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[mrS.pill, { borderColor: matchType === t.value ? BLUE : theme.border, backgroundColor: matchType === t.value ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => setMatchType(t.value)}
                    activeOpacity={0.7}>
                    <Text style={[mrS.pillText, { color: matchType === t.value ? BLUE : theme.textSecondary }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Availability Type */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Availability</Text>
              <View style={mrS.pillRow}>
                {REQUEST_AVAILABILITY.map((a) => (
                  <TouchableOpacity
                    key={a.value}
                    style={[mrS.pill, { borderColor: availType === a.value ? BLUE : theme.border, backgroundColor: availType === a.value ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => setAvailType(a.value)}
                    activeOpacity={0.7}>
                    <Text style={[mrS.pillText, { color: availType === a.value ? BLUE : theme.textSecondary }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Date</Text>
              <TouchableOpacity
                style={[mrS.fieldRow, { borderColor: date ? BLUE : theme.border, backgroundColor: theme.inputBg }]}
                onPress={() => setShowDatePicker((v) => !v)}
                activeOpacity={0.8}>
                <Calendar size={15} color={date ? BLUE : theme.textMuted} strokeWidth={1.5} />
                <Text style={[mrS.fieldText, { color: date ? theme.textPrimary : theme.textDisabled }]}>
                  {date ? formatRequestDate(date) : 'Select date'}
                </Text>
                <ChevronRight size={14} color={theme.textMuted} strokeWidth={1.5} />
              </TouchableOpacity>
              {showDatePicker && (
                <MatchRequestDatePicker
                  value={date}
                  onChange={(d) => { setDate(d); setShowDatePicker(false); }}
                />
              )}

              {/* Start Time */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Start Time</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={mrS.timeRow}>
                {REQUEST_TIME_SLOTS.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[mrS.timeChip, { borderColor: timeSlot === slot ? BLUE : theme.border, backgroundColor: timeSlot === slot ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => setTimeSlot(slot)}
                    activeOpacity={0.7}>
                    <Text style={[mrS.timeChipText, { color: timeSlot === slot ? BLUE : theme.textSecondary }]}>
                      {formatRequestTime(slot)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Duration */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Duration</Text>
              <View style={mrS.pillRow}>
                {REQUEST_DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[mrS.pill, { borderColor: duration === d ? BLUE : theme.border, backgroundColor: duration === d ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => setDuration(d)}
                    activeOpacity={0.7}>
                    <Text style={[mrS.pillText, { color: duration === d ? BLUE : theme.textSecondary }]}>{d} min</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Court Surface */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Preferred Surface</Text>
              <View style={mrS.pillRow}>
                {REQUEST_COURT_TYPES.map((c) => {
                  const active = courtType === c.value;
                  return (
                    <TouchableOpacity
                      key={c.label}
                      style={[mrS.pill, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                      onPress={() => setCourtType(c.value)}
                      activeOpacity={0.7}>
                      <Text style={[mrS.pillText, { color: active ? BLUE : theme.textSecondary }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Message */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Message (optional)</Text>
              <TextInput
                style={[mrS.msgInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                value={message}
                onChangeText={(t) => { if (t.length <= 300) setMessage(t); }}
                placeholder="Looking for competitive practice. Available evenings."
                placeholderTextColor={theme.textDisabled}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Summary */}
              <View style={[mrS.summary, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
                <Text style={[mrS.summaryTitle, { color: theme.textMuted }]}>SUMMARY</Text>
                {summaryRows.map(([label, val]) => (
                  <View key={label} style={mrS.summaryRow}>
                    <Text style={[mrS.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
                    <Text style={[mrS.summaryValue, { color: theme.textPrimary }]} numberOfLines={1}>{val}</Text>
                  </View>
                ))}
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* CTA */}
            <TouchableOpacity
              style={[mrS.sendBtn, { backgroundColor: canSend ? BLUE : theme.surface2 }]}
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.85}>
              {sending
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={[mrS.sendBtnText, { color: canSend ? '#FFF' : theme.textDisabled }]}>
                    Send Match Request
                  </Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const mrS = StyleSheet.create({
  backdrop:      { flex: 1, justifyContent: 'flex-end' },
  sheet:         { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.pagePx, paddingTop: 12, paddingBottom: 36, maxHeight: '92%' },
  handle:        { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:         { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  sectionLabel:  { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, marginBottom: 10, marginTop: 16 },
  pillRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:          { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  pillText:      { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
  fieldRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 13 },
  fieldText:     { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  timeRow:       { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  timeChip:      { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  timeChipText:  { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, letterSpacing: 0.3 },
  msgInput:      { borderWidth: 1.5, borderRadius: Radius.sm, padding: 14, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, minHeight: 80, textAlignVertical: 'top' },
  summary:       { borderWidth: 1, borderRadius: Radius.sm, padding: 14, marginTop: 20, gap: 8 },
  summaryTitle:  { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, letterSpacing: 1.8, marginBottom: 4 },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
  summaryValue:  { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, flex: 2, textAlign: 'right' },
  sendBtn:       { borderRadius: Radius.button, paddingVertical: 14, alignItems: 'center', marginTop: 12, minHeight: Spacing.tapTarget },
  sendBtnText:   { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  // Inline date picker
  calWrap:       { borderWidth: 1, borderRadius: Radius.sm, padding: 12, marginTop: 8 },
  calHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calMonthLabel: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 15 },
  calDayRow:     { flexDirection: 'row', marginBottom: 4 },
  calDayLabel:   { flex: 1, textAlign: 'center', fontFamily: FontFamily.manropeMedium, fontSize: 11 },
  calWeekRow:    { flexDirection: 'row' },
  calCell:       { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  calDayNum:     { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
});
```

- [ ] **Step 6: Wire MatchRequestSheet into MatchScreen state**

Find the `MatchScreen` component (around line 1806). Add the `requestTarget` state variable alongside the other target states:
```ts
const [requestTarget, setRequestTarget] = useState<RecommendedPlayer | MatchPlayer | null>(null);
```

- [ ] **Step 7: Replace Request button in RecommendedPlayerCard**

`RecommendedPlayerCard` currently calls `sendMatchRequest` directly in `handleRequest`. The card needs an `onRequest` prop instead. Change its props and button handler:

```tsx
function RecommendedPlayerCard({
  player,
  onRequest,    // ← replace currentUserId + direct call
  onMessage,
}: {
  player: RecommendedPlayer;
  onRequest: () => void;  // ← new
  onMessage: (id: string) => void;
}) {
  const { theme }       = useTheme();
  const [sent, setSent] = useState(false);

  function handleRequest() {
    setSent(true);
    onRequest();
  }

  return (
    // ... card body unchanged ...
    <TouchableOpacity
      style={[rcS.btn, { borderColor: sent ? theme.border : GREEN }]}
      onPress={handleRequest}
      disabled={sent}
      activeOpacity={0.8}>
      <Text style={[rcS.btnText, { color: sent ? theme.textDisabled : GREEN }]}>
        {sent ? 'Sent' : 'Request'}
      </Text>
    </TouchableOpacity>
    // ...
  );
}
```

Update `RecommendedPlayersSection` to pass `onRequest` down, and update the call site in `MatchScreen`:

In `RecommendedPlayersSection`:
```tsx
function RecommendedPlayersSection({ players, loading, currentUserId, onRequest }: {
  players: RecommendedPlayer[]; loading: boolean; currentUserId: string;
  onRequest: (player: RecommendedPlayer) => void;  // ← add
}) {
  // ...
  renderItem={({ item }) => (
    <RecommendedPlayerCard
      player={item}
      onRequest={() => onRequest(item)}    // ← pass through
      onMessage={(id) => router.push(`/messages?partner=${id}`)}
    />
  )}
```

In `MatchScreen`'s JSX:
```tsx
<RecommendedPlayersSection
  players={filteredRecommended}
  loading={loading}
  currentUserId={userId}
  onRequest={(player) => setRequestTarget(player)}   // ← add
/>
```

- [ ] **Step 8: Replace Request button in PlayerLookupModal**

Find `PlayerLookupModal` (around line 1677). Replace `handleRequest`:
```tsx
// Before:
async function handleRequest(player: MatchPlayer) {
  setRequested((prev) => new Set([...prev, player.id]));
  await sendMatchRequest(currentUserId, player.id, 'singles');
}

// After:
function handleRequest(player: MatchPlayer) {
  setRequested((prev) => new Set([...prev, player.id]));
  onRequestPlayer(player);
}
```

Add `onRequestPlayer` to `PlayerLookupModal` props:
```tsx
function PlayerLookupModal({ visible, currentUserId, onDismiss, onRequestPlayer }: {
  visible: boolean; currentUserId: string; onDismiss: () => void;
  onRequestPlayer: (player: MatchPlayer) => void;  // ← add
}) {
```

Update the call site in `MatchScreen`:
```tsx
<PlayerLookupModal
  visible={showLookup}
  currentUserId={userId}
  onDismiss={() => setShowLookup(false)}
  onRequestPlayer={(player) => { setShowLookup(false); setRequestTarget(player); }}  // ← add
/>
```

- [ ] **Step 9: Render MatchRequestSheet in MatchScreen**

Add just before `<PlayerLookupModal .../>`:
```tsx
<MatchRequestSheet
  visible={requestTarget != null}
  opponent={requestTarget}
  currentUserId={userId}
  onSend={reload}
  onDismiss={() => setRequestTarget(null)}
/>
```

- [ ] **Step 10: Remove the legacy sendMatchRequest function**

The standalone `sendMatchRequest` function (around line 423) is now unused. Delete it entirely:
```ts
// Delete this entire function:
async function sendMatchRequest(currentUserId: string, opponentId: string, matchType: MatchType) {
  ...
}
```

- [ ] **Step 11: Verify TypeScript**

```bash
npm run lint
```
Expected: no errors. `sendMatchRequest` is no longer referenced anywhere.

- [ ] **Step 12: Commit**

```bash
git add src/app/\(resident\)/match.tsx
git commit -m "feat(match): MatchRequestSheet with scheduling, date/time picker, and availability type"
```

---

## Task 6: Expiry Filter for Incoming Requests

**Files:**
- Modify: `src/app/(resident)/match.tsx`

- [ ] **Step 1: Add expires_at filter to incoming requests query**

Find `useMatchData` (around line 245). In the `supabase.from('match_requests')` query inside `Promise.all`, add the expiry filter after `.eq('status', 'pending')`:
```ts
supabase
  .from('match_requests')
  .select('id, match_type, date, time_start, time_end, location, challenger_id, status')
  .eq('opponent_id', userId)
  .eq('status', 'pending')
  .gt('expires_at', new Date().toISOString())   // ← add this line
  .order('date', { ascending: true }),
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(resident\)/match.tsx
git commit -m "feat(match): filter expired incoming requests (72hr TTL)"
```

---

## Task 7: Reservation Sheet Footer Consolidation

**Files:**
- Modify: `src/app/(resident)/courts.tsx`

- [ ] **Step 1: Replace the selectedSummary View block**

Find the `sheetConfirmArea` block (around line 1183). Replace the existing `selectedSummary` conditional block (lines 1185–1203) with a compact two-line summary:

```tsx
{/* Sticky confirm area — always visible at bottom of sheet */}
<View style={[styles.sheetConfirmArea, { paddingBottom: Math.max(insets.bottom, 24) }]}>
  {selectedSlot && !showCalendar && (
    <View style={styles.slotSummary}>
      <Text style={styles.slotSummaryLine1} numberOfLines={1}>
        {courtName} · {playType === 'singles' ? 'Singles' : 'Doubles'} · {duration} min
      </Text>
      <View style={styles.slotSummaryRow2}>
        <Text style={styles.slotSummaryLine2} numberOfLines={1}>
          {sheetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          {'  ·  '}{formatTime(selectedSlot)}{' – '}{formatTime(getEndTime(selectedSlot, duration))}
        </Text>
        {selectedSlotWx?.icon && selectedSlotWx?.label && (
          <>
            <WeatherIcon type={selectedSlotWx.icon} color={theme.cyanOnLight} size={12} />
            <Text style={styles.slotSummaryWx}>{selectedSlotWx.label}</Text>
          </>
        )}
      </View>
    </View>
  )}
  {!!bookingError && (
    <Text testID="booking-error" style={styles.bookingErrorText}>{bookingError}</Text>
  )}
  <TouchableOpacity testID="confirm-booking-btn"
    style={[styles.confirmBtn, (!selectedSlot || confirming) && styles.confirmBtnDisabled, success && styles.confirmBtnSuccess]}
    onPress={onConfirm} disabled={!selectedSlot || confirming || success} activeOpacity={0.85}>
    {confirming ? <ActivityIndicator color={Colors.white} size="small" /> : (
      <Text style={styles.confirmBtnText}>
        {success ? '✓ Booked!' : selectedSlot ? 'Confirm Reservation' : 'Select a time slot'}
      </Text>
    )}
  </TouchableOpacity>
</View>
```

- [ ] **Step 2: Replace the old selectedSummary styles with new compact styles**

Find `useStyles` (the function that returns `StyleSheet.create({...})`). Find and **delete** these style entries:
- `selectedSummary`
- `selectedSummaryContent`
- `selectedSummaryMain`
- `selectedSummaryTime`
- `selectedSummaryWx`
- `selectedSummaryWxText`

Add these new compact styles in their place (in the same area of the stylesheet, around line 1499):
```ts
slotSummary:    { marginBottom: 6 },
slotSummaryLine1: {
  fontFamily: FontFamily.manropeSemiBold,
  fontSize: 13,
  color: theme.textPrimary,
  marginBottom: 2,
},
slotSummaryRow2: {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 5,
  flexWrap: 'wrap' as const,
},
slotSummaryLine2: {
  fontFamily: FontFamily.manropeMedium,
  fontSize: 12,
  color: theme.textSecondary,
},
slotSummaryWx: {
  fontFamily: FontFamily.jetbrainsMonoSemiBold,
  fontSize: 11,
  color: theme.cyanOnLight,
  letterSpacing: 0.3,
},
```

- [ ] **Step 3: Verify TypeScript**

```bash
npm run lint
```
Expected: no errors. No references to `selectedSummary`, `selectedSummaryContent`, etc. remain.

- [ ] **Step 4: Verify the build compiles**

```bash
npm run dev
```
Open the app (Expo Go or simulator). Navigate to Courts → tap a court → tap Reserve. Select a time slot. Confirm the footer shows compact text (two lines) above the button with no card/box. Selected slot row should remain visible.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(resident\)/courts.tsx
git commit -m "fix(courts): consolidate reservation summary into sticky footer, remove summary card"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| NTRP levels 3.0–5.0 multi-select | Task 4 |
| Chip overflow: first 2 + `+N more` | Task 4, Step 6 |
| Filter logic: includes() exact match | Task 4, Step 4 |
| ResultsContext Any NTRP label | Task 4, Step 7 |
| MatchRequestSheet modal flow | Task 5 |
| All 4 match types | Task 5, Step 5 (REQUEST_MATCH_TYPES) |
| Availability Type field | Task 5, Step 2 + 5 |
| Date picker (inline calendar) | Task 5, Steps 4 + 5 |
| Time picker (30-min chips) | Task 5, Step 2 + 5 |
| Duration 60/90/120 | Task 5, Step 2 + 5 |
| Court surface optional | Task 5, Step 2 + 5 |
| Message optional (max 300) | Task 5, Step 5 |
| Summary section | Task 5, Step 5 |
| CTA disabled until date+time filled | Task 5, Step 5 (`canSend`) |
| Writes to Supabase | Task 5, Step 5 (`handleSend`) |
| Mock-ID guard | Task 5, Step 5 (`startsWith('mock-')`) |
| Circular avatars everywhere | Task 3, Step 3 |
| Practice Session rename | Task 3, Steps 1 + 2 |
| Schema: duration column | Task 1 |
| Schema: message column | Task 1 |
| Schema: availability_type column | Task 1 |
| Schema: expires_at + 72h default | Task 1 |
| types.ts updated | Task 2 |
| Expiry filter on incoming query | Task 6 |
| Reservation summary card removed | Task 7 |
| Compact two-line footer | Task 7 |
| No TypeScript errors | Each task's lint step |

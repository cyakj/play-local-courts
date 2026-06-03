# Button Geometry Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all pill-shaped (borderRadius: 999) interactive filter/selector chips across the resident app with the TenisX reference geometry (borderRadius 12–14px, height 40–44px) so the shape vocabulary is consistent with the "Play Now" primary button.

**Architecture:** Add a single `chip` radius token to `design.ts`, then apply it to every date chip, duration chip, play-type selector, segmented control, amenity filter, and report filter chip in the resident screens. The More Dates UX in the booking and schedule sheets is simultaneously reworked from a horizontal expansion into a vertical dropdown to avoid row overflow and give a cleaner mobile feel.

**Tech Stack:** React Native + TypeScript, Expo SDK 56, `src/constants/design.ts` token system, inline StyleSheet on each screen.

---

## File Map

| File | Change |
|------|--------|
| `src/constants/design.ts` | Add `chip: 12` to `Radius` |
| `src/app/(resident)/courts.tsx` | Date chips, play-type chips, duration chips → `Radius.chip`; More Dates → vertical dropdown |
| `src/app/(resident)/book.tsx` | Amenity filter pills → `Radius.chip` |
| `src/app/(resident)/calendar.tsx` | Community filter chips, view-toggle → `Radius.chip` |
| `src/app/my-reports.tsx` | Report filter chips → `Radius.chip` |
| `src/app/settings.tsx` | Segmented control container + segment → `Radius.chip` |

**Not changing:** status/badge pills (small inline indicators using `Radius.pill`), bottom navigation, FABs, icon-only circle controls.

---

## Task 1: Add `chip` design token

**Files:**
- Modify: `src/constants/design.ts` (line ~97–107)

- [ ] **Step 1: Add the `chip` token**

In `src/constants/design.ts`, change the `Radius` object to add `chip: 12` between `button` and `pill`:

```typescript
export const Radius = {
  xs:     6,    // --r-xs · small tags
  sm:     10,   // --r-sm · inputs, buttons
  card:   14,   // --r-md · default card radius (was 16)
  lg:     20,   // --r-lg · large cards, sheets
  xl:     28,   // --r-xl · bottom sheet top corners
  modal:  20,
  button: 10,   // --r-sm (was 12)
  chip:   12,   // --r-chip · interactive filter chips, date/duration/segmented controls
  pill:   999,  // --r-pill · status badges only (NOT for interactive chips)
  input:  10,
} as const;
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/constants/design.ts
git commit -m "feat(design): add Radius.chip=12 token for interactive filter chips"
```

---

## Task 2: courts.tsx — chip geometry (date / play-type / duration)

**Files:**
- Modify: `src/app/(resident)/courts.tsx` (styles section, ~line 1181–1205)

This task only changes `borderRadius` and chip heights. The More Dates UX refactor is Task 3.

- [ ] **Step 1: Update `sheetDateChip` — pill → chip**

Find:
```typescript
sheetDateChip: { height: 40, alignSelf: 'center', paddingHorizontal: 12, borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
```

Replace with:
```typescript
sheetDateChip: { height: 40, alignSelf: 'center', paddingHorizontal: 16, borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
```

- [ ] **Step 2: Update `playTypeChip` — pill → chip, height 36 → 40**

Find:
```typescript
playTypeChip: { height: 36, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
```

Replace with:
```typescript
playTypeChip: { height: 40, paddingHorizontal: 16, borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
```

- [ ] **Step 3: Update `durationChip` — pill → chip, height 36 → 40**

Find:
```typescript
durationChip: { height: 36, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
```

Replace with:
```typescript
durationChip: { height: 40, paddingHorizontal: 16, borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
```

- [ ] **Step 4: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```
git add src/app/(resident)/courts.tsx
git commit -m "feat(courts): standardize date/play/duration chip geometry to Radius.chip=12"
```

---

## Task 3: courts.tsx — More Dates dropdown (BookingSheet)

**Files:**
- Modify: `src/app/(resident)/courts.tsx`

Currently `showMoreDates` expands extra date chips horizontally into the same ScrollView row. Replace with a vertical dropdown that appears below the date row.

- [ ] **Step 1: Rename state variable and update setter**

In `BookingSheet` component (around line 738), find:
```typescript
const [showMoreDates, setShowMoreDates] = useState(false);
```
Replace with:
```typescript
const [showDateDropdown, setShowDateDropdown] = useState(false);
```

- [ ] **Step 2: Rewrite the date-row JSX in BookingSheet**

Find the entire `{/* Date: Today · Tomorrow · More Dates ▼ */}` block (lines ~792–831):

```jsx
{/* Date: Today · Tomorrow · More Dates ▼ */}
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetDateScroll} contentContainerStyle={styles.sheetDateContent} testID="sheet-date-scroll">
  {primaryDates.map((date, i) =>
    renderDateChip(date, i === 0 ? 'sheet-date-today' : 'sheet-date-1')
  )}

  {moreDates.length > 0 && !showMoreDates && (
    selectedMoreDate
      ? renderDateChip(selectedMoreDate, 'sheet-date-selected-more')
      : (
        <TouchableOpacity
          testID="sheet-date-more"
          style={styles.sheetDateChip}
          onPress={() => setShowMoreDates(true)}
          activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.sheetDateChipText}>More Dates</Text>
            <ChevronDown color={Colors.fg3} size={12} strokeWidth={1.5} />
          </View>
        </TouchableOpacity>
      )
  )}

  {showMoreDates && moreDates.map((date, i) =>
    renderDateChip(date, `sheet-date-${i + 2}`)
  )}

  {showMoreDates && (
    <TouchableOpacity
      testID="sheet-date-less"
      style={styles.sheetDateChip}
      onPress={() => setShowMoreDates(false)}
      activeOpacity={0.7}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={styles.sheetDateChipText}>Less</Text>
        <ChevronUp color={Colors.fg3} size={12} strokeWidth={1.5} />
      </View>
    </TouchableOpacity>
  )}
</ScrollView>
```

Replace with:

```jsx
{/* Date: Today · Tomorrow · More Dates ▼ (dropdown) */}
<View style={styles.dateRowContainer}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetDateScroll} contentContainerStyle={styles.sheetDateContent} testID="sheet-date-scroll">
    {primaryDates.map((date, i) =>
      renderDateChip(date, i === 0 ? 'sheet-date-today' : 'sheet-date-1')
    )}
    {moreDates.length > 0 && (
      <TouchableOpacity
        testID="sheet-date-more"
        style={[styles.sheetDateChip, selectedMoreDate ? styles.sheetDateChipActive : undefined]}
        onPress={() => setShowDateDropdown(v => !v)}
        activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.sheetDateChipText, selectedMoreDate ? styles.sheetDateChipTextActive : undefined]}>
            {selectedMoreDate ? formatDateLabel(selectedMoreDate, now) : 'More Dates'}
          </Text>
          <ChevronDown color={selectedMoreDate ? Colors.white : Colors.fg3} size={12} strokeWidth={1.5} />
        </View>
      </TouchableOpacity>
    )}
  </ScrollView>
  {showDateDropdown && moreDates.length > 0 && (
    <View style={styles.dateDropdown} testID="sheet-date-dropdown">
      {moreDates.map((date, i) => {
        const isSelected = date.toDateString() === sheetDate.toDateString();
        return (
          <TouchableOpacity
            key={i}
            testID={`sheet-date-${i + 2}`}
            style={[styles.dateDropdownItem, i < moreDates.length - 1 && styles.dateDropdownItemBorder, isSelected && styles.dateDropdownItemActive]}
            onPress={() => { onDateChange(date); setShowDateDropdown(false); }}
            activeOpacity={0.7}>
            <Text style={[styles.dateDropdownItemText, isSelected && styles.dateDropdownItemTextActive]}>
              {formatDateLabel(date, now)}
            </Text>
            {isSelected && <Check color={Colors.blue} size={14} strokeWidth={2} />}
          </TouchableOpacity>
        );
      })}
    </View>
  )}
</View>
```

- [ ] **Step 3: Remove the `ChevronUp` import if no longer used elsewhere**

Check if `ChevronUp` is used anywhere else in courts.tsx:

```
grep -n "ChevronUp" src/app/(resident)/courts.tsx
```

If used only in the old More Dates section, remove it from the import at the top:

Find:
```typescript
import {
  MapPin, Clock, Sun, Cloud, CloudRain, Zap, X, ChevronRight,
  CalendarDays, Check, ChevronDown, ChevronUp,
} from 'lucide-react-native';
```

Replace with:
```typescript
import {
  MapPin, Clock, Sun, Cloud, CloudRain, Zap, X, ChevronRight,
  CalendarDays, Check, ChevronDown,
} from 'lucide-react-native';
```

(Only remove `ChevronUp` if the grep confirms it's not used elsewhere in the file.)

- [ ] **Step 4: Add dropdown styles to the StyleSheet**

At the end of the styles object (before the closing `})`), add these styles alongside the existing `sheetDateScroll`/`sheetDateContent` definitions:

```typescript
dateRowContainer: { marginBottom: 8 },
dateDropdown: {
  backgroundColor: theme.surface,
  borderRadius: Radius.chip,
  borderWidth: 1,
  borderColor: theme.border,
  marginTop: 4,
  overflow: 'hidden',
},
dateDropdownItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingVertical: 12,
},
dateDropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: theme.border },
dateDropdownItemActive: { backgroundColor: 'rgba(45,107,255,0.10)' },
dateDropdownItemText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: theme.textSecondary },
dateDropdownItemTextActive: { color: Colors.blue },
```

Also remove `marginBottom: 8` from `sheetDateScroll` since it's now handled by `dateRowContainer`:

Find:
```typescript
sheetDateScroll: { minHeight: 50, marginBottom: 8 },
```
Replace with:
```typescript
sheetDateScroll: { minHeight: 50 },
```

- [ ] **Step 5: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors. Fix any issues (e.g. type mismatch on `setShowDateDropdown`).

- [ ] **Step 6: Commit**

```
git add src/app/(resident)/courts.tsx
git commit -m "feat(courts): More Dates → vertical dropdown in BookingSheet"
```

---

## Task 4: courts.tsx — More Dates dropdown (ScheduleSheet)

**Files:**
- Modify: `src/app/(resident)/courts.tsx` (ScheduleSheet component, ~line 942–1060)

- [ ] **Step 1: Rename state variable in ScheduleSheet**

Find:
```typescript
const [showMoreSchedDates, setShowMoreSchedDates] = useState(false);
```
Replace with:
```typescript
const [showSchedDateDropdown, setShowSchedDateDropdown] = useState(false);
```

- [ ] **Step 2: Rewrite the ScheduleSheet date-row JSX**

Find the entire schedule date picker block (from `{/* Date picker — same window as booking */}` through the closing `</ScrollView>`, lines ~987–1063):

```jsx
{/* Date picker — same window as booking */}
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetDateScroll} contentContainerStyle={styles.sheetDateContent} testID="schedule-date-scroll">
  {primarySchedDates.map((date, i) => {
    const isSelected = date.toDateString() === scheduleDate.toDateString();
    return (
      <TouchableOpacity
        key={i === 0 ? 'sched-today' : 'sched-1'}
        testID={i === 0 ? 'sched-date-today' : 'sched-date-1'}
        style={[styles.sheetDateChip, isSelected && styles.sheetDateChipActive]}
        onPress={() => { onDateChange(date); setShowMoreSchedDates(false); }}
        activeOpacity={0.7}>
        <Text style={[styles.sheetDateChipText, isSelected && styles.sheetDateChipTextActive]}>
          {formatDateLabel(date, now)}
        </Text>
      </TouchableOpacity>
    );
  })}
  {moreSchedDates.length > 0 && !showMoreSchedDates && (
    selectedMoreSchedDate ? (
      <TouchableOpacity
        key="sched-selected-more"
        testID="sched-date-selected-more"
        style={[styles.sheetDateChip, styles.sheetDateChipActive]}
        onPress={() => setShowMoreSchedDates(true)}
        activeOpacity={0.7}>
        <Text style={[styles.sheetDateChipText, styles.sheetDateChipTextActive]}>
          {formatDateLabel(selectedMoreSchedDate, now)}
        </Text>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity
        testID="sched-date-more"
        style={styles.sheetDateChip}
        onPress={() => setShowMoreSchedDates(true)}
        activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.sheetDateChipText}>More Dates</Text>
          <ChevronDown color={Colors.fg3} size={12} strokeWidth={1.5} />
        </View>
      </TouchableOpacity>
    )
  )}
  {showMoreSchedDates && moreSchedDates.map((date, i) => {
    const isSelected = date.toDateString() === scheduleDate.toDateString();
    return (
      <TouchableOpacity
        key={`sched-more-${i}`}
        testID={`sched-date-${i + 2}`}
        style={[styles.sheetDateChip, isSelected && styles.sheetDateChipActive]}
        onPress={() => { onDateChange(date); setShowMoreSchedDates(false); }}
        activeOpacity={0.7}>
        <Text style={[styles.sheetDateChipText, isSelected && styles.sheetDateChipTextActive]}>
          {formatDateLabel(date, now)}
        </Text>
      </TouchableOpacity>
    );
  })}
  {showMoreSchedDates && (
    <TouchableOpacity
      testID="sched-date-less"
      style={styles.sheetDateChip}
      onPress={() => setShowMoreSchedDates(false)}
      activeOpacity={0.7}>
```

Replace the entire block with:

```jsx
{/* Date picker — same window as booking */}
<View style={styles.dateRowContainer}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetDateScroll} contentContainerStyle={styles.sheetDateContent} testID="schedule-date-scroll">
    {primarySchedDates.map((date, i) => {
      const isSelected = date.toDateString() === scheduleDate.toDateString();
      return (
        <TouchableOpacity
          key={i === 0 ? 'sched-today' : 'sched-1'}
          testID={i === 0 ? 'sched-date-today' : 'sched-date-1'}
          style={[styles.sheetDateChip, isSelected && styles.sheetDateChipActive]}
          onPress={() => { onDateChange(date); setShowSchedDateDropdown(false); }}
          activeOpacity={0.7}>
          <Text style={[styles.sheetDateChipText, isSelected && styles.sheetDateChipTextActive]}>
            {formatDateLabel(date, now)}
          </Text>
        </TouchableOpacity>
      );
    })}
    {moreSchedDates.length > 0 && (
      <TouchableOpacity
        testID="sched-date-more"
        style={[styles.sheetDateChip, selectedMoreSchedDate ? styles.sheetDateChipActive : undefined]}
        onPress={() => setShowSchedDateDropdown(v => !v)}
        activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.sheetDateChipText, selectedMoreSchedDate ? styles.sheetDateChipTextActive : undefined]}>
            {selectedMoreSchedDate ? formatDateLabel(selectedMoreSchedDate, now) : 'More Dates'}
          </Text>
          <ChevronDown color={selectedMoreSchedDate ? Colors.white : Colors.fg3} size={12} strokeWidth={1.5} />
        </View>
      </TouchableOpacity>
    )}
  </ScrollView>
  {showSchedDateDropdown && moreSchedDates.length > 0 && (
    <View style={styles.dateDropdown} testID="sched-date-dropdown">
      {moreSchedDates.map((date, i) => {
        const isSelected = date.toDateString() === scheduleDate.toDateString();
        return (
          <TouchableOpacity
            key={i}
            testID={`sched-date-${i + 2}`}
            style={[styles.dateDropdownItem, i < moreSchedDates.length - 1 && styles.dateDropdownItemBorder, isSelected && styles.dateDropdownItemActive]}
            onPress={() => { onDateChange(date); setShowSchedDateDropdown(false); }}
            activeOpacity={0.7}>
            <Text style={[styles.dateDropdownItemText, isSelected && styles.dateDropdownItemTextActive]}>
              {formatDateLabel(date, now)}
            </Text>
            {isSelected && <Check color={Colors.blue} size={14} strokeWidth={2} />}
          </TouchableOpacity>
        );
      })}
    </View>
  )}
</View>
```

Note: also remove the stale `{showMoreSchedDates && (…Less…)}` `TouchableOpacity` block that follows the old `showMoreSchedDates` expansion — it should be deleted entirely since the dropdown toggle replaces it.

- [ ] **Step 3: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/app/(resident)/courts.tsx
git commit -m "feat(courts): More Dates → vertical dropdown in ScheduleSheet"
```

---

## Task 5: book.tsx — amenity filter pills

**Files:**
- Modify: `src/app/(resident)/book.tsx` (~line 481–502)

- [ ] **Step 1: Update filterPill borderRadius**

Find:
```typescript
filterPill: {
  paddingHorizontal: 18,
  paddingVertical: 10,
  borderRadius: Radius.pill,
  borderWidth: 1.5,
  borderColor: '#E5E7EB',
  backgroundColor: Colors.white,
  minHeight: 40,
  justifyContent: 'center',
},
```

Replace with:
```typescript
filterPill: {
  paddingHorizontal: 18,
  paddingVertical: 10,
  borderRadius: Radius.chip,
  borderWidth: 1.5,
  borderColor: '#E5E7EB',
  backgroundColor: Colors.white,
  minHeight: 40,
  justifyContent: 'center',
},
```

Also find and update the `openBadge` style that uses `Radius.pill` (~line 558–562):

```typescript
// Find:
borderRadius: Radius.pill,
// In the openBadge style context — this is a status badge, NOT a filter chip.
// Do NOT change this one — status badges keep Radius.pill.
```

(Confirm that `openBadge` is a status indicator, not a filter chip — leave it as `Radius.pill`.)

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/app/(resident)/book.tsx
git commit -m "feat(book): amenity filter pills → Radius.chip geometry"
```

---

## Task 6: calendar.tsx — community chips + view toggle

**Files:**
- Modify: `src/app/(resident)/calendar.tsx` (~line 554–587)

- [ ] **Step 1: Update `commChip` borderRadius**

Find:
```typescript
commChip: {
  borderRadius: Radius.pill,
  borderWidth: 1,
  borderColor: Colors.border,
  paddingHorizontal: 16,
  paddingVertical: 10,
  backgroundColor: Colors.cardBg,
  minHeight: 44,
  alignItems: 'center',
  justifyContent: 'center',
},
```

Replace with:
```typescript
commChip: {
  borderRadius: Radius.chip,
  borderWidth: 1,
  borderColor: Colors.border,
  paddingHorizontal: 16,
  paddingVertical: 10,
  backgroundColor: Colors.cardBg,
  minHeight: 44,
  alignItems: 'center',
  justifyContent: 'center',
},
```

- [ ] **Step 2: Update `viewToggle` borderRadius**

Find:
```typescript
viewToggle: {
  flexDirection: 'row',
  borderRadius: 99,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: Colors.border,
  flexShrink: 0,
},
```

Replace with:
```typescript
viewToggle: {
  flexDirection: 'row',
  borderRadius: 14,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: Colors.border,
  flexShrink: 0,
},
```

- [ ] **Step 3: Update `typeChip` borderRadius**

Find:
```typescript
typeChip: {
  borderRadius: Radius.pill,
  borderWidth: 1,
```

Replace with:
```typescript
typeChip: {
  borderRadius: Radius.chip,
  borderWidth: 1,
```

- [ ] **Step 4: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```
git add src/app/(resident)/calendar.tsx
git commit -m "feat(calendar): community chips + view toggle → Radius.chip geometry"
```

---

## Task 7: my-reports.tsx — report filter chips

**Files:**
- Modify: `src/app/my-reports.tsx` (~line 377–394)

- [ ] **Step 1: Update `chip` borderRadius**

Find:
```typescript
chip: {
  borderRadius: Radius.pill,
  borderWidth: 1,
```

Replace with:
```typescript
chip: {
  borderRadius: Radius.chip,
  borderWidth: 1,
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/app/my-reports.tsx
git commit -m "feat(my-reports): filter chips → Radius.chip geometry"
```

---

## Task 8: settings.tsx — segmented control

**Files:**
- Modify: `src/app/settings.tsx` (~line 351–375)

- [ ] **Step 1: Update `segmentedControl` and `segment` borderRadius**

Find:
```typescript
segmentedControl: {
  flexDirection: 'row',
  borderRadius: Radius.pill,
  padding: 3,
  marginTop: 12,
  marginBottom: 4,
},
segment: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 40,
  borderRadius: Radius.pill,
},
```

Replace with:
```typescript
segmentedControl: {
  flexDirection: 'row',
  borderRadius: 14,
  padding: 3,
  marginTop: 12,
  marginBottom: 4,
},
segment: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 40,
  borderRadius: 11,
},
```

(Container uses 14, inner segments use 11 so the padding gap creates the correct inset look.)

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/app/settings.tsx
git commit -m "feat(settings): segmented control → 14/11px geometry replacing pill"
```

---

## Task 9: Visual verification

- [ ] **Step 1: Run the dev server**

```
npm run dev
```

- [ ] **Step 2: Verify on each screen**

Open in Expo Go / simulator and confirm:

| Screen | What to check |
|--------|--------------|
| Courts → Booking sheet | Today/Tomorrow chips are rounded-rect not capsule; More Dates shows dropdown below; Singles/Doubles and duration chips match |
| Courts → Schedule sheet | Same date chip geometry; More Dates dropdown works |
| Book screen | Filter pills (All / Tennis / etc.) are rounded-rect |
| Calendar | Community chips and view toggle are rounded-rect |
| My Reports | Active / All / Resolved filter chips are rounded-rect |
| Settings | Segmented control (Resident / HOA / etc.) is rounded-rect |

- [ ] **Step 3: Final TypeScript pass**

```
npx tsc --noEmit
```

Expected: zero errors.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Date chips — Task 2+3+4 (`courts.tsx`)
- [x] Duration chips — Task 2 (`courts.tsx`)
- [x] Singles/Doubles selector — Task 2 (`courts.tsx`)
- [x] Segmented controls — Task 8 (`settings.tsx`)
- [x] Amenity filters — Task 5 (`book.tsx`)
- [x] Booking controls — covered by Tasks 2–4
- [x] Reservation filters — `my-reservations.tsx` has no chip-style filters; StatusPill is a status indicator (exempted)
- [x] Settings selectors — Task 8
- [x] Report category chips — the `categoryTile` grid in `report.tsx` is already rectangular (non-pill), no change needed; the `chip` in `my-reports.tsx` is covered by Task 7
- [x] Secondary action buttons — covered by filter pill updates
- [x] More Dates UX → vertical dropdown — Tasks 3 + 4
- [x] Bottom nav / FABs / icon circles — explicitly NOT changed
- [x] `Radius.chip` added before any file references it — Task 1 is first
- [x] Type names consistent across all tasks — only `Radius.chip` added; all other types unchanged

# Availability Grid Interaction Fixes — Design Spec

**Date:** 2026-06-09  
**File:** `src/components/coach/CoachAvailabilityGridEditor.tsx`  
**Scope:** Coach availability editor UX overhaul — local draft state, bottom-sheet cell editing, full color conversion support, F/T/E cell labels.

---

## Problem Summary

The current `CoachAvailabilityGridEditor` has these concrete bugs:

| Problem | Root cause |
|---|---|
| No Cancel Changes button | Never added |
| Save button hidden unless dirty — not visible at bottom | `isDirty` guard hides it entirely |
| Empty cell tap → sets coachDefault immediately | No add-slot bottom sheet |
| Filled cell tap → `ActionSheetIOS` / `Alert.alert` | No cross-platform modal bottom sheet |
| Yellow Traveling cannot convert to Facility or Either | Nested `TouchableOpacity` (row + cell) causes unreliable tap propagation |
| No F / T / E label on cells | Never implemented |

---

## Architecture

All changes are contained in two files:

- **`CoachAvailabilityGridEditor.tsx`** — rewritten (same public API)
- **`CoachAvailabilityGrid.tsx`** — small addition: render optional text label inside interactive cells

No new files. No changes to `useCoachAvailability.ts`, `schedule.tsx`, or any other consumers.

---

## 1. Draft State

Already exists. Keep as-is:
- `DraftMap = Map<string, CellMode>` keyed by `"dow|hourStart"`
- `buildInitialDraft()` from `weeklySlots`
- `isDirty` derived by comparing draft to saved

Add: `savedSlots` ref — a snapshot of `weeklySlots` at last save, used for Cancel restore.

---

## 2. Save / Cancel Button Bar

Rendered at **both top and bottom** of the editor.

```
[ WEEKLY AVAILABILITY ]      [ Cancel Changes ]  [ Save Changes ]
...grid...
                             [ Cancel Changes ]  [ Save Changes ]
```

- **Save Changes**: disabled + 50% opacity when `!isDirty`, loading state while saving, toast "Availability saved" on success.
- **Cancel Changes**: disabled + 50% opacity when `!isDirty`. On press, shows `Alert.alert` confirmation: "Discard unsaved availability changes?" with Discard / Keep Editing actions. Discard restores draft from `buildInitialDraft()`.
- Unsaved-changes dot indicator next to section title when `isDirty`.

---

## 3. Cell Tap — Bottom Sheet

Replace all `ActionSheetIOS` and `Alert.alert` cell-edit flows with a single cross-platform **Modal bottom sheet** (same pattern as `CoachAvailabilityEditor.tsx`).

Sheet state:
```ts
type SheetMode = 'add' | 'edit' | null;
interface SheetTarget { dow: number; hour: TimeHour }
```

### 3a. Empty cell tapped → Add sheet

Title: **Add Availability**  
Shows: Day name, time label  
Options (radio): Facility | Traveling | Either  
Buttons: Add | Cancel  
On Add: sets cell in draft, closes sheet, Save Changes activates.

### 3b. Filled cell tapped → Edit sheet

Title: **Edit Time Slot**  
Shows: Day name, time label, current type badge  
Options (radio): Facility | Traveling | Either | Remove Availability  
Buttons: Save | Cancel  
On Save: applies change locally, closes sheet.  
On "Remove Availability": deletes key from draft map.

---

## 4. All Mode Conversions

Every combination must work:

| From | To | Mechanism |
|---|---|---|
| coach_facility | traveling | edit sheet → select Traveling → Save |
| coach_facility | both | edit sheet → select Either → Save |
| coach_facility | empty | edit sheet → Remove Availability |
| traveling | coach_facility | edit sheet → select Facility → Save |
| traveling | both | edit sheet → select Either → Save |
| traveling | empty | edit sheet → Remove Availability |
| both | coach_facility | edit sheet → select Facility → Save |
| both | traveling | edit sheet → select Traveling → Save |
| both | empty | edit sheet → Remove Availability |

The nested-TouchableOpacity issue in `CoachAvailabilityGrid` is fixed by wrapping each row `TouchableOpacity` with `pointerEvents="box-none"` when `isCellInteractive` is true so row-level taps don't compete.

---

## 5. Cell Labels (F / T / E)

When `isCellInteractive` is true, each colored cell renders a tiny text label:

- `coach_facility` → `F` (blue, 8px JetBrains Mono)
- `traveling` → `T` (volt, 8px JetBrains Mono)
- `both` → `E` (cyan, 8px JetBrains Mono)

Empty cells show no label (remain visually quiet).

---

## 6. One-by-One Removal

Each cell press opens its own sheet for exactly that (dow, hour) key. Map deletion removes only that key. Adjacent cells are unaffected.

---

## 7. Save Persistence

Unchanged from current implementation:
- Deletes DB rows for keys removed from draft
- Upserts rows for all keys present in draft
- Calls `onRefresh()` on success

---

## 8. QA Checklist

- [ ] Save Changes appears at top and bottom
- [ ] Cancel Changes appears at top and bottom
- [ ] Save disabled when no changes
- [ ] Cancel disabled when no changes
- [ ] Adding one empty slot works (Add sheet)
- [ ] Removing one slot works (Edit sheet → Remove)
- [ ] Traveling → Facility conversion works
- [ ] Traveling → Either conversion works
- [ ] Traveling → Remove works
- [ ] Facility → Traveling works
- [ ] Facility → Either works
- [ ] Either → Facility works
- [ ] Either → Traveling works
- [ ] One slot removed without affecting adjacent slots
- [ ] Unsaved changes not persisted until Save Changes
- [ ] Cancel shows confirmation, then restores previous state
- [ ] Toast shown after successful save
- [ ] F / T / E labels visible on colored cells

# Theme Modernization Progress

Converting all screens from static `Colors.*` to `useStyles(theme)` + `useTheme()` pattern.

## Pattern Reference

```tsx
import { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

export default function MyScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  // ...
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    // ...
  }), [theme]);
}
```

### Key token mappings
| Old | New |
|-----|-----|
| `Colors.pageBg` | `theme.pageBg` |
| `Colors.cardBg` | `theme.cardBg` |
| `Colors.border` | `theme.border` |
| `Colors.textPrimary` | `theme.textPrimary` |
| `Colors.textMuted` / `Colors.fg3` | `theme.textMuted` |
| `Colors.textSubtle` | `theme.textSecondary` |
| `Colors.navy` (header bg) | keep as `Colors.navy` (brand constant) |
| `Colors.headerBg` | use `Header variant="inner"` instead |
| `Shadow` import | `...theme.shadowCard` |
| Raw arrow-left header | `Header variant="inner"` component |
| `FontFamily.interSemiBold` | `FontFamily.manropeSemiBold` |
| `FontFamily.interRegular` | `FontFamily.manropeMedium` |

### Status pill colors (dark-correct)
- open / in_progress → `bg: rgba(255,92,107,0.15)`, `color: Colors.negative`
- resolved / completed → `bg: rgba(45,224,255,0.12)`, `color: Colors.accentCyan`
- default → `bg: rgba(154,163,184,0.12)`, `color: theme.textMuted`

### Light-mode notice boxes (dark-correct)
- Info box: `bg: rgba(45,107,255,0.10)`, border: `rgba(45,107,255,0.30)`, text: `Colors.blue`

---

## Screen Status

| # | Screen | Status |
|---|--------|--------|
| ✅ | `announcements.tsx` | Done (prev session) |
| ✅ | `survey-results/[id].tsx` | Done (prev session) |
| ✅ | `notifications.tsx` | Done this session |
| ✅ | `my-reservations.tsx` | Done this session |
| ✅ | `my-reports.tsx` | Done this session |
| ✅ | `messages.tsx` | Done this session |
| ✅ | `hoa-application.tsx` | Done this session |
| ✅ | `(admin)/pending-requests.tsx` | Done this session |
| ✅ | `(admin)/manage-courts.tsx` | Done this session |
| ✅ | `(admin)/manage-amenities.tsx` | Done this session |
| ✅ | `amenity-book.tsx` | Done this session |
| ✅ | `(resident)/me.tsx` | Done this session |
| ✅ | `(resident)/coaches.tsx` | Done this session |

---

## Notes on hoa-application.tsx (next up)

Still uses old pattern. Key things to fix:
- Replace raw header with `Header variant="inner"`
- Status badge colors: approved→cyan, rejected/needsMoreInfo→use `Colors.negative` tints
- `Colors.optimalBg` = `rgba(47,217,139,0.15)` → dark cyan-green tint, use as-is
- `Colors.criticalBg` = `rgba(255,92,107,0.12)` → dark red tint, use as-is
- `Colors.red` — not in design.ts, likely `Colors.negative` (#FF5C6B), use that
- Light blue info box (`#EFF6FF` bg, `#1E40AF` text) → dark: `rgba(45,107,255,0.10)` bg + `Colors.blue` text
- `Colors.textSubtle` = `#9AA3B8` → `theme.textSecondary`
- `Colors.textPlaceholder` = `#5A6379` → `theme.textMuted`
- `Radius.input`, `Radius.pill` — check design.ts (likely defined)
- Building2 icon uses `Colors.navy` — change to `theme.textSecondary`
- `Colors.navy` for `rolePillActive` bg — keep (dark branded pill)
- `Shadow` → `...theme.shadowCard`

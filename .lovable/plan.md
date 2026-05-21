# Fix: remove the oversized gap on Condo Manager reports

## Problem
The extra space is coming from two stacked navy sections:

1. The global sticky header is now very tall because the TenisX logo is set to `80px` height.
2. The reports page then renders its own full navy title block directly underneath it.

So the gap is not just padding on the reports page — it is the combined height of both header layers.

## Fix
Compress the top area by making the reports screen title row much tighter and reducing duplicate vertical structure.

1. Keep the global app header as the only persistent top bar.
2. Refactor `src/pages/MaintenanceReports.tsx` so its local section starts immediately under the global header with minimal top spacing.
3. Shrink the reports page’s internal header row (back button, title, subtitle, counters) so it behaves like a compact subheader instead of a second large hero block.
4. Remove any remaining margin/padding between that subheader and the filter chips.

## Technical details
- Target files:
  - `src/pages/MaintenanceReports.tsx`
  - possibly `src/components/layouts/GlobalAppHeader.tsx` only if the logo/header height still dominates after the page compaction
- Goal on mobile: the title should sit much closer to the TenisX bar, like a dense stacked header rather than two separate sections.

## Result
- The top of `/cm/reports` will feel substantially tighter.
- The title, stats, and filters will move noticeably upward.
- The screen will keep the same functionality, just without the oversized empty area.

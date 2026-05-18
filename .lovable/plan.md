# Fix: Messages tab kicks Condo Manager into resident view

## Problem
The CM bottom nav "Messages" tab currently links to `/messages`. That route is registered under `MainLayout` (the resident layout), so tapping it loads the resident chrome (header, bottom nav, theme) — making it feel like the app dropped you into the resident experience.

## Fix
Give Condo Managers their own messaging route that stays inside the CM layout, reusing the existing Messages page content.

1. In `src/App.tsx`, add a new route inside the `CondoManagerLayout` block:
   - `/cm/messages` → renders the existing `Messages` page component.
2. In `src/components/layouts/CondoManagerBottomNav.tsx`, change the Messages tab `path` from `/messages` to `/cm/messages`.

No changes to the Messages page itself — it doesn't render its own layout chrome, so it adopts whichever parent layout wraps it (resident under MainLayout, CM under CondoManagerLayout).

## Result
- Residents: `/messages` still works exactly as today.
- Condo Managers: tapping Messages stays at `/cm/messages` with the CM header and CM bottom nav.

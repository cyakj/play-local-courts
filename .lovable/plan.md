

## Problem

The admin's **Manage Competition** screen (for "Sea Champs") is using the old `LadderTeams` component which shows an **"Add Team"** button for admins to manually add players. This is wrong for the intended flow where **players sign up themselves** via the player view, and admins only **review/approve registrations**.

The current admin Players tab should NOT have an "Add Team" button. Instead it should:
- Show registered players/teams in a read-only list
- Allow admins to **remove** players if needed
- Direct player registration through the **player-facing Sign Up flow** (which already exists in `CompetitionDetailPlayer` + `LadderJoinDialog`)

## Plan

### 1. Replace `LadderTeams` usage in `ManageCompetition.tsx`

Replace the `LadderTeams` component in the admin's Players tab with a **custom inline players list** that:
- Shows all registered teams/players with their name, rating, and record
- Provides a **Remove** button for each player (admin capability)
- Does NOT have an "Add Team" button (players self-register)
- Shows an empty state: "No players registered yet. Players can join from the Browse view."

### 2. Ensure the Requests tab is always visible for admin

Currently the Requests tab only shows when `auto_approve_registration` is false. It should always be visible so admins can see registration activity. When auto-approve is on, show a note that registrations are auto-approved.

### 3. No changes to player flow

The player signup flow (`CompetitionDetailPlayer` → `LadderJoinDialog`) is already correct and separate from the admin view.

### Technical Details

- **File modified**: `src/components/compete/ManageCompetition.tsx`
  - Remove import of `LadderTeams`
  - Build inline players list with remove capability in the Players tab
  - Always show Requests tab (remove conditional)
  - Fetch player profile names for display


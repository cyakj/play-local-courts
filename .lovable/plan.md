

## Issues and Fixes

### 1. "View Ladder Details" navigates to wrong place
Currently navigates to `/leagues-ladders` (the list). Should navigate directly to the competition detail page with the Rules tab selected.

**Fix**: Change `LadderInvitationMessage.viewLadder()` to use a query param or state, e.g., `navigate('/leagues-ladders', { state: { openCompetitionId: invitationData.ladder_id, defaultTab: 'rules' } })`. Then in the Compete player view, check for this navigation state to auto-open the correct competition detail with the Rules tab.

### 2. "Registered Players (1)" but shows "No players registered yet"
The count (`totalPlayerCount`) includes pending registration requests, but the player list only renders from `teams` array. When a player accepted an invite and a team was created, they appear in `teams`. But if only a registration request exists (no team yet), the count increments but nothing renders.

**Fix**: Also fetch profiles for pending registration requests and display them alongside teams in the Players tab. Sort all displayed players by NTRP descending (highest first).

### 3. Invitation message still shows Accept/Decline after already accepted
`LadderInvitationMessage` initializes `status` as `'pending'` every render. It never checks the actual DB status of the invitation.

**Fix**: On mount, query `ladder_invitations` for the current invitation status. If already `accepted` or `declined`, initialize `status` accordingly so it renders the post-action card instead of the action buttons.

### 4. Player cards sorted by NTRP
Display individual player cards (avatar, name, community, NTRP badge) sorted highest NTRP first, matching the reference screenshot style.


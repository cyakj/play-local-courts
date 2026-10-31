# Resident privacy controls - recommendations (NOT implemented)

Prepared 2026-10-31 for V1 follow-up. Nothing here changes code, policies or the database.

## What is true today (verified)
- The Privacy screen lists facts only; it has no switches (correct: no V1 switch is backed by enforcement).
- **API-level gap:** the policy `Members can view profiles in same HOA` (`auth.uid() = id OR is_in_same_hoa OR is_admin_in_same_hoa`) lets
  ANY approved member of a community read other members' whole `profiles` row over the API: 46 columns, including
  `phone_number`, `date_of_birth`, `unit_number`, `latitude/longitude`, `zip_code`, `city`, `bio`, `notification_preferences`.
  The app UI never shows these to other residents, so the on-screen copy ("not shown ... in the app") is accurate, but a resident
  calling the API directly can read them. Do not strengthen the copy until this is closed.
- `profiles.profile_visibility`, `location_visible`, `show_exact_distance`, `hide_contact_until_confirmed`, `show_activity_status` are
  tennis-era columns. Only the tennis match lookup reads them; they protect nothing in the HOA product.

## Recommended V1.1 controls (in order of value)
1. **Close the read gap first (prerequisite for every switch).** Replace the broad same-HOA SELECT on `profiles` with a narrow
   directory source: a view or SECURITY DEFINER function returning only `id, full_name, avatar_path, unit_number` for members of
   the caller's communities who opted in, and keep full-row access for the owner and the community's admins. This needs a reviewed
   migration, a rehearsal on a restore, and a check that no Stage 1 screen relies on reading co-members' full rows (none found in
   `src/app` outside admin screens).
2. **Contact visibility to neighbours - default OFF.** One switch, "Show my name and unit in the community directory"
   (default off). Stored in one new column on `hoa_memberships` (per community, because a person can belong to several), enforced by the
   function in (1), not by the UI.
3. **Phone / email visibility - default OFF, admins always.** Never shared with other residents in V1.1; HOA administrators keep access
   because they need it to run reservations and reports. State this plainly on the screen.
4. **Communication preferences** (already built for email): keep as is, and add the in-app announcement/maintenance toggles only when a
   delivery path reads them (today those are "always on" and shown as such).
5. **Data requests:** "Download my data" and "Delete my account" are legal/retention work (V1-009), not privacy switches. Keep the support
   path and document retention before adding buttons.

## Remove from the product surface
`show_exact_distance`, `hide_contact_until_confirmed`, `show_activity_status`, location sharing: no HOA use case. Leave the columns in
place (Stage 2 tennis uses them) but never render them in the Resident app.

## What each step needs before building
| Step | Needs | Risk if skipped |
|---|---|---|
| 1 read-gap fix | migration + rehearsal; confirm admin and platform-reviewer screens still read what they need | residents can read each other's phone/DOB/coordinates via the API |
| 2 directory opt-in | step 1, one column, one RPC, UI switch + empty-state | a switch that only hides UI would break the "no false promises" rule |
| 3 contact visibility | step 1 | same |

## Decision for you
Do you want step 1 (the read-gap fix) treated as a pre-launch security item? My recommendation: yes, it is a real exposure for a
multi-resident community even though the app UI does not surface it.

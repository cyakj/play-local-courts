// Statements shown on the V1 Privacy screen. Each one is limited to what the app and backend demonstrably do today;
// nothing here promises enforcement that does not exist.
//
// Verified against the code:
//   * Name, unit and contact details are stored in `profiles` / `hoa_memberships` and used by HOA administrators to
//     manage reservations, reports and membership. (Admin screens read them.)
//   * The app has no resident directory or resident-to-resident messaging in V1 (messages are resident <-> HOA admin).
//   * Location is requested only for the weather indicator on Home and is not stored by the app.
//   * No "last active" / activity-status feature exists in the HOA screens.
//   * profiles.profile_visibility exists but is only consulted by the tennis match-invite lookup
//     (migration 20260719120000), so it is NOT presented as a protection here.

export interface PrivacyFact { title: string; body: string }

export const PRIVACY_FACTS: PrivacyFact[] = [
  {
    title: 'HOA administrators',
    body: 'Your name, unit and contact details are visible to the administrators of your community so they can manage reservations, maintenance reports and membership.',
  },
  {
    title: 'Other residents',
    body: 'This version of the app has no resident directory and no resident-to-resident messaging. Other residents are not shown your profile or contact details in the app.',
  },
  {
    title: 'Location',
    body: 'Your device location is used only to show local weather on the Home screen. It is not saved to your profile or shared.',
  },
  {
    title: 'Messages',
    body: 'Messages you send go to your community’s HOA administrators.',
  },
];

export const PRIVACY_PLANNED_NOTE =
  'Controls for who can see your contact details, and a community member directory, are planned for a future version. Until then there are no visibility switches to change.';

// Who a resident may START a conversation with (V1-006). Pure.
//
// Residents message HOA administrators only. The backend decides the authoritative set (my_message_contacts(), migration
// 20261013120000, which also enforces it in the messages INSERT policy); until that migration is applied the client
// falls back to the administrators it can see. Either way the client narrows the list to the ACTIVE community so a
// resident of several communities is never offered another community's administrator under the wrong identity.

export interface ContactLike {
  user_id: string;
  hoa_id: string;
  contact_is_admin: boolean;
}

export function contactsForActiveCommunity<T extends ContactLike>(
  contacts: T[],
  role: 'admin' | 'resident',
  activeHoaId: string | null | undefined,
): T[] {
  if (role === 'admin') return contacts; // managers see members of the communities they manage (server-enforced)
  const admins = contacts.filter((c) => c.contact_is_admin);
  if (!activeHoaId) return []; // nothing offered until the active community is known
  return admins.filter((c) => c.hoa_id === activeHoaId);
}

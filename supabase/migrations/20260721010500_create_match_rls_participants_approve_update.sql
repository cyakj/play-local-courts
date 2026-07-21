-- Decline reuses the existing "Creator can remove or reopen a participant slot"
-- DELETE policy — no change needed there. Withdraw reuses the existing
-- "Participant can leave a match" DELETE policy — no change needed there either.
-- This is the one new policy: organizer approves a pending request.
create policy "Creator can approve a join request"
on public.open_match_listing_participants
for update
using (
  status = 'requested'
  and exists (
    select 1 from public.open_match_listings listing
    where listing.id = open_match_listing_participants.listing_id and listing.creator_id = auth.uid()
  )
)
with check (status = 'joined');

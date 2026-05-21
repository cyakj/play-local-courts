-- Enforce: one pending invitation per inviter per ladder
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_invitation_per_inviter
ON public.ladder_invitations (ladder_id, invited_by)
WHERE status = 'pending';

-- Enforce: one pending invitation per invited user per ladder  
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_invitation_per_invitee
ON public.ladder_invitations (ladder_id, invited_user_id)
WHERE status = 'pending';
-- Allow message receivers to mark messages as read (set read_at)
-- This fixes unread indicators that can't clear due to RLS.

CREATE POLICY "Users can mark received messages as read"
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);
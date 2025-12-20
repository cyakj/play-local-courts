-- Add read_at column to messages table to track when messages are read
ALTER TABLE public.messages ADD COLUMN read_at timestamp with time zone DEFAULT NULL;

-- Create index for faster unread message queries
CREATE INDEX idx_messages_unread ON public.messages (receiver_id, read_at) WHERE read_at IS NULL;
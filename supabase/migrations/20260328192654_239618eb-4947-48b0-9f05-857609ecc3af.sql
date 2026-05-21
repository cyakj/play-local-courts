-- Create document_views table for tracking who has read each document
CREATE TABLE public.document_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.hoa_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);

ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;

-- Residents can insert/upsert their own view records
CREATE POLICY "Users can insert own views"
  ON public.document_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own view record (for upsert viewed_at)
CREATE POLICY "Users can update own views"
  ON public.document_views
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can select their own views (for unread dot logic)
CREATE POLICY "Users can select own views"
  ON public.document_views
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can select all views for documents in their communities
CREATE POLICY "Admins can select community document views"
  ON public.document_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hoa_documents hd
      JOIN public.hoa_memberships hm ON hm.hoa_id = hd.hoa_id
      WHERE hd.id = document_views.document_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
        AND hm.status = 'approved'
    )
  );

-- Index for fast lookups
CREATE INDEX idx_document_views_document_id ON public.document_views(document_id);
CREATE INDEX idx_document_views_user_id ON public.document_views(user_id);
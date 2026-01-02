-- Create hoa_applications table for tracking HOA manager applications
CREATE TABLE public.hoa_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hoa_name TEXT NOT NULL,
  community_location TEXT NOT NULL,
  estimated_residents INTEGER NOT NULL,
  claimed_role TEXT NOT NULL CHECK (claimed_role IN ('board_member', 'property_manager', 'administrator', 'other')),
  claimed_role_other TEXT,
  verification_documents TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_more_info')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_hoa_id UUID REFERENCES public.hoas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for reviewer notes (audit trail)
CREATE TABLE public.hoa_application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.hoa_applications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL,
  status_change TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for applicant notifications
CREATE TABLE public.application_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.hoa_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hoa_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoa_application_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hoa_applications
CREATE POLICY "Users can view own applications" 
ON public.hoa_applications FOR SELECT 
TO authenticated 
USING (auth.uid() = applicant_id);

CREATE POLICY "Users can submit applications" 
ON public.hoa_applications FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Platform reviewers can view all applications" 
ON public.hoa_applications FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'platform_reviewer'::public.app_role));

CREATE POLICY "Platform reviewers can update applications" 
ON public.hoa_applications FOR UPDATE 
TO authenticated 
USING (public.has_role(auth.uid(), 'platform_reviewer'::public.app_role));

-- RLS Policies for hoa_application_notes
CREATE POLICY "Platform reviewers can insert notes" 
ON public.hoa_application_notes FOR INSERT 
TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'platform_reviewer'::public.app_role));

CREATE POLICY "Platform reviewers can view all notes" 
ON public.hoa_application_notes FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'platform_reviewer'::public.app_role));

-- RLS Policies for application_notifications
CREATE POLICY "Users can view own notifications" 
ON public.application_notifications FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
ON public.application_notifications FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Platform reviewers can insert notifications" 
ON public.application_notifications FOR INSERT 
TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'platform_reviewer'::public.app_role));

-- Create function to approve HOA application
CREATE OR REPLACE FUNCTION public.approve_hoa_application(
  application_id UUID,
  reviewer_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  app_record RECORD;
  new_hoa_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_reviewer'::public.app_role) THEN
    RAISE EXCEPTION 'Only platform reviewers can approve applications';
  END IF;

  SELECT * INTO app_record FROM public.hoa_applications WHERE id = application_id;
  
  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF app_record.status = 'approved' THEN
    RAISE EXCEPTION 'Application already approved';
  END IF;

  INSERT INTO public.hoas (name, address, admin_id)
  VALUES (app_record.hoa_name, app_record.community_location, app_record.applicant_id)
  RETURNING id INTO new_hoa_id;

  UPDATE public.hoa_applications 
  SET status = 'approved', 
      reviewed_at = now(), 
      reviewed_by = auth.uid(),
      created_hoa_id = new_hoa_id,
      updated_at = now()
  WHERE id = application_id;

  UPDATE public.profiles 
  SET hoa_id = new_hoa_id, 
      hoa_status = 'approved',
      hoa_role = 'admin'
  WHERE id = app_record.applicant_id;

  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (app_record.applicant_id, 'admin', auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;

  IF reviewer_note IS NOT NULL THEN
    INSERT INTO public.hoa_application_notes (application_id, reviewer_id, note, status_change)
    VALUES (application_id, auth.uid(), reviewer_note, 'approved');
  END IF;

  INSERT INTO public.application_notifications (application_id, user_id, title, message)
  VALUES (
    application_id, 
    app_record.applicant_id, 
    'Application Approved!', 
    'Congratulations! Your HOA application for "' || app_record.hoa_name || '" has been approved. You now have full administrative access to manage your community.'
  );

  RETURN new_hoa_id;
END;
$$;

-- Create function to reject/update application status
CREATE OR REPLACE FUNCTION public.update_hoa_application_status(
  application_id UUID,
  new_status TEXT,
  reviewer_note TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  app_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_reviewer'::public.app_role) THEN
    RAISE EXCEPTION 'Only platform reviewers can update application status';
  END IF;

  IF new_status NOT IN ('pending', 'rejected', 'needs_more_info') THEN
    RAISE EXCEPTION 'Invalid status. Use approve_hoa_application for approvals.';
  END IF;

  SELECT * INTO app_record FROM public.hoa_applications WHERE id = application_id;
  
  IF app_record IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.hoa_applications 
  SET status = new_status, 
      reviewed_at = now(), 
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = application_id;

  INSERT INTO public.hoa_application_notes (application_id, reviewer_id, note, status_change)
  VALUES (application_id, auth.uid(), reviewer_note, new_status);

  IF new_status = 'rejected' THEN
    notification_title := 'Application Not Approved';
    notification_message := 'Your HOA application for "' || app_record.hoa_name || '" was not approved. Reason: ' || reviewer_note || '. Please contact support if you believe this was in error.';
  ELSIF new_status = 'needs_more_info' THEN
    notification_title := 'Additional Information Needed';
    notification_message := 'Your HOA application for "' || app_record.hoa_name || '" requires additional information: ' || reviewer_note || '. Please update your application with the requested details.';
  ELSE
    notification_title := 'Application Status Updated';
    notification_message := 'Your HOA application status has been updated to: ' || new_status;
  END IF;

  INSERT INTO public.application_notifications (application_id, user_id, title, message)
  VALUES (application_id, app_record.applicant_id, notification_title, notification_message);

  RETURN true;
END;
$$;

-- Create updated_at trigger for hoa_applications
CREATE TRIGGER handle_hoa_applications_updated_at
  BEFORE UPDATE ON public.hoa_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better query performance
CREATE INDEX idx_hoa_applications_status ON public.hoa_applications(status);
CREATE INDEX idx_hoa_applications_applicant ON public.hoa_applications(applicant_id);
CREATE INDEX idx_hoa_application_notes_application ON public.hoa_application_notes(application_id);
CREATE INDEX idx_application_notifications_user ON public.application_notifications(user_id);
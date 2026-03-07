
-- Unified notifications table for HOA/CM
CREATE TABLE public.hoa_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hoa_id UUID REFERENCES public.hoas(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'report_submitted','report_status_changed','report_unresolved',
    'member_application','member_approved','member_rejected',
    'booking_confirmed','booking_cancelled','booking_reminder',
    'health_score_alert','announcement',
    'survey_published','survey_reminder','event_created','event_reminder'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hoa_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.hoa_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.hoa_notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can mark own as read" ON public.hoa_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_hoa_notifications_user_unread ON public.hoa_notifications(user_id, read, created_at DESC);

-- Documents
CREATE TABLE public.hoa_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hoa_id UUID REFERENCES public.hoas(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('rules_bylaws','meeting_minutes','financial_statements','maintenance_records','forms_applications')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  visibility TEXT NOT NULL DEFAULT 'all_residents' CHECK (visibility IN ('all_residents','board_only')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hoa_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Residents view community documents" ON public.hoa_documents FOR SELECT TO authenticated USING (
  visibility = 'all_residents' AND EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_documents.hoa_id AND status = 'approved')
);
CREATE POLICY "Admins view all documents" ON public.hoa_documents FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_documents.hoa_id AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Admins upload documents" ON public.hoa_documents FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_documents.hoa_id AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Admins delete documents" ON public.hoa_documents FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_documents.hoa_id AND role = 'admin' AND status = 'approved')
);

-- Surveys
CREATE TABLE public.hoa_surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hoa_id UUID REFERENCES public.hoas(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  audience TEXT NOT NULL DEFAULT 'all_residents' CHECK (audience IN ('all_residents','board_only')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  opens_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hoa_surveys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hoa_survey_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID REFERENCES public.hoa_surveys(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice','yes_no','rating','open_text')),
  options JSONB,
  position INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.hoa_survey_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hoa_survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID REFERENCES public.hoa_surveys(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(survey_id, user_id)
);
ALTER TABLE public.hoa_survey_responses ENABLE ROW LEVEL SECURITY;

-- Survey RLS
CREATE POLICY "Residents view active surveys" ON public.hoa_surveys FOR SELECT TO authenticated USING (
  status IN ('active', 'closed') AND EXISTS (
    SELECT 1 FROM public.hoa_memberships m 
    WHERE m.user_id = auth.uid() AND m.hoa_id = hoa_surveys.hoa_id AND m.status = 'approved' 
    AND (audience = 'all_residents' OR (audience = 'board_only' AND m.role = 'admin'))
  )
);
CREATE POLICY "Admins manage surveys" ON public.hoa_surveys FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_surveys.hoa_id AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Questions visible with survey" ON public.hoa_survey_questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_surveys s WHERE s.id = survey_id AND (
    EXISTS (SELECT 1 FROM public.hoa_memberships m WHERE m.user_id = auth.uid() AND m.hoa_id = s.hoa_id AND m.status = 'approved')
  ))
);
CREATE POLICY "Admins manage questions" ON public.hoa_survey_questions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_surveys s JOIN public.hoa_memberships m ON m.hoa_id = s.hoa_id WHERE s.id = survey_id AND m.user_id = auth.uid() AND m.role = 'admin' AND m.status = 'approved')
);
CREATE POLICY "Users submit own response" ON public.hoa_survey_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own response" ON public.hoa_survey_responses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all responses" ON public.hoa_survey_responses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_surveys s JOIN public.hoa_memberships m ON m.hoa_id = s.hoa_id WHERE s.id = survey_id AND m.user_id = auth.uid() AND m.role = 'admin' AND m.status = 'approved')
);

-- Community events
CREATE TABLE public.hoa_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hoa_id UUID REFERENCES public.hoas(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('community_event','board_meeting','maintenance_scheduled','amenity_booking')),
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  rsvp_enabled BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hoa_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hoa_event_rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.hoa_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  response TEXT NOT NULL CHECK (response IN ('going','not_going')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.hoa_event_rsvps ENABLE ROW LEVEL SECURITY;

-- Events RLS
CREATE POLICY "Residents view community events" ON public.hoa_events FOR SELECT TO authenticated USING (
  status = 'active' AND EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_events.hoa_id AND status = 'approved')
);
CREATE POLICY "Admins manage events" ON public.hoa_events FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_events.hoa_id AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Users manage own RSVP" ON public.hoa_event_rsvps FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all RSVPs" ON public.hoa_event_rsvps FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_events e JOIN public.hoa_memberships m ON m.hoa_id = e.hoa_id WHERE e.id = event_id AND m.user_id = auth.uid() AND m.role = 'admin' AND m.status = 'approved')
);

-- Announcements table
CREATE TABLE public.hoa_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hoa_id UUID REFERENCES public.hoas(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all_residents' CHECK (audience IN ('all_residents','board_only')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hoa_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Residents view announcements" ON public.hoa_announcements FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_announcements.hoa_id AND status = 'approved'
    AND (hoa_announcements.audience = 'all_residents' OR role = 'admin'))
);
CREATE POLICY "Admins create announcements" ON public.hoa_announcements FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_announcements.hoa_id AND role = 'admin' AND status = 'approved')
);

-- Storage bucket for documents (created via Supabase dashboard, but ensure policy)

-- Notification triggers

-- 1. On maintenance_reports INSERT → notify admins
CREATE OR REPLACE FUNCTION public.notify_admins_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_record RECORD;
  reporter_name TEXT;
  amenity_name TEXT;
BEGIN
  SELECT full_name INTO reporter_name FROM public.profiles WHERE id = NEW.reporter_id;
  SELECT name INTO amenity_name FROM public.courts WHERE id = NEW.amenity_id;
  
  FOR admin_record IN
    SELECT user_id FROM public.hoa_memberships 
    WHERE hoa_id = NEW.hoa_id AND role = 'admin' AND status = 'approved'
  LOOP
    INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata)
    VALUES (
      admin_record.user_id, NEW.hoa_id, 'report_submitted',
      'New maintenance report',
      COALESCE(reporter_name, 'A resident') || ' reported ' || NEW.category || ' at ' || COALESCE(amenity_name, 'an amenity'),
      jsonb_build_object('report_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_report_submitted
AFTER INSERT ON public.maintenance_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_report();

-- 2. On maintenance_reports status UPDATE → notify reporter
CREATE OR REPLACE FUNCTION public.notify_reporter_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  amenity_name TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT name INTO amenity_name FROM public.courts WHERE id = NEW.amenity_id;
    INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata)
    VALUES (
      NEW.reporter_id, NEW.hoa_id, 'report_status_changed',
      'Your report has been updated',
      'Your ' || NEW.category || ' report at ' || COALESCE(amenity_name, 'an amenity') || ' is now ' || NEW.status,
      jsonb_build_object('report_id', NEW.id, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_report_status
AFTER UPDATE ON public.maintenance_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_reporter_on_status_change();

-- 3. On hoa_memberships INSERT → notify admins
CREATE OR REPLACE FUNCTION public.notify_admins_on_member_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_record RECORD;
  applicant_name TEXT;
  community_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT full_name INTO applicant_name FROM public.profiles WHERE id = NEW.user_id;
    SELECT name INTO community_name FROM public.hoas WHERE id = NEW.hoa_id;
    
    FOR admin_record IN
      SELECT user_id FROM public.hoa_memberships 
      WHERE hoa_id = NEW.hoa_id AND role = 'admin' AND status = 'approved' AND user_id != NEW.user_id
    LOOP
      INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata)
      VALUES (
        admin_record.user_id, NEW.hoa_id, 'member_application',
        'New member application',
        COALESCE(applicant_name, 'Someone') || ' applied to join ' || COALESCE(community_name, 'your community'),
        jsonb_build_object('membership_id', NEW.id, 'applicant_id', NEW.user_id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_member_application
AFTER INSERT ON public.hoa_memberships
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_member_application();

-- 4. On hoa_memberships status UPDATE → notify applicant
CREATE OR REPLACE FUNCTION public.notify_applicant_on_membership_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  community_name TEXT;
  notif_type TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    SELECT name INTO community_name FROM public.hoas WHERE id = NEW.hoa_id;
    notif_type := CASE WHEN NEW.status = 'approved' THEN 'member_approved' ELSE 'member_rejected' END;
    
    INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata)
    VALUES (
      NEW.user_id, NEW.hoa_id, notif_type,
      'Your application has been ' || NEW.status,
      'Your application to join ' || COALESCE(community_name, 'the community') || ' has been ' || NEW.status,
      jsonb_build_object('membership_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_membership_status
AFTER UPDATE ON public.hoa_memberships
FOR EACH ROW EXECUTE FUNCTION public.notify_applicant_on_membership_change();

-- 5. On bookings INSERT → notify booker
CREATE OR REPLACE FUNCTION public.notify_booker_on_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  amenity_name TEXT;
  amenity_hoa_id UUID;
BEGIN
  SELECT name, hoa_id INTO amenity_name, amenity_hoa_id FROM public.courts WHERE id = NEW.court_id;
  
  INSERT INTO public.hoa_notifications (user_id, hoa_id, type, title, body, metadata)
  VALUES (
    NEW.user_id, amenity_hoa_id, 'booking_confirmed',
    'Booking confirmed',
    COALESCE(amenity_name, 'Amenity') || ' booked for ' || NEW.date || ' at ' || NEW.start_time,
    jsonb_build_object('booking_id', NEW.id, 'court_id', NEW.court_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_booking
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_booker_on_booking();

-- Add hoa-documents storage bucket policy (bucket created separately)

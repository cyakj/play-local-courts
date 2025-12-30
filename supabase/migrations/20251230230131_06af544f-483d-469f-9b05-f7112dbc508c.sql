-- Create assignments table for coach-client relationship
CREATE TABLE public.client_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  client_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lesson plans table linked to lesson requests
CREATE TABLE public.lesson_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_request_id UUID NOT NULL REFERENCES public.lesson_requests(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lesson_request_id)
);

-- Enable RLS
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- Policies for client_assignments
CREATE POLICY "Coaches can manage their own assignments"
ON public.client_assignments
FOR ALL
USING (auth.uid() = coach_id);

CREATE POLICY "Players can view their assignments"
ON public.client_assignments
FOR SELECT
USING (auth.uid() = client_id);

CREATE POLICY "Players can update completion status"
ON public.client_assignments
FOR UPDATE
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

-- Policies for lesson_plans
CREATE POLICY "Coaches can manage their lesson plans"
ON public.lesson_plans
FOR ALL
USING (auth.uid() = coach_id);

CREATE POLICY "Players can view lesson plans for their lessons"
ON public.lesson_plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lesson_requests lr
    WHERE lr.id = lesson_request_id
    AND lr.player_id = auth.uid()
  )
);

-- Create indexes
CREATE INDEX idx_client_assignments_coach ON public.client_assignments(coach_id);
CREATE INDEX idx_client_assignments_client ON public.client_assignments(client_id);
CREATE INDEX idx_lesson_plans_lesson ON public.lesson_plans(lesson_request_id);

-- Triggers for updated_at
CREATE TRIGGER update_client_assignments_updated_at
  BEFORE UPDATE ON public.client_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_lesson_plans_updated_at
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
-- Add takeaways column to lesson_plans table
ALTER TABLE public.lesson_plans
ADD COLUMN takeaways text;
-- Grant platform_reviewer role to rallynet123@gmail.com account
INSERT INTO public.user_roles (user_id, role)
VALUES ('fbcf0c78-17e0-4d71-a476-42848bf005b6', 'platform_reviewer')
ON CONFLICT (user_id, role) DO NOTHING;
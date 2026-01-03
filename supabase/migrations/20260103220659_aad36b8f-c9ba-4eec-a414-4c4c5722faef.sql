-- Grant platform_reviewer role to the specified user
INSERT INTO public.user_roles (user_id, role)
VALUES ('010b0152-f3f2-4213-a08a-1dca6f19f96e', 'platform_reviewer')
ON CONFLICT (user_id, role) DO NOTHING;
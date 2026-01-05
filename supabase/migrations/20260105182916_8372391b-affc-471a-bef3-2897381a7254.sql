
-- Remove platform_reviewer role from cyruskjy@gmail.com (Coach J account)
-- Only rallynet123@gmail.com should have platform_reviewer role
DELETE FROM public.user_roles 
WHERE user_id = '010b0152-f3f2-4213-a08a-1dca6f19f96e' 
AND role = 'platform_reviewer';

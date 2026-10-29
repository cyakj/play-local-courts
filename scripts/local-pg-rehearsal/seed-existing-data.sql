-- Representative pre-upgrade data on the rehearsal database (fake users only). Fixed UUIDs so assertions can refer to them.
-- u1 approved resident, u2 pending (membership+request), u3 rejected (request only, legacy), u4 pending request only
-- (legacy, no membership), u5 unverified-email user, u6 admin of c1, u7 approved resident whose request row is still 'pending'
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-0000000000a1','u1@test.local', now()),
 ('00000000-0000-0000-0000-0000000000a2','u2@test.local', now()),
 ('00000000-0000-0000-0000-0000000000a3','u3@test.local', now()),
 ('00000000-0000-0000-0000-0000000000a4','u4@test.local', now()),
 ('00000000-0000-0000-0000-0000000000a5','u5@test.local', NULL),
 ('00000000-0000-0000-0000-0000000000a6','u6@test.local', now()),
 ('00000000-0000-0000-0000-0000000000a7','u7@test.local', now()),
 ('00000000-0000-0000-0000-0000000000a8','u8@test.local', now());

INSERT INTO public.hoas (id, name, admin_id, community_type, invite_code, invite_enabled, invite_expires_at, approval_status) VALUES
 ('00000000-0000-0000-0000-0000000000c1','Approved Greens','00000000-0000-0000-0000-0000000000a6','hoa','CODE-C1', true, NULL,'approved'),
 ('00000000-0000-0000-0000-0000000000c2','Pending Estates', NULL,'hoa','CODE-C2', true, NULL,'pending'),
 ('00000000-0000-0000-0000-0000000000c3','Expired Invite HOA', NULL,'hoa','CODE-C3', true, now() - interval '1 day','approved'),
 ('00000000-0000-0000-0000-0000000000c4','Disabled Invite HOA', NULL,'hoa','CODE-C4', false, NULL,'approved');

INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status) VALUES
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','resident','approved'),
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000c1','resident','pending'),
 ('00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000c1','admin','approved'),
 ('00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-0000000000c1','resident','approved');

INSERT INTO public.community_join_requests (user_id, hoa_id, status) VALUES
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000c1','pending'),
 ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000c1','rejected'),
 ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000c1','pending'),
 ('00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-0000000000c1','pending');

INSERT INTO public.hoa_applications (applicant_id, hoa_name, status, verification_documents) VALUES
 ('00000000-0000-0000-0000-0000000000a8','Some New HOA','pending', ARRAY['00000000-0000-0000-0000-0000000000a8/doc1.pdf']),
 ('00000000-0000-0000-0000-0000000000a8','Older HOA','rejected', NULL);

-- bucket exactly as 20260102102038 created it: no allowed_mime_types
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('hoa-verification-documents','hoa-verification-documents', false, 10485760);

INSERT INTO public.email_preferences (user_id) VALUES ('00000000-0000-0000-0000-0000000000a1');

-- Baseline snapshot (row hashes) so the assertions can prove every ORIGINAL row is byte-for-byte unchanged afterwards.
CREATE TABLE public.zz_rehearsal_baseline (tbl text NOT NULL, row_key text NOT NULL, h text NOT NULL, PRIMARY KEY (tbl, row_key));
INSERT INTO public.zz_rehearsal_baseline SELECT 'auth.users', id::text, md5(to_jsonb(t)::text) FROM auth.users t;
INSERT INTO public.zz_rehearsal_baseline SELECT 'hoas', id::text, md5(to_jsonb(t)::text) FROM public.hoas t;
INSERT INTO public.zz_rehearsal_baseline SELECT 'hoa_memberships', id::text, md5(to_jsonb(t)::text) FROM public.hoa_memberships t;
INSERT INTO public.zz_rehearsal_baseline SELECT 'community_join_requests', id::text, md5(to_jsonb(t)::text) FROM public.community_join_requests t;
INSERT INTO public.zz_rehearsal_baseline SELECT 'hoa_applications', id::text, md5(to_jsonb(t)::text) FROM public.hoa_applications t;
INSERT INTO public.zz_rehearsal_baseline SELECT 'email_preferences', id::text, md5(to_jsonb(t)::text) FROM public.email_preferences t;
INSERT INTO public.zz_rehearsal_baseline SELECT 'storage.buckets', id, md5(to_jsonb(t)::text) FROM storage.buckets t;

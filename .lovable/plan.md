

## Problem

The INSERT policy on the `ladders` table is **scoped to the `public` role** instead of `authenticated`. This means `auth.uid()` evaluates to `NULL` during the insert, causing the `WITH CHECK` to always fail. Every previous migration attempted to fix this but kept recreating the policy with the wrong role scope.

This is confirmed by querying `pg_policies`: the INSERT policy shows `roles: {public}` while DELETE, UPDATE, and SELECT all correctly show `roles: {authenticated}`.

## Fix

A single SQL migration that:

1. **Drops** the existing INSERT policy `"Admins and coaches can create ladders"`.
2. **Recreates** it with `TO authenticated` — keeping the same `WITH CHECK` logic but ensuring `auth.uid()` is available.

```sql
DROP POLICY IF EXISTS "Admins and coaches can create ladders" ON public.ladders;

CREATE POLICY "Admins and coaches can create ladders"
ON public.ladders
FOR INSERT
TO authenticated
WITH CHECK (
  admin_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coach'::app_role)
    OR EXISTS (SELECT 1 FROM coaches WHERE coaches.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM hoa_memberships
      WHERE hoa_memberships.user_id = auth.uid()
        AND hoa_memberships.role = 'admin'
        AND hoa_memberships.status = 'approved'
    )
  )
);
```

That is the entire fix. No frontend changes needed — the wizard code and `authUserId` logic are already correct.

## Verification

After migration runs, query `pg_policies` to confirm the INSERT policy shows `roles: {authenticated}`. Then test Publish from the wizard.


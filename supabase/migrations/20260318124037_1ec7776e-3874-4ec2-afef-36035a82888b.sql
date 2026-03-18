-- Allow HOA admins to update bookings within their own HOA so admin-initiated cancellations can persist
create policy "Admins can update bookings in their HOA"
on public.bookings
for update
to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  and exists (
    select 1
    from public.profiles
    join public.courts on public.courts.id = public.bookings.court_id
    where public.profiles.id = auth.uid()
      and public.profiles.hoa_id = public.courts.hoa_id
  )
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  and exists (
    select 1
    from public.profiles
    join public.courts on public.courts.id = public.bookings.court_id
    where public.profiles.id = auth.uid()
      and public.profiles.hoa_id = public.courts.hoa_id
  )
);
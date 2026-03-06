

# Maintenance Worker System & Report Enhancements — Implementation Plan

This is a very large feature set spanning database schema changes, a new user role, new UI screens, and notification infrastructure. I'll break it into phased deliverables.

---

## Phase 1: Quick Wins — Category Formatting, Report Card Cleanup, Priority Badges, Status Filters

**Shared category formatter utility** — Create `src/lib/maintenanceUtils.ts` with a unified `getCategoryLabel()` function used across all screens (MyReports, MaintenanceReports, MultiStepReportDialog review step). The mapping covers all existing categories from the report submission flow (`amenities_equipment`, `lighting_electrical`, `water_plumbing`, `grounds_landscaping`, `buildings_structures`, `safety_other`) plus the legacy admin categories (`lighting`, `surface_net`, etc.).

**Report card title simplification** — In both `MyReports.tsx` and `MaintenanceReports.tsx`, show only the amenity name (without court_type) as the card title. Show category as a separate badge below alongside a priority badge. The admin view currently appends `(court_type)` to the amenity name — strip that.

**Priority badges** — Parse the severity from the description field (currently stored as `[Severity: Low/Moderate/High/Critical]` prefix in description). Map: Critical → Urgent (red), High (orange), Moderate → Medium (blue), Low (gray). Display as color-coded Badge components.

**Status filter expansion** — Update filter chips in both MyReports and MaintenanceReports to include: All, Open, Assigned, Accepted, In Progress, Completed, Reopened. Update `getStatusBadge()` for the new statuses with appropriate colors.

**Counters update** — Admin MaintenanceReports header: show "X Open Issues" counting `open` + `assigned` statuses, plus an orange "Y In Progress" badge counting `in_progress` + `accepted` statuses.

---

## Phase 2: Database Schema Changes

**New `maintenance_workers` table:**
```sql
CREATE TABLE public.maintenance_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  worker_type text NOT NULL CHECK (worker_type IN ('hoa_employee', 'independent_contractor')),
  specialties text[] NOT NULL DEFAULT '{}',
  bio text,
  photo_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
```

**New `maintenance_worker_communities` join table** (since workers can belong to multiple communities):
```sql
CREATE TABLE public.maintenance_worker_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.maintenance_workers(id) ON DELETE CASCADE NOT NULL,
  hoa_id uuid REFERENCES public.hoas(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(worker_id, hoa_id)
);
```

**Add columns to `maintenance_reports`:**
- `worker_id uuid` — references `maintenance_workers(id)`
- `priority text DEFAULT 'medium'` — low, medium, high, urgent
- `completion_notes text`
- `completion_photo_url text`
- `completed_at timestamptz`
- `cannot_complete_reason text`

**New `maintenance_status_history` table** for timeline tracking:
```sql
CREATE TABLE public.maintenance_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.maintenance_reports(id) ON DELETE CASCADE NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Add `maintenance_worker` to `app_role` enum** and create appropriate RLS policies:
- Workers can only SELECT reports assigned to them (`worker_id = their worker id`)
- Workers can UPDATE status on their assigned reports
- Admins can manage workers in their HOA
- Workers can view/update their own profile

**Update `maintenance_reports` status column** — allow new values: `open`, `assigned`, `accepted`, `in_progress`, `completed`, `reopened`.

---

## Phase 3: Registration & Auth Updates

**Add "Maintenance Worker" to signup** — New role option `maintenance_worker` in Register.tsx. When selected, show:
- Standard fields (name, email, phone, password)
- Worker type radio: HOA Employee / Independent Contractor
- Searchable community multi-select (single for HOA Employee)
- Specialty multi-select checkboxes matching existing report categories
- Bio text field (optional)
- Profile photo upload (optional)

**Auth context update** — Add `isMaintenanceWorker` boolean derived from `user_roles` table. New role value `'maintenance_worker'` in `app_role` enum.

**Post-signup flow** — Create maintenance_workers record with `status: 'pending'`. Create entries in `maintenance_worker_communities`. Show pending approval message.

---

## Phase 4: Admin Worker Management

**Admin Hub update** — Add "Maintenance Workers" card linking to `/admin/workers`.

**New `/admin/workers` page** with two tabs:
- **Workers tab**: Approved workers with photo, name, type badge, specialty badges, active/completed job counts, View Profile + Deactivate buttons.
- **Pending tab**: Pending applications with Approve/Reject buttons. Approval updates worker status and sends notification.

**AdminQuickOverview update** — Include pending worker applications in the pending count.

---

## Phase 5: Assignment Flow in Admin Report Detail

**Update ReportDetailForm** in MaintenanceReports.tsx:
- Add "Assignment" section showing current worker or "Unassigned"
- "Assign Worker" button opens a worker selection panel filtered by community, grouped by specialty relevance
- Workers matching report category get a "Suggested" badge
- Admin sets priority (Low/Medium/High/Urgent) during assignment
- "Reassign" button for already-assigned reports
- Assignment changes status to `assigned`, creates status history entry

---

## Phase 6: Maintenance Worker Interface

**New layout component** — `WorkerLayout.tsx` with simplified bottom nav (My Jobs, History, Profile) and no access to resident/admin features.

**New pages:**
- `/worker/jobs` — Active jobs sorted by priority, each with priority badge, category, location, status
- `/worker/jobs/:id` — Job detail with status action buttons (Accept → Start → Complete flow), "Cannot Complete" option
- `/worker/history` — Completed/reassigned jobs with filters
- `/worker/profile` — Worker stats, editable bio/photo/specialties

**Routing** — Add worker routes in App.tsx gated by `isMaintenanceWorker` role check. Workers are redirected away from all other routes.

---

## Phase 7: Resident Report Updates

**MyReports.tsx updates:**
- Status badges with new colors: Open (gray), Assigned (blue), In Progress (orange), Completed (green), Reopened (red)
- Report detail shows assigned worker's first name + specialty (no full contact)
- Completion notes and photo displayed when available
- Status change timeline from `maintenance_status_history`
- "Reopen Issue" button on completed reports (requires reason, changes status to `open`)

---

## Phase 8: Admin Dashboard Counters

**AdminQuickOverview** updates:
- Open Issues = `open` + `assigned`
- In Maintenance = `in_progress` + `accepted`
- Completed Today = completed in last 24h
- Workers Overview card: total active, on-job, available

---

## Phase 9: Notifications

Leverage existing `competition_notifications` pattern or create a new `maintenance_notifications` table. Key triggers:
- New report → Admin
- Worker application → Admin
- Job assigned → Worker + Resident
- Status changes → relevant parties
- Reminders (24h/48h) via scheduled edge function

---

## Implementation Order

Given the massive scope, I recommend implementing in this order:
1. **Phase 1** (formatting fixes, badges, filters) — immediate visual improvements
2. **Phase 2** (database migrations) — foundation for everything else
3. **Phase 3** (worker signup) + **Phase 4** (admin management)
4. **Phase 5** (assignment flow)
5. **Phase 6** (worker interface)
6. **Phase 7** (resident updates) + **Phase 8** (dashboard counters)
7. **Phase 9** (notifications)

This is roughly 15-20 distinct implementation steps. Shall I begin with Phase 1 (the formatting/UI fixes) and Phase 2 (database schema), then proceed through the remaining phases?


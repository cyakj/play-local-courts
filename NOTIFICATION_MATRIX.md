# TenisX — Notification Matrix

**Owner:** Engineering  
**Last updated:** 2026-06-26  
**Email sender:** `noreply@tenisx.ai`  
**Push provider:** APNS (iOS) via Supabase Edge Function  
**In-app store:** `notifications` table, surfaced in `/notifications` screen

---

## Mandatory Notifications

The following events **ignore user preferences** and are always delivered:

| Event | Reason |
|-------|--------|
| Account verification | Cannot use app without email confirmed |
| Password reset | Security — must be delivered |
| Payment receipt | Legal / financial record |
| Refund issued | Legal / financial record |

All other events respect the user's notification preference settings.

---

## Summary Matrix

| # | Event | Recipient | Email | Push | In-App | Mandatory | Prefs | Priority |
|---|-------|-----------|-------|------|--------|-----------|-------|----------|
| **AUTH** |||||||||
| A1 | Signup welcome | New user | ✓ ON | — | — | No | Yes | P1 |
| A2 | Account verification | New user | ✓ ON | — | — | **Yes** | No | **P0** |
| A3 | Password reset | User | ✓ ON | — | — | **Yes** | No | **P0** |
| **MATCHES** |||||||||
| M1 | Match request received | Challenged player | ✓ ON | ✓ ON | ✓ | No | Yes | P2 |
| M2 | Match accepted | Requesting player | ✓ ON | ✓ ON | ✓ | No | Yes | P2 |
| M3 | Match declined | Requesting player | ✓ ON | ✓ ON | ✓ | No | Yes | P2 |
| M4 | Match cancelled | Both players | ✓ ON | ✓ ON | ✓ | No | Yes | P2 |
| **MESSAGES** |||||||||
| MS1 | New message received | Recipient | — OFF | ✓ ON | ✓ | No | Yes | P1 |
| **COACHING** |||||||||
| C1 | Lesson request submitted | Coach | ✓ ON | ✓ ON | ✓ | No | Yes | P1 |
| C2 | Lesson accepted | Player | ✓ ON | ✓ ON | ✓ | No | Yes | P1 |
| C3 | Lesson declined | Player | ✓ ON | ✓ ON | ✓ | No | Yes | P1 |
| C4 | Lesson cancelled | Non-cancelling party | ✓ ON | ✓ ON | ✓ | No | Yes | P1 |
| **COURTS** |||||||||
| CR1 | Reservation confirmed | Resident | ✓ ON | ✓ ON | ✓ | No | Yes | **P1** |
| CR2 | Reservation cancelled | Resident | ✓ ON | ✓ ON | ✓ | No | Yes | P1 |
| **HOA** |||||||||
| H1 | HOA join approved | Applicant | ✓ ON | ✓ ON | ✓ | No | Yes | P1 |
| H2 | HOA join rejected | Applicant | ✓ ON | ✓ ON | ✓ | No | Yes | P1 |
| **PAYMENTS** |||||||||
| P1 | Payment receipt | Payer | ✓ ON | — | ✓ | **Yes** | No | **P0** |
| P2 | Refund issued | Payer | ✓ ON | ✓ ON | ✓ | **Yes** | No | **P0** |
| **REMINDERS** |||||||||
| R1 | Lesson reminder | Coach + Player | — OFF | ✓ ON | ✓ | No | Yes | P2 |
| R2 | Court reminder | Resident | — OFF | ✓ ON | ✓ | No | Yes | P2 |
| R3 | Match reminder | Both players | — OFF | ✓ ON | ✓ | No | Yes | P2 |

**Legend:** `✓ ON` = channel enabled by default · `— OFF` = channel disabled by default · `—` = channel not used for this event

---

## Detailed Event Specifications

---

### A1 — Signup Welcome

| Field | Value |
|-------|-------|
| **Recipient** | New user |
| **Trigger** | Successful account creation |
| **Email** | ON (default) |
| **Push** | Not sent |
| **In-App** | Not sent (user not yet in app) |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.account` |
| **Template** | `auth_welcome` |
| **Priority** | P1 |

**Required Payload**

```
user_id
user_name          (display name or email prefix)
app_name           "TenisX"
onboarding_url     deep link to HOA join flow
```

---

### A2 — Account Verification

| Field | Value |
|-------|-------|
| **Recipient** | New user |
| **Trigger** | Signup — Supabase sends automatically |
| **Email** | ON — always |
| **Push** | Not sent |
| **In-App** | Not sent |
| **Mandatory** | **Yes** |
| **Respects Preferences** | No |
| **Template** | `auth_verify_email` (Supabase built-in) |
| **Priority** | **P0** |

**Required Payload**

```
user_name
verification_link    (Supabase-generated, one-time)
expiry_hours         24
```

**Note:** Delivered by Supabase Auth natively. Custom branding requires configuring a custom SMTP provider in the Supabase dashboard.

---

### A3 — Password Reset

| Field | Value |
|-------|-------|
| **Recipient** | User requesting reset |
| **Trigger** | `supabase.auth.resetPasswordForEmail()` call |
| **Email** | ON — always |
| **Push** | Not sent |
| **In-App** | Not sent |
| **Mandatory** | **Yes** |
| **Respects Preferences** | No |
| **Template** | `auth_password_reset` (Supabase built-in) |
| **Priority** | **P0** |

**Required Payload**

```
user_name
reset_link           deep link to tenisx://reset-password?token=...
expiry_minutes       60
```

**Note:** Deep link requires `app.json` scheme and P0-012 reset screen. Until that screen exists, the link opens in-browser.

---

### M1 — Match Request Received

| Field | Value |
|-------|-------|
| **Recipient** | Challenged player |
| **Trigger** | New row inserted in `match_requests` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.matches`, `pref.push.matches` |
| **Template** | `match_request_received` |
| **Priority** | P2 (feature is Stage 2) |

**Required Payload**

```
recipient_name
challenger_name
match_type           (singles / doubles / practice)
proposed_date        formatted date string
proposed_time
court_name           (if specified)
accept_url           deep link to match request
expires_at
```

---

### M2 — Match Accepted

| Field | Value |
|-------|-------|
| **Recipient** | Player who sent the request |
| **Trigger** | `match_requests.status` updated to `accepted` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.matches`, `pref.push.matches` |
| **Template** | `match_accepted` |
| **Priority** | P2 |

**Required Payload**

```
recipient_name
opponent_name
match_type
confirmed_date
confirmed_time
court_name
match_id             for deep link
```

---

### M3 — Match Declined

| Field | Value |
|-------|-------|
| **Recipient** | Player who sent the request |
| **Trigger** | `match_requests.status` updated to `declined` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.matches`, `pref.push.matches` |
| **Template** | `match_declined` |
| **Priority** | P2 |

**Required Payload**

```
recipient_name
opponent_name
match_type
proposed_date
decline_reason       nullable
```

---

### M4 — Match Cancelled

| Field | Value |
|-------|-------|
| **Recipient** | Both players (send separately) |
| **Trigger** | `match_requests.status` updated to `cancelled` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.matches`, `pref.push.matches` |
| **Template** | `match_cancelled` |
| **Priority** | P2 |

**Required Payload**

```
recipient_name
opponent_name
match_type
original_date
original_time
cancelled_by         "you" | opponent_name
cancellation_reason  nullable
```

---

### MS1 — New Message Received

| Field | Value |
|-------|-------|
| **Recipient** | Message recipient |
| **Trigger** | New message row inserted |
| **Email** | OFF (default) — high-frequency event, push is preferred |
| **Push** | ON (default) |
| **In-App** | Yes (badge + notification row) |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.messages`, `pref.push.messages` |
| **Template** | `message_new` |
| **Priority** | P1 |

**Required Payload**

```
recipient_name
sender_name
message_preview      first 100 chars, truncated with ellipsis
thread_id            for deep link
sender_avatar_url    nullable
```

**Note:** Do not include full message body in email. Truncated preview only — preserve privacy if device is shared.

---

### C1 — Lesson Request Submitted

| Field | Value |
|-------|-------|
| **Recipient** | Coach |
| **Trigger** | New row inserted in `lesson_requests` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.coaching`, `pref.push.coaching` |
| **Template** | `lesson_request_received` |
| **Priority** | P1 |

**Required Payload**

```
coach_name
player_name
lesson_type          (private_lesson / semi_private / group_clinic / practice_session)
duration_minutes
skill_level
preferred_date
preferred_time_start nullable
preferred_time_end   nullable
location_preference
facility_name        nullable
notes                nullable
package_title        nullable (if package selected)
package_price        nullable
request_id           for deep link to coach inbox
expires_at           48h from request
```

---

### C2 — Lesson Accepted

| Field | Value |
|-------|-------|
| **Recipient** | Player |
| **Trigger** | `lesson_requests.status` updated to `accepted` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.coaching`, `pref.push.coaching` |
| **Template** | `lesson_accepted` |
| **Priority** | P1 |

**Required Payload**

```
player_name
coach_name
lesson_type
duration_minutes
confirmed_date
confirmed_time_start
confirmed_time_end
location             resolved location string
coach_home_base      nullable
request_id
package_title        nullable
```

---

### C3 — Lesson Declined

| Field | Value |
|-------|-------|
| **Recipient** | Player |
| **Trigger** | `lesson_requests.status` updated to `declined` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.coaching`, `pref.push.coaching` |
| **Template** | `lesson_declined` |
| **Priority** | P1 |

**Required Payload**

```
player_name
coach_name
lesson_type
preferred_date
decline_reason       nullable
coach_profile_url    deep link to find another coach
```

---

### C4 — Lesson Cancelled

| Field | Value |
|-------|-------|
| **Recipient** | The party who did NOT cancel (coach or player) |
| **Trigger** | `lesson_requests.status` updated to `cancelled` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.coaching`, `pref.push.coaching` |
| **Template** | `lesson_cancelled` |
| **Priority** | P1 |

**Required Payload**

```
recipient_name
other_party_name
cancelled_by         "coach" | "player"
lesson_type
original_date
original_time_start
cancellation_reason  nullable
request_id
```

---

### CR1 — Reservation Confirmed

| Field | Value |
|-------|-------|
| **Recipient** | Resident who booked |
| **Trigger** | Booking INSERT succeeds in `bookings` table |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.courts`, `pref.push.courts` |
| **Template** | `booking_confirmation` |
| **Priority** | **P1** (blocked by P1-006 — email not yet wired to booking flow) |

**Required Payload**

```
resident_name
court_name
booking_date         formatted date string
start_time           formatted 12h
end_time             formatted 12h
play_type
booking_id
community_name
cancellation_url     deep link to My Reservations
```

---

### CR2 — Reservation Cancelled

| Field | Value |
|-------|-------|
| **Recipient** | Resident who booked |
| **Trigger** | `bookings.status` updated to `cancelled` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.courts`, `pref.push.courts` |
| **Template** | `booking_cancelled` |
| **Priority** | P1 (blocked by P1-007) |

**Required Payload**

```
resident_name
court_name
original_date
original_start_time
original_end_time
cancelled_by         "you" | "admin"
cancellation_reason  nullable
booking_id
```

---

### H1 — HOA Join Approved

| Field | Value |
|-------|-------|
| **Recipient** | Applicant |
| **Trigger** | `hoa_memberships.status` updated to `approved` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.hoa`, `pref.push.hoa` |
| **Template** | `hoa_approved` |
| **Priority** | P1 |

**Required Payload**

```
applicant_name
community_name
approved_by_name     nullable (admin name)
approved_at
next_steps           "You can now book courts and report issues."
app_url              deep link to resident home
```

---

### H2 — HOA Join Rejected

| Field | Value |
|-------|-------|
| **Recipient** | Applicant |
| **Trigger** | `hoa_memberships.status` updated to `rejected` |
| **Email** | ON (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.email.hoa`, `pref.push.hoa` |
| **Template** | `hoa_rejected` |
| **Priority** | P1 |

**Required Payload**

```
applicant_name
community_name
rejection_reason     nullable
contact_email        nullable (HOA admin contact)
```

---

### P1 — Payment Receipt

| Field | Value |
|-------|-------|
| **Recipient** | Payer |
| **Trigger** | Successful payment processed via Stripe |
| **Email** | ON — always |
| **Push** | Not sent (email receipt is the legal record) |
| **In-App** | Yes |
| **Mandatory** | **Yes** |
| **Respects Preferences** | No |
| **Template** | `payment_receipt` |
| **Priority** | **P0** |

**Required Payload**

```
payer_name
amount_cents         integer, display as formatted currency
currency             "USD"
description          "Court booking — June 26" or "Lesson Package — Coach Name"
payment_date
payment_method_brand nullable ("Visa", "Mastercard")
payment_method_last4 nullable
transaction_id       Stripe payment_intent_id or charge_id
invoice_url          nullable (Stripe-hosted invoice PDF)
```

---

### P2 — Refund Issued

| Field | Value |
|-------|-------|
| **Recipient** | Original payer |
| **Trigger** | Refund processed via Stripe |
| **Email** | ON — always |
| **Push** | ON — always |
| **In-App** | Yes |
| **Mandatory** | **Yes** |
| **Respects Preferences** | No |
| **Template** | `payment_refund` |
| **Priority** | **P0** |

**Required Payload**

```
payer_name
refund_amount_cents
original_amount_cents
currency             "USD"
description          reason for refund
refund_date
estimated_arrival    "3–5 business days"
transaction_id       Stripe refund_id
original_transaction_id
```

---

### R1 — Lesson Reminder

| Field | Value |
|-------|-------|
| **Recipient** | Coach and Player (send separately) |
| **Trigger** | Scheduled job — 24h before and 1h before confirmed lesson |
| **Email** | OFF (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.push.reminders` |
| **Template** | `reminder_lesson` |
| **Priority** | P2 |

**Required Payload**

```
recipient_name
other_party_name     coach name (for player) or player name (for coach)
lesson_type
confirmed_date
confirmed_time_start
confirmed_time_end
location
minutes_until        60 | 1440
request_id           for deep link
```

---

### R2 — Court Reminder

| Field | Value |
|-------|-------|
| **Recipient** | Resident who booked |
| **Trigger** | Scheduled job — 1h before court reservation start time |
| **Email** | OFF (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.push.reminders` |
| **Template** | `reminder_court` |
| **Priority** | P2 |

**Required Payload**

```
resident_name
court_name
booking_date
start_time
end_time
play_type
booking_id
```

---

### R3 — Match Reminder

| Field | Value |
|-------|-------|
| **Recipient** | Both players (send separately) |
| **Trigger** | Scheduled job — 24h before and 1h before match |
| **Email** | OFF (default) |
| **Push** | ON (default) |
| **In-App** | Yes |
| **Mandatory** | No |
| **Respects Preferences** | Yes — `pref.push.reminders` |
| **Template** | `reminder_match` |
| **Priority** | P2 |

**Required Payload**

```
recipient_name
opponent_name
match_type
match_date
match_time
court_name
minutes_until        60 | 1440
match_id             for deep link
```

---

## User Preference Keys

Preferences are stored per-user in `notification_preferences` (or equivalent). Channels that are `Mandatory` are never gated by these keys.

| Key | Controls | Default |
|-----|----------|---------|
| `pref.email.account` | Signup welcome | ON |
| `pref.email.matches` | All match email notifications | ON |
| `pref.email.messages` | Message received email | OFF |
| `pref.email.coaching` | All coaching email notifications | ON |
| `pref.email.courts` | Court booking emails | ON |
| `pref.email.hoa` | HOA status emails | ON |
| `pref.push.matches` | All match push notifications | ON |
| `pref.push.messages` | New message push | ON |
| `pref.push.coaching` | All coaching push notifications | ON |
| `pref.push.courts` | Court booking push | ON |
| `pref.push.hoa` | HOA status push | ON |
| `pref.push.reminders` | All reminder push notifications | ON |

---

## Template Index

| Template Name | Event | Channel |
|---------------|-------|---------|
| `auth_welcome` | A1 Signup | Email |
| `auth_verify_email` | A2 Verification | Email |
| `auth_password_reset` | A3 Password Reset | Email |
| `match_request_received` | M1 | Email + Push + In-App |
| `match_accepted` | M2 | Email + Push + In-App |
| `match_declined` | M3 | Email + Push + In-App |
| `match_cancelled` | M4 | Email + Push + In-App |
| `message_new` | MS1 | Push + In-App |
| `lesson_request_received` | C1 | Email + Push + In-App |
| `lesson_accepted` | C2 | Email + Push + In-App |
| `lesson_declined` | C3 | Email + Push + In-App |
| `lesson_cancelled` | C4 | Email + Push + In-App |
| `booking_confirmation` | CR1 | Email + Push + In-App |
| `booking_cancelled` | CR2 | Email + Push + In-App |
| `hoa_approved` | H1 | Email + Push + In-App |
| `hoa_rejected` | H2 | Email + Push + In-App |
| `payment_receipt` | P1 | Email + In-App |
| `payment_refund` | P2 | Email + Push + In-App |
| `reminder_lesson` | R1 | Push + In-App |
| `reminder_court` | R2 | Push + In-App |
| `reminder_match` | R3 | Push + In-App |

---

## Launch Priority Summary

### P0 — Required for App Store submission
- A2 Account verification (Supabase native, needs custom SMTP branding)
- A3 Password reset (Supabase native, needs deep link — see P0-012)
- P1 Payment receipt (mandatory with every Stripe charge)
- P2 Refund issued (mandatory)

### P1 — Required before public launch
- A1 Signup welcome
- MS1 New message push
- C1–C4 All coaching notifications (lesson request, accept, decline, cancel)
- CR1 Reservation confirmed (blocked by P1-006)
- CR2 Reservation cancelled (blocked by P1-007)
- H1–H2 HOA join approved / rejected

### P2 — Post-launch / Stage 2 features
- M1–M4 All match notifications (matches are Stage 2)
- R1–R3 All reminder notifications (requires scheduled job infrastructure)

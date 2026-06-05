# Match Screen — Design Spec

**Version:** 1.0  
**Date:** 2026-06-04  
**Status:** Approved for implementation

---

## Goal

Replace the placeholder `(resident)/match.tsx` with a fully functional Match screen
that lets players find opponents, accept/decline requests, and manage upcoming matches.

---

## Scope: This build

- Singles and Hitting Session flows: **fully functional**
- Doubles / Mixed Doubles: **UI display only** — real 2-player data, no faked participant counts
- Group conversations: **not implemented** — TODO comments scaffold next phase

---

## Files

| File | Action |
|---|---|
| `src/app/(resident)/match.tsx` | Full rewrite |
| `src/components/ui/WeatherMini.tsx` | New shared component |
| `supabase/migrations/YYYYMMDD_extend_match_type.sql` | Extend enum |
| `src/app/messages.tsx` | Add `?partner=<id>` deep-link support |

---

## Schema

### Migration (this build)
```sql
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'mixed_doubles';
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'hitting_session';
```

### Proposed follow-up migration (doubles/group phase — NOT this build)
```sql
-- Participant tracking for doubles requests
CREATE TABLE match_request_participants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES match_requests(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team        smallint NOT NULL CHECK (team IN (1, 2)),  -- 1 = challenger team, 2 = opponent team
  status      match_status NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, player_id)
);

-- Group conversations
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  match_id    uuid REFERENCES matches(id) ON DELETE SET NULL,
  request_id  uuid REFERENCES match_requests(id) ON DELETE SET NULL
);
CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE conversation_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         text NOT NULL,
  event_type      text,   -- 'accept' | 'decline' | 'reschedule' | 'cancel' | null (plain message)
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_by         uuid[]  -- array of user IDs who have read this message
);
```

---

## Color rules for this screen

| Element | Color |
|---|---|
| Incoming request left rail | `#2D6BFF` (Intelligent Blue) |
| Upcoming match left rail | `#2FD98B` (Positive Green) |
| Accept button / Request to Play / Reschedule | `#2FD98B` outline+text |
| Message button / Player Lookup / Edit Filters / request badge | `#2D6BFF` outline+text |
| Decline / Cancel button | `#FF5C6B` outline+text |
| Active Match tab | `#2D6BFF` |

**No Tennis Volt on this screen.**

---

## Weather icons (vector, no emoji)

Use Lucide React Native:
- `Sun` — sunny / clear
- `Cloud` — cloudy / overcast
- `CloudSun` — partly cloudy
- `CloudRain` — rainy / drizzle
- `CloudSnow` — snow
- `Zap` — stormy / thunderstorm

---

## Doubles display rules (this build)

- Show challenger avatar + current user avatar in slots 1 and 2
- Show "2 empty" placeholder avatars for slots 3 and 4 with dashed border
- Do NOT show "3 OF 4 CONFIRMED" — show "2 OF 4 CONFIRMED" or simply the slots
- Add `// TODO(doubles): replace with match_request_participants query` comment

---

## Messaging

- Singles / Hitting Session: `router.push('/messages?partner=<id>')`
- Doubles / Mixed Doubles: same as above (1:1 with challenger) + `// TODO(group-chat): open group conversation once conversations table exists`
- `messages.tsx` reads `?partner` param on mount and auto-opens that thread

---

## Action sheet pattern (all four)

1. Modal rises from bottom (slide-up animation)
2. Optional TextInput for personal message
3. Quick-reply chips (tap to pre-fill input)
4. Two CTA buttons: "Send & [Action]" / "[Action] Only"
5. On confirm: Supabase UPDATE to `match_requests.status`, then INSERT to `messages` with structured text
6. Dismiss on success

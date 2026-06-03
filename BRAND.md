# TenisX Brand Guide

## Positioning

TenisX is the Operating System for Tennis.

It is not an HOA portal.
It is not a generic reservation app.
It is a premium tennis technology platform for players, clubs, communities, coaches, and future public court networks.

The product should feel:
- premium
- athletic
- intelligent
- social
- fast
- mobile-first
- AI-native
- modern
- competitive

Avoid:
- HOA portal aesthetics
- generic SaaS dashboards
- cartoon tennis graphics
- clutter
- excessive text
- cheap startup styling
- childish icons
- over-rounded capsule buttons

## Visual Philosophy

TenisX should combine:
- Apple-level product clarity
- WHOOP-style performance intelligence
- Nike Tennis athletic confidence
- Formula 1 precision
- premium mobile sports-app execution

Design should feel like a serious sports technology platform, not community management software.

## Core Palette

Primary canvas:
- Midnight: #0C0F18
- Court Blue: #0F2A57

Interaction blues:
- Intelligent Blue: #2D6BFF
- Electric Cyan: #2DE0FF
- Cyan Highlight: #7FF0FF
- AI Glow: #BFFCFF

Athletic accent:
- Tennis Volt: #D6FF3D

Status:
- Positive: #2FD98B
- Negative / Coral: #FF5C6B

Dark neutral surfaces:
- Page background: #0C0F18
- Elevated background: #11141F
- Card background: #161A26
- Secondary surface: #1B2030
- Border: #232838
- Strong border: #333A4D

Dark text:
- Primary: #F5F8FF
- Secondary: #9AA3B8
- Muted: #7A839A
- Disabled: #5A6379

Light mode direction:
- Light mode should not feel plain white or generic.
- Use cool off-white canvas, white elevated cards, navy text, dark navy header, and controlled blue/cyan accents.
- Header should remain dark navy in both modes to preserve brand identity.
- Light mode needs contrast, depth, subtle shadows, and strong text hierarchy.

Suggested light tokens:
- Page background: #F4F6FA
- Card background: #FFFFFF
- Elevated surface: #FFFFFF
- Secondary surface: #EEF1F8
- Text primary: #0C0F18
- Text secondary: #3D4A5C
- Text muted: #6B7280
- Border: rgba(15,31,61,0.10)
- Strong border: rgba(15,31,61,0.20)
- Header background: #0F2A57

## Typography

Use:
- Space Grotesk Bold for major display titles and high-impact screen titles.
- Manrope for body, labels, buttons, and UI copy.
- JetBrains Mono SemiBold for technical labels, eyebrow text, status lines, metadata, small uppercase labels, and intelligence indicators.

Typography personality:
- clean
- technical
- athletic
- sharp
- premium
- readable on mobile

Avoid tiny low-contrast metadata.

## Button Geometry

Use the Play Now button as the reference geometry.

Button shape:
- straight vertical sides
- rounded corners
- not fully pill-shaped
- radius around 12–14px
- height generally 40–52px depending on importance

Avoid overusing capsule pills.

Apply this geometry to:
- date selectors
- duration controls
- segmented controls
- report categories
- booking actions
- settings selectors

Do not apply to:
- icon-only circular controls
- bottom navigation icons

## Component Direction

Cards:
- clean, spacious, strong hierarchy
- subtle borders
- meaningful status accents
- avoid clutter

Court cards:
- court/facility name should be the visual anchor
- availability status should be instantly readable
- primary CTA should be clear
- secondary actions should not overpower primary action

Weather:
- should feel like play intelligence, not a generic weather widget
- outdoor facilities show weather
- indoor facilities hide weather
- use icon + temp + rain risk
- avoid long text like "Prime Playing Conditions"

Schedule:
- available = cyan
- reserved = muted blue/gray
- maintenance = coral/red
- my reservation = volt/lime
- maintenance details should not be exposed to residents

Report Issue:
- use "Report Issue," not "Report Court Issue," because it applies to all amenities
- categories should be facility-specific
- icons must match meaning

## Product Language

Preferred:
- Reserve
- Play Now
- View Schedule
- Report Issue
- Upcoming Reservations
- My HOA / Club
- Other
- Tennis
- Amenities

Avoid resident-facing:
- HOA portal
- amenity management
- maintenance window
- booking window
- admin language
- generic reservation software language

## UX Principles

The app should answer quickly:
- Can I play?
- Where can I play?
- When can I play?
- What do I have booked?
- Is the weather good enough?

Default experience:
- tennis-first
- My HOA / Club first
- Tennis selected by default
- Amenities supported but secondary

Reserve hierarchy:
Reserve
→ My HOA / Club / Other
→ Tennis / Amenities
→ Facility card
→ Booking sheet
→ Date
→ Time
→ Confirm

## Implementation Rules

When implementing UI:
- follow DESIGN.md and this BRAND.md
- do not hardcode one-off styling if a token exists
- keep touch targets at least 44–48px
- preserve mobile-first layout
- avoid full Playwright suite unless explicitly requested
- use TypeScript validation and targeted tests only

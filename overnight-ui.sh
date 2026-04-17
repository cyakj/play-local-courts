#!/bin/bash
set -e

echo "Starting TenisX overnight UI rework..."

claude -p "Read CLAUDE.md fully. This is screen 1 of 5.
Redesign src/pages/CMPortfolio.tsx using the
TenisX Lumina Slate design system exactly as follows:

DESIGN SYSTEM - LUMINA SLATE:
Page background: #F9FAFB
Card background: #FFFFFF
Header background: #0F1F3D (deep navy)
Primary accent (AI Cyan): #00D4FF
Primary text: #0F1F3D
Muted text: #8892A4
Warning/attention: #F97066 (coral)
Success/optimal: #00D4FF (cyan)
Border: rgba(15,31,61,0.08)
Fonts: Manrope ExtraBold for headlines, Inter for body
Card border-radius: 16px
Button/pill border-radius: 8px
Card shadow: 0px 12px 32px rgba(15,31,61,0.04)
Glassmorphism on nav: backdrop-blur with bg-white/80

SPECIFIC RULES:
- Header: #0F1F3D deep navy background, white text
- Portfolio Health number: cyan #00D4FF glow effect
  add subtle box-shadow: 0 0 20px rgba(0,212,255,0.3)
- Active nav items: #00D4FF cyan
- Health score color logic:
  >= 70: #00D4FF cyan
  >= 40: #F97066 coral
  < 40: #EF4444 red
- Status pills:
  Optimal: cyan tinted bg, #00D4FF border
  Needs Attention: coral tinted bg, #F97066 border
  Critical: red tinted bg, #EF4444 border
- Stats row tiles: #0F1F3D dark navy background
  white numbers, #8892A4 labels, cyan icons
- Community cards: white, soft shadow,
  cyan left border if optimal,
  coral left border if needs attention
- Manage arrow: #00D4FF cyan
- Bottom nav: white/80 glassmorphic blur,
  active: #00D4FF, inactive: #8892A4
- Add subtle cyan glow to key AI metrics
- Import Manrope and Inter from Google Fonts
  if not already in index.html

Verify npm run dev compiles with no errors.
Git commit: 'UI redesign: CMPortfolio Lumina Slate'"

claude -p "Read CLAUDE.md and src/pages/CMPortfolio.tsx
for exact style reference. Screen 2 of 5.
Find and redesign the Community Detail screen.
Apply identical Lumina Slate design system as CMPortfolio:
- Same header style (#0F1F3D navy)
- Same card styles (white, soft shadow, 16px radius)
- Same color logic for health scores
- Same font system (Manrope/Inter)
- Same cyan glow on key metrics
- Keep ALL chart data and logic intact
- Fix scrolling so full page scrolls freely
- Health score card NOT overlapping header
- Quick action cards text not overflowing
- Tab bar fully visible (all 4 tabs)
- Issues trend bars color coded:
  Critical: #EF4444, Moderate: #F97066,
  Resolved: #E5E7EB
- YTD period goes back 12 months from today
Verify npm run dev compiles.
Git commit: 'UI redesign: Community Detail Lumina Slate'"

claude -p "Read CLAUDE.md and src/pages/CMPortfolio.tsx
for exact style reference. Screen 3 of 5.
Find and redesign the Maintenance/Issues Reports screen
(MaintenanceReports or equivalent).
Apply identical Lumina Slate design system.
Specific to this screen:
- Header: #0F1F3D navy, white text
- Filter tabs (All/Open/In Progress/Resolved):
  pill style, active cyan #00D4FF
- Issue cards: white, 16px radius, soft shadow
- Issue status badges color coded:
  Open: coral #F97066
  In Progress: cyan #00D4FF
  Resolved: #8892A4 gray
- Community filter tabs consistent with tab style
- Severity badges: same color logic
- 'View Details' link: #00D4FF cyan
Verify npm run dev compiles.
Git commit: 'UI redesign: Maintenance Reports Lumina Slate'"

claude -p "Read CLAUDE.md and src/pages/CMPortfolio.tsx
for exact style reference. Screen 4 of 5.
Find and redesign the Resident home screen.
Apply identical Lumina Slate design system.
Specific to this screen:
- Header: #0F1F3D navy, greeting white
- Resident name large Manrope ExtraBold white
- Info cards: white, 16px radius, soft shadow
- Booking CTA button: #00D4FF cyan background
  white text, subtle cyan glow
- Court availability indicators: cyan if available,
  coral if unavailable
- Upcoming bookings: white cards, cyan accent
- Issue report button: coral #F97066
- Bottom nav: same glassmorphic style
Verify npm run dev compiles.
Git commit: 'UI redesign: Resident home Lumina Slate'"

claude -p "Read CLAUDE.md and src/pages/CMPortfolio.tsx.
Final consistency pass — screen 5 of 5.
Review ALL Stage 1 components in CLAUDE.md.
Check every screen for:
- Consistent header style (#0F1F3D navy everywhere)
- Consistent card style (white, shadow, 16px radius)
- Consistent font usage (Manrope headlines, Inter body)
- Consistent color usage (cyan, coral, navy only)
- Consistent bottom nav style across all screens
- No leftover green (#059669, #064E3B, #34D399)
  anywhere in Stage 1 components
- No emoji icons — SVG stroke icons only
- Minimum text color #8892A4 on light backgrounds
- Minimum text color white/0.75 on dark backgrounds
- All labels uppercase with letter-spacing: 0.08em
Fix every inconsistency found.
Verify npm run dev compiles with no errors.
Git commit: 'UI redesign: Lumina Slate consistency pass'"

echo "Overnight UI rework complete!"
echo "Run: git log --oneline to see all commits"
echo "Run: npm run dev to preview"

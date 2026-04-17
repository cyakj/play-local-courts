$ErrorActionPreference = "Stop"

Write-Host "Starting TenisX overnight UI rework..."

claude -p @"
Read CLAUDE.md fully. Screen 1 of 5.
Redesign src/pages/CMPortfolio.tsx completely.

DESIGN SYSTEM - LUMINA SLATE:
Page background: #F9FAFB
Card background: #FFFFFF
Header: #0F1F3D deep navy
Primary accent: #00D4FF cyan
Primary text: #0F1F3D
Muted text: #8892A4
Warning: #F97066 coral
Border: rgba(15,31,61,0.08)
Fonts: Manrope ExtraBold headings, Inter body
Card radius: 16px, shadow: 0px 12px 32px rgba(15,31,61,0.04)

HEADER SECTION:
- Background #0F1F3D full width
- TenisX logo top left: src='/images/tenisx-logo.svg'
  height 56px, width auto, filter brightness(0) invert(1)
- Notification bell top right, white, red badge
- Hamburger menu icon white
- 'WELCOME BACK' label: 11px Inter, #00D4FF cyan,
  letter-spacing 0.15em uppercase
- Greeting 'Good evening Ron' Manrope ExtraBold
  28px white
- Subtitle 'Your portfolio is being monitored...'
  15px Inter white opacity 0.75
- Portfolio Health badge: #00D4FF background,
  rounded-2xl, padding 12px 20px
  'Portfolio Health' 11px white label above
  Large bold white number with cyan glow:
  box-shadow: 0 0 20px rgba(0,212,255,0.4)
  'updated daily' 10px below

STATS ROW (single row of 4, inside header area):
- 4 equal tiles, background rgba(255,255,255,0.08)
  border: 1px solid rgba(255,255,255,0.12)
  border-radius 12px, padding 12px 8px
- Each tile: SVG icon top (cyan #00D4FF, 18px)
  then large white number (22px Manrope Bold)
  then label (10px Inter uppercase white 0.6 opacity
  letter-spacing 0.08em)
- Icons (SVG stroke, no emoji):
  Units: grid/building icon
  Issues: wrench icon
  Bookings: calendar icon
  Pending: hourglass icon
- Gap 8px between tiles
- Labels: UNITS, ISSUES, BOOKINGS, PENDING
  all fit -- reduce to 9px if needed

MY COMMUNITIES SECTION:
- Page background #F9FAFB
- Section title 'My Communities' 18px Manrope Bold
  color #0F1F3D, margin 20px horizontal
- Community cards full width, stacked vertically,
  NEVER horizontal
- Each card: white background, border-radius 16px
  shadow: 0px 12px 32px rgba(15,31,61,0.04)
  padding 20px, margin 0 16px 12px
- Card header row:
  Community name: 17px Manrope Bold #0F1F3D left
  Status pill right:
  Optimal: bg #E0F9FF, text #0369A1,
    border 1px solid #00D4FF, radius 99px,
    font 11px Inter, padding 4px 10px
  Needs Attention: bg #FFF5F5, text #C0392B,
    border 1px solid #F97066
  Critical: bg #FEF2F2, text #991B1B,
    border 1px solid #EF4444
- Below name: '20 units · 2 amenities'
  12px Inter #8892A4
- Health score row:
  'Health Score' label 11px uppercase #8892A4 left
  Score value right, color from getHealthColor():
  const getHealthColor = (score) =>
    score >= 70 ? '#00D4FF' :
    score >= 40 ? '#F97066' : '#EF4444'
- Progress bar: height 4px, radius 99px,
  background #F3F4F6, fill color from getHealthColor()
- Stats row (4 columns, NO boxes or borders):
  divider line above: 1px rgba(15,31,61,0.06)
  padding-top 14px, margin-top 14px
  Each: number 20px Manrope Bold #0F1F3D centered
  label 11px Inter #8892A4 uppercase centered
  letter-spacing 0.06em
- 'Manage ->' 13px Inter #00D4FF font-weight 600
  text-align right, margin-top 12px

ADD COMMUNITY CARD:
- White, border-radius 16px,
  border: 1.5px dashed rgba(15,31,61,0.15)
  padding 24px, margin 0 16px 12px
  centered + icon (24px, #8892A4) and
  'Add Community' 14px Inter #8892A4 font-weight 500

BOTTOM NAV:
- background white/80 backdrop-blur-md
  border-top: 1px solid rgba(15,31,61,0.08)
  padding 12px 0 28px
- 4 tabs: Portfolio, Issues, Calendar, Alerts
- Active: #00D4FF icon + label,
  4px cyan dot below label
- Inactive: #8892A4
- NO background pills on active tab
- Alerts tab: red badge on bell icon

TYPOGRAPHY MINIMUMS:
- No text smaller than 11px anywhere
- Body text minimum #4B5563 on white backgrounds
- All text on dark header minimum white 0.75 opacity

Do not touch data fetching, Supabase, state,
or navigation logic.
Run npm run dev. Fix any compile errors.
Git commit: 'UI redesign: CMPortfolio Lumina Slate'
"@

claude -p @"
Read CLAUDE.md and src/pages/CMPortfolio.tsx
for exact style reference. Screen 2 of 5.
Find the Community Detail screen component.

Apply identical Lumina Slate system from CMPortfolio.
Additional specs for this screen:

HEADER:
- Same #0F1F3D navy as CMPortfolio
- Back arrow white top left (SVG chevron)
- Community name large Manrope ExtraBold white
- Unit count subtitle white 0.75 opacity
- Status pill top right (same pill style as CMPortfolio)
- Health Score card INSIDE header but scrolls WITH page:
  NOT fixed or overlapping -- part of normal flow
  White card, radius 16px, padding 20px
  'COMMUNITY HEALTH SCORE' 11px cyan uppercase
  Score number large Manrope Bold getHealthColor()
  with subtle glow effect
  'updated daily' 11px #8892A4
  4px progress bar getHealthColor() fill
- Period tabs (Week/3M/12M/YTD):
  pill style, active white on rgba(255,255,255,0.15)
  inactive white 0.5 opacity

TAB BAR:
- Overview/Reports/Amenities/Members
- All 4 tabs visible -- font-size 14px
  if overflow: font-size 13px
- Active: #00D4FF underline 2px
- Inactive: #8892A4
- border-bottom 1px rgba(15,31,61,0.08)

OVERVIEW STATS (2x2 grid):
- White cards, radius 12px,
  shadow 0px 8px 24px rgba(15,31,61,0.04)
- SVG icon top left #00D4FF (no emoji)
- Stat number 24px Manrope Bold #0F1F3D
- Label 11px Inter uppercase #8892A4
- Status tag (PERFECT/CLEAR):
  same cyan pill style as Optimal
- gap 12px between cards

ISSUES TREND CARD:
- White card, radius 16px, padding 20px
- Title 18px Manrope Bold #0F1F3D
- Subtitle 13px Inter #8892A4
- 3 mini stat boxes in a row:
  background #F9FAFB, radius 8px, padding 12px
  label 11px #8892A4 above, bold number below
  equal width, gap 8px
- Bar chart 7 bars Mon-Sun:
  Critical: #EF4444
  Moderate: #F97066
  Resolved: #E5E7EB
  Value label above active bar: 12px bold #0F1F3D
  X-axis labels 11px #8892A4
- Avg dashed line: #8892A4, label 12px visible
- Legend: 3 colored dots + labels 11px #8892A4
- YTD range: start 12 months ago from today
- KEEP all existing chart data and logic intact

QUICK ACTIONS (2x2 grid):
- White cards radius 16px
  shadow 0px 8px 24px rgba(15,31,61,0.04)
- Each card: min-height 72px, padding 16px
  display flex, align-items center, gap 12px
- Icon square: 40x40px radius 10px flex-shrink 0
  Post Announcement: bg #FFF5F5, icon #F97066
  Approve Members: bg #E0F9FF, icon #00D4FF
  Manage Documents: bg #FFFBEB, icon #D97706
  Manage Surveys: bg #EFF6FF, icon #3B82F6
- Label: 14px Manrope SemiBold #0F1F3D
  line-height 1.3, allow 2 line wrap
  NO overflow hidden, NO white-space nowrap

SCROLLING:
- Full page scrolls freely
- No content cut off
- Main container: overflow-y auto, height 100vh

Do not touch data, charts logic, Supabase, navigation.
Run npm run dev. Fix compile errors.
Git commit: 'UI redesign: Community Detail Lumina Slate'
"@

claude -p @"
Read CLAUDE.md and src/pages/CMPortfolio.tsx
for exact style reference. Screen 3 of 5.
Find and redesign the Maintenance/Issues Reports screen.

Apply Lumina Slate system. Specific to this screen:

HEADER:
- #0F1F3D navy, white text
- Title 'Maintenance Reports' Manrope ExtraBold white
- Subtitle 'All communities · real time' white 0.75
- Stat badges top right:
  Open count: coral #F97066 pill
  In Progress count: cyan #00D4FF pill

COMMUNITY FILTER TABS:
- All / The Greens / DBE
- Pill style tabs in a scrollable row
- Active: #0F1F3D bg white text
- Inactive: #F9FAFB bg #8892A4 text
- radius 99px, padding 6px 16px

STATUS FILTER:
- Single row: All / Open / In Progress / Resolved
- Same pill style as community tabs
- Active: #00D4FF bg white text
- gap 8px between pills

ISSUE CARDS:
- White, radius 16px, padding 16px 20px
  shadow 0px 8px 24px rgba(15,31,61,0.04)
  margin bottom 10px
- Location name: 16px Manrope Bold #0F1F3D
- Community tag: 12px Inter #00D4FF
- Description: 13px Inter #4B5563
  max 2 lines then ellipsis
- Reporter + date: 12px Inter #8892A4
- Status badge top right:
  Open: coral pill
  In Progress: cyan pill
  Resolved: gray #E5E7EB pill text #4B5563
- Severity badge: small pill below status
  High: #FEF2F2 text #991B1B
  Medium: #FFF5F5 text #C0392B
  Low: #F9FAFB text #8892A4
- 'View Details ->' 13px #00D4FF bottom right

Do not touch data fetching, filters logic, Supabase.
Run npm run dev. Fix compile errors.
Git commit: 'UI redesign: Maintenance Reports Lumina Slate'
"@

claude -p @"
Read CLAUDE.md and src/pages/CMPortfolio.tsx
for exact style reference. Screen 4 of 5.
Find and redesign the Resident home screen.

Apply Lumina Slate system. Specific to this screen:

HEADER:
- #0F1F3D navy
- Avatar circle top left with initials, cyan border
- 'Good evening [name]' Manrope ExtraBold white 26px
- Community name subtitle white 0.75
- Notification bell top right white with red badge

INFO CARDS ROW:
- Horizontal scroll row of info cards
- White cards, radius 16px, padding 16px
  min-width 140px
  shadow 0px 8px 24px rgba(15,31,61,0.04)
- Next booking, open issues, announcements

COURT BOOKING CTA:
- Full width card, #0F1F3D background
  or cyan gradient suggestion
- 'Book a Court' Manrope Bold white 18px
- Subtitle white 0.75
- Book Now button: #00D4FF bg white text
  radius 8px, padding 12px 24px
  glow: box-shadow 0 0 20px rgba(0,212,255,0.4)

UPCOMING BOOKINGS:
- Section title Manrope Bold #0F1F3D
- White cards, radius 16px
- Court name, date/time, status badge
- Status: Confirmed cyan, Pending coral

RECENT ANNOUNCEMENTS:
- White cards, radius 16px
- Title Manrope SemiBold #0F1F3D
- Date 11px #8892A4
- Preview text 13px #4B5563

REPORT ISSUE BUTTON:
- Full width, coral #F97066 background
  white text Manrope Bold
  radius 12px, padding 16px

BOTTOM NAV:
- Same as CMPortfolio exactly

Do not touch data, Supabase, navigation logic.
Run npm run dev. Fix compile errors.
Git commit: 'UI redesign: Resident home Lumina Slate'
"@

claude -p @"
Read CLAUDE.md and src/pages/CMPortfolio.tsx.
Final consistency pass -- screen 5 of 5.

Review ALL Stage 1 components in CLAUDE.md.
For each component check and fix:

COLORS:
- No leftover green (#059669, #064E3B, #34D399,
  #1A6B4A, #F0FDF4, #065F46) anywhere
- All headers: #0F1F3D navy
- All accents: #00D4FF cyan only
- All warnings: #F97066 coral only
- All page backgrounds: #F9FAFB
- All card backgrounds: white

TYPOGRAPHY:
- All headlines: Manrope (check font-family)
- All body: Inter
- No text smaller than 11px
- All labels uppercase with letter-spacing 0.06em
- Minimum color #8892A4 on white backgrounds
- Minimum white/0.75 on dark backgrounds

COMPONENTS:
- All cards: radius 16px, correct shadow
- All pills: radius 99px
- All buttons: radius 8px
- No emoji anywhere -- SVG stroke icons only
- All icon colors: cyan #00D4FF on dark,
  colored on light backgrounds

LAYOUT:
- All community cards full width vertical stack
- All pages scroll freely
- No content cut off or overlapping
- Consistent horizontal padding 20px
- Consistent gap between cards 12px

BOTTOM NAV:
- Identical across all screens
- Glassmorphic white/80 backdrop-blur
- Active cyan, inactive gray
- Same icons, same sizing

Fix every inconsistency found across all files.
Run npm run dev. Fix all compile errors.
Git commit: 'UI redesign: Lumina Slate consistency pass'
"@

Write-Host "Overnight complete!"
Write-Host "Run: git log --oneline"
Write-Host "Run: npm run dev to preview"

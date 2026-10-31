// Sizes shared by every Resident header layout so the TenisX and community logos look the same on every screen.
export const HEADER_BRAND = {
  tenisxHeight: 36,
  communityHeight: 36,
  communityMaxWidth: 220,
} as const;

/** Minimum 44pt touch target (Apple HIG); 48 gives a visible, comfortable chip. */
export const BACK_BUTTON = { size: 48, icon: 22, stroke: 2.25 } as const;

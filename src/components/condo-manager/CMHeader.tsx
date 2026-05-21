import React from 'react';

interface CMHeaderProps {
  children: React.ReactNode;
  compact?: boolean;
}

export const CMHeader = ({ children, compact }: CMHeaderProps) => (
  <div
    className="flex-shrink-0 text-white border-0"
    style={{
      background: 'linear-gradient(135deg, hsl(var(--cm-navy)) 0%, hsl(var(--cm-navy-mid)) 60%, hsl(var(--cm-navy-light)) 100%)',
      padding: compact ? '50px 20px 18px' : '50px 20px 24px',
    }}
  >
    {children}
  </div>
);

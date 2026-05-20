import React from 'react';

interface ResidentHeaderProps {
  children: React.ReactNode;
  compact?: boolean;
}

const ResidentHeader: React.FC<ResidentHeaderProps> = ({ children, compact }) => (
  <div
    className="text-white flex-shrink-0"
    style={{ backgroundColor: '#0F1F3D', padding: compact ? '12px 20px 14px' : '12px 20px 16px' }}
  >
    {children}
  </div>
);

export default ResidentHeader;

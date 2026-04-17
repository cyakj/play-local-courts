import React from 'react';

interface ResidentHeaderProps {
  children: React.ReactNode;
  compact?: boolean;
}

const ResidentHeader: React.FC<ResidentHeaderProps> = ({ children, compact }) => (
  <div
    className="text-white flex-shrink-0"
    style={{ backgroundColor: '#0F1F3D', padding: compact ? '50px 20px 18px' : '50px 20px 24px' }}
  >
    {children}
  </div>
);

export default ResidentHeader;

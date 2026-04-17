import React from 'react';

interface SurveyStatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#E6FFFA', color: '#00D4FF', label: 'Active' },
  draft: { bg: '#FFFBEB', color: '#F59E0B', label: 'Draft' },
  closed: { bg: '#F3F4F6', color: '#9CA3AF', label: 'Closed' },
};

export const SurveyStatusBadge: React.FC<SurveyStatusBadgeProps> = ({ status }) => {
  const s = statusMap[status] || statusMap.draft;
  return (
    <div
      className="inline-flex items-center rounded-full text-[11px] font-bold"
      style={{ background: s.bg, color: s.color, padding: '4px 10px' }}
    >
      {s.label}
    </div>
  );
};

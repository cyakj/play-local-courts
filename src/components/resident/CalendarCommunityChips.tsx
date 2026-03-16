import React from 'react';

interface Community {
  hoaId: string;
  name: string;
}

interface CalendarCommunityChipsProps {
  communities: Community[];
  activeCommunity: string; // 'all' or hoaId
  onSelect: (val: string) => void;
}

const CalendarCommunityChips = ({ communities, activeCommunity, onSelect }: CalendarCommunityChipsProps) => (
  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
    {['all', ...communities.map(c => c.hoaId)].map(id => {
      const label = id === 'all' ? 'All' : communities.find(c => c.hoaId === id)?.name || '';
      const isActive = activeCommunity === id;
      return (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className="whitespace-nowrap flex-shrink-0 text-xs font-bold rounded-full px-4 py-[7px] transition-colors"
          style={{
            background: isActive ? 'hsl(var(--navy))' : 'hsl(var(--card))',
            color: isActive ? '#fff' : 'hsl(var(--muted-foreground))',
            border: isActive ? '1px solid hsl(var(--navy))' : '1px solid hsl(var(--border))',
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);

export default CalendarCommunityChips;

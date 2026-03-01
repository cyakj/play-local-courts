import React from 'react';
import { Button } from '@/components/ui/button';

interface FilterChipsProps {
  filters: { label: string; value: string }[];
  activeFilter: string;
  onChange: (value: string) => void;
}

const FilterChips = ({ filters, activeFilter, onChange }: FilterChipsProps) => (
  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
    {filters.map(f => (
      <Button
        key={f.value}
        variant={activeFilter === f.value ? 'default' : 'outline'}
        size="sm"
        className={`min-h-[36px] whitespace-nowrap rounded-full text-xs px-4 flex-shrink-0 ${
          activeFilter === f.value ? 'bg-compete hover:bg-compete/90 text-compete-foreground' : 'bg-card border-0 shadow-sm'
        }`}
        onClick={() => onChange(f.value)}
      >
        {f.label}
      </Button>
    ))}
  </div>
);

export default FilterChips;

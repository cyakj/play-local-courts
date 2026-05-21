import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CMChipsProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  light?: boolean;
}

export const CMChips = ({ options, value, onChange, light }: CMChipsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [options.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  const arrowBtn = (dir: 'left' | 'right', show: boolean) => (
    <button
      type="button"
      onClick={() => scrollBy(dir === 'left' ? -1 : 1)}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
      className="absolute top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-opacity"
      style={{
        [dir]: 0,
        background: light ? '#FFFFFF' : 'rgba(15,31,61,0.85)',
        color: light ? '#0F1F3D' : '#FFFFFF',
        border: `1px solid ${light ? '#E5E7EB' : 'rgba(255,255,255,0.15)'}`,
        opacity: show ? 1 : 0,
        pointerEvents: show ? 'auto' : 'none',
      } as React.CSSProperties}
    >
      {dir === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );

  return (
    <div className="relative">
      {arrowBtn('left', canLeft)}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' } as React.CSSProperties}
      >
        {options.map((opt) => (
          <div
            key={opt}
            onClick={() => onChange(opt)}
            className="cursor-pointer whitespace-nowrap flex-shrink-0 rounded-full px-3.5 py-1.5 transition-colors"
            style={
              light
                ? {
                    fontSize: 14,
                    fontWeight: 600,
                    background: value === opt ? '#0F1F3D' : '#F9FAFB',
                    color: value === opt ? '#FFFFFF' : '#4B5563',
                    border: `1px solid ${value === opt ? '#0F1F3D' : '#E5E7EB'}`,
                    scrollSnapAlign: 'start',
                  }
                : {
                    fontSize: 14,
                    fontWeight: 600,
                    background: value === opt ? 'rgba(0,180,216,0.25)' : 'rgba(255,255,255,0.1)',
                    color: value === opt ? '#fff' : 'rgba(255,255,255,0.7)',
                    border: `1px solid ${value === opt ? 'rgba(0,180,216,0.6)' : 'rgba(255,255,255,0.15)'}`,
                    scrollSnapAlign: 'start',
                  }
            }
          >
            {opt}
          </div>
        ))}
      </div>
      {arrowBtn('right', canRight)}
    </div>
  );
};

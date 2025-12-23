import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  startHour?: number;
  endHour?: number;
  className?: string;
  id?: string;
}

// Generate 30-minute increment time options
const generateTimeOptions = (startHour: number, endHour: number) => {
  const options: { value: string; label: string }[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minutes of [0, 30]) {
      if (hour === endHour && minutes === 30) continue; // Skip if it goes past end hour
      const timeValue = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const period = hour >= 12 ? 'PM' : 'AM';
      const label = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
      options.push({ value: timeValue, label });
    }
  }
  return options;
};

export const TimeSelect: React.FC<TimeSelectProps> = ({
  value,
  onChange,
  placeholder = 'Select time',
  startHour = 6,
  endHour = 22,
  className,
  id
}) => {
  const options = generateTimeOptions(startHour, endHour);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default TimeSelect;

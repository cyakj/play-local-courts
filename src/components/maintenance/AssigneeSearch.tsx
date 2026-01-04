import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface MaintenanceUser {
  id: string;
  full_name: string;
}

interface AssigneeSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const AssigneeSearch: React.FC<AssigneeSearchProps> = ({
  value,
  onChange,
  placeholder = "Search by name..."
}) => {
  const [searchResults, setSearchResults] = useState<MaintenanceUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for maintenance users when value changes
  useEffect(() => {
    const searchUsers = async () => {
      if (value.length < 1) {
        setSearchResults([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);
      try {
        // Search profiles with user_type = 'maintenance' or role containing maintenance
        // For now, we'll search all profiles and filter by name match
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .ilike('full_name', `%${value}%`)
          .limit(10);

        if (error) throw error;

        // Sort results by closest match (names starting with search term first)
        const sortedResults = (data || [])
          .filter(user => user.full_name)
          .sort((a, b) => {
            const aName = a.full_name?.toLowerCase() || '';
            const bName = b.full_name?.toLowerCase() || '';
            const searchLower = value.toLowerCase();
            
            // Prioritize names that start with the search term
            const aStartsWith = aName.startsWith(searchLower);
            const bStartsWith = bName.startsWith(searchLower);
            
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            
            // Then sort alphabetically
            return aName.localeCompare(bName);
          }) as MaintenanceUser[];

        setSearchResults(sortedResults);
        setIsOpen(sortedResults.length > 0);
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchUsers, 200);
    return () => clearTimeout(debounceTimeout);
  }, [value]);

  const handleSelectUser = (user: MaintenanceUser) => {
    onChange(user.full_name);
    setIsOpen(false);
    setSearchResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => {
          if (searchResults.length > 0) {
            setIsOpen(true);
          }
        }}
      />
      
      {isOpen && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {searchResults.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelectUser(user)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors",
                "first:rounded-t-lg last:rounded-b-lg"
              )}
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{user.full_name}</span>
            </button>
          ))}
        </div>
      )}
      
      {loading && value.length > 0 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

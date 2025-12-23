import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  CheckCircle, 
  XCircle, 
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { ProfileLink } from '@/components/ui/profile-link';
import { formatTime12Hour } from '@/lib/textUtils';

interface LessonRequest {
  id: string;
  player_id: string;
  player?: { full_name?: string; avatar_url?: string };
  sport: string;
  lesson_type: string;
  skill_level: string;
  preferred_date: string;
  preferred_time_start: string;
  preferred_time_end: string;
  location?: string;
  notes?: string;
  status: string;
  created_at: string;
}

interface LessonRequestsTableProps {
  requests: LessonRequest[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

type SortField = 'created_at' | 'preferred_date';
type SortOrder = 'asc' | 'desc';

export default function LessonRequestsTable({ 
  requests, 
  onAccept, 
  onDecline 
}: LessonRequestsTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [skillFilter, setSkillFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique values for filters
  const lessonTypes = useMemo(() => 
    [...new Set(requests.map(r => r.lesson_type))].filter(Boolean),
    [requests]
  );
  
  const skillLevels = useMemo(() => 
    [...new Set(requests.map(r => r.skill_level))].filter(Boolean),
    [requests]
  );
  
  const locations = useMemo(() => 
    [...new Set(requests.map(r => r.location))].filter(Boolean),
    [requests]
  );

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let result = [...requests];

    // Apply type filter
    if (typeFilter.length > 0) {
      result = result.filter(r => typeFilter.includes(r.lesson_type));
    }

    // Apply skill filter
    if (skillFilter.length > 0) {
      result = result.filter(r => skillFilter.includes(r.skill_level));
    }

    // Apply location filter
    if (locationFilter) {
      result = result.filter(r => 
        r.location?.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      const aValue = sortField === 'created_at' ? a.created_at : a.preferred_date;
      const bValue = sortField === 'created_at' ? b.created_at : b.preferred_date;
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : 1;
      }
      return aValue > bValue ? -1 : 1;
    });

    return result;
  }, [requests, sortField, sortOrder, typeFilter, skillFilter, locationFilter]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4" /> 
      : <ArrowDown className="h-4 w-4" />;
  };

  const clearFilters = () => {
    setTypeFilter([]);
    setSkillFilter([]);
    setLocationFilter('');
  };

  const hasActiveFilters = typeFilter.length > 0 || skillFilter.length > 0 || locationFilter;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Lesson Requests</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant={showFilters ? "default" : "outline"} 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {typeFilter.length + skillFilter.length + (locationFilter ? 1 : 0)}
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            {/* Sort by */}
            <Select 
              value={`${sortField}-${sortOrder}`} 
              onValueChange={(val) => {
                const [field, order] = val.split('-') as [SortField, SortOrder];
                setSortField(field);
                setSortOrder(order);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">Newest First</SelectItem>
                <SelectItem value="created_at-asc">Oldest First</SelectItem>
                <SelectItem value="preferred_date-asc">Date (Earliest)</SelectItem>
                <SelectItem value="preferred_date-desc">Date (Latest)</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Type {typeFilter.length > 0 && `(${typeFilter.length})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Lesson Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {lessonTypes.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={typeFilter.includes(type)}
                    onCheckedChange={(checked) => {
                      setTypeFilter(prev => 
                        checked 
                          ? [...prev, type]
                          : prev.filter(t => t !== type)
                      );
                    }}
                  >
                    {type}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Skill Level Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Skill {skillFilter.length > 0 && `(${skillFilter.length})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Skill Level</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {skillLevels.map(level => (
                  <DropdownMenuCheckboxItem
                    key={level}
                    checked={skillFilter.includes(level)}
                    onCheckedChange={(checked) => {
                      setSkillFilter(prev => 
                        checked 
                          ? [...prev, level]
                          : prev.filter(l => l !== level)
                      );
                    }}
                  >
                    {level}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Location Search */}
            <Input
              placeholder="Filter by location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-[180px]"
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filteredRequests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {requests.length === 0 ? 'No lesson requests yet' : 'No requests match your filters'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">#</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Student</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Sport</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Skill</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                    <button 
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort('preferred_date')}
                    >
                      Date <SortIcon field="preferred_date" />
                    </button>
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Location</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Notes</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request, index) => (
                  <tr key={request.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-3 text-sm text-muted-foreground">{index + 1}</td>
                    <td className="p-3">
                      <ProfileLink userId={request.player_id}>
                        <span className="font-medium text-sm">
                          {request.player?.full_name || 'Unknown'}
                        </span>
                      </ProfileLink>
                    </td>
                    <td className="p-3 text-sm capitalize">{request.sport}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {request.lesson_type}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm capitalize">{request.skill_level}</td>
                    <td className="p-3 text-sm">{request.preferred_date}</td>
                    <td className="p-3 text-sm whitespace-nowrap">
                      {formatTime12Hour(request.preferred_time_start)}
                    </td>
                    <td className="p-3 text-sm max-w-[150px] truncate" title={request.location}>
                      {request.location || '-'}
                    </td>
                    <td className="p-3 text-sm max-w-[150px] truncate" title={request.notes}>
                      {request.notes || '-'}
                    </td>
                    <td className="p-3">
                      <Badge 
                        variant={
                          request.status === 'pending' ? 'default' :
                          request.status === 'accepted' ? 'default' :
                          request.status === 'declined' ? 'destructive' : 'outline'
                        }
                        className={`text-xs ${request.status === 'accepted' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      >
                        {request.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {request.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onAccept(request.id)}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDecline(request.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

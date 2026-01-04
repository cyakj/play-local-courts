import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Wrench, Users, Heart, Clock } from 'lucide-react';
import TimeSelector from '../components/TimeSelector';
import CourtPoliciesDialog from '../components/CourtPoliciesDialog';
import { MultiStepReportDialog } from '../components/maintenance/MultiStepReportDialog';
import { useAmenityRules } from '../hooks/useAmenityRules';
import { AmenityStatus } from '../types';
import { cn } from '@/lib/utils';

const ReserveCourt = () => {
  const { currentUser } = useAuth();
  const { 
    amenities, 
    bookAmenity,
    hasBookingForDate 
  } = useData();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedAmenity, setSelectedAmenity] = useState<string>('');
  const [playType, setPlayType] = useState<'singles' | 'doubles' | 'family' | 'group'>('singles');
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [selectedEndTime, setSelectedEndTime] = useState<string>('');
  const [showPoliciesDialog, setShowPoliciesDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const { rules, loading: rulesLoading } = useAmenityRules(selectedAmenity);
  
  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const dateOptions = [
    { value: format(today, 'yyyy-MM-dd'), label: `Today (${format(today, 'MMMM d')})`, date: today },
    { value: format(tomorrow, 'yyyy-MM-dd'), label: `Tomorrow (${format(tomorrow, 'MMMM d')})`, date: tomorrow }
  ];

  // Get unique amenity types for filter tabs
  const amenityTypes = ['all', ...new Set(amenities.map(a => a.amenityType))];

  // Filter amenities based on active filter
  const filteredAmenities = activeFilter === 'all' 
    ? amenities 
    : amenities.filter(a => a.amenityType === activeFilter);

  const amenityTypeConfig: Record<string, { label: string; basePlayTypes: string[]; description: string }> = {
    tennis: { label: 'Courts', basePlayTypes: ['singles', 'doubles'], description: 'Professional grade courts with night lighting' },
    pickleball: { label: 'Courts', basePlayTypes: ['singles', 'doubles'], description: 'Dedicated pickleball courts' },
    pool: { label: 'Pools', basePlayTypes: ['family', 'group'], description: 'Heated pool with dedicated lap lanes' },
    barbecue: { label: 'Dining', basePlayTypes: ['family', 'group'], description: 'Outdoor BBQ and dining areas' },
    clubhouse: { label: 'Dining', basePlayTypes: ['family', 'group'], description: 'Perfect for events and gatherings' },
    gym: { label: 'Gym', basePlayTypes: ['singles', 'group'], description: 'Fully equipped fitness center' },
    jacuzzi: { label: 'Pools', basePlayTypes: ['family', 'group'], description: 'Relaxation spa' }
  };

  // Mock status for amenities - in production this would come from real-time data
  const getAmenityStatus = (amenityId: string) => {
    const statuses = ['open', 'low', 'closed'];
    const hash = amenityId.charCodeAt(0) % 3;
    return statuses[hash];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-500 text-white border-0">Open Now</Badge>;
      case 'low':
        return <Badge className="bg-orange-500 text-white border-0">Low Availability</Badge>;
      case 'closed':
        return <Badge className="bg-muted text-muted-foreground border-0">Closed</Badge>;
      default:
        return null;
    }
  };

  const getNextAvailable = (status: string) => {
    if (status === 'open') return null;
    if (status === 'low') return 'Next: 2:00 PM';
    return 'Opens: 9:00 AM';
  };

  const toggleFavorite = (amenityId: string) => {
    setFavorites(prev => 
      prev.includes(amenityId) 
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const getBookedSlots = (amenityId: string, date: string) => {
    return [
      { start: '08:00', end: '09:00' },
      { start: '14:00', end: '15:30' },
      { start: '18:00', end: '19:00' }
    ];
  };
  
  const getMaintenanceSlots = (amenityId: string, date: string) => {
    return [{ start: '12:00', end: '13:00' }];
  };
  
  const handleTimeSelect = (startTime: string, endTime: string) => {
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
  };

  const handleClearSelection = () => {
    setSelectedStartTime('');
    setSelectedEndTime('');
  };
  
  const handleBookAmenity = () => {
    if (!currentUser || !selectedAmenity || !selectedStartTime || !selectedEndTime) {
      toast.error("Please select an amenity and time slot");
      return;
    }
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (currentUser && hasBookingForDate(currentUser.id, dateStr)) {
      toast.error("You already have a booking for this date");
      return;
    }
    
    setShowPoliciesDialog(true);
  };
  
  const handlePoliciesAgreed = async () => {
    if (!currentUser || !selectedAmenity) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const amenity = amenities.find(a => a.id === selectedAmenity);
    
    if (amenity) {
      const timeSlot = {
        id: `${selectedAmenity}-${dateStr}-${selectedStartTime}`,
        start: new Date(`${dateStr}T${selectedStartTime}:00`).toISOString(),
        end: new Date(`${dateStr}T${selectedEndTime}:00`).toISOString(),
        status: AmenityStatus.AVAILABLE
      };
      
      await bookAmenity(
        currentUser.id,
        currentUser.fullName,
        amenity.id,
        amenity.name,
        dateStr,
        timeSlot,
        playType
      );
      
      setSelectedStartTime('');
      setSelectedEndTime('');
      setShowPoliciesDialog(false);
      setSelectedAmenity('');
    }
  };

  const getPlayTypeOptions = (amenityType: string) => {
    const config = amenityTypeConfig[amenityType];
    let availablePlayTypes = config?.basePlayTypes || ['singles'];

    if (rules) {
      if (rules.singles_only) {
        availablePlayTypes = availablePlayTypes.filter(type => type === 'singles');
      } else if (rules.doubles_only) {
        availablePlayTypes = availablePlayTypes.filter(type => type === 'doubles');
      }
    }

    return availablePlayTypes;
  };

  const getMaxDuration = (): number => {
    if (!rules) {
      switch (playType) {
        case 'singles': return 60;
        case 'doubles': return 90;
        case 'family':
        case 'group': return 120;
        default: return 60;
      }
    }
    // Use play-type specific durations from rules
    switch (playType) {
      case 'singles': return rules.singles_duration_minutes || 60;
      case 'doubles': return rules.doubles_duration_minutes || 90;
      case 'family': return rules.family_duration_minutes || 120;
      case 'group': return rules.group_duration_minutes || 120;
      default: return 60;
    }
  };

  const getDurationOptions = () => {
    const maxDuration = getMaxDuration();
    const options = [];
    
    for (let duration = 30; duration <= maxDuration; duration += 30) {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      
      let label = '';
      if (hours > 0) {
        label += `${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) label += ` ${minutes} min`;
      } else {
        label = `${minutes} min`;
      }
      
      options.push({ value: duration, label });
    }
    
    return options;
  };

  const getFilterLabel = (type: string) => {
    if (type === 'all') return 'All';
    const config = amenityTypeConfig[type];
    return config?.label || type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-3xl font-bold text-primary leading-tight">
          Love where<br />you live.
        </h1>
        <p className="text-muted-foreground mt-2">
          Reserve your spot at the pool, gym, or clubhouse instantly.
        </p>
        
        {/* Check Availability Button */}
        <Button className="w-full mt-6 h-12 rounded-full text-base font-semibold">
          <Calendar className="h-5 w-5 mr-2" />
          Check Availability
        </Button>
        
        {/* Report Maintenance Issue Link */}
        <button 
          onClick={() => setShowReportDialog(true)}
          className="flex items-center justify-center w-full mt-3 text-muted-foreground hover:text-primary transition-colors"
        >
          <Wrench className="h-4 w-4 mr-2" />
          <span className="text-sm">Report Maintenance Issue</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {amenityTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                activeFilter === type
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {getFilterLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Discover Amenities */}
      <div className="px-4 pb-6">
        <h2 className="text-lg font-semibold mb-4">Discover Amenities</h2>
        
        <div className="space-y-4">
          {filteredAmenities.map((amenity) => {
            const status = getAmenityStatus(amenity.id);
            const nextAvailable = getNextAvailable(status);
            const isSelected = selectedAmenity === amenity.id;
            const config = amenityTypeConfig[amenity.amenityType];
            const isFavorite = favorites.includes(amenity.id);
            
            return (
              <Card 
                key={amenity.id} 
                className={cn(
                  "overflow-hidden transition-all",
                  isSelected && "ring-2 ring-primary"
                )}
              >
                {/* Compact horizontal layout */}
                <div className="flex">
                  {/* Thumbnail */}
                  <div className="relative w-24 h-24 flex-shrink-0 bg-muted">
                    <img 
                      src="/placeholder.svg" 
                      alt={amenity.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1">
                      {getStatusBadge(status)}
                    </div>
                  </div>
                  
                  <CardContent className="flex-1 p-3 flex flex-col justify-between">
                    {/* Info row */}
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-primary text-sm truncate">{amenity.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {nextAvailable && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {nextAvailable}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            12/50
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 -mr-1 -mt-1"
                        onClick={() => toggleFavorite(amenity.id)}
                      >
                        <Heart className={cn(
                          "h-4 w-4",
                          isFavorite && "fill-red-500 text-red-500"
                        )} />
                      </Button>
                    </div>
                    
                    {/* Action Button */}
                    <div className="mt-2">
                      {status === 'open' ? (
                        <Button 
                          size="sm"
                          className="w-full h-7 text-xs rounded-full"
                          onClick={() => {
                            setSelectedAmenity(amenity.id);
                            const availableTypes = getPlayTypeOptions(amenity.amenityType);
                            if (availableTypes.length > 0) {
                              setPlayType(availableTypes[0] as typeof playType);
                            }
                          }}
                        >
                          Book Now
                        </Button>
                      ) : status === 'low' ? (
                        <Button variant="outline" size="sm" className="w-full h-7 text-xs rounded-full">
                          View Schedule
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full h-7 text-xs rounded-full">
                          Join Waitlist
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </div>
                  
                {/* Booking Form (when selected) */}
                {isSelected && !rulesLoading && (
                  <div className="px-4 pb-4 pt-0 border-t space-y-4">
                    {/* Date Selection */}
                    <div className="space-y-2 pt-4">
                      <Label className="text-sm font-medium">Select Date</Label>
                      <Select 
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onValueChange={(value) => {
                          const date = dateOptions.find(d => d.value === value)?.date;
                          if (date) setSelectedDate(date);
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select a date" />
                        </SelectTrigger>
                        <SelectContent>
                          {dateOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Play Type Selection */}
                    {getPlayTypeOptions(amenity.amenityType).length > 1 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Type of Use</Label>
                        <RadioGroup 
                          value={playType} 
                          onValueChange={(value) => {
                            setPlayType(value as typeof playType);
                            setSelectedStartTime('');
                            setSelectedEndTime('');
                          }}
                          className="flex gap-4"
                        >
                          {getPlayTypeOptions(amenity.amenityType).map(option => (
                            <div key={option} className="flex items-center space-x-2">
                              <RadioGroupItem value={option} id={`${amenity.id}-${option}`} />
                              <Label htmlFor={`${amenity.id}-${option}`} className="capitalize">
                                {option}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}
                    
                    {/* Duration Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Duration</Label>
                      <Select 
                        value={selectedDuration.toString()} 
                        onValueChange={(value) => {
                          setSelectedDuration(parseInt(value));
                          setSelectedStartTime('');
                          setSelectedEndTime('');
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          {getDurationOptions().map(option => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Time Selector */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Select Time</Label>
                      <p className="text-xs text-muted-foreground">
                        Tap a time slot to select. Red = unavailable, Green = your selection.
                      </p>
                      <TimeSelector
                        selectedDate={selectedDate}
                        onTimeSelect={handleTimeSelect}
                        onClearSelection={handleClearSelection}
                        maxDurationMinutes={selectedDuration}
                        amenityRules={rules}
                        bookedSlots={getBookedSlots(amenity.id, format(selectedDate, 'yyyy-MM-dd'))}
                        maintenanceSlots={getMaintenanceSlots(amenity.id, format(selectedDate, 'yyyy-MM-dd'))}
                        selectedStartTime={selectedStartTime}
                        selectedEndTime={selectedEndTime}
                      />
                    </div>
                    
                    {/* Confirm Selection */}
                    {selectedStartTime && selectedEndTime && (
                      <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                        <p className="text-sm font-medium text-primary mb-3">
                          Selected: {selectedStartTime} - {selectedEndTime}
                        </p>
                        <div className="flex gap-2">
                          <Button onClick={handleBookAmenity} className="flex-1 rounded-xl">
                            Confirm Booking
                          </Button>
                          <Button onClick={handleClearSelection} variant="outline" className="rounded-xl">
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        
        {filteredAmenities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No amenities available in this category</p>
          </div>
        )}
      </div>
      
      <CourtPoliciesDialog
        isOpen={showPoliciesDialog}
        onClose={() => setShowPoliciesDialog(false)}
        onAgree={handlePoliciesAgreed}
      />
      
      <MultiStepReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        amenities={amenities.map(a => ({ id: a.id, name: a.name, amenityType: a.amenityType }))}
      />
    </div>
  );
};

export default ReserveCourt;

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format, addDays } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import TimeSelector from '../components/TimeSelector';
import CourtPoliciesDialog from '../components/CourtPoliciesDialog';
import { useAmenityRules } from '../hooks/useAmenityRules';
import { AmenityStatus } from '../types';

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
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [selectedEndTime, setSelectedEndTime] = useState<string>('');
  const [showPoliciesDialog, setShowPoliciesDialog] = useState(false);
  
  // Fetch amenity rules for the selected amenity
  const { rules, loading: rulesLoading } = useAmenityRules(selectedAmenity);
  
  // Get only today and tomorrow for date options
  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const dateOptions = [
    {
      value: format(today, 'yyyy-MM-dd'),
      label: `Today (${format(today, 'MMMM d')})`,
      date: today
    },
    {
      value: format(tomorrow, 'yyyy-MM-dd'),
      label: `Tomorrow (${format(tomorrow, 'MMMM d')})`,
      date: tomorrow
    }
  ];
  
  // Group amenities by type
  const groupedAmenities = amenities.reduce((acc, amenity) => {
    if (!acc[amenity.amenityType]) {
      acc[amenity.amenityType] = [];
    }
    acc[amenity.amenityType].push(amenity);
    return acc;
  }, {} as Record<string, typeof amenities>);

  // Amenity type configurations
  const amenityTypeConfig = {
    tennis: { 
      label: 'Tennis Courts', 
      basePlayTypes: ['singles', 'doubles'],
      description: 'Book a tennis court for singles or doubles play'
    },
    pickleball: { 
      label: 'Pickleball Courts', 
      basePlayTypes: ['singles', 'doubles'],
      description: 'Book a pickleball court for singles or doubles play'
    },
    barbecue: { 
      label: 'Barbecue Areas', 
      basePlayTypes: ['family', 'group'],
      description: 'Reserve a barbecue area for family gatherings or group events'
    },
    jacuzzi: { 
      label: 'Jacuzzi', 
      basePlayTypes: ['family', 'group'],
      description: 'Book the jacuzzi for relaxation'
    },
    pool: { 
      label: 'Pool', 
      basePlayTypes: ['family', 'group'],
      description: 'Reserve pool time for swimming and recreation'
    },
    gym: { 
      label: 'Gym', 
      basePlayTypes: ['singles', 'group'],
      description: 'Book gym time for personal or group workouts'
    },
    clubhouse: { 
      label: 'Clubhouse', 
      basePlayTypes: ['family', 'group'],
      description: 'Reserve the clubhouse for events and gatherings'
    }
  };
  
  // Mock data for booked and maintenance slots - in real app this would come from the data context
  const getBookedSlots = (amenityId: string, date: string) => {
    // This should be replaced with actual data from your booking system
    return [
      { start: '08:00', end: '09:00' },
      { start: '14:00', end: '15:30' },
      { start: '18:00', end: '19:00' }
    ];
  };
  
  const getMaintenanceSlots = (amenityId: string, date: string) => {
    // This should be replaced with actual maintenance data
    return [
      { start: '12:00', end: '13:00' }
    ];
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
    
    // Check if user already has a booking for this date
    if (currentUser && hasBookingForDate(currentUser.id, dateStr)) {
      toast.error("You already have a booking for this date");
      return;
    }
    
    // Show policies dialog before booking
    setShowPoliciesDialog(true);
  };
  
  const handlePoliciesAgreed = async () => {
    if (!currentUser || !selectedAmenity) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const amenity = amenities.find(a => a.id === selectedAmenity);
    
    if (amenity) {
      // Create a time slot object for the booking
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
      
      // Reset form
      setSelectedStartTime('');
      setSelectedEndTime('');
      setShowPoliciesDialog(false);
    }
  };

  const getPlayTypeOptions = (amenityType: string) => {
    const config = amenityTypeConfig[amenityType as keyof typeof amenityTypeConfig];
    let availablePlayTypes = config?.basePlayTypes || ['singles'];

    // Apply amenity rules restrictions
    if (rules) {
      if (rules.singles_only) {
        availablePlayTypes = availablePlayTypes.filter(type => type === 'singles');
      } else if (rules.doubles_only) {
        availablePlayTypes = availablePlayTypes.filter(type => type === 'doubles');
      }
    }

    return availablePlayTypes;
  };

  const getMaxDuration = () => {
    if (rules?.max_duration_minutes) {
      return rules.max_duration_minutes;
    }
    
    // Fallback to default durations if no rules configured
    switch (playType) {
      case 'singles': return 60;
      case 'doubles': return 90;
      case 'family':
      case 'group': return 120;
      default: return 60;
    }
  };

  const getDurationLabel = (playType: string) => {
    const maxDuration = getMaxDuration();
    const hours = Math.floor(maxDuration / 60);
    const minutes = maxDuration % 60;
    
    let timeLabel = '';
    if (hours > 0) {
      timeLabel += `${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) {
        timeLabel += ` ${minutes} min`;
      }
    } else {
      timeLabel = `${minutes} min`;
    }
    
    return `${playType} (up to ${timeLabel})`;
  };

  const renderAmenityTab = (amenityType: string, amenityList: typeof amenities) => {
    const config = amenityTypeConfig[amenityType as keyof typeof amenityTypeConfig];
    
    return (
      <div className="grid grid-cols-1 gap-4">
        {amenityList.map(amenity => {
          const playTypeOptions = getPlayTypeOptions(amenityType);
          const isSelected = selectedAmenity === amenity.id;
          
          return (
            <Card key={amenity.id} className={isSelected ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{amenity.name}</CardTitle>
                <CardDescription>{config?.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => {
                    setSelectedAmenity(amenity.id);
                    setSelectedStartTime('');
                    setSelectedEndTime('');
                    // Reset play type to first available option
                    const availableTypes = getPlayTypeOptions(amenityType);
                    if (availableTypes.length > 0) {
                      setPlayType(availableTypes[0] as typeof playType);
                    }
                  }}
                  variant={isSelected ? "default" : "outline"}
                  className="w-full mb-4"
                >
                  {isSelected ? "Selected" : "Select"}
                </Button>
                
                {isSelected && !rulesLoading && (
                  <div className="mt-4 space-y-4">
                    {playTypeOptions.length > 1 && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium mb-1">Type of Use</label>
                        <RadioGroup value={playType} onValueChange={(value) => {
                          setPlayType(value as typeof playType);
                          setSelectedStartTime('');
                          setSelectedEndTime('');
                        }}>
                          {playTypeOptions.map(option => (
                            <div key={option} className="flex items-center space-x-2">
                              <RadioGroupItem value={option} id={option} />
                              <Label htmlFor={option} className="capitalize">
                                {getDurationLabel(option)}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}
                    
                    <TimeSelector
                      selectedDate={selectedDate}
                      onTimeSelect={handleTimeSelect}
                      onClearSelection={handleClearSelection}
                      maxDurationMinutes={getMaxDuration()}
                      amenityRules={rules}
                      bookedSlots={getBookedSlots(amenity.id, format(selectedDate, 'yyyy-MM-dd'))}
                      maintenanceSlots={getMaintenanceSlots(amenity.id, format(selectedDate, 'yyyy-MM-dd'))}
                      selectedStartTime={selectedStartTime}
                      selectedEndTime={selectedEndTime}
                    />
                    
                    {selectedStartTime && selectedEndTime && (
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p className="text-sm font-medium text-green-800">
                          Selected Time: {selectedStartTime} - {selectedEndTime}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button onClick={handleBookAmenity} className="flex-1">
                            Book {amenity.name}
                          </Button>
                          <Button onClick={handleClearSelection} variant="outline">
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reserve an Amenity</h1>
        <p className="text-muted-foreground">
          Book amenities at your community
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Date & Type</CardTitle>
            <CardDescription>Choose when you want to use the amenity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1">Select Date</label>
                <Select 
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onValueChange={(value) => {
                    const date = dateOptions.find(d => d.value === value)?.date;
                    if (date) setSelectedDate(date);
                  }}
                >
                  <SelectTrigger>
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
            </div>
          </CardContent>
        </Card>
        
        {Object.keys(groupedAmenities).length > 0 ? (
          <Tabs defaultValue={Object.keys(groupedAmenities)[0]}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Object.keys(groupedAmenities).length}, 1fr)` }}>
              {Object.entries(groupedAmenities).map(([type, _]) => {
                const config = amenityTypeConfig[type as keyof typeof amenityTypeConfig];
                return (
                  <TabsTrigger key={type} value={type}>
                    {config?.label || type}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            {Object.entries(groupedAmenities).map(([type, amenityList]) => (
              <TabsContent key={type} value={type} className="mt-4">
                {amenityList.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No {type} amenities available in your community</p>
                  </div>
                ) : (
                  renderAmenityTab(type, amenityList)
                )}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No amenities available in your community</p>
          </div>
        )}
      </div>
      
      <CourtPoliciesDialog
        isOpen={showPoliciesDialog}
        onClose={() => setShowPoliciesDialog(false)}
        onAgree={handlePoliciesAgreed}
      />
    </div>
  );
};

export default ReserveCourt;


import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format, addDays } from 'date-fns';
import { CourtStatus } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';

const ReserveCourt = () => {
  const { currentUser } = useAuth();
  const { 
    getCourtsByHOAId, 
    getTimeSlots, 
    bookCourt,
    hasBookingForDate 
  } = useData();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [playType, setPlayType] = useState<'singles' | 'doubles'>('singles');
  
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
  
  // Get courts for the current user's HOA
  const courts = currentUser ? getCourtsByHOAId(currentUser.hoaId) : [];
  
  // Get time slots for the selected date and court
  const timeSlots = selectedCourt && selectedDate 
    ? getTimeSlots(format(selectedDate, 'yyyy-MM-dd'), selectedCourt) 
    : [];
  
  const handleBookCourt = (timeSlotId: string) => {
    if (!currentUser || !selectedCourt) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Check if user already has a booking for this date
    if (hasBookingForDate(currentUser.id, dateStr)) {
      toast.error("You already have a booking for this date");
      return;
    }
    
    const timeSlot = timeSlots.find(slot => slot.id === timeSlotId);
    const court = courts.find(court => court.id === selectedCourt);
    
    if (timeSlot && court) {
      // Pass the play type to bookCourt
      bookCourt(
        currentUser.id,
        currentUser.fullName,
        court.id,
        court.name,
        dateStr,
        timeSlot,
        playType
      );
    }
  };
  
  // Filter courts by type
  const tennisCourts = courts.filter(court => court.courtType === 'tennis');
  const pickleballCourts = courts.filter(court => court.courtType === 'pickleball');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reserve a Court</h1>
        <p className="text-muted-foreground">
          Book a tennis or pickleball court at your community
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Date & Type</CardTitle>
            <CardDescription>Choose when you want to play and how</CardDescription>
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
              
              <div className="space-y-2">
                <label className="block text-sm font-medium mb-1">Type of Play</label>
                <RadioGroup value={playType} onValueChange={(value) => setPlayType(value as 'singles' | 'doubles')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="singles" id="singles" />
                    <Label htmlFor="singles">Singles (1 hour)</Label>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="doubles" id="doubles" />
                    <Label htmlFor="doubles">Doubles (1.5 hours)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="tennis">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tennis">Tennis Courts</TabsTrigger>
            <TabsTrigger value="pickleball">Pickleball Courts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tennis" className="mt-4">
            {tennisCourts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No tennis courts available in your community</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tennisCourts.map(court => (
                  <Card key={court.id} className={selectedCourt === court.id ? "border-primary" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{court.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => setSelectedCourt(court.id)}
                        variant={selectedCourt === court.id ? "default" : "outline"}
                        className="w-full mb-4"
                      >
                        {selectedCourt === court.id ? "Selected" : "Select Court"}
                      </Button>
                      
                      {selectedCourt === court.id && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Available Time Slots</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {timeSlots.map(slot => {
                              const startTime = new Date(slot.start);
                              const endTime = new Date(slot.end);
                              
                              // For doubles, we need to check that there's an available slot after this one
                              let isValidForPlayType = true;
                              if (playType === 'doubles') {
                                const slotHour = startTime.getHours();
                                const nextSlotId = `${court.id}-${format(selectedDate, 'yyyy-MM-dd')}-${slotHour + 1}`;
                                const nextSlot = timeSlots.find(s => s.id === nextSlotId);
                                isValidForPlayType = nextSlot && nextSlot.status === CourtStatus.AVAILABLE;
                              }
                              
                              return (
                                <div 
                                  key={slot.id} 
                                  className={`
                                    time-slot p-2 rounded text-center text-sm cursor-pointer
                                    ${slot.status === CourtStatus.AVAILABLE && isValidForPlayType ? 'bg-green-100 hover:bg-green-200' : ''}
                                    ${slot.status === CourtStatus.BOOKED || !isValidForPlayType ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                                    ${slot.status === CourtStatus.MAINTENANCE ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed' : ''}
                                  `}
                                  onClick={() => {
                                    if (slot.status === CourtStatus.AVAILABLE && isValidForPlayType) {
                                      handleBookCourt(slot.id);
                                    }
                                  }}
                                >
                                  {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                  {playType === 'singles' 
                                    ? endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                    : new Date(new Date(endTime).setMinutes(endTime.getMinutes() + 30))
                                        .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                  }
                                  <div className="text-[10px]">
                                    {slot.status === CourtStatus.AVAILABLE && isValidForPlayType && 'Available'}
                                    {slot.status === CourtStatus.BOOKED && 'Booked'}
                                    {slot.status === CourtStatus.MAINTENANCE && 'Maintenance'}
                                    {slot.status === CourtStatus.AVAILABLE && !isValidForPlayType && 'Not enough time for doubles'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="pickleball" className="mt-4">
            {pickleballCourts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No pickleball courts available in your community</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pickleballCourts.map(court => (
                  <Card key={court.id} className={selectedCourt === court.id ? "border-primary" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{court.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => setSelectedCourt(court.id)}
                        variant={selectedCourt === court.id ? "default" : "outline"}
                        className="w-full mb-4"
                      >
                        {selectedCourt === court.id ? "Selected" : "Select Court"}
                      </Button>
                      
                      {selectedCourt === court.id && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Available Time Slots</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {timeSlots.map(slot => {
                              const startTime = new Date(slot.start);
                              const endTime = new Date(slot.end);
                              
                              // For doubles, we need to check that there's an available slot after this one
                              let isValidForPlayType = true;
                              if (playType === 'doubles') {
                                const slotHour = startTime.getHours();
                                const nextSlotId = `${court.id}-${format(selectedDate, 'yyyy-MM-dd')}-${slotHour + 1}`;
                                const nextSlot = timeSlots.find(s => s.id === nextSlotId);
                                isValidForPlayType = nextSlot && nextSlot.status === CourtStatus.AVAILABLE;
                              }
                              
                              return (
                                <div 
                                  key={slot.id} 
                                  className={`
                                    time-slot p-2 rounded text-center text-sm cursor-pointer
                                    ${slot.status === CourtStatus.AVAILABLE && isValidForPlayType ? 'bg-green-100 hover:bg-green-200' : ''}
                                    ${slot.status === CourtStatus.BOOKED || !isValidForPlayType ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                                    ${slot.status === CourtStatus.MAINTENANCE ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed' : ''}
                                  `}
                                  onClick={() => {
                                    if (slot.status === CourtStatus.AVAILABLE && isValidForPlayType) {
                                      handleBookCourt(slot.id);
                                    }
                                  }}
                                >
                                  {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                  {playType === 'singles' 
                                    ? endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                    : new Date(new Date(endTime).setMinutes(endTime.getMinutes() + 30))
                                        .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                  }
                                  <div className="text-[10px]">
                                    {slot.status === CourtStatus.AVAILABLE && isValidForPlayType && 'Available'}
                                    {slot.status === CourtStatus.BOOKED && 'Booked'}
                                    {slot.status === CourtStatus.MAINTENANCE && 'Maintenance'}
                                    {slot.status === CourtStatus.AVAILABLE && !isValidForPlayType && 'Not enough time for doubles'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ReserveCourt;

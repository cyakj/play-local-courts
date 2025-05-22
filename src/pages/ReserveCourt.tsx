
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
  
  // Get next 7 days for the date selector
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEEE, MMMM d'),
      date
    };
  });
  
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
      bookCourt(
        currentUser.id,
        currentUser.fullName,
        court.id,
        court.name,
        dateStr,
        timeSlot
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
            <CardTitle>Select Date & Court</CardTitle>
            <CardDescription>Choose when you want to play and which court to reserve</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
                              
                              return (
                                <div 
                                  key={slot.id} 
                                  className={`
                                    time-slot 
                                    ${slot.status === CourtStatus.AVAILABLE ? 'available' : ''}
                                    ${slot.status === CourtStatus.BOOKED ? 'booked' : ''}
                                    ${slot.status === CourtStatus.MAINTENANCE ? 'maintenance' : ''}
                                  `}
                                  onClick={() => {
                                    if (slot.status === CourtStatus.AVAILABLE) {
                                      handleBookCourt(slot.id);
                                    }
                                  }}
                                >
                                  {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                  {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  <div className="text-[10px]">
                                    {slot.status === CourtStatus.AVAILABLE && 'Available'}
                                    {slot.status === CourtStatus.BOOKED && 'Booked'}
                                    {slot.status === CourtStatus.MAINTENANCE && 'Maintenance'}
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
                              
                              return (
                                <div 
                                  key={slot.id} 
                                  className={`
                                    time-slot 
                                    ${slot.status === CourtStatus.AVAILABLE ? 'available' : ''}
                                    ${slot.status === CourtStatus.BOOKED ? 'booked' : ''}
                                    ${slot.status === CourtStatus.MAINTENANCE ? 'maintenance' : ''}
                                  `}
                                  onClick={() => {
                                    if (slot.status === CourtStatus.AVAILABLE) {
                                      handleBookCourt(slot.id);
                                    }
                                  }}
                                >
                                  {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                  {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  <div className="text-[10px]">
                                    {slot.status === CourtStatus.AVAILABLE && 'Available'}
                                    {slot.status === CourtStatus.BOOKED && 'Booked'}
                                    {slot.status === CourtStatus.MAINTENANCE && 'Maintenance'}
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

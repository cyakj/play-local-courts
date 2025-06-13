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
import { CourtStatus } from '../types';

const ReserveCourt = () => {
  const { currentUser } = useAuth();
  const { 
    courts, 
    bookCourt,
    hasBookingForDate 
  } = useData();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [playType, setPlayType] = useState<'singles' | 'doubles'>('singles');
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [selectedEndTime, setSelectedEndTime] = useState<string>('');
  const [showPoliciesDialog, setShowPoliciesDialog] = useState(false);
  
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
  
  // Mock data for booked and maintenance slots - in real app this would come from the data context
  const getBookedSlots = (courtId: string, date: string) => {
    // This should be replaced with actual data from your booking system
    return [
      { start: '08:00', end: '09:00' },
      { start: '14:00', end: '15:30' },
      { start: '18:00', end: '19:00' }
    ];
  };
  
  const getMaintenanceSlots = (courtId: string, date: string) => {
    // This should be replaced with actual maintenance data
    return [
      { start: '12:00', end: '13:00' }
    ];
  };
  
  const handleTimeSelect = (startTime: string, endTime: string) => {
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
  };
  
  const handleBookCourt = () => {
    if (!currentUser || !selectedCourt || !selectedStartTime || !selectedEndTime) {
      toast.error("Please select a court and time slot");
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
    if (!currentUser || !selectedCourt) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const court = courts.find(court => court.id === selectedCourt);
    
    if (court) {
      // Create a time slot object for the booking
      const timeSlot = {
        id: `${selectedCourt}-${dateStr}-${selectedStartTime}`,
        start: new Date(`${dateStr}T${selectedStartTime}:00`).toISOString(),
        end: new Date(`${dateStr}T${selectedEndTime}:00`).toISOString(),
        status: CourtStatus.AVAILABLE
      };
      
      await bookCourt(
        currentUser.id,
        currentUser.fullName,
        court.id,
        court.name,
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
                    <Label htmlFor="singles">Singles (up to 1 hour)</Label>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="doubles" id="doubles" />
                    <Label htmlFor="doubles">Doubles (up to 1.5 hours)</Label>
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
              <div className="grid grid-cols-1 gap-4">
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
                        <div className="mt-4 space-y-4">
                          <TimeSelector
                            selectedDate={selectedDate}
                            onTimeSelect={handleTimeSelect}
                            isDoubles={playType === 'doubles'}
                            bookedSlots={getBookedSlots(court.id, format(selectedDate, 'yyyy-MM-dd'))}
                            maintenanceSlots={getMaintenanceSlots(court.id, format(selectedDate, 'yyyy-MM-dd'))}
                            selectedStartTime={selectedStartTime}
                            selectedEndTime={selectedEndTime}
                          />
                          
                          {selectedStartTime && selectedEndTime && (
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                              <p className="text-sm font-medium text-green-800">
                                Selected Time: {selectedStartTime} - {selectedEndTime}
                              </p>
                              <Button onClick={handleBookCourt} className="mt-2 w-full">
                                Book Court
                              </Button>
                            </div>
                          )}
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
              <div className="grid grid-cols-1 gap-4">
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
                        <div className="mt-4 space-y-4">
                          <TimeSelector
                            selectedDate={selectedDate}
                            onTimeSelect={handleTimeSelect}
                            isDoubles={playType === 'doubles'}
                            bookedSlots={getBookedSlots(court.id, format(selectedDate, 'yyyy-MM-dd'))}
                            maintenanceSlots={getMaintenanceSlots(court.id, format(selectedDate, 'yyyy-MM-dd'))}
                            selectedStartTime={selectedStartTime}
                            selectedEndTime={selectedEndTime}
                          />
                          
                          {selectedStartTime && selectedEndTime && (
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                              <p className="text-sm font-medium text-green-800">
                                Selected Time: {selectedStartTime} - {selectedEndTime}
                              </p>
                              <Button onClick={handleBookCourt} className="mt-2 w-full">
                                Book Court
                              </Button>
                            </div>
                          )}
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
      
      <CourtPoliciesDialog
        isOpen={showPoliciesDialog}
        onClose={() => setShowPoliciesDialog(false)}
        onAgree={handlePoliciesAgreed}
      />
    </div>
  );
};

export default ReserveCourt;

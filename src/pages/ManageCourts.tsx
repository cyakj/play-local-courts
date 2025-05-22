import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { CourtStatus } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ManageCourts = () => {
  const { currentUser, isAdmin } = useAuth();
  const { 
    getCourtsByHOAId, 
    addCourt, 
    removeCourt, 
    getTimeSlots,
    setCourtMaintenance
  } = useData();
  
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtType, setNewCourtType] = useState<"tennis" | "pickleball">("tennis");
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  
  // Redirect if not an admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  const courts = currentUser ? getCourtsByHOAId(currentUser.hoaId) : [];
  
  // Get next 7 days for the date selector
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEEE, MMMM d'),
      date
    };
  });
  
  // Get time slots for the selected date and court
  const timeSlots = selectedCourt && selectedDate 
    ? getTimeSlots(format(selectedDate, 'yyyy-MM-dd'), selectedCourt) 
    : [];
  
  const handleAddCourt = () => {
    if (!currentUser || !newCourtName.trim()) return;
    
    addCourt(newCourtName, currentUser.hoaId, newCourtType);
    setNewCourtName('');
  };
  
  const handleRemoveCourt = (courtId: string) => {
    if (window.confirm('Are you sure you want to remove this court? All bookings for this court will also be removed.')) {
      removeCourt(courtId);
    }
  };
  
  const handleMaintenanceToggle = (slotId: string, isMaintenance: boolean) => {
    if (!selectedCourt || !selectedDate) return;
    
    const slot = timeSlots.find(s => s.id === slotId);
    if (slot) {
      const hour = new Date(slot.start).getHours();
      setCourtMaintenance(
        selectedCourt,
        format(selectedDate, 'yyyy-MM-dd'),
        hour,
        isMaintenance
      );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Courts</h1>
        <p className="text-muted-foreground">
          Add, remove, and manage courts for your HOA
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Court</CardTitle>
          <CardDescription>Create a new tennis or pickleball court for your community</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="courtName">Court Name</Label>
              <Input
                id="courtName"
                placeholder="e.g., Tennis Court 3"
                value={newCourtName}
                onChange={(e) => setNewCourtName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Court Type</Label>
              <RadioGroup 
                value={newCourtType} 
                onValueChange={(value) => setNewCourtType(value as "tennis" | "pickleball")}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tennis" id="tennis" />
                  <Label htmlFor="tennis">Tennis</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pickleball" id="pickleball" />
                  <Label htmlFor="pickleball">Pickleball</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddCourt} disabled={!newCourtName.trim()}>
            Add Court
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Manage Existing Courts</CardTitle>
          <CardDescription>Schedule maintenance or remove courts</CardDescription>
        </CardHeader>
        <CardContent>
          {courts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No courts available</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <Label className="block text-sm font-medium mb-1">Select Date</Label>
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courts.map(court => (
                  <Card key={court.id} className={selectedCourt === court.id ? "border-primary" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex justify-between items-center">
                        <span>{court.name}</span>
                        <Badge variant="outline">{court.courtType}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex space-x-2 mb-4">
                        <Button 
                          onClick={() => setSelectedCourt(court.id)}
                          variant={selectedCourt === court.id ? "default" : "outline"}
                          size="sm"
                        >
                          {selectedCourt === court.id ? "Selected" : "Select"}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleRemoveCourt(court.id)}
                        >
                          Remove Court
                        </Button>
                      </div>
                      
                      {selectedCourt === court.id && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Manage Time Slots</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {timeSlots.map(slot => {
                              const startTime = new Date(slot.start);
                              const endTime = new Date(slot.end);
                              const isMaintenance = slot.status === CourtStatus.MAINTENANCE;
                              
                              return (
                                <div 
                                  key={slot.id} 
                                  className={`
                                    p-2 border rounded flex justify-between items-center
                                    ${isMaintenance ? 'bg-yellow-50 border-yellow-200' : ''}
                                    ${slot.status === CourtStatus.BOOKED ? 'bg-red-50 border-red-200' : ''}
                                  `}
                                >
                                  <div className="text-xs">
                                    {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                    {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    <div className="text-[10px]">
                                      {slot.status === CourtStatus.AVAILABLE && 'Available'}
                                      {slot.status === CourtStatus.BOOKED && 'Booked'}
                                      {slot.status === CourtStatus.MAINTENANCE && 'Maintenance'}
                                    </div>
                                  </div>
                                  
                                  {slot.status !== CourtStatus.BOOKED && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs"
                                      onClick={() => handleMaintenanceToggle(slot.id, !isMaintenance)}
                                    >
                                      {isMaintenance ? 'Make Available' : 'Set Maintenance'}
                                    </Button>
                                  )}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageCourts;

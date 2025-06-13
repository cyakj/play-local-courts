
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
import { AmenityStatus } from '../types';

const ManageCourts = () => {
  const { currentUser, isAdmin } = useAuth();
  const { 
    amenities, 
    addAmenity, 
    removeAmenity, 
    getTimeSlots,
    setAmenityMaintenance
  } = useData();
  
  const [newAmenityName, setNewAmenityName] = useState('');
  const [newAmenityType, setNewAmenityType] = useState<"tennis" | "pickleball" | "barbecue" | "jacuzzi" | "pool" | "gym" | "clubhouse">("tennis");
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedAmenity, setSelectedAmenity] = useState<string>('');
  
  // Redirect if not an admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Get next 7 days for the date selector
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEEE, MMMM d'),
      date
    };
  });
  
  // Get time slots for the selected date and amenity
  const timeSlots = selectedAmenity && selectedDate 
    ? getTimeSlots(format(selectedDate, 'yyyy-MM-dd'), selectedAmenity) 
    : [];
  
  const handleAddAmenity = () => {
    if (!currentUser || !newAmenityName.trim()) return;
    
    addAmenity(newAmenityName, currentUser.hoaId, newAmenityType);
    setNewAmenityName('');
  };
  
  const handleRemoveAmenity = (amenityId: string) => {
    if (window.confirm('Are you sure you want to remove this amenity? All bookings for this amenity will also be removed.')) {
      removeAmenity(amenityId);
    }
  };
  
  const handleMaintenanceToggle = (slotId: string, isMaintenance: boolean) => {
    if (!selectedAmenity || !selectedDate) return;
    
    const slot = timeSlots.find(s => s.id === slotId);
    if (slot) {
      const hour = new Date(slot.start).getHours();
      setAmenityMaintenance(
        selectedAmenity,
        format(selectedDate, 'yyyy-MM-dd'),
        hour,
        isMaintenance
      );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Amenities</h1>
        <p className="text-muted-foreground">
          Add, remove, and manage amenities for your HOA
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Amenity</CardTitle>
          <CardDescription>Create a new amenity for your community</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amenityName">Amenity Name</Label>
              <Input
                id="amenityName"
                placeholder="e.g., Tennis Court 3, Pool Area"
                value={newAmenityName}
                onChange={(e) => setNewAmenityName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Amenity Type</Label>
              <RadioGroup 
                value={newAmenityType} 
                onValueChange={(value) => setNewAmenityType(value as typeof newAmenityType)}
                className="grid grid-cols-2 gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tennis" id="tennis" />
                  <Label htmlFor="tennis">Tennis</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pickleball" id="pickleball" />
                  <Label htmlFor="pickleball">Pickleball</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="barbecue" id="barbecue" />
                  <Label htmlFor="barbecue">Barbecue</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="jacuzzi" id="jacuzzi" />
                  <Label htmlFor="jacuzzi">Jacuzzi</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pool" id="pool" />
                  <Label htmlFor="pool">Pool</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gym" id="gym" />
                  <Label htmlFor="gym">Gym</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="clubhouse" id="clubhouse" />
                  <Label htmlFor="clubhouse">Clubhouse</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddAmenity} disabled={!newAmenityName.trim()}>
            Add Amenity
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Manage Existing Amenities</CardTitle>
          <CardDescription>Schedule maintenance or remove amenities</CardDescription>
        </CardHeader>
        <CardContent>
          {amenities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No amenities available</p>
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
                {amenities.map(amenity => (
                  <Card key={amenity.id} className={selectedAmenity === amenity.id ? "border-primary" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex justify-between items-center">
                        <span>{amenity.name}</span>
                        <Badge variant="outline">{amenity.amenityType}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex space-x-2 mb-4">
                        <Button 
                          onClick={() => setSelectedAmenity(amenity.id)}
                          variant={selectedAmenity === amenity.id ? "default" : "outline"}
                          size="sm"
                        >
                          {selectedAmenity === amenity.id ? "Selected" : "Select"}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleRemoveAmenity(amenity.id)}
                        >
                          Remove Amenity
                        </Button>
                      </div>
                      
                      {selectedAmenity === amenity.id && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Manage Time Slots</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {timeSlots.map(slot => {
                              const startTime = new Date(slot.start);
                              const endTime = new Date(slot.end);
                              const isMaintenance = slot.status === AmenityStatus.MAINTENANCE;
                              
                              return (
                                <div 
                                  key={slot.id} 
                                  className={`
                                    p-2 border rounded flex justify-between items-center
                                    ${isMaintenance ? 'bg-yellow-50 border-yellow-200' : ''}
                                    ${slot.status === AmenityStatus.BOOKED ? 'bg-red-50 border-red-200' : ''}
                                  `}
                                >
                                  <div className="text-xs">
                                    {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                    {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    <div className="text-[10px]">
                                      {slot.status === AmenityStatus.AVAILABLE && 'Available'}
                                      {slot.status === AmenityStatus.BOOKED && 'Booked'}
                                      {slot.status === AmenityStatus.MAINTENANCE && 'Maintenance'}
                                    </div>
                                  </div>
                                  
                                  {slot.status !== AmenityStatus.BOOKED && (
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

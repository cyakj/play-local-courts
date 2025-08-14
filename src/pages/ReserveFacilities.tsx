import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Clock, DollarSign, Star, Calendar, Users, Wifi, Car, Utensils, Zap } from 'lucide-react';

// Mock data for facilities
const mockFacilities = [
  {
    id: '1',
    name: 'City Tennis Center',
    type: 'Public',
    sports: ['Tennis', 'Pickleball'],
    location: 'Downtown Recreation Center',
    distance: '2.3 miles',
    rating: 4.2,
    reviewCount: 156,
    priceRange: '$15-25/hour',
    imageUrl: '/placeholder.svg',
    amenities: ['Parking', 'Restrooms', 'Pro Shop', 'Lighting'],
    courts: [
      { id: 'ct1', name: 'Court 1', type: 'Tennis', surface: 'Hard Court', lighting: true },
      { id: 'ct2', name: 'Court 2', type: 'Tennis', surface: 'Hard Court', lighting: true },
      { id: 'pb1', name: 'Pickleball Court A', type: 'Pickleball', surface: 'Composite', lighting: true },
    ],
    instantBooking: true,
    description: 'Modern facility with 6 tennis courts and 4 pickleball courts. Professional lighting for evening play.'
  },
  {
    id: '2',
    name: 'Riverside Country Club',
    type: 'Private',
    sports: ['Tennis'],
    location: 'Riverside District',
    distance: '4.1 miles',
    rating: 4.7,
    reviewCount: 89,
    priceRange: '$40-60/hour',
    imageUrl: '/placeholder.svg',
    amenities: ['Valet Parking', 'Restaurant', 'Locker Rooms', 'Pool'],
    courts: [
      { id: 'rc1', name: 'Championship Court', type: 'Tennis', surface: 'Clay Court', lighting: true },
      { id: 'rc2', name: 'Court 2', type: 'Tennis', surface: 'Hard Court', lighting: true },
    ],
    instantBooking: false,
    description: 'Exclusive country club with premium clay and hard courts. Guest privileges available.'
  },
  {
    id: '3',
    name: 'Westside Sports Complex',
    type: 'Public',
    sports: ['Tennis', 'Pickleball', 'Badminton'],
    location: 'Westside Park',
    distance: '5.7 miles',
    rating: 3.9,
    reviewCount: 234,
    priceRange: '$12-20/hour',
    imageUrl: '/placeholder.svg',
    amenities: ['Free Parking', 'Snack Bar', 'Equipment Rental'],
    courts: [
      { id: 'ws1', name: 'Court A', type: 'Tennis', surface: 'Hard Court', lighting: false },
      { id: 'ws2', name: 'Court B', type: 'Tennis', surface: 'Hard Court', lighting: false },
      { id: 'wspb1', name: 'Pickleball 1', type: 'Pickleball', surface: 'Composite', lighting: true },
      { id: 'wsb1', name: 'Badminton Court', type: 'Badminton', surface: 'Wooden', lighting: true },
    ],
    instantBooking: true,
    description: 'Large multi-sport complex with courts for tennis, pickleball, and badminton.'
  }
];

const ReserveFacilities = () => {
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [priceRange, setPriceRange] = useState<string>('all');

  const filteredFacilities = mockFacilities.filter(facility => {
    const matchesSport = selectedSport === 'all' || facility.sports.includes(selectedSport);
    const matchesType = selectedType === 'all' || facility.type.toLowerCase() === selectedType;
    const matchesLocation = !searchLocation || facility.location.toLowerCase().includes(searchLocation.toLowerCase());
    return matchesSport && matchesType && matchesLocation;
  });

  const getAmenityIcon = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'parking':
      case 'valet parking':
      case 'free parking':
        return Car;
      case 'wifi':
        return Wifi;
      case 'restaurant':
      case 'snack bar':
        return Utensils;
      case 'lighting':
        return Zap;
      default:
        return Users;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reserve Facilities</h1>
        <p className="text-muted-foreground">
          Book courts and amenities at participating clubs and public facilities
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find Your Perfect Court</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Sport</label>
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="Tennis">Tennis</SelectItem>
                  <SelectItem value="Pickleball">Pickleball</SelectItem>
                  <SelectItem value="Badminton">Badminton</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Facility Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Input
                placeholder="Search by area..."
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Price Range</label>
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Any Price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Price</SelectItem>
                  <SelectItem value="budget">$10-20/hour</SelectItem>
                  <SelectItem value="mid">$20-40/hour</SelectItem>
                  <SelectItem value="premium">$40+/hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredFacilities.map((facility) => (
          <Card key={facility.id} className="overflow-hidden">
            <div className="aspect-video bg-muted relative">
              <img
                src={facility.imageUrl}
                alt={facility.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 right-4">
                <Badge variant={facility.type === 'Public' ? 'secondary' : 'outline'}>
                  {facility.type}
                </Badge>
              </div>
              {facility.instantBooking && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-green-600">Instant Booking</Badge>
                </div>
              )}
            </div>
            
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{facility.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {facility.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {facility.rating} ({facility.reviewCount})
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {facility.sports.map((sport) => (
                    <Badge key={sport} variant="outline">
                      {sport}
                    </Badge>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground">
                  {facility.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <DollarSign className="h-4 w-4" />
                    {facility.priceRange}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {facility.distance} away
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {facility.amenities.slice(0, 4).map((amenity, index) => {
                    const Icon = getAmenityIcon(amenity);
                    return (
                      <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3 w-3" />
                        {amenity}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  <Button size="sm">
                    {facility.instantBooking ? (
                      <>
                        <Calendar className="h-4 w-4 mr-1" />
                        Book Now
                      </>
                    ) : (
                      'Request Booking'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFacilities.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No facilities found matching your criteria. Try adjusting your filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReserveFacilities;
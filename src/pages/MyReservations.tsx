
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserType } from '../types';

const MyReservations = () => {
  const { currentUser } = useAuth();
  const { bookings, cancelBooking } = useData();
  
  // Sort bookings by date (newest first)
  const sortedBookings = [...bookings].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.startTime}`);
    const dateB = new Date(`${b.date}T${b.startTime}`);
    return dateB.getTime() - dateA.getTime();
  });
  
  // Separate upcoming and past bookings
  const now = new Date();
  const upcomingBookings = sortedBookings.filter(booking => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
    return bookingDateTime > now;
  });
  const pastBookings = sortedBookings.filter(booking => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
    return bookingDateTime <= now;
  });

  const handleCancelBooking = (bookingId: string) => {
    if (window.confirm('Are you sure you want to cancel this reservation?')) {
      cancelBooking(bookingId);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Schedule</h1>
        <p className="text-muted-foreground">
          {currentUser?.userType === UserType.NON_HOA 
            ? "View your upcoming matches and lessons"
            : "View and manage your amenity reservations"
          }
        </p>
      </div>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {currentUser?.userType === UserType.NON_HOA ? "Upcoming Matches & Lessons" : "Upcoming Reservations"}
            </CardTitle>
            <CardDescription>
              {currentUser?.userType === UserType.NON_HOA 
                ? "Your scheduled tennis activities"
                : "Amenity times you have scheduled"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {currentUser?.userType === UserType.NON_HOA 
                    ? "You don't have any upcoming matches or lessons"
                    : "You don't have any upcoming reservations"
                  }
                </p>
                {currentUser?.userType !== UserType.NON_HOA && (
                  <Button className="mt-4" asChild>
                    <a href="/reserve-court">Book an Amenity</a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map(booking => {
                  const startTime = new Date(`${booking.date}T${booking.startTime}`);
                  const endTime = new Date(`${booking.date}T${booking.endTime}`);
                  
                  return (
                    <Card key={booking.id} className="overflow-hidden">
                      <div className="flex flex-col sm:flex-row">
                        <div className="bg-primary p-4 text-white sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                          <div className="text-lg font-medium">
                            {startTime.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="text-2xl font-bold">
                            {startTime.getDate()}
                          </div>
                        </div>
                        <div className="p-4 flex-1">
                          <div className="font-semibold">{booking.amenityName}</div>
                          <div className="text-sm text-muted-foreground">
                            {startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' • '}
                            {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                            {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="p-4 flex items-center">
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        
        {pastBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {currentUser?.userType === UserType.NON_HOA ? "Past Activities" : "Past Reservations"}
              </CardTitle>
              <CardDescription>
                {currentUser?.userType === UserType.NON_HOA 
                  ? "Your tennis activity history"
                  : "Your amenity booking history"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pastBookings.slice(0, 5).map(booking => {
                  const startTime = new Date(`${booking.date}T${booking.startTime}`);
                  const endTime = new Date(`${booking.date}T${booking.endTime}`);
                  
                  return (
                    <Card key={booking.id} className="overflow-hidden bg-gray-50">
                      <div className="flex flex-col sm:flex-row">
                        <div className="bg-gray-200 p-4 text-gray-700 sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                          <div className="text-lg font-medium">
                            {startTime.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="text-2xl font-bold">
                            {startTime.getDate()}
                          </div>
                        </div>
                        <div className="p-4 flex-1">
                          <div className="font-semibold">{booking.amenityName}</div>
                          <div className="text-sm text-muted-foreground">
                            {startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' • '}
                            {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                            {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MyReservations;

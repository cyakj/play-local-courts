
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';

const PendingRequests = () => {
  const { currentUser, isAdmin } = useAuth();
  const { getPendingUsersByHOAId, approveUser, rejectUser } = useData();
  
  // Redirect if not an admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  const pendingUsers = currentUser ? getPendingUsersByHOAId(currentUser.hoaId) : [];
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pending Requests</h1>
        <p className="text-muted-foreground">
          Review and manage user requests to join your HOA
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>User Requests</CardTitle>
          <CardDescription>Users waiting for approval to access court reservations</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No pending user requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map(user => (
                <Card key={user.id} className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row p-4 items-center">
                    <div className="flex-1">
                      <div className="font-medium text-lg">{user.fullName}</div>
                      <div className="text-muted-foreground">{user.email}</div>
                      <div className="mt-1 flex items-center space-x-2">
                        <Badge variant="outline">Pending</Badge>
                        <span className="text-xs text-muted-foreground">
                          Requested {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-4 sm:mt-0">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => rejectUser(user.id)}
                        className="text-red-500"
                      >
                        Reject
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => approveUser(user.id)}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingRequests;

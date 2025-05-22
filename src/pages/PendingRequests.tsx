
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { mockUsers } from '../services/mockDataService';
import { UserStatus } from '../types';

const PendingRequests = () => {
  const { currentUser, isAdmin } = useAuth();
  const { getPendingUsersByHOAId, approveUser, rejectUser } = useData();
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  
  // Redirect if not an admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Use useEffect to get the latest pending users
  useEffect(() => {
    if (currentUser) {
      // Get all pending users directly from mockUsers
      const allPendingUsers = mockUsers.filter(
        u => u.hoaId === currentUser.hoaId && u.status === UserStatus.PENDING
      );
      console.log("Found pending users:", allPendingUsers);
      setPendingUsers(allPendingUsers);
    }
  }, [currentUser]);
  
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.fullName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              rejectUser(user.id);
                              // Update the local state
                              setPendingUsers(prev => prev.filter(u => u.id !== user.id));
                            }}
                            className="text-red-500"
                          >
                            Reject
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => {
                              approveUser(user.id);
                              // Update the local state
                              setPendingUsers(prev => prev.filter(u => u.id !== user.id));
                            }}
                          >
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingRequests;


import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigate } from 'react-router-dom';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { UserStatus } from '../types';
import { Badge } from '@/components/ui/badge';

const PendingRequests = () => {
  const { currentUser, isAdmin } = useAuth();
  const { pendingUsers, approveUser, rejectUser, refreshData } = useData();
  
  // Redirect if not an admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Refresh data when component mounts to ensure we have latest pending users
  useEffect(() => {
    if (currentUser && isAdmin) {
      refreshData();
    }
  }, [currentUser, isAdmin, refreshData]);
  
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
                    <TableHead>Phone</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.fullName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phoneNumber || 'Not provided'}</TableCell>
                      <TableCell>
                        {user.dateOfBirth 
                          ? new Date(user.dateOfBirth).toLocaleDateString() 
                          : 'Not provided'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Pending</Badge>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              await rejectUser(user.id);
                            }}
                            className="text-red-500 hover:text-red-600"
                          >
                            ❌ Reject
                          </Button>
                          <Button 
                            size="sm"
                            onClick={async () => {
                              await approveUser(user.id);
                            }}
                            className="text-green-600 hover:text-green-700"
                          >
                            ✅ Approve
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

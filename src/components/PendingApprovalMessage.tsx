
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Clock } from 'lucide-react';

const PendingApprovalMessage = () => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <CardTitle className="text-xl">Account Pending Approval</CardTitle>
          <CardDescription>
            Your account is currently pending approval by your HOA administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm text-yellow-800">
              You will be notified via email once your account has been approved and you can access the reservation system.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={logout}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApprovalMessage;

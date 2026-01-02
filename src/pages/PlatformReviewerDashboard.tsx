import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, FileSearch, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import HOAApplicationReview from '@/components/reviewer/HOAApplicationReview';

interface HOAApplication {
  id: string;
  applicant_id: string;
  hoa_name: string;
  community_location: string;
  estimated_residents: number;
  claimed_role: string;
  claimed_role_other: string | null;
  verification_documents: string[];
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
}

const PlatformReviewerDashboard = () => {
  const { currentUser } = useAuth();
  const [isPlatformReviewer, setIsPlatformReviewer] = useState<boolean | null>(null);
  const [applications, setApplications] = useState<HOAApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<HOAApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    checkReviewerRole();
  }, [currentUser]);

  useEffect(() => {
    if (isPlatformReviewer) {
      fetchApplications();
    }
  }, [isPlatformReviewer, activeTab]);

  const checkReviewerRole = async () => {
    if (!currentUser) {
      setIsPlatformReviewer(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .eq('role', 'platform_reviewer')
        .maybeSingle();

      if (error) throw error;
      setIsPlatformReviewer(!!data);
    } catch (error) {
      console.error('Error checking reviewer role:', error);
      setIsPlatformReviewer(false);
    }
  };

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('hoa_applications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data, error } = await query;

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case 'needs_more_info':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800"><AlertCircle className="h-3 w-3 mr-1" /> Needs Info</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleLabel = (role: string, roleOther: string | null) => {
    switch (role) {
      case 'board_member':
        return 'Board Member';
      case 'property_manager':
        return 'Property Manager';
      case 'administrator':
        return 'Administrator';
      case 'other':
        return roleOther || 'Other';
      default:
        return role;
    }
  };

  if (isPlatformReviewer === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isPlatformReviewer) {
    return <Navigate to="/dashboard" replace />;
  }

  if (selectedApplication) {
    return (
      <HOAApplicationReview
        application={selectedApplication}
        onBack={() => {
          setSelectedApplication(null);
          fetchApplications();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-purple-100 rounded-lg">
          <Shield className="h-8 w-8 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HOA Verification Queue</h1>
          <p className="text-muted-foreground">
            Review and manage HOA manager applications
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {applications.filter(a => a.status === 'pending').length}
                </p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {applications.filter(a => a.status === 'approved').length}
                </p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {applications.filter(a => a.status === 'needs_more_info').length}
                </p>
                <p className="text-sm text-muted-foreground">Needs Info</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {applications.filter(a => a.status === 'rejected').length}
                </p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>
            Click on an application to review it in detail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="needs_more_info">Needs Info</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : applications.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No applications found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedApplication(app)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{app.hoa_name}</h3>
                            {getStatusBadge(app.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {app.community_location}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{app.estimated_residents} residents</span>
                            <span>•</span>
                            <span>{getRoleLabel(app.claimed_role, app.claimed_role_other)}</span>
                            <span>•</span>
                            <span>{app.verification_documents.length} documents</span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>Submitted</p>
                          <p>{new Date(app.submitted_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformReviewerDashboard;

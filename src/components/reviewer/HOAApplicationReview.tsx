import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Users, 
  Briefcase, 
  FileText, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  MessageSquare
} from 'lucide-react';

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

interface ApplicationNote {
  id: string;
  reviewer_id: string;
  note: string;
  status_change: string | null;
  created_at: string;
}

interface ApplicantProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
}

interface Props {
  application: HOAApplication;
  onBack: () => void;
}

const HOAApplicationReview: React.FC<Props> = ({ application, onBack }) => {
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [applicantProfile, setApplicantProfile] = useState<ApplicantProfile | null>(null);
  const [newNote, setNewNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
    fetchApplicantProfile();
  }, [application.id]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('hoa_application_notes')
        .select('*')
        .eq('application_id', application.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const fetchApplicantProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .eq('id', application.applicant_id)
        .single();

      if (error) throw error;
      setApplicantProfile(data);
    } catch (error) {
      console.error('Error fetching applicant profile:', error);
    }
  };

  const handleApprove = async () => {
    if (!newNote.trim()) {
      toast.error('Please add a note before approving');
      return;
    }

    setIsLoading(true);
    setActionType('approve');
    
    try {
      const { error } = await supabase.rpc('approve_hoa_application', {
        application_id: application.id,
        reviewer_note: newNote.trim()
      });

      if (error) throw error;

      toast.success('Application approved successfully!');
      onBack();
    } catch (error: any) {
      console.error('Error approving application:', error);
      toast.error(error.message || 'Failed to approve application');
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleReject = async () => {
    if (!newNote.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsLoading(true);
    setActionType('reject');
    
    try {
      const { error } = await supabase.rpc('update_hoa_application_status', {
        application_id: application.id,
        new_status: 'rejected',
        reviewer_note: newNote.trim()
      });

      if (error) throw error;

      toast.success('Application rejected');
      onBack();
    } catch (error: any) {
      console.error('Error rejecting application:', error);
      toast.error(error.message || 'Failed to reject application');
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleRequestInfo = async () => {
    if (!newNote.trim()) {
      toast.error('Please specify what information is needed');
      return;
    }

    setIsLoading(true);
    setActionType('info');
    
    try {
      const { error } = await supabase.rpc('update_hoa_application_status', {
        application_id: application.id,
        new_status: 'needs_more_info',
        reviewer_note: newNote.trim()
      });

      if (error) throw error;

      toast.success('Request for information sent');
      onBack();
    } catch (error: any) {
      console.error('Error requesting info:', error);
      toast.error(error.message || 'Failed to request information');
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('hoa_application_notes')
        .insert({
          application_id: application.id,
          reviewer_id: (await supabase.auth.getUser()).data.user?.id,
          note: newNote.trim()
        });

      if (error) throw error;

      toast.success('Note added');
      setNewNote('');
      fetchNotes();
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast.error(error.message || 'Failed to add note');
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from('hoa-verification-documents')
      .createSignedUrl(path, 3600);
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
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

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Queue
      </Button>

      {/* Application Details */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>{application.hoa_name}</CardTitle>
                <CardDescription>
                  Application ID: {application.id.slice(0, 8)}
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(application.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Applicant Info */}
          <div>
            <h3 className="font-semibold mb-3">Applicant Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Name:</span>
                <span>{applicantProfile?.full_name || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Phone:</span>
                <span>{applicantProfile?.phone_number || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Community Info */}
          <div>
            <h3 className="font-semibold mb-3">Community Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="font-medium">Location:</span>
                  <p>{application.community_location}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Estimated Residents:</span>
                <span>{application.estimated_residents}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Claimed Role:</span>
                <span>{getRoleLabel(application.claimed_role, application.claimed_role_other)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Submitted:</span>
                <span>{new Date(application.submitted_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Verification Documents */}
          <div>
            <h3 className="font-semibold mb-3">Verification Documents</h3>
            {application.verification_documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded</p>
            ) : (
              <div className="space-y-2">
                {application.verification_documents.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">Document {index + 1}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => getDocumentUrl(doc)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review Actions */}
      {application.status === 'pending' || application.status === 'needs_more_info' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Review Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reviewNote">Review Note / Reason</Label>
              <Textarea
                id="reviewNote"
                placeholder="Add a note about your decision or request..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleApprove}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionType === 'approve' ? 'Approving...' : 'Approve Application'}
              </Button>
              <Button
                variant="outline"
                onClick={handleRequestInfo}
                disabled={isLoading}
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                {actionType === 'info' ? 'Sending...' : 'Request More Info'}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isLoading}
              >
                {actionType === 'reject' ? 'Rejecting...' : 'Reject Application'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Add Internal Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="internalNote">Note</Label>
              <Textarea
                id="internalNote"
                placeholder="Add an internal note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={handleAddNote} disabled={isLoading || !newNote.trim()}>
              Add Note
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notes History */}
      <Card>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
          <CardDescription>All notes and decisions for this application</CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No notes yet
            </p>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="p-4 bg-muted rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {note.status_change && (
                        <Badge variant="outline" className="capitalize">
                          {note.status_change.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{note.note}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HOAApplicationReview;

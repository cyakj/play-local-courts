import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, FileText, X, Building2, CheckCircle, Clock } from 'lucide-react';

interface ExistingApplication {
  id: string;
  hoa_name: string;
  status: string;
  submitted_at: string;
}

const HOAApplication = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hoaName, setHoaName] = useState('');
  const [communityLocation, setCommunityLocation] = useState('');
  const [estimatedResidents, setEstimatedResidents] = useState<number>(0);
  const [claimedRole, setClaimedRole] = useState<string>('');
  const [claimedRoleOther, setClaimedRoleOther] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<ExistingApplication | null>(null);
  const [latestReviewerNote, setLatestReviewerNote] = useState<{ note: string; created_at: string } | null>(null);
  const [forceResubmit, setForceResubmit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkExistingApplication();
    // Pre-fill from profile if available
    if (currentUser?.fullName) {
      setFullName(currentUser.fullName);
    }
    if (currentUser?.phoneNumber) {
      setPhoneNumber(currentUser.phoneNumber);
    }
  }, [currentUser]);

  const fetchLatestReviewerNote = async (applicationId: string) => {
    try {
      const { data, error } = await supabase
        .from('hoa_application_notes')
        .select('note, created_at')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestReviewerNote(data ?? null);
    } catch (error) {
      console.error('Error fetching reviewer note:', error);
      setLatestReviewerNote(null);
    }
  };

  const checkExistingApplication = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('hoa_applications')
        .select('id, hoa_name, status, submitted_at')
        .eq('applicant_id', currentUser.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setExistingApplication(data ?? null);
      setForceResubmit(false);

      if (data?.id) {
        await fetchLatestReviewerNote(data.id);
      } else {
        setLatestReviewerNote(null);
      }
    } catch (error) {
      console.error('Error checking existing application:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (!currentUser || uploadedFiles.length === 0) return [];

    const uploadedUrls: string[] = [];
    
    for (const file of uploadedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('hoa-verification-documents')
        .upload(fileName, file);

      if (error) {
        console.error('Error uploading file:', error);
        throw error;
      }

      uploadedUrls.push(fileName);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('You must be logged in to submit an application');
      return;
    }

    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    if (!phoneNumber.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    if (uploadedFiles.length === 0) {
      toast.error('Please upload at least one verification document');
      return;
    }

    setIsSubmitting(true);

    try {
      // First update the profile with name and phone
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
        })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      // Upload verification documents
      const documentUrls = await uploadFiles();

      if (forceResubmit && existingApplication) {
        // Update existing application: append new documents and reset status to pending
        const { data: currentApp, error: fetchError } = await supabase
          .from('hoa_applications')
          .select('verification_documents')
          .eq('id', existingApplication.id)
          .single();

        if (fetchError) throw fetchError;

        const existingDocs: string[] = currentApp?.verification_documents || [];
        const mergedDocs = [...existingDocs, ...documentUrls];

        const { error: updateError } = await supabase
          .from('hoa_applications')
          .update({
            verification_documents: mergedDocs,
            status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingApplication.id);

        if (updateError) throw updateError;

        toast.success('Updated information submitted! RallyNet will review your application.');
      } else {
        // Create new application
        const { error } = await supabase
          .from('hoa_applications')
          .insert({
            applicant_id: currentUser.id,
            hoa_name: hoaName,
            community_location: communityLocation,
            estimated_residents: estimatedResidents,
            claimed_role: claimedRole,
            claimed_role_other: claimedRole === 'other' ? claimedRoleOther : null,
            verification_documents: documentUrls,
          });

        if (error) throw error;

        toast.success('Application submitted successfully! We will review it shortly.');
      }

      setForceResubmit(false);
      setUploadedFiles([]);

      // Refresh to show updated status
      await checkExistingApplication();
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Show existing application status
  if (existingApplication && !forceResubmit) {
    const submittedLabel = new Date(existingApplication.submitted_at).toLocaleDateString('en-US');
    const noteTimestampLabel = latestReviewerNote?.created_at
      ? new Date(latestReviewerNote.created_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
          hour12: true,
        })
      : null;

    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>HOA Application Status</CardTitle>
                <CardDescription>
                  Your application for "{existingApplication.hoa_name}"
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted">
              {existingApplication.status === 'pending' && (
                <>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold text-lg">Verification Pending</h3>
                    <p className="text-muted-foreground">
                      RallyNet is reviewing your application to register this HOA on the platform.
                    </p>
                  </div>
                </>
              )}
              {existingApplication.status === 'approved' && (
                <>
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold text-lg">Application Approved!</h3>
                    <p className="text-muted-foreground">
                      You now have administrative access to your community.
                    </p>
                  </div>
                </>
              )}
              {existingApplication.status === 'rejected' && (
                <>
                  <X className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold text-lg">Application Not Approved</h3>
                    <p className="text-muted-foreground">
                      Please review the most recent note below for details.
                    </p>
                  </div>
                </>
              )}
              {existingApplication.status === 'needs_more_info' && (
                <>
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold text-lg">Additional Information Needed</h3>
                    <p className="text-muted-foreground">
                      A RallyNet reviewer requested more information. Review the request below, then submit updated documents.
                    </p>
                  </div>
                </>
              )}
            </div>

            {(existingApplication.status === 'needs_more_info' || existingApplication.status === 'rejected') && (
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium">Reviewer request</p>
                  {noteTimestampLabel && (
                    <p className="text-xs text-muted-foreground">{noteTimestampLabel}</p>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {latestReviewerNote?.note || 'No note found yet.'}
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">Submitted on {submittedLabel}</p>

            <div className="flex flex-col sm:flex-row gap-3">
              {existingApplication.status === 'needs_more_info' && (
                <Button onClick={() => setForceResubmit(true)} className="sm:flex-1">
                  Submit Updated Documents
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="sm:flex-1">
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>HOA Manager Application</CardTitle>
              <CardDescription>
                Apply to become the administrator for your community
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Applicant Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Your Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="fullName"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number <span className="text-red-500">*</span></Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* HOA Name */}
            <div className="space-y-2">
              <Label htmlFor="hoaName">HOA / Community Name <span className="text-red-500">*</span></Label>
              <Input
                id="hoaName"
                placeholder="e.g., Sunset Hills Homeowners Association"
                value={hoaName}
                onChange={(e) => setHoaName(e.target.value)}
                required
              />
            </div>

            {/* Community Location */}
            <div className="space-y-2">
              <Label htmlFor="communityLocation">Community Location <span className="text-red-500">*</span></Label>
              <Input
                id="communityLocation"
                placeholder="e.g., 123 Main Street, City, State 12345"
                value={communityLocation}
                onChange={(e) => setCommunityLocation(e.target.value)}
                required
              />
            </div>

            {/* Estimated Residents */}
            <div className="space-y-2">
              <Label htmlFor="estimatedResidents">Estimated Number of Residents <span className="text-red-500">*</span></Label>
              <Input
                id="estimatedResidents"
                type="number"
                min="1"
                placeholder="e.g., 150"
                value={estimatedResidents || ''}
                onChange={(e) => setEstimatedResidents(parseInt(e.target.value) || 0)}
                required
              />
            </div>

            {/* Claimed Role */}
            <div className="space-y-2">
              <Label htmlFor="claimedRole">Your Role in the HOA <span className="text-red-500">*</span></Label>
              <Select value={claimedRole} onValueChange={setClaimedRole} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="board_member">Board Member</SelectItem>
                  <SelectItem value="property_manager">Property Manager</SelectItem>
                  <SelectItem value="administrator">Administrator</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Other Role Description */}
            {claimedRole === 'other' && (
              <div className="space-y-2">
                <Label htmlFor="claimedRoleOther">Please describe your role <span className="text-red-500">*</span></Label>
                <Input
                  id="claimedRoleOther"
                  placeholder="Describe your role"
                  value={claimedRoleOther}
                  onChange={(e) => setClaimedRoleOther(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Verification Documents */}
            <div className="space-y-3">
              <Label>Verification Documents <span className="text-red-500">*</span></Label>
              <p className="text-sm text-muted-foreground">
                Upload proof of your administrative authority. This can include:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Screenshots of your HOA management portal</li>
                <li>Official HOA communications with your name</li>
                <li>Meeting minutes showing your role</li>
                <li>Property management agreement</li>
              </ul>

              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="fileUpload"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="fileUpload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Click to upload files</span>
                  <span className="text-xs text-muted-foreground">
                    PDF, DOC, or images (max 10MB each)
                  </span>
                </label>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Important Notice */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Important:</strong> Your application will be reviewed by our team to verify your administrative authority. 
                This process typically takes 1-2 business days. You'll receive a notification once your application has been reviewed.
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={
                isSubmitting ||
                !fullName.trim() ||
                !phoneNumber.trim() ||
                !hoaName ||
                !communityLocation ||
                !estimatedResidents ||
                !claimedRole ||
                (claimedRole === 'other' && !claimedRoleOther) ||
                uploadedFiles.length === 0
              }
            >
              {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default HOAApplication;

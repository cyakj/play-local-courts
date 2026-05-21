
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Clock, FileText } from 'lucide-react';

type ApplicationSummary = {
  id: string;
  hoa_name: string;
  status: string;
  submitted_at: string;
};

type ApplicationNote = {
  note: string;
  created_at: string;
  status_change: string | null;
};

const PendingApprovalMessage = () => {
  const { logout, currentUser } = useAuth();
  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [latestNote, setLatestNote] = useState<ApplicationNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: appData, error: appError } = await supabase
        .from('hoa_applications')
        .select('id, hoa_name, status, submitted_at')
        .eq('applicant_id', currentUser.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appError) throw appError;

      setApplication(appData ?? null);

      if (appData?.id) {
        const { data: noteData, error: noteError } = await supabase
          .from('hoa_application_notes')
          .select('note, created_at, status_change')
          .eq('application_id', appData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (noteError) throw noteError;

        setLatestNote(noteData ?? null);
      } else {
        setLatestNote(null);
      }
    } catch (error) {
      console.error('Error loading HOA application status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser?.id]);

  // Subscribe to realtime updates on the user's application
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel('hoa-application-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hoa_applications',
          filter: `applicant_id=eq.${currentUser.id}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const content = useMemo(() => {
    // No HOA application found -> treat as resident pending HOA admin approval
    if (!application) {
      return {
        icon: <Clock className="h-6 w-6 text-muted-foreground" />,
        title: 'Account Pending Approval',
        description: 'Your account is currently pending approval by your HOA administrator.',
        details:
          'You will be notified once your account has been approved and you can access the reservation system.',
        primaryCta: null as null | { label: string; to: string },
      };
    }

    if (application.status === 'needs_more_info') {
      return {
        icon: <AlertCircle className="h-6 w-6 text-muted-foreground" />,
        title: 'More Information Needed',
        description: 'A RallyNet reviewer requested additional details for your HOA registration.',
        details: latestNote?.note || 'Please open your application to see what is needed and submit the requested details.',
        primaryCta: { label: 'Provide Information', to: '/hoa-application' },
      };
    }

    if (application.status === 'pending') {
      return {
        icon: <FileText className="h-6 w-6 text-muted-foreground" />,
        title: 'RallyNet is Reviewing Your HOA Application',
        description: `Your application for "${application.hoa_name}" is in the verification queue.`,
        details: 'We will notify you as soon as a reviewer completes the verification process.',
        primaryCta: { label: 'View Application Status', to: '/hoa-application' },
      };
    }

    if (application.status === 'rejected') {
      return {
        icon: <AlertCircle className="h-6 w-6 text-muted-foreground" />,
        title: 'Application Not Approved',
        description: `Your HOA application for "${application.hoa_name}" was not approved.`,
        details: latestNote?.note || 'Please open your application for next steps.',
        primaryCta: { label: 'View Application', to: '/hoa-application' },
      };
    }

    return {
      icon: <Clock className="h-6 w-6 text-muted-foreground" />,
      title: 'Application In Progress',
      description: `Your HOA application for "${application.hoa_name}" is currently being processed.`,
      details: latestNote?.note || 'Please check back soon for updates.',
      primaryCta: { label: 'View Application', to: '/hoa-application' },
    };
  }, [application, latestNote]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            ) : (
              content.icon
            )}
          </div>
          <CardTitle className="text-xl">{content.title}</CardTitle>
          <CardDescription>{content.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">{content.details}</p>
          </div>

          {content.primaryCta && (
            <Button asChild className="w-full">
              <Link to={content.primaryCta.to}>{content.primaryCta.label}</Link>
            </Button>
          )}

          <Button variant="outline" className="w-full" onClick={logout}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApprovalMessage;


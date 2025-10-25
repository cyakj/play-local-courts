import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function UpgradeToCoach() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const upgradeToCoach = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Not logged in');
        return;
      }

      // Check if already a coach
      const { data: existingCoach } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCoach) {
        toast.info('You are already a coach!');
        navigate('/coach-dashboard');
        return;
      }

      // Create coach profile
      const { error: coachError } = await supabase
        .from('coaches')
        .insert({
          user_id: user.id,
          business_name: 'My Coaching Business',
          credentials: 'USPTA',
          years_experience: 5,
          sports_offered: ['Tennis'],
          home_base: 'San Juan, PR',
          willing_to_travel: true,
          hourly_rate: 75,
          bio: 'Professional coach with years of experience'
        });

      if (coachError) {
        console.error('Error creating coach profile:', coachError);
        toast.error('Failed to upgrade to coach: ' + coachError.message);
        return;
      }

      toast.success('Successfully upgraded to coach account!');
      
      // Refresh the page to update auth context
      setTimeout(() => {
        window.location.href = '/coach-dashboard';
      }, 1000);
      
    } catch (error) {
      console.error('Error upgrading to coach:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Upgrade to Coach Account</CardTitle>
          <CardDescription>
            Convert your current account to a coach account to access coaching features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={upgradeToCoach} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Upgrading...' : 'Upgrade to Coach'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

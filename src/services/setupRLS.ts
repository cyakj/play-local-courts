
import { supabase } from '@/integrations/supabase/client';

export const setupHOARLS = async () => {
  console.log('Setting up RLS policies for HOAs table...');
  
  try {
    // Enable RLS on hoas table if not already enabled
    const { error: rlsError } = await supabase.rpc('enable_rls_if_not_exists', {
      table_name: 'hoas'
    });
    
    if (rlsError) {
      console.log('RLS may already be enabled:', rlsError.message);
    }

    // Create policy for public read access to hoas
    const { error: policyError } = await supabase.rpc('create_policy_if_not_exists', {
      table_name: 'hoas',
      policy_name: 'Allow public read access to hoas',
      policy_definition: 'CREATE POLICY "Allow public read access to hoas" ON public.hoas FOR SELECT USING (true);'
    });

    if (policyError) {
      console.log('Policy may already exist:', policyError.message);
    }

    console.log('HOA RLS setup completed');
  } catch (error) {
    console.error('Error setting up HOA RLS:', error);
  }
};

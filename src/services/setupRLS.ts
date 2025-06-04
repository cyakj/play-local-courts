
import { supabase } from '@/integrations/supabase/client';

export const setupHOARLS = async () => {
  console.log('Setting up RLS policies for HOAs table...');
  
  try {
    // Check if we can access the hoas table
    const { data, error } = await supabase
      .from('hoas')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('Error accessing hoas table:', error);
      return;
    }

    console.log('HOA table accessible, count:', data);
    console.log('RLS policies should be configured via SQL migrations in Supabase dashboard');
  } catch (error) {
    console.error('Error setting up HOA RLS:', error);
  }
};

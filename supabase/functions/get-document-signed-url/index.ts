import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const extractStoragePath = (url: string): string | null => {
  const patterns = [
    /\/storage\/v1\/object\/(?:public|sign)\/hoa-documents\/(.+?)(?:\?|$)/,
    /\/object\/(?:public|sign)\/hoa-documents\/(.+?)(?:\?|$)/,
    /\/hoa-documents\/(.+?)(?:\?|$)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { documentId, fileUrl } = await req.json();

    if (!documentId || !fileUrl) {
      return new Response(JSON.stringify({ error: 'documentId and fileUrl are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;

    const { data: membership, error: membershipError } = await supabase
      .from('hoa_documents')
      .select(`id, hoa_id, visibility, hoa_memberships!inner(user_id, role, status)`)
      .eq('id', documentId)
      .eq('hoa_memberships.user_id', userId)
      .eq('hoa_memberships.status', 'approved')
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberRole = Array.isArray((membership as any).hoa_memberships)
      ? (membership as any).hoa_memberships[0]?.role
      : (membership as any).hoa_memberships?.role;

    if ((membership as any).visibility === 'board_only' && memberRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const storagePath = extractStoragePath(fileUrl);
    if (!storagePath) {
      return new Response(JSON.stringify({ error: 'Invalid file path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: signed, error: signError } = await admin.storage
      .from('hoa-documents')
      .createSignedUrl(storagePath, 3600);

    if (signError || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: signError?.message || 'Could not sign file' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ signedUrl: signed.signedUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

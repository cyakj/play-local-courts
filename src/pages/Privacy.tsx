import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 h-11">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Privacy Policy content coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Privacy;

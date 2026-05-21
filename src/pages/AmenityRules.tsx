
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';
import { Edit, Settings } from 'lucide-react';
import RuleEditor from '../components/RuleEditor';

const AmenityRules = () => {
  const { currentUser, isAdmin } = useAuth();
  const { amenities } = useData();
  const [selectedAmenity, setSelectedAmenity] = useState<string | null>(null);
  
  // Redirect if not an admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (selectedAmenity) {
    const amenity = amenities.find(a => a.id === selectedAmenity);
    if (!amenity) {
      setSelectedAmenity(null);
      return null;
    }
    
    return (
      <RuleEditor 
        amenity={amenity}
        onBack={() => setSelectedAmenity(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Amenity Rules</h1>
        <p className="text-muted-foreground">
          Configure custom reservation rules for each amenity in your community
        </p>
      </div>
      
      {amenities.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No amenities available</p>
            <p className="text-sm text-muted-foreground">
              Add amenities first in the "Manage Facilities" section to configure rules.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {amenities.map(amenity => (
            <Card key={amenity.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span className="text-lg">{amenity.name}</span>
                  <Badge variant="outline" className="ml-2">
                    {amenity.amenityType}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Configure booking rules and restrictions for this {amenity.amenityType}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => setSelectedAmenity(amenity.id)}
                  className="w-full"
                  variant="outline"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Rules
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AmenityRules;

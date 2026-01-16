import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapPin, Eye, Globe, ShieldCheck, Activity } from 'lucide-react';
import { PrivacyFormData } from '@/hooks/useSettingsForm';

interface PrivacySectionProps {
  privacy: PrivacyFormData;
  setPrivacy: React.Dispatch<React.SetStateAction<PrivacyFormData>>;
}

const PrivacySection: React.FC<PrivacySectionProps> = ({ privacy, setPrivacy }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Privacy & Security</CardTitle>
        <CardDescription>Control how your information is shared with others</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Location-Based Searches */}
        <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label className="font-medium cursor-pointer">Location-Based Searches</Label>
              <p className="text-sm text-muted-foreground">Allow others to find you based on distance</p>
            </div>
          </div>
          <Switch
            checked={privacy.locationVisible}
            onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, locationVisible: checked }))}
            className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary"
          />
        </div>

        {/* Show Exact Distance */}
        <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <Eye className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label className="font-medium cursor-pointer">Show Exact Distance</Label>
              <p className="text-sm text-muted-foreground">When disabled, others see "Nearby" instead of miles</p>
            </div>
          </div>
          <Switch
            checked={privacy.showExactDistance}
            onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, showExactDistance: checked }))}
            className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary"
          />
        </div>

        {/* Public Profile */}
        <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label className="font-medium cursor-pointer">Public Profile</Label>
              <p className="text-sm text-muted-foreground">Allow others to see your stats and skill level</p>
            </div>
          </div>
          <Switch
            checked={privacy.publicProfile}
            onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, publicProfile: checked }))}
            className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary"
          />
        </div>

        {/* Contact Obfuscation */}
        <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label className="font-medium cursor-pointer">Hide Contact Until Match Confirmed</Label>
              <p className="text-sm text-muted-foreground">Email/phone only revealed after both parties agree to play</p>
            </div>
          </div>
          <Switch
            checked={privacy.hideContactUntilConfirmed}
            onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, hideContactUntilConfirmed: checked }))}
            className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary"
          />
        </div>

        {/* Activity Status */}
        <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label className="font-medium cursor-pointer">Show Activity Status</Label>
              <p className="text-sm text-muted-foreground">Let others see when you're online or last active</p>
            </div>
          </div>
          <Switch
            checked={privacy.showActivityStatus}
            onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, showActivityStatus: checked }))}
            className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default PrivacySection;

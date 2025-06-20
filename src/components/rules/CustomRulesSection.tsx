
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CustomRulesSectionProps {
  customRules: string;
  onUpdate: (field: string, value: any) => void;
}

const CustomRulesSection = ({ customRules, onUpdate }: CustomRulesSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Rules</CardTitle>
      </CardHeader>
      <CardContent>
        <Label>Additional Rules & Notes</Label>
        <Textarea
          placeholder="Enter any additional rules or special instructions for this amenity..."
          value={customRules}
          onChange={(e) => onUpdate('custom_rules', e.target.value)}
          className="mt-2"
          rows={4}
        />
      </CardContent>
    </Card>
  );
};

export default CustomRulesSection;

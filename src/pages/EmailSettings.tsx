
import React from 'react';
import EmailPreferences from '../components/EmailPreferences';

const EmailSettings = () => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Email Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your email notification preferences and settings.
        </p>
      </div>
      
      <EmailPreferences />
    </div>
  );
};

export default EmailSettings;

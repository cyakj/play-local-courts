import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Shield, Users, ChevronRight, Wrench } from 'lucide-react';

const AdminHub = () => {
  const { isAdmin } = useAuth();

  // Redirect if not an admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const adminSections = [
    {
      title: 'Manage Amenities',
      description: 'Add, edit, or delete tennis courts, pools, clubhouses, and other HOA facilities.',
      icon: Settings,
      path: '/manage-amenities',
      color: 'text-blue-600 bg-blue-50'
    },
    {
      title: 'Amenity Rules & Policies',
      description: 'Set booking rules, guest policies, time restrictions, and cancellation rules for each amenity.',
      icon: Shield,
      path: '/amenity-rules',
      color: 'text-green-600 bg-green-50'
    },
    {
      title: 'Maintenance Reports',
      description: 'Track and resolve amenity maintenance issues reported by residents.',
      icon: Wrench,
      path: '/admin/maintenance',
      color: 'text-red-600 bg-red-50'
    },
    {
      title: 'Pending Member Approvals',
      description: 'Review and approve or reject requests from users wanting to join this HOA.',
      icon: Users,
      path: '/pending-requests',
      color: 'text-orange-600 bg-orange-50'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Hub</h1>
        <p className="text-muted-foreground">
          Manage your community amenities, configure rules, and handle member requests
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section) => {
          const Icon = section.icon;
          
          return (
            <Link key={section.path} to={section.path}>
              <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer group h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-lg ${section.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {section.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

    </div>
  );
};

export default AdminHub;
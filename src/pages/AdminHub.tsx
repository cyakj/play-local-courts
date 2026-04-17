import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Shield, Users, ChevronRight, Wrench } from 'lucide-react';

const AdminHub = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const adminSections = [
    {
      title: 'Manage Amenities',
      description: 'Add, edit, or delete courts, pools, clubhouses, and other facilities.',
      icon: Settings,
      path: '/manage-amenities',
      iconColor: '#00D4FF',
      iconBg: '#E0F9FF',
    },
    {
      title: 'Amenity Rules & Policies',
      description: 'Set booking rules, guest policies, time restrictions, and cancellation rules.',
      icon: Shield,
      path: '/amenity-rules',
      iconColor: '#00D4FF',
      iconBg: '#E0F9FF',
    },
    {
      title: 'Maintenance Reports',
      description: 'Track and resolve amenity maintenance issues reported by residents.',
      icon: Wrench,
      path: '/admin/maintenance',
      iconColor: '#F97066',
      iconBg: '#FFF5F5',
    },
    {
      title: 'Pending Member Approvals',
      description: 'Review and approve or reject requests from users wanting to join this HOA.',
      icon: Users,
      path: '/pending-requests',
      iconColor: '#F97066',
      iconBg: '#FFF5F5',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-28">
      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D' }} className="px-5 pt-12 pb-8 relative overflow-visible">
        <div className="text-[13px] uppercase font-semibold mb-1" style={{ color: '#00D4FF', letterSpacing: '0.15em' }}>
          Admin
        </div>
        <h1 className="text-[32px] font-black text-white leading-[1.1] tracking-tight">
          Admin Hub
        </h1>
        <p className="text-cyan-200 mt-2 leading-relaxed" style={{ fontSize: '15px', opacity: 0.85 }}>
          Manage amenities, rules, reports, and member requests.
        </p>
        <div
          className="absolute -bottom-6 left-0 right-0 h-8 pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, #0F1F3D, transparent)' }}
        />
      </div>

      <div className="px-5 pt-8 space-y-3">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.path}
              to={section.path}
              className="block bg-white rounded-2xl p-5 border border-gray-100 active:scale-[0.98] transition-transform"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: section.iconBg }}
                >
                  <Icon className="h-5 w-5" style={{ color: section.iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[16px] font-extrabold leading-tight"
                    style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}
                  >
                    {section.title}
                  </div>
                  <div className="text-[13px] mt-0.5 leading-snug" style={{ color: '#8892A4' }}>
                    {section.description}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: '#8892A4' }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AdminHub;

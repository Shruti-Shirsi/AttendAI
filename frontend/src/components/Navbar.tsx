import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/dashboard':
        return 'Executive Overview';
      case '/live-attendance':
        return 'Live Attendance Monitor';
      case '/students':
        return 'Student Directory';
      case '/classes':
        return 'Classes & Cohorts';
      case '/attendance-register':
        return 'Digital Class Register';
      case '/reports':
        return 'Reports & Compliance Analytics';
      case '/parent-comms':
        return 'Parent Communication Center';
      case '/voice-assistant':
        return 'AI Voice Assistant';
      case '/notifications':
        return 'System Notifications';
      case '/settings':
        return 'Institutional Settings';
      default:
        return 'Dashboard';
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm/50">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AttendAI</span>
        <span className="text-slate-300">/</span>
        <h2 className="text-sm font-bold text-slate-800">{getPageTitle(location.pathname)}</h2>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-5">
        {/* Date Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
          <span>📅</span>
          <span>{currentDate}</span>
        </div>

        {/* AI Vision Status */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          <span>YuNet + SFace Engine Active</span>
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {user?.full_name ? user.full_name[0] : 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-none">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-slate-400 font-medium capitalize mt-0.5">{user?.role?.toLowerCase() || 'Admin'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};


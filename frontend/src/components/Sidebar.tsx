import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  Users,
  GraduationCap,
  CalendarCheck,
  UserX,
  TrendingUp,
  MessageSquare,
  Mic,
  Bell,
  Settings,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Live Attendance', path: '/live-attendance', icon: Camera },
    { label: 'Students', path: '/students', icon: Users },
    { label: 'Classes & Sections', path: '/classes', icon: GraduationCap },
    { label: 'Attendance Records', path: '/attendance-register', icon: CalendarCheck },
    { label: 'Absentee Queue', path: '/absentees', icon: UserX },
    { label: 'Reports & Analytics', path: '/reports', icon: TrendingUp },
    { label: 'Parent Communication', path: '/parent-comms', icon: MessageSquare },
    { label: 'Calling Permissions', path: '/call-permissions', icon: ShieldCheck },
    { label: 'AI Voice Assistant', path: '/voice-assistant', icon: Mic },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 min-h-screen bg-[#111C3A] text-slate-300 flex flex-col border-r border-slate-800 select-none z-20">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
          <span className="text-xl font-black">⚡</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-white font-extrabold text-lg tracking-tight">AttendAI</h1>
            <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              {user?.role || 'SaaS'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Vision & Voice Suite</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] text-white shadow-md shadow-indigo-600/30 font-semibold translate-x-1'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer Card */}
      <div className="p-4 border-t border-slate-800 bg-[#0C142B]/80 m-3 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow">
              {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Administrator'}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                {user?.role === 'ADMIN' ? 'Full Institutional Access' : 'Class Instructor'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};


import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { AuthResponse } from '../types';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      login(res.data);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (role: 'ADMIN' | 'TEACHER') => {
    const creds =
      role === 'ADMIN'
        ? { email: 'admin@attendai.edu', password: 'admin123' }
        : { email: 'teacher@attendai.edu', password: 'teacher123' };

    setEmail(creds.email);
    setPassword(creds.password);
    setIsSubmitting(true);

    try {
      const res = await api.post<AuthResponse>('/auth/login', creds);
      login(res.data);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Demo login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row">
      {/* Left Hero Showcase */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#312E81] text-white p-8 md:p-14 flex flex-col justify-between relative overflow-hidden">
        {/* Glow Element */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/40">
            ⚡
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">AttendAI</h1>
            <p className="text-xs text-indigo-200 uppercase tracking-widest font-semibold">Institutional Vision & Attendance</p>
          </div>
        </div>

        {/* Hero Narrative */}
        <div className="relative z-10 my-10 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI-Powered Real-Time Biometric SaaS</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Smarter Attendance.{' '}
            <span className="bg-gradient-to-r from-[#818CF8] to-[#22D3EE] bg-clip-text text-transparent">
              Safer Tomorrow.
            </span>
          </h2>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Multi-face spatial tracking, automated monthly digital registers, official WhatsApp parent dispatches, and interactive AI voice verification.
          </p>

          {/* Vision Telemetry Card */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-300">Biometric Neural Accuracy</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 99.2% Sub-Second
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 rounded-full w-[99%]" />
            </div>
            <div className="flex gap-4 mt-4 text-[11px] text-slate-400 font-medium">
              <span>🛡️ Bank-Grade Security</span>
              <span>•</span>
              <span>⚡ ByteTrack Spatial Vision</span>
              <span>•</span>
              <span>📹 60 FPS CCTV</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-slate-400 flex items-center justify-between">
          <span>© 2026 AttendAI Inc. All rights reserved.</span>
          <span>v2.0 Production Release</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="w-full md:w-1/2 p-8 md:p-16 flex items-center justify-center bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Faculty & Administrator Sign In</h3>
            <p className="text-sm text-slate-500 mt-1">
              Enter your credentials to manage attendance, classes, and parent communication.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Institutional Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@attendai.edu"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <a href="#" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="remember"
                defaultChecked
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="remember" className="text-xs text-slate-600 font-medium">
                Keep me authenticated on this device
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-indigo-600 hover:to-purple-600 shadow-md shadow-indigo-600/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Sign In to Executive Suite →</span>
              )}
            </button>
          </form>

          {/* Quick Demo Login Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold">
              <span className="bg-white px-3 text-slate-400">⚡ 1-Click Quick Demo Sign In</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('ADMIN')}
              className="py-2.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Sign In as Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin('TEACHER')}
              className="py-2.5 px-3 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100/70 text-purple-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <span>👩‍🏫 Sign In as Teacher</span>
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-400 mt-6">
            Protected by AttendAI Biometric Security Core & End-to-End Encryption.
          </p>
        </div>
      </div>
    </div>
  );
};


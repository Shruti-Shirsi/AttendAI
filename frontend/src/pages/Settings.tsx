import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle2,
  AlertCircle,
  Camera,
  ShieldCheck,
  MessageSquare,
  Mic,
  Lock,
  KeyRound,
  RotateCcw,
  Sliders,
  Building,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SystemSettings {
  face_confidence_threshold: number;
  consecutive_frames_required: number;
  shortage_threshold_percent: number;
  institution_name: string;
  camera_source: string;
  meta_whatsapp_phone_id: string;
  meta_webhook_verify_token: string;
  ai_voice_default_language: string;
  duplicate_stamping_window_hours: number;
  user_email?: string;
  user_role?: string;
  user_name?: string;
}

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({
    face_confidence_threshold: 0.35,
    consecutive_frames_required: 5,
    shortage_threshold_percent: 75.0,
    institution_name: 'College of Engineering',
    camera_source: '0 (Integrated USB Webcam)',
    meta_whatsapp_phone_id: '109823482394',
    meta_webhook_verify_token: 'attendai_webhook_verify_secret_2026',
    ai_voice_default_language: 'EN',
    duplicate_stamping_window_hours: 24
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'biometrics' | 'attendance' | 'whatsapp' | 'voice' | 'security'>('biometrics');

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordSaving, setPasswordSaving] = useState<boolean>(false);

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get<SystemSettings>('/settings/');
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
      showToast('Could not load current system settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put('/settings/', settings);
      showToast('System configuration saved successfully!');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to save settings. Admin access required.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (passwordData.new_password.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }

    try {
      setPasswordSaving(true);
      await api.post('/settings/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      showToast('Account password updated successfully!');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to change password.', 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/20">
                    <SettingsIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                      System Settings & Configuration
                    </h1>
                    <p className="text-sm text-slate-500">
                      Fine-tune biometric algorithms, institutional thresholds, WhatsApp API, and AI voice parameters
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Toast */}
            {toastMsg && (
              <div
                className={`p-4 rounded-xl flex items-center justify-between text-sm font-semibold transition-all ${
                  toastMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {toastMsg.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  )}
                  <span>{toastMsg.text}</span>
                </div>
                <button
                  onClick={() => setToastMsg(null)}
                  className="text-xs uppercase tracking-wider font-bold opacity-70 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Settings Tab Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              {[
                { id: 'biometrics', label: 'Face Biometrics & Vision', icon: Camera },
                { id: 'attendance', label: 'Attendance & Shortage Policy', icon: ShieldCheck },
                { id: 'whatsapp', label: 'WhatsApp Cloud API', icon: MessageSquare },
                { id: 'voice', label: 'AI Voice Dialer', icon: Mic },
                { id: 'security', label: 'Account & Security', icon: Lock }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              {activeTab !== 'security' ? (
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {/* TAB: BIOMETRICS */}
                  {activeTab === 'biometrics' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Computer Vision & Facial Recognition</h3>
                        <p className="text-xs text-slate-500">YuNet SCRFD detection and SFace 128-D embedding matching thresholds</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                            <span>Cosine Similarity Threshold</span>
                            <span className="font-mono text-indigo-600">
                              {(settings.face_confidence_threshold * 100).toFixed(0)}% ({settings.face_confidence_threshold})
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.20"
                            max="0.80"
                            step="0.05"
                            value={settings.face_confidence_threshold}
                            onChange={(e) =>
                              setSettings({ ...settings, face_confidence_threshold: parseFloat(e.target.value) })
                            }
                            className="w-full accent-indigo-600"
                          />
                          <p className="text-[11px] text-slate-500">
                            Lower value accepts wider angles; higher value enforces strict matching. Recommended: 35%.
                          </p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                            <span>Consecutive Verification Frames (K)</span>
                            <span className="font-mono text-indigo-600">{settings.consecutive_frames_required} frames</span>
                          </div>
                          <input
                            type="range"
                            min="3"
                            max="10"
                            step="1"
                            value={settings.consecutive_frames_required}
                            onChange={(e) =>
                              setSettings({ ...settings, consecutive_frames_required: parseInt(e.target.value) })
                            }
                            className="w-full accent-indigo-600"
                          />
                          <p className="text-[11px] text-slate-500">
                            Number of consecutive tracked frames required before automatically marking Present. Default: 5.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Default Camera Device / RTSP Stream</label>
                        <input
                          type="text"
                          value={settings.camera_source}
                          onChange={(e) => setSettings({ ...settings, camera_source: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          Set to "0" for local webcam or rtsp://username:pass@ip:port/stream for classroom IP camera.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TAB: ATTENDANCE POLICY */}
                  {activeTab === 'attendance' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Attendance Policies & Thresholds</h3>
                        <p className="text-xs text-slate-500">Configures mandatory compliance criteria and shortage risk monitoring</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                            <span>Shortage Alert Threshold</span>
                            <span className="font-mono text-rose-600 font-extrabold">
                              {settings.shortage_threshold_percent}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="60"
                            max="85"
                            step="1"
                            value={settings.shortage_threshold_percent}
                            onChange={(e) =>
                              setSettings({ ...settings, shortage_threshold_percent: parseFloat(e.target.value) })
                            }
                            className="w-full accent-rose-600"
                          />
                          <p className="text-[11px] text-slate-500">
                            Students falling below this percentage trigger the "Critical Shortage" flag on class registers.
                          </p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                            <span>Duplicate Attendance Window</span>
                            <span className="font-mono text-indigo-600 font-extrabold">
                              {settings.duplicate_stamping_window_hours} Hours
                            </span>
                          </div>
                          <input
                            type="range"
                            min="12"
                            max="48"
                            step="6"
                            value={settings.duplicate_stamping_window_hours}
                            onChange={(e) =>
                              setSettings({ ...settings, duplicate_stamping_window_hours: parseInt(e.target.value) })
                            }
                            className="w-full accent-indigo-600"
                          />
                          <p className="text-[11px] text-slate-500">
                            Prevents stamping the same student more than once per instructional calendar session.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Institution Display Name</label>
                        <input
                          type="text"
                          value={settings.institution_name}
                          onChange={(e) => setSettings({ ...settings, institution_name: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB: WHATSAPP CLOUD API */}
                  {activeTab === 'whatsapp' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Meta WhatsApp Business Platform</h3>
                        <p className="text-xs text-slate-500">Connect to Meta Cloud API for official automated parent notifications</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Phone Number ID</label>
                          <input
                            type="text"
                            value={settings.meta_whatsapp_phone_id}
                            onChange={(e) => setSettings({ ...settings, meta_whatsapp_phone_id: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Webhook Verify Secret Token</label>
                          <input
                            type="text"
                            value={settings.meta_webhook_verify_token}
                            onChange={(e) => setSettings({ ...settings, meta_webhook_verify_token: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span>Gateway is active with instant fallback simulation mode.</span>
                        </div>
                        <span className="font-mono text-[10px] bg-emerald-200/60 px-2 py-0.5 rounded text-emerald-800 font-bold">
                          HTTP 200 OK
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TAB: AI VOICE DIALER */}
                  {activeTab === 'voice' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">AI Voice Assistant Parameters</h3>
                        <p className="text-xs text-slate-500">Configure conversational dialing dialects and voice agent prompts</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Default Dialing Language</label>
                          <select
                            value={settings.ai_voice_default_language}
                            onChange={(e) => setSettings({ ...settings, ai_voice_default_language: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                          >
                            <option value="EN">English (Institutional Formal)</option>
                            <option value="HI">हिन्दी (Hindi - Conversational)</option>
                            <option value="MR">मराठी (Marathi - Regional)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Parent Calling Consent Window</label>
                          <input
                            type="text"
                            disabled
                            value="Strict 24-Hour Expiration (Module 10 Mandate)"
                            className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Saving Changes...' : 'Save Configuration'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* TAB: SECURITY & PASSWORD CHANGE */
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Account Credentials & Password</h3>
                    <p className="text-xs text-slate-500">Update your account login password and view user privileges</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">{user?.full_name || 'Administrator'}</span>
                      <span className="text-slate-500">{user?.email || 'admin@attendai.edu'}</span>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold uppercase rounded-lg border border-indigo-200">
                      {user?.role || 'ADMIN'}
                    </span>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-4 max-w-md text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Current Password *</label>
                      <input
                        type="password"
                        required
                        value={passwordData.current_password}
                        onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">New Password (Min 6 Characters) *</label>
                      <input
                        type="password"
                        required
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Confirm New Password *</label>
                      <input
                        type="password"
                        required
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={passwordSaving}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
    </div>
  );
};


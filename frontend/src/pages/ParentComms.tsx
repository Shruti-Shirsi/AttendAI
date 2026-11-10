import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CheckCheck,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  PhoneCall,
  Search,
  ExternalLink,
  ShieldCheck,
  Percent,
  Users,
  Globe,
  Radio
} from 'lucide-react';
import { api } from '../services/api';
import { WhatsAppNotificationItem, WhatsAppStats } from '../types';

export const ParentComms: React.FC = () => {
  const [notifications, setNotifications] = useState<WhatsAppNotificationItem[]>([]);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DELIVERED' | 'READ' | 'SENT' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchStatsAndHistory = async () => {
    try {
      setIsLoading(true);
      const [statsRes, historyRes] = await Promise.all([
        api.get<WhatsAppStats>('/whatsapp/stats'),
        api.get<WhatsAppNotificationItem[]>('/whatsapp/notifications', {
          params: {
            date: selectedDate,
            status: statusFilter
          }
        })
      ]);
      setStats(statsRes.data);
      setNotifications(historyRes.data);
    } catch (err) {
      console.error('Failed to load parent communications:', err);
      showToast('Could not load communications stream.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndHistory();
  }, [selectedDate, statusFilter]);

  // Dispatch all approved notifications
  const handleDispatchApproved = async () => {
    try {
      setIsDispatching(true);
      const res = await api.post('/whatsapp/dispatch-approved');
      showToast(`Dispatched ${res.data.dispatched_count} WhatsApp notifications to parents!`);
      fetchStatsAndHistory();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Dispatch failed.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Re-send / Send Single
  const handleSendSingle = async (notifId: number) => {
    try {
      await api.post(`/whatsapp/send-single/${notifId}`);
      showToast('WhatsApp notification sent successfully!');
      fetchStatsAndHistory();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to send notification.');
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch =
      n.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.parent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.recipient_phone.includes(searchQuery);
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl bg-slate-900 text-white border border-indigo-500/50 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Parent WhatsApp Communication Hub</h1>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Meta Cloud API Ready
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Official parent notification gateway with real-time delivery receipts, interactive response buttons, and multilingual translation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/call-permissions"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Voice Calling Consent</span>
          </a>

          <button
            onClick={fetchStatsAndHistory}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Receipts</span>
          </button>

          <button
            onClick={handleDispatchApproved}
            disabled={isDispatching || (stats?.approved_waiting_dispatch || 0) === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/30 transition-all hover:translate-y-[-1px] disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Dispatch Approved Alerts ({stats?.approved_waiting_dispatch || 0})</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Messages Dispatched</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{stats?.total_dispatched || 0}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Parent notifications</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Delivery Rate</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{stats?.delivery_rate_percentage || 0}%</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
              {stats?.delivered_count || 0} Delivered successfully
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Parent Engagement</p>
            <p className="text-2xl font-black text-cyan-600 mt-0.5">{stats?.read_rate_percentage || 0}%</p>
            <p className="text-[10px] text-cyan-600 font-bold mt-0.5">
              {stats?.read_count || 0} Read receipts received
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Send</p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{stats?.approved_waiting_dispatch || 0}</p>
            <p className="text-[10px] text-amber-600 font-bold mt-0.5">Teacher approved</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Delivery Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['ALL', 'DELIVERED', 'READ', 'SENT', 'FAILED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === status
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL'
                  ? 'All Statuses'
                  : status === 'READ'
                  ? '✓✓ Read'
                  : status === 'DELIVERED'
                  ? '✓✓ Delivered'
                  : status === 'SENT'
                  ? '✓ Sent'
                  : 'Failed'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student, parent or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* ── COMMUNICATIONS STREAM TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Student</th>
                <th className="py-3.5 px-5">Cohort</th>
                <th className="py-3.5 px-5">Parent & WhatsApp</th>
                <th className="py-3.5 px-5">Language</th>
                <th className="py-3.5 px-5">Message Payload</th>
                <th className="py-3.5 px-5">Delivery Receipt</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading WhatsApp Communications Stream...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquare className="w-10 h-10 text-slate-300 stroke-1" />
                      <p className="font-bold text-slate-700">No Communications Records</p>
                      <p className="text-[11px] text-slate-400">
                        No WhatsApp alerts dispatched for {selectedDate}.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((notif) => {
                  const cleanPhone = notif.recipient_phone.replace(/[^0-9]/g, '');
                  const waLink = `https://wa.me/${cleanPhone}`;

                  return (
                    <tr key={notif.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0">
                            {notif.student_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{notif.student_name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{notif.roll_number}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {notif.class_name}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                            title="Open direct WhatsApp conversation"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </a>
                          <div>
                            <p className="font-semibold text-slate-800 flex items-center gap-1">
                              <span>{notif.recipient_phone}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                            </p>
                            <p className="text-[10px] text-slate-400">{notif.parent_name}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          <Globe className="w-3 h-3 text-slate-400" />
                          {notif.language === 'HI' ? 'हिन्दी' : notif.language === 'MR' ? 'मराठी' : 'English'}
                        </span>
                      </td>

                      <td className="py-4 px-5 max-w-sm">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-700 leading-relaxed">
                          <p>{notif.message_content}</p>
                          {notif.external_provider_id && (
                            <p className="text-[9px] font-mono text-slate-400 mt-1 truncate">
                              ID: {notif.external_provider_id}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        {notif.status === 'READ' ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-cyan-50 text-cyan-700 border border-cyan-200">
                            <CheckCheck className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Read by Parent</span>
                          </div>
                        ) : notif.status === 'DELIVERED' ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Delivered</span>
                          </div>
                        ) : notif.status === 'SENT' ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Check className="w-3.5 h-3.5" />
                            <span>Sent to Meta</span>
                          </div>
                        ) : notif.status === 'FAILED' ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending Send</span>
                          </div>
                        )}
                        {notif.sent_at && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(notif.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => handleSendSingle(notif.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                          title="Re-send notification"
                        >
                          Send Again
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


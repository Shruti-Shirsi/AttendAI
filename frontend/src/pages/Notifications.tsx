import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Bell,
  Search,
  CheckCircle2,
  CheckCheck,
  Check,
  AlertTriangle,
  Clock,
  RotateCcw,
  ExternalLink,
  RefreshCw,
  Filter
} from 'lucide-react';

interface NotificationLog {
  id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  class_name: string;
  parent_id: number;
  parent_name: string;
  whatsapp_number?: string;
  recipient_phone?: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  approval_status: string;
  session_date: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  external_provider_id: string | null;
  message_preview?: string;
  message_content?: string;
}

interface NotificationStats {
  total_dispatched: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  approved_waiting_dispatch: number;
}

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [notifRes, statsRes] = await Promise.all([
        api.get<NotificationLog[]>('/whatsapp/notifications', {
          params: { status: statusFilter === 'ALL' ? undefined : statusFilter }
        }),
        api.get<NotificationStats>('/whatsapp/stats')
      ]);

      setNotifications(notifRes.data || []);
      setStats(statsRes.data || null);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      showToast('Error retrieving notifications feed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [statusFilter]);

  const handleRetrySend = async (notificationId: number) => {
    try {
      await api.post(`/whatsapp/send-single/${notificationId}`);
      showToast('Notification re-dispatched to parent via WhatsApp.');
      fetchNotifications();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to re-send notification.', 'error');
    }
  };

  const filtered = (notifications || []).filter((n) => {
    const q = searchQuery.toLowerCase();
    const sName = (n.student_name || '').toLowerCase();
    const rNum = (n.roll_number || '').toLowerCase();
    const pName = (n.parent_name || '').toLowerCase();
    const phone = (n.whatsapp_number || n.recipient_phone || '');
    return (
      sName.includes(q) ||
      rNum.includes(q) ||
      pName.includes(q) ||
      phone.includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READ':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">
            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
            Read by Parent
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
            Delivered
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
            <Check className="w-3.5 h-3.5 text-amber-500" />
            Sent to Gateway
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Delivery Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Pending Dispatch
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/20">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                Notification Activity Stream
              </h1>
              <p className="text-sm text-slate-500">
                Real-time delivery receipts, Meta WhatsApp Cloud API events, and communication logs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-all flex items-center gap-2 text-xs font-bold"
            title="Refresh Notifications"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
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
              <AlertTriangle className="w-5 h-5 text-rose-600" />
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Dispatched</span>
          <div className="text-2xl font-black text-slate-800 mt-1">{stats?.total_dispatched || 0}</div>
          <span className="text-xs text-slate-500 mt-1 block">Parent broadcast alerts</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" />
            Delivered
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{stats?.delivered_count || 0}</div>
          <span className="text-xs text-emerald-600/80 mt-1 block">Confirmed handset delivery</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-sm bg-gradient-to-br from-blue-50/40 to-white">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" />
            Read Receipts
          </span>
          <div className="text-2xl font-black text-blue-700 mt-1">{stats?.read_count || 0}</div>
          <span className="text-xs text-blue-600/80 mt-1 block">Opened by guardian</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm bg-gradient-to-br from-amber-50/40 to-white">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Waiting Dispatch
          </span>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {stats?.approved_waiting_dispatch || 0}
          </div>
          <span className="text-xs text-amber-600/80 mt-1 block">Approved absentee queue</span>
        </div>
      </div>

      {/* Filter Toolbar & Data Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by student, roll, or guardian phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Delivery States</option>
              <option value="DELIVERED">Delivered</option>
              <option value="READ">Read Receipts</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Feed Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-6">Message ID / Time</th>
                <th className="py-3.5 px-6">Student Information</th>
                <th className="py-3.5 px-6">Parent Contact</th>
                <th className="py-3.5 px-6">Delivery Status</th>
                <th className="py-3.5 px-6">Message Preview</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No notifications matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const phoneStr = item.whatsapp_number || item.recipient_phone || '';
                  const previewText = item.message_preview || item.message_content || 'AttendAI Absentee Alert dispatched to parent via Meta WhatsApp Platform.';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <span className="font-mono text-[10px] text-indigo-600 block truncate max-w-[150px]">
                          {item.external_provider_id || `NOTIF-#${item.id}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.sent_at ? new Date(item.sent_at).toLocaleString() : item.session_date}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{item.student_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">Roll: {item.roll_number}</div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-800">{item.parent_name}</div>
                        <div className="font-mono text-[11px] text-indigo-600">{phoneStr}</div>
                      </td>

                      <td className="py-4 px-6">{getStatusBadge(item.status)}</td>

                      <td className="py-4 px-6 max-w-xs">
                        <p className="text-[11px] text-slate-600 truncate bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {previewText}
                        </p>
                      </td>

                      <td className="py-4 px-6 text-right">
                        {item.status === 'FAILED' ? (
                          <button
                            onClick={() => handleRetrySend(item.id)}
                            className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-lg text-xs flex items-center gap-1 transition-all"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        ) : (
                          <a
                            href={phoneStr ? `https://wa.me/${phoneStr.replace(/\+/g, '')}` : '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-slate-100 text-xs font-semibold"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Chat</span>
                          </a>
                        )}
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

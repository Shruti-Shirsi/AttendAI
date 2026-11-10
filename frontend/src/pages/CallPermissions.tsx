import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  ShieldCheck,
  PhoneCall,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Send,
  UserCheck,
  UserX,
  Search,
  Filter,
  ExternalLink,
  Info,
  Calendar,
  Lock
} from 'lucide-react';

interface CallPermissionItem {
  parent_id: number;
  student_id: number | null;
  student_name: string;
  roll_number: string;
  class_name: string;
  parent_name: string;
  whatsapp_number: string;
  preferred_language: string;
  permission_id: number | null;
  status: 'ALLOWED' | 'REQUESTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN' | 'UNREQUESTED';
  granted_at: string | null;
  expires_at: string | null;
  remaining_hours: number;
  provider_reference: string | null;
}

interface EligibleAbsentee {
  student_id: number;
  student_name: string;
  roll_number: string;
  class_name: string;
  parent_id: number;
  parent_name: string;
  whatsapp_number: string;
  preferred_language: string;
  permission_id: number;
  remaining_hours: number;
}

interface PermissionStats {
  total_parents: number;
  allowed: number;
  requested: number;
  declined: number;
  withdrawn: number;
  expired: number;
  unrequested: number;
  compliance_rate: number;
}

export const CallPermissions: React.FC = () => {
  const [permissions, setPermissions] = useState<CallPermissionItem[]>([]);
  const [eligibleAbsentees, setEligibleAbsentees] = useState<EligibleAbsentee[]>([]);
  const [stats, setStats] = useState<PermissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'roster' | 'eligible'>('roster');

  // Manual Grant Modal
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<CallPermissionItem | null>(null);
  const [grantReason, setGrantReason] = useState('Parent verbal consent on file / Institutional policy');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [permRes, statsRes, eligibleRes] = await Promise.all([
        api.get<CallPermissionItem[]>('/permissions/', {
          params: { status: statusFilter === 'ALL' ? undefined : statusFilter }
        }),
        api.get<PermissionStats>('/permissions/stats'),
        api.get<EligibleAbsentee[]>('/permissions/eligible')
      ]);

      setPermissions(permRes.data);
      setStats(statsRes.data);
      setEligibleAbsentees(eligibleRes.data);
    } catch (err: any) {
      console.error('Failed to load calling permissions:', err);
      setFeedbackMsg({ type: 'error', text: 'Error connecting to permissions API' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleRequestConsent = async (parentId: number, studentName: string) => {
    try {
      setActionLoading(true);
      await api.post(`/permissions/request/${parentId}`, {});
      setFeedbackMsg({
        type: 'success',
        text: `Consent request dispatched to parent of ${studentName} via WhatsApp.`
      });
      fetchData();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to dispatch consent prompt.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParent) return;

    try {
      setActionLoading(true);
      await api.post(`/permissions/grant/${selectedParent.parent_id}`, { reason: grantReason });
      setFeedbackMsg({
        type: 'success',
        text: `24-hour calling authorization recorded for ${selectedParent.student_name}'s guardian.`
      });
      setGrantModalOpen(false);
      setSelectedParent(null);
      fetchData();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to authorize permission.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (parentId: number, studentName: string) => {
    if (!window.confirm(`Revoke voice call authorization for ${studentName}'s guardian?`)) return;

    try {
      setActionLoading(true);
      await api.post(`/permissions/revoke/${parentId}`, {});
      setFeedbackMsg({
        type: 'success',
        text: `Calling authorization revoked for ${studentName}.`
      });
      fetchData();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to revoke authorization.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPermissions = permissions.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.student_name.toLowerCase().includes(q) ||
      p.roll_number.toLowerCase().includes(q) ||
      p.parent_name.toLowerCase().includes(q) ||
      p.whatsapp_number.includes(q)
    );
  });

  const getStatusBadge = (item: CallPermissionItem) => {
    switch (item.status) {
      case 'ALLOWED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Allowed ({item.remaining_hours}h left)
          </span>
        );
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            Consent Requested
          </span>
        );
      case 'DECLINED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Declined by Parent
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Expired (24h Lapsed)
          </span>
        );
      case 'WITHDRAWN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
            Unrequested
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
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                      Parent Calling Permissions
                    </h1>
                    <p className="text-sm text-slate-500">
                      Module 10 • 24-Hour WhatsApp Voice Consent Engine & Institutional Compliance
                    </p>
                  </div>
                </div>
              </div>

              {/* Tab Selector & Refresh */}
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-200/80 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab('roster')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'roster'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Guardians ({permissions.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('eligible')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'eligible'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    Call-Eligible Absentees ({eligibleAbsentees.length})
                  </button>
                </div>

                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="p-2 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-all"
                  title="Refresh Data"
                >
                  <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                </button>
              </div>
            </div>

            {/* Notification Toast */}
            {feedbackMsg && (
              <div
                className={`p-4 rounded-xl flex items-center justify-between text-sm font-semibold transition-all ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {feedbackMsg.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  )}
                  <span>{feedbackMsg.text}</span>
                </div>
                <button
                  onClick={() => setFeedbackMsg(null)}
                  className="text-xs uppercase tracking-wider font-bold opacity-70 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Guardians</span>
                <div className="text-2xl font-black text-slate-800 mt-1">{stats?.total_parents || 0}</div>
                <span className="text-xs text-slate-500 mt-1 block">Registered in Cohort</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active Consents
                </span>
                <div className="text-2xl font-black text-emerald-700 mt-1">{stats?.allowed || 0}</div>
                <span className="text-xs text-emerald-600/80 mt-1 block">Valid 24h voice permission</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm bg-gradient-to-br from-amber-50/40 to-white">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Pending Requests
                </span>
                <div className="text-2xl font-black text-amber-700 mt-1">{stats?.requested || 0}</div>
                <span className="text-xs text-amber-600/80 mt-1 block">Awaiting WhatsApp reply</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Expired / Revoked
                </span>
                <div className="text-2xl font-black text-slate-700 mt-1">
                  {(stats?.expired || 0) + (stats?.withdrawn || 0)}
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Requires re-authorization</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 shadow-sm bg-gradient-to-br from-indigo-50/40 to-white">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Consent Rate
                </span>
                <div className="text-2xl font-black text-indigo-700 mt-1">
                  {stats?.compliance_rate || 0}%
                </div>
                <span className="text-xs text-indigo-600/80 mt-1 block">Institutional compliance</span>
              </div>
            </div>

            {/* TAB 1: ALL GUARDIANS ROSTER */}
            {activeTab === 'roster' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                {/* Search & Filter Toolbar */}
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Search student, roll number, or parent..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="ALL">All Permissions</option>
                      <option value="ALLOWED">Allowed (Active 24h)</option>
                      <option value="REQUESTED">Requested (Pending)</option>
                      <option value="DECLINED">Declined</option>
                      <option value="EXPIRED">Expired</option>
                      <option value="WITHDRAWN">Withdrawn / Revoked</option>
                      <option value="UNREQUESTED">Unrequested</option>
                    </select>
                  </div>
                </div>

                {/* Permissions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3.5 px-6">Student Information</th>
                        <th className="py-3.5 px-6">Parent / Guardian</th>
                        <th className="py-3.5 px-6">WhatsApp Contact</th>
                        <th className="py-3.5 px-6">Consent Status</th>
                        <th className="py-3.5 px-6">Validity & Scope</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredPermissions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                            No guardians matching current filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredPermissions.map((item) => (
                          <tr key={item.parent_id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Student Info */}
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{item.student_name}</div>
                              <div className="text-[11px] text-slate-500">
                                Roll: <span className="font-semibold">{item.roll_number}</span> • {item.class_name}
                              </div>
                            </td>

                            {/* Parent Info */}
                            <td className="py-4 px-6">
                              <div className="font-semibold text-slate-800">{item.parent_name}</div>
                              <div className="text-[11px] text-slate-400">
                                Lang: <span className="uppercase font-bold text-indigo-600">{item.preferred_language || 'EN'}</span>
                              </div>
                            </td>

                            {/* WhatsApp Number */}
                            <td className="py-4 px-6">
                              <a
                                href={`https://wa.me/${item.whatsapp_number.replace(/\+/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 font-mono text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                {item.whatsapp_number}
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </a>
                            </td>

                            {/* Status Badge */}
                            <td className="py-4 px-6">
                              {getStatusBadge(item)}
                            </td>

                            {/* Validity */}
                            <td className="py-4 px-6 text-slate-600">
                              {item.status === 'ALLOWED' ? (
                                <div>
                                  <div className="font-semibold text-emerald-700">
                                    Valid for {item.remaining_hours} hours
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Expires: {item.expires_at ? new Date(item.expires_at).toLocaleTimeString() : 'N/A'}
                                  </div>
                                </div>
                              ) : item.provider_reference ? (
                                <span className="text-[10px] text-slate-400 font-mono block max-w-xs truncate">
                                  {item.provider_reference}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Strict 24h limit</span>
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Prompt WhatsApp button */}
                                <button
                                  onClick={() => handleRequestConsent(item.parent_id, item.student_name)}
                                  disabled={actionLoading}
                                  title="Dispatch WhatsApp interactive consent request"
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs flex items-center gap-1 transition-all"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Request</span>
                                </button>

                                {/* Manual Grant button */}
                                <button
                                  onClick={() => {
                                    setSelectedParent(item);
                                    setGrantModalOpen(true);
                                  }}
                                  disabled={actionLoading}
                                  title="Record verbal or written parent consent"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs flex items-center gap-1 transition-all"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Grant</span>
                                </button>

                                {/* Revoke button */}
                                {item.status === 'ALLOWED' && (
                                  <button
                                    onClick={() => handleRevoke(item.parent_id, item.student_name)}
                                    disabled={actionLoading}
                                    title="Revoke permission immediately"
                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: CALL-ELIGIBLE ABSENTEES */}
            {activeTab === 'eligible' && (
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-b border-emerald-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        Today's Call-Eligible Absentees
                      </h2>
                      <p className="text-xs text-emerald-800/80 mt-1">
                        These absent students have confirmed, active 24-hour parent consent. The AI Voice Assistant can legally dial these guardians.
                      </p>
                    </div>

                    <div className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20">
                      {eligibleAbsentees.length} Eligible Guardian{eligibleAbsentees.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3.5 px-6">Student</th>
                        <th className="py-3.5 px-6">Roll Number</th>
                        <th className="py-3.5 px-6">Guardian Name</th>
                        <th className="py-3.5 px-6">Guardian Phone</th>
                        <th className="py-3.5 px-6">Language</th>
                        <th className="py-3.5 px-6">Permission Remaining</th>
                        <th className="py-3.5 px-6 text-right">Voice Agent Ready</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {eligibleAbsentees.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                            No absent students currently hold an active 24-hour calling consent. Request permission above first!
                          </td>
                        </tr>
                      ) : (
                        eligibleAbsentees.map((e) => (
                          <tr key={e.student_id} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="py-4 px-6 font-bold text-slate-900">{e.student_name}</td>
                            <td className="py-4 px-6 font-mono text-slate-600 font-semibold">{e.roll_number}</td>
                            <td className="py-4 px-6 text-slate-800 font-medium">{e.parent_name}</td>
                            <td className="py-4 px-6 font-mono text-indigo-600 font-semibold">{e.whatsapp_number}</td>
                            <td className="py-4 px-6">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                                {e.preferred_language}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-full text-xs">
                                <Clock className="w-3 h-3 text-emerald-600" />
                                {e.remaining_hours}h Remaining
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                                <PhoneCall className="w-3.5 h-3.5" />
                                Ready for Call
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

      {/* MANUAL GRANT MODAL */}
      {grantModalOpen && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Authorize Calling Permission</h3>
                <p className="text-xs text-slate-500">Record authorized teacher override (Valid 24 Hours)</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl mb-4 text-xs space-y-1">
              <div>
                Student: <span className="font-bold text-slate-800">{selectedParent.student_name}</span> ({selectedParent.roll_number})
              </div>
              <div>
                Parent: <span className="font-semibold text-slate-800">{selectedParent.parent_name}</span> ({selectedParent.whatsapp_number})
              </div>
            </div>

            <form onSubmit={handleManualGrantSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Justification / Authorization Basis
                </label>
                <textarea
                  rows={3}
                  required
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  placeholder="e.g. Verbal phone authorization recorded by Class Teacher, physical permission slip..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setGrantModalOpen(false);
                    setSelectedParent(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{actionLoading ? 'Granting...' : 'Authorize 24h Permission'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


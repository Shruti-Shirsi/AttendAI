import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  X,
  PhoneCall,
  Globe,
  Filter,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';
import { AbsenteeQueueItem, AbsenteeQueueStats, ClassItem } from '../types';

export const AbsenteeQueue: React.FC = () => {
  const [queueItems, setQueueItems] = useState<AbsenteeQueueItem[]>([]);
  const [stats, setStats] = useState<AbsenteeQueueStats | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'DISPATCHED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isBulkApproving, setIsBulkApproving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Excuse Modal
  const [excuseModal, setExcuseModal] = useState<{
    isOpen: boolean;
    notificationId: number;
    studentName: string;
    rollNumber: string;
    reason: string;
  }>({
    isOpen: false,
    notificationId: 0,
    studentName: '',
    rollNumber: '',
    reason: 'Medical Leave Certificate Verified'
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchClassesAndStats = async () => {
    try {
      const [classRes, statsRes] = await Promise.all([
        api.get<ClassItem[]>('/classes/'),
        api.get<AbsenteeQueueStats>('/absentees/stats')
      ]);
      setClasses(classRes.data);
      setStats(statsRes.data);
    } catch {
      // Soft ignore
    }
  };

  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<AbsenteeQueueItem[]>('/absentees/queue', {
        params: {
          date: selectedDate,
          class_id: selectedClassId === 'ALL' ? undefined : Number(selectedClassId),
          approval_status: statusFilter
        }
      });
      setQueueItems(res.data);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to load absentee queue:', err);
      showToast('Could not load absentee queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesAndStats();
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [selectedDate, selectedClassId, statusFilter]);

  // Trigger Automatic Absentee Scanner
  const handleCompileAbsentees = async () => {
    try {
      setIsCompiling(true);
      const targetClass = selectedClassId === 'ALL' ? 1 : Number(selectedClassId);
      const res = await api.post('/absentees/compile', {
        class_id: targetClass,
        date: selectedDate
      });
      showToast(`Scanned ${res.data.class_name}! ${res.data.newly_queued} new absentees compiled into review queue.`);
      fetchQueue();
      fetchClassesAndStats();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to scan absentees.');
    } finally {
      setIsCompiling(false);
    }
  };

  // Toggle single selection
  const toggleSelect = (id: number) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  // Toggle all selection
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.notification_id)));
    }
  };

  // Approve single
  const handleApproveSingle = async (notifId: number) => {
    try {
      await api.post(`/absentees/approve/${notifId}`);
      showToast('Absentee approved for WhatsApp dispatch!');
      fetchQueue();
      fetchClassesAndStats();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Approval failed.');
    }
  };

  // Bulk Approve
  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showToast('Please select at least 1 absentee to approve.');
      return;
    }
    try {
      setIsBulkApproving(true);
      const res = await api.post('/absentees/bulk-approve', { notification_ids: ids });
      showToast(`Approved ${res.data.approved_count} absentee notifications!`);
      setSelectedIds(new Set());
      fetchQueue();
      fetchClassesAndStats();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Bulk approval failed.');
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Excuse Student
  const handleExcuseStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/absentees/excuse/${excuseModal.notificationId}`, {
        reason: excuseModal.reason
      });
      showToast(`${excuseModal.studentName} marked as EXCUSED. Notification cancelled.`);
      setExcuseModal(prev => ({ ...prev, isOpen: false }));
      fetchQueue();
      fetchClassesAndStats();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to excuse student.');
    }
  };

  // Filter items by search
  const filteredItems = queueItems.filter(item => {
    const matchesSearch =
      item.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.parent_name.toLowerCase().includes(searchQuery.toLowerCase());
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Absentee Review & Approval Queue</h1>
            <span className="text-xs bg-indigo-50 text-[#4F46E5] font-bold px-2.5 py-1 rounded-full border border-indigo-100">
              Phase 6
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Teacher verification gateway before automated WhatsApp parent notifications are dispatched.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCompileAbsentees}
            disabled={isCompiling}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${isCompiling ? 'animate-spin' : ''}`} />
            <span>{isCompiling ? 'Scanning Roster...' : 'Scan & Compile Absentees'}</span>
          </button>

          <button
            onClick={handleBulkApprove}
            disabled={selectedIds.size === 0 || isBulkApproving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <FileCheck className="w-4 h-4" />
            <span>Approve Selected ({selectedIds.size}) for WhatsApp</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Absentees Detected</p>
            <p className="text-2xl font-black text-rose-600 mt-0.5">
              {stats?.total_absentees_today || queueItems.length}
            </p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Unrecorded on date</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Sign-Off</p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">
              {stats?.pending_approval || queueItems.filter(q => q.approval_status === 'PENDING_APPROVAL').length}
            </p>
            <p className="text-[10px] text-amber-600 font-bold mt-0.5">Action required</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Approved for Send</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">
              {stats?.approved_ready || queueItems.filter(q => q.approval_status === 'APPROVED').length}
            </p>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Ready for WhatsApp</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dispatched Alerts</p>
            <p className="text-2xl font-black text-indigo-600 mt-0.5">
              {stats?.dispatched || 0}
            </p>
            <p className="text-[10px] text-indigo-600 font-bold mt-0.5">Delivered to parents</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Send className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Class Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Cohort:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Cohorts</option>
              {classes.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>
                  {cls.name} ({cls.department})
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Session Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED'] as const).map((status) => (
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
                  ? 'All'
                  : status === 'PENDING_APPROVAL'
                  ? 'Pending Sign-Off'
                  : status === 'APPROVED'
                  ? '✓ Approved'
                  : 'Dispatched'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student or parent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* ── QUEUE TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-600 hover:text-indigo-600">
                    {selectedIds.size > 0 && selectedIds.size === filteredItems.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Student Details</th>
                <th className="py-3.5 px-4">Cohort</th>
                <th className="py-3.5 px-4">Guardian WhatsApp</th>
                <th className="py-3.5 px-4">Language</th>
                <th className="py-3.5 px-4">Localized Message Preview</th>
                <th className="py-3.5 px-4">Approval State</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading Absentee Review Queue...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 stroke-1" />
                      <p className="font-bold text-slate-700">No Absentees in Queue</p>
                      <p className="text-[11px] text-slate-400">
                        All students present or attendance already reviewed for {selectedDate}.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIds.has(item.notification_id);
                  return (
                    <tr
                      key={item.notification_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleSelect(item.notification_id)}
                          className="text-slate-500 hover:text-indigo-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 text-white font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0">
                            {item.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.full_name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{item.roll_number}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {item.class_name}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-800">{item.whatsapp_number}</p>
                            <p className="text-[10px] text-slate-400">{item.parent_name}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          <Globe className="w-3 h-3 text-slate-400" />
                          {item.preferred_language === 'HI'
                            ? 'हिन्दी'
                            : item.preferred_language === 'MR'
                            ? 'मराठी'
                            : 'English'}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2" title={item.message_content}>
                          {item.message_content}
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        {item.approval_status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approved</span>
                          </span>
                        ) : item.approval_status === 'DISPATCHED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Send className="w-3 h-3" />
                            <span>Dispatched</span>
                          </span>
                        ) : item.approval_status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Excused
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Pending Sign-Off</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.approval_status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                onClick={() => handleApproveSingle(item.notification_id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  setExcuseModal({
                                    isOpen: true,
                                    notificationId: item.notification_id,
                                    studentName: item.full_name,
                                    rollNumber: item.roll_number,
                                    reason: 'Authorized College Symposium'
                                  })
                                }
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all"
                              >
                                Excuse
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: Excuse Absence ── */}
      {excuseModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Excuse Student Absence</h3>
                  <p className="text-xs text-slate-400">Exempt from parent alert & mark register EXCUSED</p>
                </div>
              </div>
              <button
                onClick={() => setExcuseModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExcuseStudent} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <p className="font-bold text-slate-900">
                  {excuseModal.studentName} <span className="font-mono text-slate-500">({excuseModal.rollNumber})</span>
                </p>
                <p className="text-slate-500 mt-1">
                  Exempting this student will remove them from the WhatsApp absentee queue.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Exemption *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Authorized Medical Leave / Sports Representation"
                  value={excuseModal.reason}
                  onChange={(e) => setExcuseModal({ ...excuseModal, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setExcuseModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md"
                >
                  Confirm & Excuse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


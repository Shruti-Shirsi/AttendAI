import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Mic,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Play,
  Volume2,
  ShieldCheck,
  ShieldAlert,
  Search,
  Globe,
  Calendar,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ChevronRight,
  UserCheck,
  UserX
} from 'lucide-react';

interface QueueItem {
  student_id: number;
  student_name: string;
  roll_number: string;
  class_name: string;
  parent_id: number;
  parent_name: string;
  whatsapp_number: string;
  language: string;
  is_permitted: boolean;
  permission_status: string;
  permission_remaining_hours: number;
  call_count_today: number;
  last_call_status: string | null;
  last_call_reason: string | null;
  last_call_duration: number | null;
}

interface CallLogItem {
  id: number;
  provider_call_id: string;
  student_id: number;
  student_name: string;
  roll_number: string;
  class_name: string;
  parent_id: number;
  parent_name: string;
  whatsapp_number: string;
  language: string;
  call_date: string;
  attempt_number: number;
  status: string;
  duration_seconds: number;
  absence_reason_category: string | null;
  parent_response_snippet: string | null;
}

interface VoiceMetrics {
  total_calls_today: number;
  completed_calls: number;
  no_answer_calls: number;
  failed_calls: number;
  average_duration_seconds: number;
  top_reasons: { reason: string; count: number }[];
}

interface DialogScript {
  language: string;
  greeting: string;
  absence_inquiry: string;
  return_inquiry: string;
  closing: string;
  sample_reasons: string[];
}

export const VoiceAssistant: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<CallLogItem[]>([]);
  const [metrics, setMetrics] = useState<VoiceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [searchQuery, setSearchQuery] = useState('');

  // Call Progression Simulation State
  const [activeCallModal, setActiveCallModal] = useState(false);
  const [callingStudent, setCallingStudent] = useState<QueueItem | null>(null);
  const [callPhase, setCallPhase] = useState<'CONNECTING' | 'RINGING' | 'IN_CONVERSATION' | 'COMPLETED' | 'ERROR'>('CONNECTING');
  const [callProgressSeconds, setCallProgressSeconds] = useState(0);
  const [simulatedOutcome, setSimulatedOutcome] = useState<any>(null);

  // Script Preview Modal
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [previewScript, setPreviewScript] = useState<DialogScript | null>(null);
  const [previewStudent, setPreviewStudent] = useState<QueueItem | null>(null);

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [queueRes, historyRes, metricsRes] = await Promise.all([
        api.get<QueueItem[]>('/voice/queue'),
        api.get<CallLogItem[]>('/voice/history'),
        api.get<VoiceMetrics>('/voice/metrics')
      ]);

      setQueue(queueRes.data);
      setHistory(historyRes.data);
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error('Failed to load voice calling data:', err);
      setToastMsg({ type: 'error', text: 'Error connecting to voice assistant server.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Timer effect for live call progression
  useEffect(() => {
    let interval: any = null;
    if (activeCallModal && (callPhase === 'IN_CONVERSATION' || callPhase === 'CONNECTING' || callPhase === 'RINGING')) {
      interval = setInterval(() => {
        setCallProgressSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCallModal, callPhase]);

  const handleOpenScript = async (item: QueueItem) => {
    try {
      setPreviewStudent(item);
      const res = await api.get<DialogScript>(`/voice/script/${item.student_id}`);
      setPreviewScript(res.data);
      setScriptModalOpen(true);
    } catch (err: any) {
      setToastMsg({ type: 'error', text: 'Failed to generate script preview.' });
    }
  };

  const handleInitiateCall = async (item: QueueItem) => {
    if (!item.is_permitted) {
      setToastMsg({
        type: 'error',
        text: `Call blocked: ${item.student_name}'s parent has not granted 24-hr calling permission.`
      });
      return;
    }

    setCallingStudent(item);
    setCallProgressSeconds(0);
    setCallPhase('CONNECTING');
    setActiveCallModal(true);

    try {
      setTimeout(() => {
        setCallPhase('RINGING');
      }, 1500);

      const res = await api.post(`/voice/initiate/${item.student_id}`, {});

      setTimeout(() => {
        setCallPhase('IN_CONVERSATION');
        setSimulatedOutcome(res.data);
      }, 3500);

      setTimeout(() => {
        setCallPhase('COMPLETED');
        fetchData();
      }, 7000);
    } catch (err: any) {
      setCallPhase('ERROR');
      const errDetail = err.response?.data?.detail || 'Voice call initialization failed.';
      setToastMsg({ type: 'error', text: errDetail });
    }
  };

  const handleBatchCall = async () => {
    const permittedItems = queue.filter((q) => q.is_permitted);
    if (permittedItems.length === 0) {
      setToastMsg({
        type: 'error',
        text: 'No absentees currently hold active calling permission.'
      });
      return;
    }

    if (!window.confirm(`Initiate automated AI voice calls for all ${permittedItems.length} permitted absentees?`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/voice/batch-call', {});
      setToastMsg({
        type: 'success',
        text: `Batch call completed: ${res.data.dispatched_count} parents contacted successfully.`
      });
      fetchData();
    } catch (err: any) {
      setToastMsg({ type: 'error', text: 'Batch call execution encountered an error.' });
    } finally {
      setLoading(false);
    }
  };

  const filteredQueue = queue.filter((q) => {
    const s = searchQuery.toLowerCase();
    return (
      q.student_name.toLowerCase().includes(s) ||
      q.roll_number.toLowerCase().includes(s) ||
      q.parent_name.toLowerCase().includes(s)
    );
  });

  const filteredHistory = history.filter((h) => {
    const s = searchQuery.toLowerCase();
    return (
      h.student_name.toLowerCase().includes(s) ||
      h.roll_number.toLowerCase().includes(s) ||
      h.parent_name.toLowerCase().includes(s) ||
      (h.absence_reason_category && h.absence_reason_category.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/20">
                    <Mic className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                      AI Voice Assistant
                    </h1>
                    <p className="text-sm text-slate-500">
                      Module 11 • Multilingual Automated Absence Inquiries (EN, HI, MR) with Strict Consent Verification
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBatchCall}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  <PhoneForwarded className="w-4 h-4" />
                  <span>Batch Call Permitted ({queue.filter((q) => q.is_permitted).length})</span>
                </button>

                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="p-2.5 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-all"
                  title="Refresh Queue"
                >
                  <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                </button>
              </div>
            </div>

            {/* Notification Toast */}
            {toastMsg && (
              <div
                className={`p-4 rounded-xl flex items-center justify-between text-sm font-semibold transition-all ${toastMsg.type === 'success'
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
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Today</span>
                <div className="text-2xl font-black text-slate-800 mt-1">{metrics?.completed_calls || 0}</div>
                <span className="text-xs text-slate-500 mt-1 block">Parent conversations concluded</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Permitted & Dialable
                </span>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  {queue.filter((q) => q.is_permitted).length}
                </div>
                <span className="text-xs text-emerald-600/80 mt-1 block">Active 24h voice consent</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-sm bg-gradient-to-br from-rose-50/30 to-white">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Blocked / Consent Needed
                </span>
                <div className="text-2xl font-black text-rose-700 mt-1">
                  {queue.filter((q) => !q.is_permitted).length}
                </div>
                <span className="text-xs text-rose-600/80 mt-1 block">Calls blocked by policy</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 shadow-sm bg-gradient-to-br from-indigo-50/40 to-white">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Avg Call Duration
                </span>
                <div className="text-2xl font-black text-indigo-700 mt-1">
                  {metrics?.average_duration_seconds || 0}s
                </div>
                <span className="text-xs text-indigo-600/80 mt-1 block">Automated conversation length</span>
              </div>
            </div>

            {/* Tab Controls & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex bg-slate-200/80 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'queue'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Outbound Queue ({queue.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'history'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Call Logs & Outcomes ({history.length})</span>
                </button>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search student, roll, or parent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* TAB 1: OUTBOUND CALL QUEUE */}
            {activeTab === 'queue' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Today's Absentee Call Queue</h2>
                    <p className="text-[11px] text-slate-400">
                      Students absent today. Voice calling strictly verifies active 24-hr parent authorization before dialing.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3.5 px-6">Student Information</th>
                        <th className="py-3.5 px-6">Guardian & Phone</th>
                        <th className="py-3.5 px-6">Language</th>
                        <th className="py-3.5 px-6">Calling Consent</th>
                        <th className="py-3.5 px-6">Calls Placed</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredQueue.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                            No absentees pending voice calls for today.
                          </td>
                        </tr>
                      ) : (
                        filteredQueue.map((item) => (
                          <tr key={item.student_id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Student Info */}
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{item.student_name}</div>
                              <div className="text-[11px] text-slate-500">
                                Roll: <span className="font-semibold">{item.roll_number}</span> • {item.class_name}
                              </div>
                            </td>

                            {/* Guardian Info */}
                            <td className="py-4 px-6">
                              <div className="font-semibold text-slate-800">{item.parent_name}</div>
                              <div className="font-mono text-indigo-600 font-semibold text-[11px]">
                                {item.whatsapp_number}
                              </div>
                            </td>

                            {/* Preferred Language */}
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                                <Globe className="w-3 h-3 text-slate-500" />
                                {item.language}
                              </span>
                            </td>

                            {/* Calling Consent Badge */}
                            <td className="py-4 px-6">
                              {item.is_permitted ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Permitted ({item.permission_remaining_hours}h left)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Blocked ({item.permission_status})
                                </span>
                              )}
                            </td>

                            {/* Call Count */}
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-800">
                                {item.call_count_today} attempt{item.call_count_today !== 1 ? 's' : ''}
                              </div>
                              {item.last_call_reason && (
                                <div className="text-[10px] text-emerald-600 font-medium truncate max-w-[140px]">
                                  {item.last_call_reason}
                                </div>
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenScript(item)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all flex items-center gap-1"
                                  title="Preview Localized AI Script"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Script</span>
                                </button>

                                <button
                                  onClick={() => handleInitiateCall(item)}
                                  disabled={!item.is_permitted}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${item.is_permitted
                                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20'
                                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    }`}
                                  title={item.is_permitted ? 'Dial Guardian via AI Agent' : 'Requires parent calling permission'}
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>Call Parent</span>
                                </button>
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

            {/* TAB 2: CALL LOGS & OUTCOMES */}
            {activeTab === 'history' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-sm font-bold text-slate-800">Institutional Call History & Dialog Outcomes</h2>
                  <p className="text-[11px] text-slate-400">
                    Compliant call logs. Detailed absence reasons and return dates recorded without storing voice recordings.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3.5 px-6">Call ID & Timestamp</th>
                        <th className="py-3.5 px-6">Student</th>
                        <th className="py-3.5 px-6">Guardian</th>
                        <th className="py-3.5 px-6">Status & Duration</th>
                        <th className="py-3.5 px-6">Identified Absence Reason</th>
                        <th className="py-3.5 px-6">AI Dialog Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                            No call history records logged yet.
                          </td>
                        </tr>
                      ) : (
                        filteredHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-6">
                              <span className="font-mono text-[10px] text-indigo-600 block">{h.provider_call_id}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(h.call_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Attempt #{h.attempt_number}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{h.student_name}</div>
                              <div className="text-[10px] text-slate-400">{h.roll_number}</div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="font-semibold text-slate-800">{h.parent_name}</div>
                              <div className="font-mono text-[11px] text-slate-500">{h.whatsapp_number}</div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {h.status} ({h.duration_seconds}s)
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700">
                                {h.absence_reason_category || 'General Inconvenience'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-slate-600 max-w-sm">
                              <p className="text-[11px] italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                                "{h.parent_response_snippet || 'Conversation recorded successfully.'}"
                              </p>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

      {/* LIVE CALL PROGRESSION MODAL */}
      {activeCallModal && callingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-center relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none" />

            {/* Avatar / Call State Icon */}
            <div className="relative mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl transition-all">
              {callPhase === 'CONNECTING' && (
                <div className="w-20 h-20 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center animate-pulse">
                  <PhoneForwarded className="w-8 h-8" />
                </div>
              )}
              {callPhase === 'RINGING' && (
                <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center animate-bounce">
                  <PhoneCall className="w-8 h-8" />
                </div>
              )}
              {callPhase === 'IN_CONVERSATION' && (
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center ring-4 ring-emerald-500/20">
                  <Volume2 className="w-8 h-8 animate-pulse" />
                </div>
              )}
              {callPhase === 'COMPLETED' && (
                <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
              )}
              {callPhase === 'ERROR' && (
                <div className="w-20 h-20 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <PhoneOff className="w-8 h-8" />
                </div>
              )}
            </div>

            {/* Calling Details */}
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{callingStudent.parent_name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-1">{callingStudent.whatsapp_number}</p>
            <p className="text-xs font-semibold text-indigo-600 mt-1">
              Student: {callingStudent.student_name} ({callingStudent.roll_number})
            </p>

            {/* Phase Status Banner */}
            <div className="mt-5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Status</div>
              <div className="text-sm font-black text-slate-800 mt-0.5 flex items-center justify-center gap-2">
                {callPhase === 'CONNECTING' && <span className="text-indigo-600">Connecting to WhatsApp Gateway...</span>}
                {callPhase === 'RINGING' && <span className="text-amber-600">Ringing Parent Phone...</span>}
                {callPhase === 'IN_CONVERSATION' && (
                  <span className="text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    AI Inquiring ({callingStudent.language}) • {callProgressSeconds}s
                  </span>
                )}
                {callPhase === 'COMPLETED' && <span className="text-emerald-700">Call Concluded & Reason Recorded!</span>}
                {callPhase === 'ERROR' && <span className="text-rose-600">Call Blocked / Failed</span>}
              </div>
            </div>

            {/* Live Conversation Transcript Snippet */}
            {callPhase === 'IN_CONVERSATION' && (
              <div className="mt-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/60 text-left text-xs space-y-2">
                <p className="text-indigo-950 font-medium italic">
                  "Hello {callingStudent.parent_name}, we noticed {callingStudent.student_name} was marked absent today. Could you share the reason?"
                </p>
                <p className="text-slate-600 font-medium text-[11px]">
                  Analyzing parent verbal confirmation...
                </p>
              </div>
            )}

            {/* Completed Outcome Summary */}
            {callPhase === 'COMPLETED' && simulatedOutcome && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-left text-xs space-y-2 animate-in fade-in duration-150">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Dialogue Outcome Summary
                </div>
                <div>
                  Reason: <span className="font-bold text-slate-800">{simulatedOutcome.absence_reason_category}</span>
                </div>
                <div>
                  Expected Return: <span className="font-bold text-slate-800">{simulatedOutcome.expected_return_date}</span>
                </div>
                <div>
                  Duration: <span className="font-bold text-slate-800">{simulatedOutcome.duration_seconds} seconds</span>
                </div>
              </div>
            )}

            {/* Modal Controls */}
            <div className="mt-6 flex justify-center">
              {callPhase === 'COMPLETED' || callPhase === 'ERROR' ? (
                <button
                  onClick={() => {
                    setActiveCallModal(false);
                    setCallingStudent(null);
                  }}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={() => {
                    setActiveCallModal(false);
                    setCallingStudent(null);
                  }}
                  className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel Call
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCRIPT PREVIEW MODAL */}
      {scriptModalOpen && previewScript && previewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Conversational AI Dialog Flow</h3>
                <p className="text-xs text-slate-500">
                  Target Language: <span className="font-bold uppercase text-indigo-600">{previewScript.language}</span> • Student: {previewStudent.student_name}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">1. AI Institutional Greeting</span>
                <p className="text-slate-800 font-medium">{previewScript.greeting}</p>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <span className="font-bold text-indigo-500 uppercase text-[10px] block mb-1">2. Absence Inquiry</span>
                <p className="text-slate-800 font-medium">{previewScript.absence_inquiry}</p>
              </div>

              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <span className="font-bold text-purple-500 uppercase text-[10px] block mb-1">3. Expected Return Date Inquiry</span>
                <p className="text-slate-800 font-medium">{previewScript.return_inquiry}</p>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="font-bold text-emerald-600 uppercase text-[10px] block mb-1">4. Closing Confirmation</span>
                <p className="text-slate-800 font-medium">{previewScript.closing}</p>
              </div>
            </div>

            <div className="flex items-center justify-end mt-6">
              <button
                onClick={() => {
                  setScriptModalOpen(false);
                  setPreviewScript(null);
                  setPreviewStudent(null);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


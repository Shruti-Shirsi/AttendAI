import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  TrendingUp,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Users,
  Search,
  RotateCcw,
  ShieldCheck,
  PhoneCall,
  PieChart as PieIcon,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface SummaryMetrics {
  total_students: number;
  total_classes: number;
  today_present: number;
  today_absent: number;
  today_attendance_rate: number;
  shortage_count: number;
  active_permissions: number;
  total_voice_calls_completed: number;
  total_whatsapp_dispatched: number;
}

interface TrendDataPoint {
  date: string;
  display_date: string;
  day_name: string;
  present: number;
  absent: number;
  attendance_rate: number;
  day_type: string;
}

interface AbsenceReasonPoint {
  name: string;
  value: number;
  color: string;
}

interface StudentBreakdownItem {
  student_id: number;
  student_name: string;
  roll_number: string;
  class_name: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  attendance_percentage: number;
  is_shortage: boolean;
  parent_name: string;
  whatsapp_number: string;
  permission_status: string;
  calls_count: number;
}

export const Reports: React.FC = () => {
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [reasons, setReasons] = useState<AbsenceReasonPoint[]>([]);
  const [students, setStudents] = useState<StudentBreakdownItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDays, setSelectedDays] = useState<number>(14);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [shortageOnly, setShortageOnly] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const [sumRes, trendRes, reasonRes, studentRes] = await Promise.all([
        api.get<SummaryMetrics>('/reports/summary'),
        api.get<TrendDataPoint[]>(`/reports/trends?days=${selectedDays}`),
        api.get<AbsenceReasonPoint[]>('/reports/absence-reasons'),
        api.get<StudentBreakdownItem[]>('/reports/students')
      ]);

      setSummary(sumRes.data);
      setTrends(trendRes.data);
      setReasons(reasonRes.data);
      setStudents(studentRes.data);
    } catch (err) {
      console.error('Failed to load reports data:', err);
      setToastMsg({ type: 'error', text: 'Failed to retrieve reports and analytics.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, [selectedDays]);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const response = await api.get('/reports/export-csv', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendai_institutional_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setToastMsg({ type: 'success', text: 'Institutional CSV report downloaded successfully!' });
    } catch (err) {
      console.error('Export CSV error:', err);
      setToastMsg({ type: 'error', text: 'Failed to download CSV export.' });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.student_name.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q) ||
      s.parent_name.toLowerCase().includes(q);

    if (shortageOnly) {
      return matchesSearch && s.is_shortage;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/20">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                      Institutional Reports & Analytics
                    </h1>
                    <p className="text-sm text-slate-500">
                      Module 12 • Attendance Trends, 75% Shortage Risk Engine & Parent Dialogue Intelligence
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-slate-200/80 p-1 rounded-xl">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDays(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedDays === d
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Past {d} Days
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExportCSV}
                  disabled={isExporting}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
                  <span>{isExporting ? 'Exporting...' : 'Export CSV Report'}</span>
                </button>

                <button
                  onClick={fetchReportsData}
                  disabled={loading}
                  className="p-2.5 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-all"
                  title="Refresh Reports"
                >
                  <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
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

            {/* Top KPI Metrics Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm bg-gradient-to-br from-indigo-50/40 to-white">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Overall Attendance Rate
                </span>
                <div className="text-3xl font-black text-indigo-950 mt-1">
                  {summary?.today_attendance_rate || 0}%
                </div>
                <span className="text-xs text-indigo-600/80 mt-1 block">
                  {summary?.today_present || 0} of {summary?.total_students || 0} students present today
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-sm bg-gradient-to-br from-rose-50/40 to-white">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  75% Shortage Risk
                </span>
                <div className="text-3xl font-black text-rose-700 mt-1">
                  {summary?.shortage_count || 0} Student{summary?.shortage_count !== 1 ? 's' : ''}
                </div>
                <span className="text-xs text-rose-600/80 mt-1 block">Critical institutional alert flag</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Active Calling Consents
                </span>
                <div className="text-3xl font-black text-emerald-700 mt-1">
                  {summary?.active_permissions || 0}
                </div>
                <span className="text-xs text-emerald-600/80 mt-1 block">Valid 24-hr parent voice permissions</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-purple-200/80 shadow-sm bg-gradient-to-br from-purple-50/40 to-white">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4" />
                  AI Voice Calls Concluded
                </span>
                <div className="text-3xl font-black text-purple-700 mt-1">
                  {summary?.total_voice_calls_completed || 0}
                </div>
                <span className="text-xs text-purple-600/80 mt-1 block">Multilingual absence inquiries logged</span>
              </div>
            </div>

            {/* Visual Analytics Grid: Trend Chart & Absence Reasons Donut */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Attendance Trend (2 Columns) */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Daily Attendance Trajectory (Past {selectedDays} Days)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tracking daily student presence and cohort attendance percentages over time.
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="display_date" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '12px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="present"
                        name="Students Present"
                        stroke="#4F46E5"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorPresent)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Absence Reason Breakdown (1 Column) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
                    <PieIcon className="w-5 h-5 text-purple-600" />
                    Identified Absence Reasons
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Captured directly from parent responses during AI voice calls.
                  </p>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reasons}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {reasons.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1E293B',
                            borderRadius: '12px',
                            border: 'none',
                            color: '#FFFFFF',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-1.5 mt-2">
                  {reasons.map((r) => (
                    <div key={r.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }}></span>
                        <span className="text-slate-700 font-medium">{r.name}</span>
                      </div>
                      <span className="font-bold text-slate-900">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cumulative Student Attendance Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Student Attendance Register & Shortage Status</h3>
                  <p className="text-[11px] text-slate-500">
                    Comprehensive compliance breakdown. Mandatory attendance threshold is 75%.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Search student, roll, or parent..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <button
                    onClick={() => setShortageOnly(!shortageOnly)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      shortageOnly
                        ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Shortage Only (&lt;75%)</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3.5 px-6">Student Information</th>
                      <th className="py-3.5 px-6">Class Cohort</th>
                      <th className="py-3.5 px-6">Present / Total</th>
                      <th className="py-3.5 px-6">Attendance %</th>
                      <th className="py-3.5 px-6">Status Flag</th>
                      <th className="py-3.5 px-6">Parent Contact</th>
                      <th className="py-3.5 px-6 text-right">Voice Calls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                          No students matching current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => (
                        <tr key={s.student_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900">{s.student_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">Roll: {s.roll_number}</div>
                          </td>

                          <td className="py-4 px-6 font-semibold text-slate-700">{s.class_name}</td>

                          <td className="py-4 px-6">
                            <span className="font-bold text-slate-800">{s.present_count}</span>
                            <span className="text-slate-400"> / {s.total_sessions} sessions</span>
                          </td>

                          <td className="py-4 px-6">
                            <div className="w-32">
                              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                <span className={s.is_shortage ? 'text-rose-600' : 'text-emerald-700'}>
                                  {s.attendance_percentage}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    s.is_shortage ? 'bg-rose-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, s.attendance_percentage)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            {s.is_shortage ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-500" />
                                Critical (&lt;75%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                Compliant
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-6">
                            <div className="font-medium text-slate-800">{s.parent_name}</div>
                            <div className="font-mono text-[11px] text-indigo-600">{s.whatsapp_number}</div>
                          </td>

                          <td className="py-4 px-6 text-right font-bold text-slate-800">
                            {s.calls_count} call{s.calls_count !== 1 ? 's' : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
    </div>
  );
};


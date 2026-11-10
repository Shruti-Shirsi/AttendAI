import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Download,
  Printer,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Edit2,
  X,
  FileSpreadsheet,
  Users,
  Percent,
  Search
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';
import { ClassItem } from '../types';

interface DayMetadata {
  day: number;
  weekday_name: string;
  is_weekend: boolean;
  is_future: boolean;
}

interface StudentRegisterRow {
  student_id: number;
  roll_number: string;
  full_name: string;
  days: Record<number, string>;
  total_present: number;
  total_absent: number;
  total_late: number;
  attendance_percentage: number;
  is_shortage: boolean;
}

interface MonthlyRegisterData {
  class_id: number;
  class_name: string;
  year: number;
  month: number;
  month_name: string;
  days_in_month: number;
  working_days_elapsed: number;
  days_metadata: DayMetadata[];
  total_students: number;
  shortage_count: number;
  class_average_percentage: number;
  students: StudentRegisterRow[];
}

export const AttendanceRegister: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [filterShortageOnly, setFilterShortageOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [registerData, setRegisterData] = useState<MonthlyRegisterData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Override Modal State
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    studentId: number;
    studentName: string;
    rollNumber: string;
    day: number;
    currentStatus: string;
    newStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    reason: string;
  }>({
    isOpen: false,
    studentId: 0,
    studentName: '',
    rollNumber: '',
    day: 1,
    currentStatus: 'P',
    newStatus: 'PRESENT',
    reason: 'Teacher Manual Correction'
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get<ClassItem[]>('/classes/');
        setClasses(res.data);
        if (res.data.length > 0) {
          setSelectedClassId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Fetch register matrix
  const fetchRegister = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<MonthlyRegisterData>('/attendance/register/monthly', {
        params: {
          class_id: selectedClassId,
          year: selectedYear,
          month: selectedMonth
        }
      });
      setRegisterData(res.data);
    } catch (err) {
      console.error('Failed to load monthly register:', err);
      showToast('Could not load monthly register data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      fetchRegister();
    }
  }, [selectedClassId, selectedYear, selectedMonth]);

  // Open override modal on cell click
  const handleCellClick = (student: StudentRegisterRow, dayMeta: DayMetadata, status: string) => {
    if (dayMeta.is_weekend || dayMeta.is_future) return;
    
    let defaultStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' = 'PRESENT';
    if (status === 'P') defaultStatus = 'ABSENT';
    else if (status === 'A') defaultStatus = 'PRESENT';
    else if (status === 'L') defaultStatus = 'PRESENT';

    setOverrideModal({
      isOpen: true,
      studentId: student.student_id,
      studentName: student.full_name,
      rollNumber: student.roll_number,
      day: dayMeta.day,
      currentStatus: status,
      newStatus: defaultStatus,
      reason: 'Instructor Manual Correction'
    });
  };

  // Submit manual override
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(overrideModal.day).padStart(2, '0')}`;
      await api.put('/attendance/register/override', {
        student_id: overrideModal.studentId,
        date: dateStr,
        status: overrideModal.newStatus,
        reason: overrideModal.reason
      });
      showToast(`Updated attendance for ${overrideModal.studentName} on ${dateStr} to ${overrideModal.newStatus}!`);
      setOverrideModal(prev => ({ ...prev, isOpen: false }));
      fetchRegister();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to update attendance override.');
    }
  };

  // CSV Export URL
  const csvExportUrl = `${API_BASE_URL}/attendance/register/export-csv?class_id=${selectedClassId}&year=${selectedYear}&month=${selectedMonth}`;

  // Filter students
  const filteredStudents = (registerData?.students || []).filter(student => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.roll_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShortage = filterShortageOnly ? student.is_shortage : true;
    return matchesSearch && matchesShortage;
  });

  const months = [
    { num: 1, name: 'January' }, { num: 2, name: 'February' }, { num: 3, name: 'March' },
    { num: 4, name: 'April' }, { num: 5, name: 'May' }, { num: 6, name: 'June' },
    { num: 7, name: 'July' }, { num: 8, name: 'August' }, { num: 9, name: 'September' },
    { num: 10, name: 'October' }, { num: 11, name: 'November' }, { num: 12, name: 'December' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl bg-slate-900 text-white border border-indigo-500/50 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Monthly Digital Class Register</h1>
            <span className="text-xs bg-indigo-50 text-[#4F46E5] font-bold px-2.5 py-1 rounded-full border border-indigo-100">
              Phase 5
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Institutional multi-day attendance matrix with 75% shortage alert engine and teacher manual audit overrides.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={csvExportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print View</span>
          </button>

          <button
            onClick={fetchRegister}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Register</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Class Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Cohort:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.department})
                </option>
              ))}
            </select>
          </div>

          {/* Month Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {months.map((m) => (
                <option key={m.num} value={m.num}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Shortage Toggle Filter */}
          <button
            onClick={() => setFilterShortageOnly(!filterShortageOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterShortageOnly
                ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Shortage Only (&lt;75%)</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student or roll no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cohort Attendance</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {registerData?.class_average_percentage || 0}%
            </p>
            <p className="text-[10px] text-indigo-600 font-bold mt-0.5">Monthly Average</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Working Days</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {registerData?.working_days_elapsed || 0} / {registerData?.days_in_month || 30}
            </p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Excluding Sundays</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Shortage Warnings</p>
            <p className="text-2xl font-black text-rose-600 mt-0.5">
              {registerData?.shortage_count || 0} Students
            </p>
            <p className="text-[10px] text-rose-600 font-bold mt-0.5">&lt; 75% Threshold</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cohort Enrolled</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {registerData?.total_students || 0}
            </p>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Active Class Roster</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-500">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-[10px]">P</span>
            <span className="text-slate-600">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-rose-100 text-rose-800 font-extrabold flex items-center justify-center text-[10px]">A</span>
            <span className="text-slate-600">Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-amber-100 text-amber-800 font-extrabold flex items-center justify-center text-[10px]">L</span>
            <span className="text-slate-600">Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-slate-200 text-slate-600 font-extrabold flex items-center justify-center text-[10px]">W</span>
            <span className="text-slate-600">Weekend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-slate-100 text-slate-400 font-bold flex items-center justify-center text-[10px]">-</span>
            <span className="text-slate-400">Future</span>
          </div>
        </div>
        <p className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
          <Edit2 className="w-3.5 h-3.5" />
          <span>Click any cell to override/correct attendance status</span>
        </p>
      </div>

      {/* ── THE DIGITAL REGISTER MATRIX TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse select-none">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                {/* Sticky Student Info Column */}
                <th className="py-3 px-4 sticky left-0 bg-slate-100 z-10 min-w-[200px] shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                  Student Details
                </th>

                {/* Day Columns (1..30/31) */}
                {(registerData?.days_metadata || []).map((dayMeta) => (
                  <th
                    key={dayMeta.day}
                    className={`py-2 px-1 text-center min-w-[32px] border-r border-slate-200/60 ${
                      dayMeta.is_weekend
                        ? 'bg-slate-200/60 text-slate-400'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold">{dayMeta.day}</div>
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-tighter">
                      {dayMeta.weekday_name}
                    </div>
                  </th>
                ))}

                {/* Summary Columns on Right */}
                <th className="py-3 px-3 text-center min-w-[70px] bg-slate-100 font-bold border-l border-slate-200">
                  Total
                </th>
                <th className="py-3 px-3 text-center min-w-[70px] bg-slate-100 font-bold">
                  Att %
                </th>
                <th className="py-3 px-4 text-center min-w-[100px] bg-slate-100 font-bold">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={(registerData?.days_in_month || 30) + 4}
                    className="py-16 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Compiling Monthly Register Matrix...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={(registerData?.days_in_month || 30) + 4}
                    className="py-16 text-center text-slate-400"
                  >
                    No student records matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.student_id} className="hover:bg-indigo-50/20 transition-colors">
                    {/* Sticky Student Column */}
                    <td className="py-2.5 px-4 sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center gap-2.5 min-w-[180px]">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                          {st.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-slate-900 truncate">{st.full_name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{st.roll_number}</p>
                        </div>
                      </div>
                    </td>

                    {/* Day Matrix Cells */}
                    {(registerData?.days_metadata || []).map((dayMeta) => {
                      const dayVal = st.days[dayMeta.day] || '-';
                      const isClickable = !dayMeta.is_weekend && !dayMeta.is_future;

                      return (
                        <td
                          key={dayMeta.day}
                          onClick={() => isClickable && handleCellClick(st, dayMeta, dayVal)}
                          className={`p-0.5 text-center border-r border-slate-100 ${
                            isClickable ? 'cursor-pointer hover:scale-110 transition-transform' : ''
                          }`}
                          title={
                            isClickable
                              ? `Day ${dayMeta.day} (${st.full_name}): ${dayVal} - Click to override`
                              : undefined
                          }
                        >
                          <div
                            className={`w-6 h-6 mx-auto rounded flex items-center justify-center text-[10px] font-extrabold ${
                              dayVal === 'P'
                                ? 'bg-emerald-100 text-emerald-800'
                                : dayVal === 'A'
                                ? 'bg-rose-100 text-rose-800'
                                : dayVal === 'L'
                                ? 'bg-amber-100 text-amber-800'
                                : dayVal === 'W'
                                ? 'bg-slate-100 text-slate-400'
                                : 'bg-slate-50 text-slate-300'
                            }`}
                          >
                            {dayVal}
                          </div>
                        </td>
                      );
                    })}

                    {/* Right Summary Totals */}
                    <td className="py-2 px-3 text-center font-bold text-slate-800 border-l border-slate-200">
                      {st.total_present}
                    </td>

                    <td className="py-2 px-3 text-center font-bold">
                      <span
                        className={
                          st.is_shortage
                            ? 'text-rose-600 font-extrabold'
                            : 'text-emerald-600 font-extrabold'
                        }
                      >
                        {st.attendance_percentage}%
                      </span>
                    </td>

                    <td className="py-2 px-4 text-center">
                      {st.is_shortage ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Shortage</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Regular</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: Teacher Manual Attendance Override ── */}
      {overrideModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Attendance Override</h3>
                  <p className="text-xs text-slate-400">Teacher manual audit modification</p>
                </div>
              </div>
              <button
                onClick={() => setOverrideModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <p className="font-bold text-slate-900">
                  {overrideModal.studentName} <span className="font-mono text-slate-500">({overrideModal.rollNumber})</span>
                </p>
                <p className="text-slate-500 mt-1">
                  Target Date: <span className="font-bold text-indigo-700">{selectedYear}-{String(selectedMonth).padStart(2, '0')}-{String(overrideModal.day).padStart(2, '0')}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Attendance Status *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code: 'PRESENT', label: 'Present (P)', color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                    { code: 'ABSENT', label: 'Absent (A)', color: 'border-rose-500 bg-rose-50 text-rose-800' },
                    { code: 'LATE', label: 'Late (L)', color: 'border-amber-500 bg-amber-50 text-amber-800' },
                    { code: 'EXCUSED', label: 'Excused (E)', color: 'border-purple-500 bg-purple-50 text-purple-800' },
                  ].map((st) => (
                    <button
                      key={st.code}
                      type="button"
                      onClick={() => setOverrideModal((prev) => ({ ...prev, newStatus: st.code as any }))}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        overrideModal.newStatus === st.code
                          ? st.color + ' ring-2 ring-indigo-500/30'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Justification *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical certificate verified / Bus delay"
                  value={overrideModal.reason}
                  onChange={(e) => setOverrideModal({ ...overrideModal, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOverrideModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-indigo-600 hover:to-purple-600 rounded-xl shadow-md shadow-indigo-500/20"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


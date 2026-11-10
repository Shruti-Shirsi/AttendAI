import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  GraduationCap,
  Plus,
  Search,
  Users,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  BookOpen,
  Building2,
  Calendar,
  Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ClassItem {
  id: number;
  name: string;
  academic_year: string;
  department: string;
  division: string;
  students_count?: number;
}

export const Classes: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2026-27',
    department: 'Computer Science & Engineering',
    division: 'A'
  });

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await api.get<ClassItem[]>('/classes/');
      setClasses(res.data);
    } catch (err) {
      console.error('Failed to load classes:', err);
      showToast('Failed to load class cohorts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/classes/', formData);
      showToast(`Class cohort '${formData.name}' created successfully!`);
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        academic_year: '2026-27',
        department: 'Computer Science & Engineering',
        division: 'A'
      });
      fetchClasses();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to create class cohort.', 'error');
    }
  };

  const openEditModal = (cls: ClassItem) => {
    setSelectedClass(cls);
    setFormData({
      name: cls.name,
      academic_year: cls.academic_year,
      department: cls.department,
      division: cls.division
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    try {
      await api.put(`/classes/${selectedClass.id}`, formData);
      showToast(`Class cohort '${formData.name}' updated successfully!`);
      setIsEditModalOpen(false);
      setSelectedClass(null);
      fetchClasses();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to update class cohort.', 'error');
    }
  };

  const handleDeleteClass = async (cls: ClassItem) => {
    if (!window.confirm(`Are you sure you want to delete '${cls.name}'?`)) return;
    try {
      await api.delete(`/classes/${cls.id}`);
      showToast(`Class cohort '${cls.name}' deleted.`);
      fetchClasses();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Cannot delete class with active students.', 'error');
    }
  };

  const filteredClasses = classes.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q) ||
      c.academic_year.toLowerCase().includes(q) ||
      c.division.toLowerCase().includes(q)
    );
  });

  const totalStudents = classes.reduce((sum, c) => sum + (c.students_count || 0), 0);
  const departments = Array.from(new Set(classes.map((c) => c.department)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/20">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                      Classes & Cohort Sections
                    </h1>
                    <p className="text-sm text-slate-500">
                      Manage institutional academic departments, section cohorts, and roster allocations
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Class Cohort</span>
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm bg-gradient-to-br from-indigo-50/40 to-white">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  Active Classes
                </span>
                <div className="text-3xl font-black text-indigo-950 mt-1">{classes.length}</div>
                <span className="text-xs text-indigo-600/80 mt-1 block">Configured academic cohorts</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  Total Enrolled Students
                </span>
                <div className="text-3xl font-black text-emerald-700 mt-1">{totalStudents}</div>
                <span className="text-xs text-emerald-600/80 mt-1 block">Assigned across cohorts</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-purple-200/80 shadow-sm bg-gradient-to-br from-purple-50/40 to-white">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  Departments
                </span>
                <div className="text-3xl font-black text-purple-700 mt-1">{departments.length}</div>
                <span className="text-xs text-purple-600/80 mt-1 block">Academic faculties</span>
              </div>
            </div>

            {/* Search & Grid */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search by class name, department, or division..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Class Cards Grid */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClasses.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                    No classes found matching search criteria.
                  </div>
                ) : (
                  filteredClasses.map((cls) => (
                    <div
                      key={cls.id}
                      className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-400 p-5 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-gradient-to-tr group-hover:from-indigo-600 group-hover:to-purple-600 group-hover:text-white flex items-center justify-center font-black text-base shadow-sm transition-all">
                            {cls.division}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">{cls.name}</h3>
                            <span className="text-[11px] font-semibold text-slate-400 block">
                              Year: {cls.academic_year}
                            </span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {cls.students_count || 0} Students
                        </span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium truncate">{cls.department}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>Division Section: <strong>{cls.division}</strong></span>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <Link
                          to="/students"
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <span>View Roster</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(cls)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Edit Class Details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClass(cls)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Class"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

      {/* MODAL: ADD CLASS */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Add New Class Cohort</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Class Cohort Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TE-CSE-B"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department / Branch *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science & Engineering"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    placeholder="2026-27"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Division Section</label>
                  <input
                    type="text"
                    required
                    placeholder="A, B, C"
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md transition-all"
                >
                  Create Cohort
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CLASS */}
      {isEditModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Edit Class Cohort</h3>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedClass(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateClass} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Class Cohort Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department / Branch *</label>
                <input
                  type="text"
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Division Section</label>
                  <input
                    type="text"
                    required
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedClass(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md transition-all"
                >
                  Update Cohort
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Camera,
  UploadCloud,
  X,
  RefreshCw,
  Trash2,
  Edit3,
  PhoneCall,
  Globe,
  ShieldCheck,
  ChevronRight,
  Eye
} from 'lucide-react';
import { api } from '../services/api';
import { Student, ClassItem, FaceEnrollImage, EnrollmentResponse } from '../types';

export const Students: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [enrollStatusFilter, setEnrollStatusFilter] = useState<'ALL' | 'ENROLLED' | 'PENDING'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [activeEnrollStudent, setActiveEnrollStudent] = useState<Student | null>(null);

  // New Student Form State
  const [formData, setFormData] = useState({
    roll_number: '',
    full_name: '',
    email: '',
    class_id: 1,
    parent_name: '',
    parent_whatsapp: '',
    parent_language: 'EN' as 'EN' | 'HI' | 'MR'
  });

  // Edit Student Form State
  const [editFormData, setEditFormData] = useState({
    roll_number: '',
    full_name: '',
    email: '',
    class_id: 1,
    parent_name: '',
    parent_whatsapp: '',
    parent_language: 'EN' as 'EN' | 'HI' | 'MR'
  });

  // Multi-Angle Face Enrollment State
  const angles: Array<{ key: 'front' | 'left' | 'right' | 'up' | 'down'; label: string; desc: string }> = [
    { key: 'front', label: 'Front Facing', desc: 'Direct face pose looking straight at the lens' },
    { key: 'left', label: 'Left Profile (15°)', desc: 'Turn head slightly to the left' },
    { key: 'right', label: 'Right Profile (15°)', desc: 'Turn head slightly to the right' },
    { key: 'up', label: 'Looking Up (10°)', desc: 'Tilt chin slightly upward' },
    { key: 'down', label: 'Looking Down (10°)', desc: 'Tilt chin slightly downward' },
  ];
  const [capturedAngles, setCapturedAngles] = useState<Record<string, string>>({});
  const [activeCameraAngle, setActiveCameraAngle] = useState<'front' | 'left' | 'right' | 'up' | 'down' | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmittingEnroll, setIsSubmittingEnroll] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const [studentsRes, classesRes] = await Promise.all([
        api.get<Student[]>('/students/'),
        api.get<ClassItem[]>('/classes/')
      ]);
      setStudents(studentsRes.data);
      setClasses(classesRes.data);
      if (classesRes.data.length > 0 && formData.class_id === 1) {
        setFormData(prev => ({ ...prev, class_id: classesRes.data[0].id }));
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // One-Click Dataset & PKL Sync
  const handleSyncDataset = async () => {
    try {
      setIsSyncing(true);
      const res = await api.post('/students/sync-dataset');
      showToast(`Dataset Synchronized! ${res.data.synced_embeddings_count} face encodings loaded into database.`);
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to sync dataset encodings.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Create Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/students/', {
        roll_number: formData.roll_number,
        full_name: formData.full_name,
        email: formData.email,
        class_id: Number(formData.class_id),
        parent: {
          full_name: formData.parent_name,
          whatsapp_number: formData.parent_whatsapp,
          preferred_language: formData.parent_language
        }
      });
      showToast(`Student ${formData.full_name} registered successfully!`);
      setIsAddModalOpen(false);
      setFormData({
        roll_number: '',
        full_name: '',
        email: '',
        class_id: classes[0]?.id || 1,
        parent_name: '',
        parent_whatsapp: '',
        parent_language: 'EN'
      });
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to create student.', 'error');
    }
  };

  // Open Edit Modal
  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setEditFormData({
      roll_number: student.roll_number,
      full_name: student.full_name,
      email: student.email,
      class_id: student.class_id,
      parent_name: student.parent?.full_name || '',
      parent_whatsapp: student.parent?.whatsapp_number || '',
      parent_language: (student.parent?.preferred_language as 'EN' | 'HI' | 'MR') || 'EN'
    });
    setIsEditModalOpen(true);
  };

  // Update Student
  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      await api.put(`/students/${editingStudent.id}`, {
        roll_number: editFormData.roll_number,
        full_name: editFormData.full_name,
        email: editFormData.email,
        class_id: Number(editFormData.class_id),
        parent_name: editFormData.parent_name,
        parent_whatsapp: editFormData.parent_whatsapp,
        parent_language: editFormData.parent_language
      });
      showToast(`Student ${editFormData.full_name} updated successfully!`);
      setIsEditModalOpen(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to update student.', 'error');
    }
  };

  // Open Multi-Face Enrollment Modal
  const openEnrollmentModal = (student: Student) => {
    setActiveEnrollStudent(student);
    setCapturedAngles({});
    setActiveCameraAngle(null);
    setIsEnrollModalOpen(true);
  };

  // Start Webcam stream for active angle
  const startWebcam = async (angleKey: 'front' | 'left' | 'right' | 'up' | 'down') => {
    stopWebcam();
    setActiveCameraAngle(angleKey);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      showToast('Camera permission denied or camera unavailable.', 'error');
      setActiveCameraAngle(null);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setActiveCameraAngle(null);
  };

  const capturePhoto = (angleKey: string) => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedAngles(prev => ({ ...prev, [angleKey]: b64 }));
      stopWebcam();
    }
  };

  // File Upload handler for angle
  const handleFileUpload = (angleKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      setCapturedAngles(prev => ({ ...prev, [angleKey]: b64 }));
    };
    reader.readAsDataURL(file);
  };

  // Submit Multi-Angle Enrollment to backend
  const handleSubmitEnrollment = async () => {
    if (!activeEnrollStudent) return;
    const imageList: FaceEnrollImage[] = Object.entries(capturedAngles).map(([ang, b64]) => ({
      angle: ang as any,
      image_base64: b64
    }));

    if (imageList.length === 0) {
      showToast('Please capture or upload at least 1 face angle image.', 'error');
      return;
    }

    try {
      setIsSubmittingEnroll(true);
      const res = await api.post<EnrollmentResponse>(`/students/${activeEnrollStudent.id}/enroll-faces`, {
        images: imageList
      });
      showToast(res.data.message || 'Face enrollment successful!');
      setIsEnrollModalOpen(false);
      stopWebcam();
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Face enrollment failed. Ensure a clear face is visible.', 'error');
    } finally {
      setIsSubmittingEnroll(false);
    }
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(search.toLowerCase()) ||
      student.roll_number.toLowerCase().includes(search.toLowerCase());
    const matchesClass = selectedClassId === 'ALL' || String(student.class_id) === selectedClassId;
    const matchesEnroll =
      enrollStatusFilter === 'ALL' ||
      (enrollStatusFilter === 'ENROLLED' && student.is_enrolled) ||
      (enrollStatusFilter === 'PENDING' && !student.is_enrolled);
    return matchesSearch && matchesClass && matchesEnroll;
  });

  const enrolledCount = students.filter(s => s.is_enrolled).length;
  const pendingCount = students.length - enrolledCount;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold transition-all transform animate-bounce ${
            statusMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-500/30'
              : 'bg-rose-600 text-white shadow-rose-500/30'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Student Directory & Biometric Profiles</h1>
            <span className="text-xs bg-indigo-50 text-[#4F46E5] font-bold px-2.5 py-1 rounded-full border border-indigo-100">
              Phase 2 Active
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Manage multi-face biometric enrollment vectors, parent WhatsApp communication channels, and student profiles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncDataset}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-sm disabled:opacity-50"
            title="Scan dataset folders and sync face vectors to DB"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Dataset (1,182 Pkts)'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-[#4338CA] hover:to-[#7C3AED] text-white rounded-xl font-semibold text-xs tracking-wide shadow-md shadow-indigo-600/20 transition-all hover:translate-y-[-1px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Student</span>
          </button>
        </div>
      </div>

      {/* Quick KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Registered</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{students.length}</p>
            <p className="text-xs text-slate-500 mt-1">Institutional records</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Face Enrolled</p>
            <p className="text-3xl font-extrabold text-[#16A34A] mt-1">{enrolledCount}</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">
              {students.length ? Math.round((enrolledCount / students.length) * 100) : 0}% Biometric Ready
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Enrollment</p>
            <p className="text-3xl font-extrabold text-[#F59E0B] mt-1">{pendingCount}</p>
            <p className="text-xs text-amber-600 font-medium mt-1">Requires multi-angle capture</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-[#F59E0B]">
            <Camera className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Classes & Sections</option>
              {classes.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>
                  {cls.name} ({cls.department})
                </option>
              ))}
            </select>
          </div>

          {/* Biometric Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['ALL', 'ENROLLED', 'PENDING'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setEnrollStatusFilter(status)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                  enrollStatusFilter === status
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'All' : status === 'ENROLLED' ? '✓ Enrolled' : '⚠ Pending'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Students Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Roll No / PRN</th>
                <th className="py-3.5 px-5">Student Name</th>
                <th className="py-3.5 px-5">Class / Div</th>
                <th className="py-3.5 px-5">Parent Contact (WhatsApp)</th>
                <th className="py-3.5 px-5">Language</th>
                <th className="py-3.5 px-5">Face Biometric Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading Student Directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No students found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5 font-mono font-bold text-slate-800">
                      {student.roll_number}
                    </td>

                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                          {student.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{student.full_name}</p>
                          <p className="text-[11px] text-slate-400">{student.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md text-[11px] border border-indigo-100/60">
                        {student.class_name || 'TE-CSE-A'}
                      </span>
                    </td>

                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <PhoneCall className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{student.parent?.whatsapp_number || 'N/A'}</p>
                          <p className="text-[10px] text-slate-400">{student.parent?.full_name || 'Guardian'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        <Globe className="w-3 h-3 text-slate-400" />
                        {student.parent?.preferred_language || 'EN'}
                      </span>
                    </td>

                    <td className="py-4 px-5">
                      {student.is_enrolled ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-[#16A34A] border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Enrolled ({student.embeddings_count} vectors)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-[#F59E0B] border border-amber-100">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Pending Enrollment</span>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200"
                          title="Edit student and guardian profile"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => openEnrollmentModal(student)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            student.is_enrolled
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20'
                          }`}
                          title="Capture or re-enroll multi-angle facial vectors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{student.is_enrolled ? 'Update Faces' : 'Enroll Face'}</span>
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

      {/* ── MODAL: Add New Student ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Register New Student</h3>
                  <p className="text-xs text-slate-400">Add student profile and parent communication credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Roll No / PRN *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 202610"
                    value={formData.roll_number}
                    onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class / Cohort *</label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => setFormData({ ...formData, class_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="student@attendai.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-3">Parent / Guardian Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Parent Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Sharma"
                      value={formData.parent_name}
                      onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="+91 9876543210"
                      value={formData.parent_whatsapp}
                      onChange={(e) => setFormData({ ...formData, parent_whatsapp: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Communication Language</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { code: 'EN', name: 'English' },
                      { code: 'HI', name: 'हिन्दी (Hindi)' },
                      { code: 'MR', name: 'मराठी (Marathi)' },
                    ].map((lang) => (
                      <button
                        type="button"
                        key={lang.code}
                        onClick={() => setFormData({ ...formData, parent_language: lang.code as any })}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                          formData.parent_language === lang.code
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-indigo-600 hover:to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 transition-all"
                >
                  Save & Register Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Edit Student Details ── */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Edit Student Details</h3>
                  <p className="text-xs text-slate-400">Update student profile and guardian contact information</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStudent(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Roll No / PRN *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.roll_number}
                    onChange={(e) => setEditFormData({ ...editFormData, roll_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class / Cohort *</label>
                  <select
                    value={editFormData.class_id}
                    onChange={(e) => setEditFormData({ ...editFormData, class_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-2">
                  Parent / Guardian Details
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Guardian Name</label>
                    <input
                      type="text"
                      value={editFormData.parent_name}
                      onChange={(e) => setEditFormData({ ...editFormData, parent_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number</label>
                    <input
                      type="text"
                      value={editFormData.parent_whatsapp}
                      onChange={(e) => setEditFormData({ ...editFormData, parent_whatsapp: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Communication Language</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { code: 'EN', name: 'English' },
                      { code: 'HI', name: 'हिन्दी (Hindi)' },
                      { code: 'MR', name: 'मराठी (Marathi)' },
                    ].map((lang) => (
                      <button
                        type="button"
                        key={lang.code}
                        onClick={() => setEditFormData({ ...editFormData, parent_language: lang.code as any })}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                          editFormData.parent_language === lang.code
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-indigo-600 hover:to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Multi-Angle Face Enrollment ── */}
      {isEnrollModalOpen && activeEnrollStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-scale-up my-6">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#111C3A] text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base tracking-tight">Biometric Face Enrollment</h3>
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold">
                      {activeEnrollStudent.roll_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Student: <span className="font-bold text-white">{activeEnrollStudent.full_name}</span> • YuNet & ArcFace/SFace 128-D Model
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopWebcam();
                  setIsEnrollModalOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Instructions banner */}
              <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950">
                  <p className="font-bold">Multi-Angle Enrollment Protocol</p>
                  <p className="text-indigo-800/80 mt-0.5 leading-relaxed">
                    For optimal high-accuracy multi-face recognition in crowded classrooms, capture or upload 3 to 5 face poses.
                    The system will automatically crop, align, and extract mathematical 128-D embedding vectors.
                  </p>
                </div>
              </div>

              {/* Live Camera View (when active) */}
              {activeCameraAngle && (
                <div className="bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden border-2 border-indigo-500 shadow-xl">
                  <p className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                    Live Camera: Capturing <span className="text-indigo-400 uppercase font-mono">{activeCameraAngle}</span> pose
                  </p>
                  <div className="relative w-full max-w-md aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {/* Visual Oval Reticle */}
                    <div className="absolute border-2 border-dashed border-indigo-400/70 rounded-full w-44 h-56 pointer-events-none"></div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => capturePhoto(activeCameraAngle)}
                      className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all"
                    >
                      📸 Snap & Use Frame
                    </button>
                    <button
                      onClick={stopWebcam}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-all"
                    >
                      Cancel Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Multi-Angle Slots Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {angles.map((ang) => {
                  const hasImage = !!capturedAngles[ang.key];
                  return (
                    <div
                      key={ang.key}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        hasImage
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : 'border-slate-200 bg-slate-50/50 hover:border-indigo-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-slate-900">{ang.label}</p>
                          {hasImage ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">
                              ✓ Captured
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-200 text-slate-600 font-medium px-1.5 py-0.5 rounded">
                              Empty
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mb-3">{ang.desc}</p>
                      </div>

                      {/* Image Preview / Slot Action */}
                      <div className="aspect-[4/3] bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center relative mb-3">
                        {hasImage ? (
                          <img
                            src={capturedAngles[ang.key]}
                            alt={ang.label}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-3 text-slate-300">
                            <Camera className="w-8 h-8 mx-auto mb-1 stroke-1" />
                            <span className="text-[10px]">No image yet</span>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => startWebcam(ang.key)}
                          className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Webcam</span>
                        </button>

                        <label className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all">
                          <UploadCloud className="w-3 h-3" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(ang.key, e)}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Summary and Save */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Angle Progress:</span>
                  <span className="text-xs font-bold text-indigo-700">
                    {Object.keys(capturedAngles).length} / {angles.length} poses ready
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopWebcam();
                      setIsEnrollModalOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={Object.keys(capturedAngles).length === 0 || isSubmittingEnroll}
                    onClick={handleSubmitEnrollment}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-indigo-600 hover:to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmittingEnroll ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing Neural Vectors...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Commit Biometric Vectors to DB</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


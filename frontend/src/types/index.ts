export type UserRole = 'ADMIN' | 'TEACHER';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  full_name: string;
  email: string;
}

export interface ParentInfo {
  id?: number;
  full_name: string;
  whatsapp_number: string;
  email?: string;
  preferred_language: 'EN' | 'HI' | 'MR';
}

export interface ClassItem {
  id: number;
  name: string;
  academic_year: string;
  department: string;
  division: string;
}

export interface Student {
  id: number;
  roll_number: string;
  full_name: string;
  email: string;
  class_id: number;
  class_name?: string;
  photo_url?: string;
  is_active: boolean;
  is_enrolled: boolean;
  embeddings_count: number;
  parent?: ParentInfo;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  time: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'PENDING';
  confidence: number;
  verification_method: string;
}

export interface TodayAttendanceStats {
  date: string;
  total_enrolled: number;
  present_today: number;
  absent_today: number;
  attendance_percentage: number;
  records: AttendanceRecord[];
}

export interface AttendanceSession {
  id: number;
  class_id: number;
  class_name?: string;
  subject: string;
  session_date: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINALIZED';
  start_time: string;
  end_time?: string;
  total_students: number;
  present_count: number;
  absent_count: number;
}

export interface WhatsAppNotificationItem {
  id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  class_name: string;
  parent_name: string;
  recipient_phone: string;
  message_content: string;
  language: 'EN' | 'HI' | 'MR';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  approval_status: string;
  external_provider_id?: string;
  session_date: string;
  sent_at?: string;
  created_at?: string;
}

export interface WhatsAppStats {
  total_dispatched: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  approved_waiting_dispatch: number;
  delivery_rate_percentage: number;
  read_rate_percentage: number;
}

export interface AbsenteeQueueItem {
  notification_id: number;
  student_id: number;
  roll_number: string;
  full_name: string;
  class_name: string;
  parent_name: string;
  whatsapp_number: string;
  preferred_language: 'EN' | 'HI' | 'MR';
  session_date: string;
  approval_status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DISPATCHED';
  notification_status: string;
  message_content: string;
  created_at: string;
}

export interface AbsenteeQueueStats {
  today: string;
  total_absentees_today: number;
  pending_approval: number;
  approved_ready: number;
  dispatched: number;
}

export interface AbsenteeItem {
  student_id: number;
  roll_number: string;
  full_name: string;
  parent_name?: string;
  whatsapp_number?: string;
  preferred_language: 'EN' | 'HI' | 'MR';
}

export interface FinalizeSessionSummary {
  session_id: number;
  class_name: string;
  subject: string;
  session_date: string;
  status: string;
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
  absentees: AbsenteeItem[];
  message: string;
}

export interface FaceEnrollImage {
  angle: 'front' | 'left' | 'right' | 'up' | 'down';
  image_base64: string;
}

export interface EnrollmentResponse {
  student_id: number;
  student_name: string;
  processed_count: number;
  enrolled_count: number;
  embeddings_total: number;
  message: string;
}

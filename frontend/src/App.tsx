import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { LiveAttendance } from './pages/LiveAttendance';
import { AttendanceRegister } from './pages/AttendanceRegister';
import { AbsenteeQueue } from './pages/AbsenteeQueue';
import { ParentComms } from './pages/ParentComms';
import { CallPermissions } from './pages/CallPermissions';
import { VoiceAssistant } from './pages/VoiceAssistant';
import { Reports } from './pages/Reports';
import { Classes } from './pages/Classes';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/live-attendance" element={<LiveAttendance />} />
            <Route path="/students" element={<Students />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/attendance-register" element={<AttendanceRegister />} />
            <Route path="/absentees" element={<AbsenteeQueue />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/parent-comms" element={<ParentComms />} />
            <Route path="/call-permissions" element={<CallPermissions />} />
            <Route path="/voice-assistant" element={<VoiceAssistant />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

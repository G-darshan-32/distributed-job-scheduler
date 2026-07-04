import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import QueuesPage from './pages/QueuesPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import WorkersPage from './pages/WorkersPage';
import DLQPage from './pages/DLQPage';
import RetryPoliciesPage from './pages/RetryPoliciesPage';
import SettingsPage from './pages/SettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId/queues" element={<QueuesPage />} />
          <Route path="queues/:queueId/jobs" element={<JobsPage />} />
          <Route path="jobs/:jobId" element={<JobDetailPage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="dlq" element={<DLQPage />} />
          <Route path="retry-policies" element={<RetryPoliciesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

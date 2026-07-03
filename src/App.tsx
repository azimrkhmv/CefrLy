import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute, SuperAdminRoute } from './components/admin/AdminRoute'
import { AdminLayout } from './components/admin/AdminLayout'
import { HomePage } from './pages/HomePage'
import { AuthPage } from './pages/AuthPage'
import { TestPage } from './pages/TestPage'
import { ResultsPage } from './pages/ResultsPage'
import { DashboardPage } from './pages/DashboardPage'
import { HandoffPage } from './pages/HandoffPage'
import { AdminTestsPage } from './pages/admin/AdminTestsPage'
import { TestFormPage } from './pages/admin/TestFormPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/handoff" element={<HandoffPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/test/:testId" element={<TestPage />} />
          <Route path="/results/:attemptId" element={<ResultsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>

      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/tests" replace />} />
          <Route path="/admin/tests" element={<AdminTestsPage />} />
          <Route path="/admin/tests/new" element={<TestFormPage />} />
          <Route path="/admin/tests/:slug" element={<TestFormPage />} />
          <Route element={<SuperAdminRoute />}>
            <Route path="/admin/admins" element={<AdminUsersPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

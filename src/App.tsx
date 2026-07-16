import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/admin/AdminRoute'
import { AdminLayout } from './components/admin/AdminLayout'
import { HomePage } from './pages/HomePage'
import { ReadingPage } from './pages/ReadingPage'
import { ListeningPage } from './pages/ListeningPage'
import { WritingPage } from './pages/WritingPage'
import { WritingTaskPage } from './pages/WritingTaskPage'
import { AuthPage } from './pages/AuthPage'
import { TestPage } from './pages/TestPage'
import { ResultsPage } from './pages/ResultsPage'
import { ReviewPage } from './pages/ReviewPage'
import { AnalyzePage } from './pages/AnalyzePage'
import { SamplesPage } from './pages/SamplesPage'
import { PricingPage } from './pages/PricingPage'
import { SupportPage } from './pages/SupportPage'
import { DashboardPage } from './pages/DashboardPage'
import { HandoffPage } from './pages/HandoffPage'
import { WelcomePage } from './pages/WelcomePage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminTestsPage } from './pages/admin/AdminTestsPage'
import { TestFormPage } from './pages/admin/TestFormPage'
import { ListeningTestFormPage } from './pages/admin/ListeningTestFormPage'
import { PartTestFormPage } from './pages/admin/PartTestFormPage'
import { TestFormRouter } from './pages/admin/TestFormRouter'
import { AdminSamplesPage } from './pages/admin/AdminSamplesPage'
import { SampleFormPage } from './pages/admin/SampleFormPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage'
import { Cat } from './components/Cat'

// DEV ONLY: mascot pose sheet for design review. Remove before launch.
function CatPreview() {
  return (
    <div className="flex flex-wrap items-end gap-10 bg-white p-10">
      {(['celebrate', 'encourage', 'read', 'nap', 'welcome', 'peek', 'avatar'] as const).map((pose) => (
        <div key={pose} className="text-center">
          <Cat pose={pose} width={180} height={pose === 'peek' ? 84 : 160} />
          <p className="mt-2 text-sm text-ink-soft">{pose}</p>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Auth pages render full-screen, outside the app shell. */}
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/cat-preview" element={<CatPreview />} />

      {/* Handoff is public: it exchanges a MilliyMock token before a session exists. */}
      <Route element={<Layout />}>
        <Route path="/handoff" element={<HandoffPage />} />
      </Route>

      {/* Everything else requires an account. Signed-out visitors are sent to /login
          before the app shell renders, so the first thing a new user sees is auth.
          ProtectedRoute also funnels accounts without onboarded_at to /welcome —
          the one-time wizard renders full-screen, outside the app shell. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/listening" element={<ListeningPage />} />
          <Route path="/writing" element={<WritingPage />} />
          <Route path="/writing/task/:id" element={<WritingTaskPage />} />
          <Route path="/samples" element={<SamplesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/test/:testId" element={<TestPage />} />
          <Route path="/results/:attemptId" element={<ResultsPage />} />
          <Route path="/review/:attemptId" element={<ReviewPage />} />
          <Route path="/analyze/:attemptId" element={<AnalyzePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/tests" replace />} />
          <Route path="/admin/tests" element={<AdminTestsPage />} />
          <Route path="/admin/tests/new" element={<TestFormPage />} />
          <Route path="/admin/tests/new/listening" element={<ListeningTestFormPage />} />
          <Route path="/admin/tests/new/part" element={<PartTestFormPage />} />
          <Route path="/admin/tests/:slug" element={<TestFormRouter />} />
          <Route path="/admin/samples" element={<AdminSamplesPage />} />
          <Route path="/admin/samples/new" element={<SampleFormPage />} />
          <Route path="/admin/samples/:slug" element={<SampleFormPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          {/* The directory absorbed the old admins-only page; keep the link alive. */}
          <Route path="/admin/admins" element={<Navigate to="/admin/users" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

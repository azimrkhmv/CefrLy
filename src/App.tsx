import { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { FullScreenFallback } from './components/RouteFallback'
import { HomePage } from './pages/HomePage'
import { AuthPage } from './pages/AuthPage'
import { Cat } from './components/Cat'

/**
 * Every page below the two entry points (/ and /login) is code-split, so the
 * initial bundle no longer carries the admin CRUD forms, the exam player, the
 * review/analyze screens and the onboarding wizard to every student.
 * Suspense boundaries live inside Layout/AdminLayout (page body only) plus one
 * full-screen boundary here for the shell-less routes.
 *
 * Pages use named exports, hence the tiny `page()` adapter — React.lazy wants
 * a module with a `default`.
 */
function page<T extends string, C extends ComponentType<Record<string, never>>>(
  loader: () => Promise<Record<T, C>>,
  name: T,
) {
  return lazy(async () => ({ default: (await loader())[name] }))
}

const ReadingPage = page(() => import('./pages/ReadingPage'), 'ReadingPage')
const ListeningPage = page(() => import('./pages/ListeningPage'), 'ListeningPage')
const WritingPage = page(() => import('./pages/WritingPage'), 'WritingPage')
const WritingTaskPage = page(() => import('./pages/WritingTaskPage'), 'WritingTaskPage')
const SpeakingPage = page(() => import('./pages/SpeakingPage'), 'SpeakingPage')
const SpeakingTaskPage = page(() => import('./pages/SpeakingTaskPage'), 'SpeakingTaskPage')
const TestPage = page(() => import('./pages/TestPage'), 'TestPage')
const ResultsPage = page(() => import('./pages/ResultsPage'), 'ResultsPage')
const ReviewPage = page(() => import('./pages/ReviewPage'), 'ReviewPage')
const AnalyzePage = page(() => import('./pages/AnalyzePage'), 'AnalyzePage')
const SamplesPage = page(() => import('./pages/SamplesPage'), 'SamplesPage')
const PricingPage = page(() => import('./pages/PricingPage'), 'PricingPage')
const SupportPage = page(() => import('./pages/SupportPage'), 'SupportPage')
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage')
const HandoffPage = page(() => import('./pages/HandoffPage'), 'HandoffPage')
const WelcomePage = page(() => import('./pages/WelcomePage'), 'WelcomePage')
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage')

// The admin shell itself is lazy too, so a student's bundle contains ZERO admin
// code (measured: it was the last 3.2 KB of /admin in the entry chunk).
const AdminRoute = page(() => import('./components/admin/AdminRoute'), 'AdminRoute')
const AdminLayout = page(() => import('./components/admin/AdminLayout'), 'AdminLayout')
const AdminTestsPage = page(() => import('./pages/admin/AdminTestsPage'), 'AdminTestsPage')
const TestFormPage = page(() => import('./pages/admin/TestFormPage'), 'TestFormPage')
const ListeningTestFormPage = page(
  () => import('./pages/admin/ListeningTestFormPage'),
  'ListeningTestFormPage',
)
const PartTestFormPage = page(() => import('./pages/admin/PartTestFormPage'), 'PartTestFormPage')
const TestFormRouter = page(() => import('./pages/admin/TestFormRouter'), 'TestFormRouter')
const AdminSamplesPage = page(() => import('./pages/admin/AdminSamplesPage'), 'AdminSamplesPage')
const SampleFormPage = page(() => import('./pages/admin/SampleFormPage'), 'SampleFormPage')
const AdminUsersPage = page(() => import('./pages/admin/AdminUsersPage'), 'AdminUsersPage')
const AdminUserDetailPage = page(
  () => import('./pages/admin/AdminUserDetailPage'),
  'AdminUserDetailPage',
)

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
    <Suspense fallback={<FullScreenFallback />}>
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
            <Route path="/speaking" element={<SpeakingPage />} />
            <Route path="/speaking/task/:id" element={<SpeakingTaskPage />} />
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
    </Suspense>
  )
}

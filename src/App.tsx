import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { AuthPage } from './pages/AuthPage'
import { TestPage } from './pages/TestPage'
import { ResultsPage } from './pages/ResultsPage'
import { DashboardPage } from './pages/DashboardPage'
import { HandoffPage } from './pages/HandoffPage'

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
    </Routes>
  )
}

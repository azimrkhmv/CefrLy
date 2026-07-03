import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { TestPage } from './pages/TestPage'
import { ResultsPage } from './pages/ResultsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/test/:testId" element={<TestPage />} />
          <Route path="/results/:attemptId" element={<ResultsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

import { TestCatalog, buildAttemptInfo } from '../components/TestCatalog'

// Re-exported for tests/other callers that relied on ReadingPage's helper.
export { buildAttemptInfo }

export function ReadingPage() {
  return <TestCatalog skill="reading" />
}

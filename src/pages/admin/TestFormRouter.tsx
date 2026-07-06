import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminGetTest } from '../../lib/adminApi'
import { TestFormPage } from './TestFormPage'
import { ListeningTestFormPage } from './ListeningTestFormPage'
import { PartTestFormPage } from './PartTestFormPage'

// The edit route (/admin/tests/:slug) serves both skills. Fetch the test once to
// learn its skill, then render the matching fixed-template form (which reads the
// same react-query cache entry, so there is no second request). Single-part
// tests MUST branch first — the full-form prefills destructure 5/6 parts and
// would break on a one-part content object.
export function TestFormRouter() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-test', slug],
    queryFn: () => adminGetTest(slug!),
    enabled: !!slug,
  })

  if (isLoading) return <p className="py-24 text-center text-ink-soft">Loading test…</p>
  if (error) {
    return (
      <p className="py-24 text-center text-sm text-rose-700">
        {error instanceof Error ? error.message : 'Could not load this test.'}
      </p>
    )
  }
  if (data?.content.scope === 'part') return <PartTestFormPage />
  return data?.content.skill === 'listening' ? <ListeningTestFormPage /> : <TestFormPage />
}

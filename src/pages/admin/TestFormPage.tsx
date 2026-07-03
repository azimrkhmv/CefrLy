import { useParams } from 'react-router-dom'

// Filled in by phase 2 tasks 6 & 7 (fixed-template Reading form, create + edit).
export function TestFormPage() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <div>
      <h1 className="text-2xl font-bold">{slug ? `Edit: ${slug}` : 'New test'}</h1>
      <p className="mt-2 text-sm text-slate-500">The Reading template form arrives in task 6.</p>
    </div>
  )
}

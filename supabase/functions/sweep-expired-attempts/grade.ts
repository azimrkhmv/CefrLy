// Grading for a reading/listening paper — shared by submit-test (the student
// hands in) and sweep-expired-attempts (the clock ran out and nobody did).
//
// COPIED, NOT IMPORTED, into each function that needs it — the same convention
// as cors.ts and plans.ts. Change it here and copy it there.

// deno-lint-ignore no-explicit-any
type Any = any

export interface GradedPaper {
  rawScore: number
  total: number
  band: string | null
  sectionScores: Record<string, { correct: number; total: number }>
  items: Any[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isCorrect(item: Any, userAnswer: string | null): boolean {
  if (userAnswer === null) return false
  switch (item.type) {
    case 'gap':
      return (item.answer as string[]).map(normalize).includes(normalize(userAnswer))
    case 'match':
    case 'mcq':
    case 'tfng':
      return userAnswer === item.answer
    default:
      return false
  }
}

// Indicative per-skill band from raw correct count out of 35 (same thresholds
// for reading and listening).
export function bandFor(score: number): string {
  if (score >= 28) return 'C1'
  if (score >= 18) return 'B2'
  if (score >= 10) return 'B1'
  return 'below_B1'
}

function optionLabel(pool: Any[] | undefined, key: string): string {
  const found = pool?.find((option: Any) => option.key === key)
  return found ? `${found.key}. ${found.label}` : key
}

export function answerLabel(part: Any, item: Any, value: string | null): string | null {
  if (value === null) return null
  switch (item.type) {
    case 'gap':
      return value
    case 'match':
      return optionLabel(part.optionPool, value)
    case 'mcq':
      return optionLabel(item.options, value)
    case 'tfng':
      return value === 'true' ? 'True' : value === 'false' ? 'False' : item.thirdOptionLabel
    default:
      return value
  }
}

export function correctAnswerLabel(part: Any, item: Any): string {
  switch (item.type) {
    case 'gap':
      return (item.answer as string[]).join(' / ')
    case 'match':
      return optionLabel(part.optionPool, item.answer)
    case 'mcq':
      return optionLabel(item.options, item.answer)
    case 'tfng':
      return item.answer === 'true'
        ? 'True'
        : item.answer === 'false'
          ? 'False'
          : item.thirdOptionLabel
    default:
      return String(item.answer)
  }
}

/** Score a whole paper. `scope` decides the band: a single-part drill's raw
 *  score means nothing on the 28/18/10 thresholds, so part attempts get null. */
export function gradePaper(
  content: Any,
  answerMap: Record<string, unknown>,
  scope: 'full' | 'part',
): GradedPaper {
  const items: Any[] = []
  const sectionScores: Record<string, { correct: number; total: number }> = {}
  let rawScore = 0
  let total = 0

  for (const part of content.parts ?? []) {
    const section = (sectionScores[part.number] ??= { correct: 0, total: 0 })
    // Listening Part 5 (multi_extract_mcq) holds its items inside groups; every
    // other layout uses part.items. Flatten so grading is uniform.
    const partItems =
      Array.isArray(part.groups) && part.groups.length > 0
        ? part.groups.flatMap((g: Any) => g.items ?? [])
        : (part.items ?? [])
    for (const item of partItems) {
      total += 1
      section.total += 1
      const raw = answerMap[item.id]
      const userAnswer = typeof raw === 'string' && raw.trim() !== '' ? raw : null
      const correct = isCorrect(item, userAnswer)
      if (correct) {
        rawScore += 1
        section.correct += 1
      }
      items.push({
        id: item.id,
        partNumber: part.number,
        type: item.type,
        prompt: item.prompt,
        correct,
        userAnswer,
        userAnswerLabel: answerLabel(part, item, userAnswer),
        correctAnswerLabel: correctAnswerLabel(part, item),
        explanation: item.explanation,
      })
    }
  }

  return {
    rawScore,
    total,
    band: scope === 'part' ? null : bandFor(rawScore),
    sectionScores,
    items,
  }
}

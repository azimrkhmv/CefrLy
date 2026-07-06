import { useState } from 'react'
import { PenIcon, MicIcon } from '../components/icons'

// Samples of the two skills Cefrly does NOT test yet: model Writing answers
// and model Speaking responses, so students can study the format and the
// standard to aim for before those papers arrive. Content is PLACEHOLDER
// authored in-house (like the listening transcripts) — the owner will supply
// official samples later; swap the consts below, the page stays the same.

interface WritingSample {
  id: string
  badge: string
  title: string
  task: string[]
  bullets?: string[]
  note: string
  model: string[]
  why: string[]
}

interface SpeakingSample {
  id: string
  badge: string
  title: string
  task: string[]
  bullets?: string[]
  note: string
  model: { speaker: string; text: string }[]
  why: string[]
}

const WRITING_SAMPLES: WritingSample[] = [
  {
    id: 'w1',
    badge: 'Task 1 · Letter',
    title: 'An informal letter to a friend',
    task: [
      'You recently borrowed a book from your friend and accidentally damaged it. Write a letter to your friend.',
    ],
    bullets: ['apologise for what happened', 'explain how the book was damaged', 'suggest a way to make up for it'],
    note: 'Write at least 120 words. You have about 20 minutes.',
    model: [
      'Dear Aziza,',
      'I hope you and your family are doing well. I’m writing because I have a small confession to make, and I’d rather you heard it from me directly.',
      'You know the novel you lent me last month — the one you love so much? I’m really sorry to say it got damaged while it was with me. I was reading it in the park last Sunday when it suddenly started to rain. I ran for shelter, but by the time I got there, the back cover and the last few pages were soaked. I’ve dried it carefully, but it doesn’t look the way it did when you gave it to me.',
      'I feel terrible about it, especially because I know it was a birthday present. Please let me replace it — I’ve already found the same edition in the bookshop near my office. I could bring the new copy when we meet on Friday, and perhaps I could treat you to coffee as well, to say sorry properly.',
      'Once again, I really do apologise. I promise I’ll be far more careful with anything you lend me in the future!',
      'With love,',
      'Malika',
    ],
    why: [
      'Covers all three bullet points in the task — the apology, the explanation, and a concrete solution.',
      'Sounds like a real letter: friendly opening and closing, contractions, natural phrases ("a small confession to make").',
      'Clear paragraphs, one job each: opening → what happened → how to fix it → closing apology.',
      'Range without showing off: past continuous ("I was reading… when it started to rain"), polite offers ("Please let me replace it"), linking ("especially because", "by the time").',
    ],
  },
  {
    id: 'w2',
    badge: 'Task 2 · Essay',
    title: 'An opinion essay',
    task: [
      'Some people believe children should start learning a foreign language as early as possible. Others think it is better to wait until secondary school, when children can study more seriously.',
      'Discuss both views and give your own opinion.',
    ],
    note: 'Write at least 250 words. You have about 40 minutes.',
    model: [
      'People disagree about the best age to begin learning a foreign language. While some parents enrol their children in English classes before they can even read, others believe languages are learned best by teenagers who understand why they are studying. In my view, an early start is more effective, provided the lessons match the child’s age.',
      'Those who support an early start point to how effortlessly young children absorb language. A six-year-old who sings songs and plays games in English is not translating; she is simply communicating, and the sounds of the new language become as natural to her as her mother tongue. Research on pronunciation supports this: learners who begin early rarely keep a strong foreign accent. Moreover, early exposure builds confidence — a child who has always spoken two languages never learns to be afraid of one of them.',
      'On the other hand, supporters of a later start argue that teenagers are far more efficient learners. They can use grammar rules, dictionaries and self-discipline, so one year of serious study at fourteen may achieve more than three years of games at six. They also warn that pushing very young children into formal lessons can turn language learning into a chore before it has even begun.',
      'Both sides make reasonable points, but they are describing different kinds of teaching, not different children. When early lessons are playful and short, young learners gain a natural accent and a fearless attitude, and the analytical skills of adolescence can be added later. For this reason, I believe the best time to open the door to a new language is as early as possible — as long as the child walks through it playing, not studying.',
    ],
    why: [
      'A clear position stated in the introduction and defended consistently through to the conclusion.',
      'Discusses BOTH views fairly (one paragraph each) before weighing them — exactly what the task asks.',
      'Strong paragraph discipline: one central idea per paragraph, each developed with an example or reason.',
      'Cohesion without formula spam: "Moreover", "On the other hand", "For this reason" appear where they belong, not decoratively.',
      'Memorable but controlled language: "never learns to be afraid of one of them", "walks through it playing, not studying".',
    ],
  },
]

const SPEAKING_SAMPLES: SpeakingSample[] = [
  {
    id: 's1',
    badge: 'Part 1 · Interview',
    title: 'Personal questions',
    task: ['The examiner asks short questions about you and your everyday life. Answer naturally — two or three sentences each, not one word and not a speech.'],
    note: 'Typical topics: home, studies, work, free time, food, travel.',
    model: [
      { speaker: 'Examiner', text: 'Do you prefer spending your evenings at home or going out?' },
      {
        speaker: 'Student',
        text: 'Mostly at home, to be honest. My days are quite busy, so in the evening I enjoy cooking something simple and watching a series with my sister. Having said that, if a friend invites me for a walk by the river, I rarely say no.',
      },
      { speaker: 'Examiner', text: 'Is there a food from your childhood that you still love?' },
      {
        speaker: 'Student',
        text: 'Definitely — my grandmother’s plov. She used to make it every Sunday, and the smell alone brings back the whole of my childhood. I’ve tried to cook it myself, but somehow hers always tastes better.',
      },
    ],
    why: [
      'Answers are extended but natural — a direct answer, a reason or example, and a small personal touch.',
      'Conversational language ("to be honest", "Having said that") shows fluency, not memorisation.',
      'Past habits handled correctly ("She used to make it every Sunday").',
    ],
  },
  {
    id: 's2',
    badge: 'Part 2 · Picture description',
    title: 'Comparing two photographs',
    task: [
      'You are given two photographs: in the first, a family is having dinner together at home; in the second, people are eating alone at a fast-food restaurant, looking at their phones.',
      'Compare the two photographs and say why you think people choose each way of eating.',
    ],
    note: 'Speak for about one minute. You have a few seconds to look at the pictures first.',
    model: [
      {
        speaker: 'Student',
        text: 'Both photographs show people having a meal, but the atmosphere could hardly be more different. In the first picture, a family is sitting around a table at home — they’re talking, passing dishes to each other, and nobody seems to be in a hurry. The second one shows the opposite: several people are eating fast food at separate tables, and instead of talking, each of them is staring at a phone.',
      },
      {
        speaker: 'Student',
        text: 'I suppose people eat like the family in the first photo when they want more than just food — dinner is their time to hear about each other’s day. The people in the second picture have probably chosen speed over company: they might be office workers on a short break, grabbing something quick between meetings. It saves time, of course, but to me the first picture looks warmer — a meal shared is somehow twice the meal.',
      },
    ],
    why: [
      'Compares from the first sentence instead of describing the pictures one by one.',
      'Speculates with appropriate language — "I suppose", "they might be", "probably" — rather than stating guesses as facts.',
      'Covers BOTH parts of the task: the comparison and the reasons people choose each way.',
      'Finishes with a personal note and a memorable line instead of stopping mid-air.',
    ],
  },
  {
    id: 's3',
    badge: 'Part 3 · Topic talk',
    title: 'A two-minute monologue',
    task: ['Talk about the role of technology in education. You may consider: advantages for students, possible dangers, and how schools should respond.'],
    note: 'Speak for about two minutes. One minute of preparation is allowed.',
    model: [
      {
        speaker: 'Student',
        text: 'Technology has changed education more in twenty years than anything else in the previous two hundred, and on the whole I believe the change is for the better. The clearest advantage is access: a student in a small town today can watch lectures from the world’s best universities, practise languages with apps, and find any book in seconds. Learning is no longer locked inside a classroom.',
      },
      {
        speaker: 'Student',
        text: 'At the same time, the dangers are real. The same phone that opens a library also opens endless distractions, and many students find it genuinely difficult to study for an hour without checking their notifications. There is also a quieter problem: when every answer is one search away, it is tempting to stop thinking and simply copy.',
      },
      {
        speaker: 'Student',
        text: 'That is why I think the responsibility lies with schools, not with the technology itself. Schools should teach students how to use these tools — how to check sources, how to plan screen time, how to use an app for practice rather than for answers. Banning technology would be like banning books because some of them are bad. In short, technology is a powerful servant but a terrible master, and education’s job is to keep it a servant.',
      },
    ],
    why: [
      'Follows the suggested structure — advantages, dangers, what schools should do — so the talk never loses direction.',
      'Each point is developed with a concrete example, not just named and abandoned.',
      'Signposting keeps the listener oriented: "The clearest advantage…", "At the same time…", "That is why…", "In short…".',
      'Ends with a conclusion, not a fade-out — the final sentence sounds prepared without sounding memorised.',
    ],
  },
]

export function SamplesPage() {
  const [tab, setTab] = useState<'writing' | 'speaking'>('writing')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Samples</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Model answers for the two skills we don’t test yet. Study how a strong response is
          built — the Writing and Speaking mock tests are coming soon.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-line bg-white p-1">
        <TabPill active={tab === 'writing'} onClick={() => setTab('writing')}>
          <PenIcon width={16} height={16} />
          Writing
        </TabPill>
        <TabPill active={tab === 'speaking'} onClick={() => setTab('speaking')}>
          <MicIcon width={16} height={16} />
          Speaking
        </TabPill>
      </div>

      {tab === 'writing' ? (
        <div className="space-y-6">
          {WRITING_SAMPLES.map((sample) => (
            <SampleCard key={sample.id} badge={sample.badge} title={sample.title}>
              <TaskPanel task={sample.task} bullets={sample.bullets} note={sample.note} />
              <div className="mt-4">
                <h4 className="text-sm font-extrabold text-heading">Model answer</h4>
                <div className="mt-2 space-y-3 rounded-xl bg-page p-4 text-sm leading-relaxed text-ink">
                  {sample.model.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
              <WhyPanel why={sample.why} />
            </SampleCard>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {SPEAKING_SAMPLES.map((sample) => (
            <SampleCard key={sample.id} badge={sample.badge} title={sample.title}>
              <TaskPanel task={sample.task} bullets={sample.bullets} note={sample.note} />
              <div className="mt-4">
                <h4 className="text-sm font-extrabold text-heading">Model response</h4>
                <div className="mt-2 space-y-3 rounded-xl bg-page p-4">
                  {sample.model.map((turn, i) => (
                    <div key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="w-20 shrink-0 pt-px text-right text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
                        {turn.speaker}
                      </span>
                      <p className="min-w-0 flex-1 text-ink">{turn.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <WhyPanel why={sample.why} />
            </SampleCard>
          ))}
        </div>
      )}
    </div>
  )
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
        active ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function SampleCard({
  badge,
  title,
  children,
}: {
  badge: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
          {badge}
        </span>
        <h2 className="text-lg font-extrabold text-heading">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function TaskPanel({ task, bullets, note }: { task: string[]; bullets?: string[]; note: string }) {
  return (
    <div className="mt-4 rounded-xl border border-brand/20 bg-brand-soft/50 p-4">
      <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">The task</h4>
      <div className="mt-1.5 space-y-1.5 text-sm font-semibold text-ink">
        {task.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {bullets && (
          <ul className="list-disc space-y-0.5 pl-5 font-medium">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs font-semibold text-ink-soft">{note}</p>
    </div>
  )
}

function WhyPanel({ why }: { why: string[] }) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h4 className="text-sm font-extrabold text-emerald-800">Why this scores well</h4>
      <ul className="mt-2 space-y-1.5 text-sm text-emerald-800">
        {why.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className="shrink-0 font-bold">
              ✓
            </span>
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

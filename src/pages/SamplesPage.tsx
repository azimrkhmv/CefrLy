import { useState } from 'react'
import { ArrowRightIcon, MicIcon, PenIcon } from '../components/icons'

// Samples of the two skills Cefrly does NOT test yet, presented like a lesson
// catalog (reference: tab strip + card grid, one card per sample; clicking a
// card opens the task + model answer + notes). FRONT-END ONLY for now — the
// samples live in the consts below; a backend/admin editor comes later, so
// keep the shapes simple and serializable.

type TabKey = 'writing1' | 'writing2' | 'speaking'

interface Sample {
  id: string
  kind: 'writing' | 'speaking'
  badge: string
  title: string
  chips: { label: string; className: string }[]
  task: string[]
  bullets?: string[]
  note: string
  /** Writing: paragraphs. Speaking: dialogue/monologue turns. */
  model: string[] | { speaker: string; text: string }[]
  why: string[]
}

const CHIP = {
  letter: { label: 'letter', className: 'bg-rose-50 text-rose-800' },
  essay: { label: 'essay', className: 'bg-rose-50 text-rose-800' },
  speaking: { label: 'speaking', className: 'bg-sun-soft text-sun-ink' },
  model: { label: 'model answer', className: 'bg-emerald-50 text-emerald-800' },
  examSkills: { label: 'exam skills', className: 'bg-brand-soft text-brand' },
}

const WRITING_TASK_1: Sample[] = [
  {
    id: 'w1-apology',
    kind: 'writing',
    badge: 'Task 1 · Informal letter',
    title: 'A letter of apology to a friend',
    chips: [CHIP.letter, CHIP.model],
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
      'Covers all three bullet points — the apology, the explanation, and a concrete solution.',
      'Sounds like a real letter: friendly opening and closing, contractions, natural phrases ("a small confession to make").',
      'Clear paragraphs, one job each: opening → what happened → how to fix it → closing apology.',
      'Range without showing off: past continuous, polite offers ("Please let me replace it"), natural linking.',
    ],
  },
  {
    id: 'w1-complaint',
    kind: 'writing',
    badge: 'Task 1 · Formal letter',
    title: 'A letter of complaint',
    chips: [CHIP.letter, CHIP.model],
    task: [
      'You bought a pair of wireless headphones online. When they arrived, they did not work properly. Write a letter to the shop.',
    ],
    bullets: ['explain what you bought and when', 'describe the problem', 'say what you want the shop to do'],
    note: 'Write at least 120 words. Use a formal style.',
    model: [
      'Dear Sir or Madam,',
      'I am writing to complain about a pair of SoundMax X2 wireless headphones, order number 58214, which I purchased from your website on 14 June and received three days later.',
      'Although the headphones appeared undamaged, they have not worked properly from the first day. The left earphone produces no sound unless the cable position is adjusted by hand, and the battery, which is advertised to last twelve hours, runs out in fewer than three. I have followed every instruction in the manual, including resetting the device twice, but the problems remain.',
      'As the headphones are clearly faulty, I would like a full refund rather than a replacement. I have kept the receipt, the original packaging and our order confirmation, and I am happy to return the product at your expense.',
      'I would appreciate a reply within ten working days.',
      'Yours faithfully,',
      'Jasur Karimov',
    ],
    why: [
      'Consistently formal from "Dear Sir or Madam" to "Yours faithfully" — no slips into chatty language.',
      'Gives the facts a real complaint needs: product, order number, dates, exactly what is wrong.',
      'States clearly what outcome is expected (a refund) and sets a polite deadline.',
      'Complaint language worth stealing: "I am writing to complain about…", "clearly faulty", "at your expense".',
    ],
  },
  {
    id: 'w1-invitation',
    kind: 'writing',
    badge: 'Task 1 · Informal letter',
    title: 'An invitation to a celebration',
    chips: [CHIP.letter, CHIP.model],
    task: [
      'Your family is organising a celebration for your grandmother’s 80th birthday. Write a letter to your English-speaking friend.',
    ],
    bullets: ['invite your friend to the celebration', 'explain what the event will be like', 'suggest what your friend could bring or prepare'],
    note: 'Write at least 120 words.',
    model: [
      'Hi Daniel,',
      'Great news — my grandmother is turning eighty next month, and the whole family is throwing a proper celebration for her. I’d really love you to come; she still talks about the day you tried to eat plov with chopsticks!',
      'It’s going to be on Saturday the 15th, in our courtyard. Expect the full programme: about forty relatives, far too much food, live music from my uncle’s dutar, and dancing until the neighbours give up complaining. Grandma has asked for one thing only — that everyone brings a story about her instead of a present.',
      'So here’s an idea: could you prepare a short toast in English? She’d be so proud to have a guest from abroad say a few words — I’ll translate, don’t worry. And if you could bring some photos from your visit two years ago, that would make her evening.',
      'Let me know if you can make it, and I’ll pick you up from the station myself.',
      'Best,',
      'Timur',
    ],
    why: [
      'All three bullets covered naturally: the invitation, a lively picture of the event, and two concrete suggestions.',
      'The tone matches the relationship — warm, playful details ("until the neighbours give up complaining").',
      'Practical information a real invitation needs: date, place, what to expect, how to respond.',
      'Closes with a clear call to action instead of trailing off.',
    ],
  },
]

const WRITING_TASK_2: Sample[] = [
  {
    id: 'w2-discussion',
    kind: 'writing',
    badge: 'Task 2 · Discussion essay',
    title: 'Discuss both views: early language learning',
    chips: [CHIP.essay, CHIP.model],
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
      'One central idea per paragraph, each developed with an example or reason.',
      'Cohesion without formula spam: "Moreover", "On the other hand", "For this reason" appear where they belong.',
    ],
  },
  {
    id: 'w2-opinion',
    kind: 'writing',
    badge: 'Task 2 · Opinion essay',
    title: 'Agree or disagree: homework should be abolished',
    chips: [CHIP.essay, CHIP.model],
    task: [
      'Some people say that schools should stop giving homework because it causes stress and takes time away from family and rest.',
      'To what extent do you agree or disagree?',
    ],
    note: 'Write at least 250 words. You have about 40 minutes.',
    model: [
      'Homework has become one of the most argued-about parts of school life, and some now demand that it be abolished altogether. Although I accept that badly designed homework causes real harm, I disagree with a complete ban: the problem is the quality and quantity of homework, not its existence.',
      'The critics have a point worth taking seriously. In many schools, children copy exercises late into the night, sacrificing sleep, sport and family dinners for work that a teacher may never even mark. Stress of this kind teaches nothing except how to dislike learning. If that were what homework necessarily meant, banning it would be right.',
      'However, homework does something that no lesson can: it shows students how to learn without a teacher in the room. Reading a chapter alone, planning a short project, or practising ten minutes of vocabulary builds the independence that both universities and employers later expect. There is also a practical argument — a forty-minute lesson is simply too short to fix new knowledge in memory, and a small amount of practice at home multiplies its value.',
      'The sensible answer, then, is reform rather than abolition. Homework should be short, purposeful and varied — thirty focused minutes, not three exhausting hours — and schools should treat it as practice, not punishment. If homework is designed this way, it stops being the enemy of childhood and becomes what it was always meant to be: a bridge between one lesson and the next. For these reasons, I believe schools should fix homework, not abolish it.',
    ],
    why: [
      'Takes a clear, nuanced position ("fix it, don’t ban it") and states it in the introduction AND the conclusion.',
      'Deals with the opposite view honestly instead of ignoring it — then answers it.',
      'Concrete, everyday examples (sleep, family dinners, ten minutes of vocabulary) rather than vague claims.',
      'Strong final paragraph: proposes a solution and ends on a memorable image ("a bridge between one lesson and the next").',
    ],
  },
  {
    id: 'w2-problem',
    kind: 'writing',
    badge: 'Task 2 · Problem & solution',
    title: 'Problem and solution: traffic in big cities',
    chips: [CHIP.essay, CHIP.model],
    task: [
      'In many big cities, traffic congestion is becoming worse every year.',
      'What problems does heavy traffic cause, and what measures could governments take to solve them?',
    ],
    note: 'Write at least 250 words. You have about 40 minutes.',
    model: [
      'Anyone who has spent an hour crossing a city at what should be a ten-minute drive knows that congestion is more than an inconvenience. As car ownership grows faster than roads can be built, heavy traffic has become one of the defining problems of modern urban life. This essay examines its main costs and the measures governments can realistically take.',
      'The damage falls into three areas. Economically, congestion wastes enormous amounts of working time and makes deliveries slow and unpredictable, which raises prices for everyone. Environmentally, cars idling in jams burn fuel while going nowhere, filling city air with fumes that children breathe on their way to school. Perhaps most seriously, congestion damages health in quieter ways too: commuters arrive home later, angrier and more exhausted, with less time for family and exercise.',
      'Governments are not powerless against any of this. The most effective measure is also the least popular: making driving expensive where alternatives exist, through congestion charges of the kind London and Singapore use, and investing the money directly into public transport. Reliable buses with dedicated lanes, affordable metro systems and safe cycle paths give people a genuine reason to leave the car at home. Cities can also spread the rush hour itself, by encouraging employers to stagger working hours or allow remote work.',
      'None of these measures works alone; a congestion charge without good buses simply punishes the poor. But taken together, they attack the real cause of the problem — that driving is often the only reasonable choice. When cities give their citizens better choices, the traffic thins by itself.',
    ],
    why: [
      'Answers BOTH questions in the task — problems AND measures — with a paragraph clearly dedicated to each.',
      'Groups the problems (economy, environment, health) instead of listing them randomly.',
      'Solutions are specific and real (congestion charging, bus lanes, staggered hours), not "governments should do something".',
      'The conclusion adds insight — solutions must work together — rather than repeating the introduction.',
    ],
  },
]

const SPEAKING: Sample[] = [
  {
    id: 's1-interview',
    kind: 'speaking',
    badge: 'Part 1 · Interview',
    title: 'Personal questions',
    chips: [CHIP.speaking, CHIP.model],
    task: [
      'The examiner asks short questions about you and your everyday life. Answer naturally — two or three sentences each, not one word and not a speech.',
    ],
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
    id: 's2-picture',
    kind: 'speaking',
    badge: 'Part 2 · Picture description',
    title: 'Comparing two photographs',
    chips: [CHIP.speaking, CHIP.model],
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
      'Speculates with appropriate language — "I suppose", "they might be", "probably".',
      'Covers BOTH parts of the task: the comparison and the reasons people choose each way.',
      'Finishes with a personal note and a memorable line instead of stopping mid-air.',
    ],
  },
  {
    id: 's3-topic',
    kind: 'speaking',
    badge: 'Part 3 · Topic talk',
    title: 'A two-minute monologue',
    chips: [CHIP.speaking, CHIP.model],
    task: [
      'Talk about the role of technology in education. You may consider: advantages for students, possible dangers, and how schools should respond.',
    ],
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
      'Signposting keeps the listener oriented: "The clearest advantage…", "At the same time…", "In short…".',
      'Ends with a conclusion, not a fade-out.',
    ],
  },
]

const TABS: { key: TabKey; label: string; samples: Sample[] }[] = [
  { key: 'writing1', label: 'Writing Task 1', samples: WRITING_TASK_1 },
  { key: 'writing2', label: 'Writing Task 2', samples: WRITING_TASK_2 },
  { key: 'speaking', label: 'Speaking', samples: SPEAKING },
]

export function SamplesPage() {
  const [tab, setTab] = useState<TabKey>('writing1')
  const [openId, setOpenId] = useState<string | null>(null)

  const samples = TABS.find((t) => t.key === tab)!.samples
  const open = samples.find((s) => s.id === openId) ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Samples</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Model answers for the two skills we don’t test yet. Study how a strong response is
          built — the Writing and Speaking mock tests are coming soon.
        </p>
      </div>

      {/* Category tabs — Writing Task 1 / Writing Task 2 / Speaking */}
      <div className="max-w-full overflow-x-auto">
        <nav
          className="inline-flex whitespace-nowrap rounded-xl border border-line bg-white p-1"
          aria-label="Sample categories"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key)
                setOpenId(null)
              }}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                tab === t.key ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {open ? (
        <SampleDetail sample={open} onBack={() => setOpenId(null)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {samples.map((sample) => (
            <SampleGridCard key={sample.id} sample={sample} onOpen={() => setOpenId(sample.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- The lesson-style card grid ----------------------------------------------

function SampleGridCard({ sample, onOpen }: { sample: Sample; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-left shadow-card transition-shadow motion-safe:hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* accent top bar, like the reference lesson cards */}
      <div className="h-1.5 w-full shrink-0 bg-accent" aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            {sample.kind === 'writing' ? (
              <PenIcon width={20} height={20} />
            ) : (
              <MicIcon width={20} height={20} />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
              {sample.badge}
            </p>
            <h2 className="mt-0.5 font-extrabold leading-snug text-heading">{sample.title}</h2>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {sample.chips.map((chip) => (
            <span
              key={chip.label}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${chip.className}`}
            >
              {chip.label}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-end border-t border-line pt-3.5">
          <span className="flex items-center gap-1.5 text-sm font-bold text-brand group-hover:underline">
            View sample
            <ArrowRightIcon width={16} height={16} />
          </span>
        </div>
      </div>
    </button>
  )
}

// ---- One sample opened -------------------------------------------------------

function SampleDetail({ sample, onBack }: { sample: Sample; onBack: () => void }) {
  const speakingModel = sample.kind === 'speaking'
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
      >
        <ArrowRightIcon width={16} height={16} className="rotate-180" />
        All samples
      </button>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
            {sample.badge}
          </span>
          <h2 className="text-lg font-extrabold text-heading">{sample.title}</h2>
        </div>

        <div className="mt-4 rounded-xl border border-brand/20 bg-brand-soft/50 p-4">
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">The task</h4>
          <div className="mt-1.5 space-y-1.5 text-sm font-semibold text-ink">
            {sample.task.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {sample.bullets && (
              <ul className="list-disc space-y-0.5 pl-5 font-medium">
                {sample.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-xs font-semibold text-ink-soft">{sample.note}</p>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-extrabold text-heading">
            {speakingModel ? 'Model response' : 'Model answer'}
          </h4>
          <div className="mt-2 space-y-3 rounded-xl bg-page p-4">
            {speakingModel
              ? (sample.model as { speaker: string; text: string }[]).map((turn, i) => (
                  <div key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="w-20 shrink-0 pt-px text-right text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
                      {turn.speaker}
                    </span>
                    <p className="min-w-0 flex-1 text-ink">{turn.text}</p>
                  </div>
                ))
              : (sample.model as string[]).map((paragraph, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink">
                    {paragraph}
                  </p>
                ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h4 className="text-sm font-extrabold text-emerald-800">Why this scores well</h4>
          <ul className="mt-2 space-y-1.5 text-sm text-emerald-800">
            {sample.why.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="shrink-0 font-bold">
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

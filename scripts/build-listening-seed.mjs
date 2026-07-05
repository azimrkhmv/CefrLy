// Builds the seeded Listening test (schema v2) as JSON + a dollar-quoted SQL
// insert. ORIGINAL content — six parts, exact counts 8/6/4/5/6/6 = 35.
//
//   node scripts/build-listening-seed.mjs [per_part|single]
//
// Writes:
//   supabase/seed/listening-test-1.json   (authoring record)
//   supabase/seed/listening-seed.sql      (tests + test_content insert)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_MODE = process.argv[2] === 'single' ? 'single' : 'per_part'
const SLUG = 'listening-mock-1'
const TEST_ID = '00000000-0000-4000-8000-000000000101'
const DIR = 'listening-mock-1' // storage folder under the audio bucket

const ex = (location, quote, reasoning) => ({ location, quote, reasoning })
const opt = (key, label) => ({ key, label })

// audio assets: real files replace these later via the admin UI / owner upload.
const partAudio = (n) =>
  AUDIO_MODE === 'per_part'
    ? { audio: { assetPath: `${DIR}/part${n}.wav`, playLimit: 2, previewSec: 20 } }
    : {}

// ── Part 1 — mcq_response (Q1–8): hear an utterance, choose the best reply ──
const p1utterances = [
  {
    say: "I'm really sorry, but I think I've lost the book you lent me.",
    options: [
      opt('A', "Don't worry, it happens. I've got another copy."),
      opt('B', "Yes, I'd love to borrow it."),
      opt('C', 'The library closes at six.'),
    ],
    answer: 'A',
    why: 'A reassuring reply to an apology about a lost book.',
  },
  {
    say: 'Shall we take the bus, or would you rather walk to the station?',
    options: [
      opt('A', 'It leaves at half past nine.'),
      opt('B', "Let's walk — it's a lovely evening."),
      opt('C', "No, I haven't been there before."),
    ],
    answer: 'B',
    why: 'The question offers a choice; B chooses walking.',
  },
  {
    say: 'Excuse me, do you know if this train stops at Kingsbridge?',
    options: [
      opt('A', 'I bought a return ticket.'),
      opt('B', 'The platform is over there.'),
      opt('C', "I'm afraid it doesn't — you'll need the next one."),
    ],
    answer: 'C',
    why: 'A direct answer to a yes/no question about the train stopping.',
  },
  {
    say: 'You look exhausted. Have you been working late again?',
    options: [
      opt('A', 'Yes, we had a deadline to meet.'),
      opt('B', 'No, the office is quite close.'),
      opt('C', "I'll take a coffee, thanks."),
    ],
    answer: 'A',
    why: 'A answers the yes/no question and gives a reason.',
  },
  {
    say: 'Would you mind turning the music down a little?',
    options: [
      opt('A', "It's my favourite song too."),
      opt('B', "Of course — sorry, I didn't realise it was so loud."),
      opt('C', 'The speakers are new.'),
    ],
    answer: 'B',
    why: 'A polite request; B agrees and apologises.',
  },
  {
    say: "I can't decide whether to order the soup or the salad.",
    options: [
      opt('A', 'The waiter is coming now.'),
      opt('B', 'I paid by card.'),
      opt('C', "Why not have both? They're small portions."),
    ],
    answer: 'C',
    why: 'C responds helpfully to the indecision.',
  },
  {
    say: 'Did you manage to fix the printer in the end?',
    options: [
      opt('A', "No, I've called someone to come and look at it."),
      opt('B', "Yes, I'd like ten copies."),
      opt('C', "It's on the second floor."),
    ],
    answer: 'A',
    why: 'A answers whether the printer was fixed.',
  },
  {
    say: "I'm thinking of joining the drama club this term.",
    options: [
      opt('A', 'The tickets sold out quickly.'),
      opt('B', 'That sounds like fun — I might come along too.'),
      opt('C', 'It rained all weekend.'),
    ],
    answer: 'B',
    why: 'B reacts naturally to the speaker’s plan.',
  },
]
const part1 = {
  id: 'lp1',
  number: 1,
  layout: 'mcq_response',
  instructions:
    'You will hear eight short recordings. For each one, choose the best reply (A, B or C). You will hear each recording twice.',
  ...partAudio(1),
  transcript: p1utterances.map((u, i) => `${i + 1}. ${u.say}`).join('\n'),
  items: p1utterances.map((u, i) => ({
    id: `q${i + 1}`,
    number: i + 1,
    type: 'mcq',
    points: 1,
    options: u.options,
    answer: u.answer,
    explanation: ex(`Part 1, recording ${i + 1}`, u.say, u.why),
  })),
}

// ── Part 2 — form_completion (Q9–14): fill a booking form ──
const part2 = {
  id: 'lp2',
  number: 2,
  layout: 'form_completion',
  instructions:
    'You will hear a telephone conversation about booking an evening class. Complete the form. Write ONE word or a number in each gap. You will hear the recording twice.',
  ...partAudio(2),
  transcript:
    'RECEPTIONIST: Riverside Evening Classes, good morning.\n' +
    'CALLER: Hello, I’d like to book a place on one of your courses. The pottery class, if there are still spaces.\n' +
    'RECEPTIONIST: Pottery — yes, there’s room. That one runs on Thursday evenings.\n' +
    'CALLER: Thursday, great. And what time does it start?\n' +
    'RECEPTIONIST: It starts at six thirty and runs for two hours.\n' +
    'CALLER: And how many weeks is the course?\n' +
    'RECEPTIONIST: It’s eight weeks in total. The cost is twelve pounds per session, paid at the door.\n' +
    'CALLER: Twelve pounds a session, fine. Do I need to bring anything?\n' +
    'RECEPTIONIST: We provide the clay and tools, but please bring your own apron — it gets messy!',
  stem: {
    title: 'Riverside Evening Classes — Booking Form',
    html:
      '<p><strong>Course chosen:</strong> {{q9}}</p>' +
      '<p><strong>Runs on:</strong> {{q10}} evenings</p>' +
      '<p><strong>Start time:</strong> {{q11}}</p>' +
      '<p><strong>Length of course:</strong> {{q12}} weeks</p>' +
      '<p><strong>Cost per session:</strong> £{{q13}}</p>' +
      '<p><strong>Please bring your own:</strong> {{q14}}</p>',
  },
  items: [
    { id: 'q9', number: 9, answers: ['pottery'], loc: 'the caller asks for the pottery class', quote: 'The pottery class, if there are still spaces.' },
    { id: 'q10', number: 10, answers: ['Thursday'], loc: 'the day the class runs', quote: 'That one runs on Thursday evenings.' },
    { id: 'q11', number: 11, answers: ['6.30', '6:30', 'half past six', '18.30', '6.30pm'], loc: 'the start time', quote: 'It starts at six thirty and runs for two hours.' },
    { id: 'q12', number: 12, answers: ['eight', '8'], loc: 'the length of the course', quote: 'It’s eight weeks in total.' },
    { id: 'q13', number: 13, answers: ['twelve', '12'], loc: 'the cost per session', quote: 'The cost is twelve pounds per session.' },
    { id: 'q14', number: 14, answers: ['apron', 'an apron'], loc: 'what students must bring', quote: 'please bring your own apron' },
  ].map((g) => ({
    id: g.id,
    number: g.number,
    type: 'gap',
    points: 1,
    answer: g.answers,
    explanation: ex(`Part 2, gap ${g.number}`, g.quote, `The answer comes from where ${g.loc}.`),
  })),
}

// ── Part 3 — matching (Q15–18): match speakers to reasons ──
const part3pool = [
  opt('A', 'the friendly teacher'),
  opt('B', 'meeting new people'),
  opt('C', 'the low cost'),
  opt('D', 'learning a practical skill'),
  opt('E', 'the convenient location'),
  opt('F', 'growing in confidence'),
  opt('G', 'the flexible timetable'),
  opt('H', 'the well-equipped rooms'),
]
const part3speakers = [
  { n: 15, sp: 'Speaker 1', answer: 'D', line: 'I can actually fix a dripping tap myself now — that’s what I got out of it.', why: 'She values having learned a practical, usable skill.' },
  { n: 16, sp: 'Speaker 2', answer: 'B', line: 'Honestly, I signed up to get out of the house, and I’ve made some really good friends.', why: 'He emphasises the new friendships he made.' },
  { n: 17, sp: 'Speaker 3', answer: 'F', line: 'I used to hate speaking in front of others; now I don’t mind at all.', why: 'She describes becoming more confident.' },
  { n: 18, sp: 'Speaker 4', answer: 'G', line: 'What suited me was being able to swap between the morning and evening groups whenever work got busy.', why: 'He praises the flexible timetable.' },
]
const part3 = {
  id: 'lp3',
  number: 3,
  layout: 'matching',
  instructions:
    'You will hear four people talking about a course they took. Choose what each speaker liked most (A–H). There are more options than speakers. You will hear the recording twice.',
  ...partAudio(3),
  optionPool: part3pool,
  transcript: part3speakers.map((s) => `${s.sp}: ${s.line}`).join('\n'),
  items: part3speakers.map((s) => ({
    id: `q${s.n}`,
    number: s.n,
    type: 'match',
    points: 1,
    prompt: s.sp,
    answer: s.answer,
    explanation: ex(`Part 3, ${s.sp}`, s.line, s.why),
  })),
}

// ── Part 4 — map_labelling (Q19–23): label 5 places on the plan ──
const part4pool = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((k) => opt(k, k))
const part4places = [
  { n: 19, place: 'The computer room', answer: 'A', line: 'Come in through the main entrance and walk up the corridor; turn left at the top and the computer room is right in the far corner on your left.', why: 'Far left corner of the top row = marker A.' },
  { n: 20, place: 'The main hall', answer: 'B', line: 'Right next to the computer room, still along the top, you’ll find the main hall.', why: 'Second room along the top = marker B.' },
  { n: 21, place: 'The library', answer: 'C', line: 'Keep going past the main hall and the library is the third room along the top.', why: 'Third room along the top = marker C.' },
  { n: 22, place: 'The café', answer: 'E', line: 'Downstairs — I mean on the lower row — the café is in the far left corner, directly below the computer room.', why: 'Far left of the bottom row = marker E.' },
  { n: 23, place: 'The staff room', answer: 'G', line: 'The staff room is on the lower row too, the third one along, just below the library.', why: 'Third room along the bottom = marker G.' },
]
const part4 = {
  id: 'lp4',
  number: 4,
  layout: 'map_labelling',
  instructions:
    'You will hear a guide describing a college floor plan. Label the places on the map. Choose the correct letter (A–H) for each place. You will hear the recording twice.',
  ...partAudio(4),
  image: { assetPath: 'listening-mock-1/map-plan-1.svg', alt: 'Ground floor plan of Greenfield Community College with eight lettered locations A to H, in two rows of four rooms either side of a central corridor, with the entrance at the bottom.' },
  optionPool: part4pool,
  transcript:
    'Welcome to Greenfield Community College. Let me point out where a few things are on this ground-floor plan. ' +
    part4places.map((p) => p.line).join(' '),
  items: part4places.map((p) => ({
    id: `q${p.n}`,
    number: p.n,
    type: 'match',
    points: 1,
    prompt: p.place,
    answer: p.answer,
    explanation: ex(`Part 4, ${p.place}`, p.line, p.why),
  })),
}

// ── Part 5 — multi_extract_mcq (Q24–29): three extracts, 2 MCQs each ──
const part5groups = [
  {
    id: 'g1',
    context: 'You will hear two students, Mark and Lucy, discussing their history project.',
    transcript:
      'MARK: So, are we agreed on the topic? I still think the Industrial Revolution is too broad.\n' +
      'LUCY: I know, but I really don’t want to do the Roman one — we can’t seem to agree, can we?\n' +
      'MARK: No. Look, rather than going round in circles, why don’t we just ask Dr Evans what she thinks in tomorrow’s tutorial?\n' +
      'LUCY: Good idea. Let’s get her advice first, then decide.',
    items: [
      {
        n: 24,
        prompt: 'What problem do Mark and Lucy have?',
        options: [opt('A', 'They cannot find enough sources.'), opt('B', 'They disagree about the topic.'), opt('C', 'They are running out of time.')],
        answer: 'B',
        quote: 'we can’t seem to agree, can we?',
        why: 'They can’t agree on which topic to choose.',
      },
      {
        n: 25,
        prompt: 'What do they decide to do next?',
        options: [opt('A', 'Ask their tutor for advice.'), opt('B', 'Divide the work between them.'), opt('C', 'Change to an easier subject.')],
        answer: 'A',
        quote: 'why don’t we just ask Dr Evans what she thinks',
        why: 'They decide to get their tutor’s advice first.',
      },
    ],
  },
  {
    id: 'g2',
    context: 'You will hear a tutor giving a student feedback on a presentation.',
    transcript:
      'TUTOR: Overall, well done. The best thing was how clearly it was organised — I could follow your argument from start to finish without getting lost. ' +
      'One thing, though: you rushed. If you slow down a little next time, the audience will take in far more of your excellent points.',
    items: [
      {
        n: 26,
        prompt: 'What does the tutor praise?',
        options: [opt('A', 'The clear structure.'), opt('B', 'The choice of images.'), opt('C', 'The length.')],
        answer: 'A',
        quote: 'The best thing was how clearly it was organised',
        why: 'The tutor praises the clear organisation/structure.',
      },
      {
        n: 27,
        prompt: 'What does the tutor suggest improving?',
        options: [opt('A', 'Speaking more slowly.'), opt('B', 'Including more data.'), opt('C', 'Making more eye contact.')],
        answer: 'A',
        quote: 'you rushed. If you slow down a little next time',
        why: 'The tutor advises slowing down.',
      },
    ],
  },
  {
    id: 'g3',
    context: 'You will hear a woman talking about a cycling holiday.',
    transcript:
      'WOMAN: People asked why I didn’t just drive. But that’s the point — on a bike you go slowly enough to really take in the countryside, the villages, everything. ' +
      'It wasn’t always easy, mind you. The rain held off, and I always found a bed for the night, but those hills — some days I thought my legs would give up completely!',
    items: [
      {
        n: 28,
        prompt: 'Why did the woman choose cycling?',
        options: [opt('A', 'It was cheaper than other options.'), opt('B', 'She wanted to see the countryside slowly.'), opt('C', 'A friend recommended it.')],
        answer: 'B',
        quote: 'on a bike you go slowly enough to really take in the countryside',
        why: 'She chose cycling to experience the countryside slowly.',
      },
      {
        n: 29,
        prompt: 'What was the biggest challenge?',
        options: [opt('A', 'The weather.'), opt('B', 'The hills.'), opt('C', 'Finding places to stay.')],
        answer: 'B',
        quote: 'those hills — some days I thought my legs would give up',
        why: 'The rain held off and she found beds, but the hills were hard.',
      },
    ],
  },
]
const part5 = {
  id: 'lp5',
  number: 5,
  layout: 'multi_extract_mcq',
  instructions:
    'You will hear three short extracts. For each extract, answer the two questions by choosing A, B or C. You will hear each extract twice.',
  ...partAudio(5),
  transcript: part5groups.map((g) => `[${g.context}]\n${g.transcript}`).join('\n\n'),
  groups: part5groups.map((g) => ({
    id: g.id,
    context: g.context,
    items: g.items.map((it) => ({
      id: `q${it.n}`,
      number: it.n,
      type: 'mcq',
      points: 1,
      prompt: it.prompt,
      options: it.options,
      answer: it.answer,
      explanation: ex(`Part 5, question ${it.n}`, it.quote, it.why),
    })),
  })),
}

// ── Part 6 — note_completion (Q30–35): complete talk notes ──
const part6 = {
  id: 'lp6',
  number: 6,
  layout: 'note_completion',
  instructions:
    'You will hear part of a talk about the history of chocolate. Complete the notes. Write ONE word in each gap. You will hear the talk twice.',
  ...partAudio(6),
  transcript:
    'Today I want to tell you a little about where chocolate comes from. It all begins with the cacao tree, which first grew wild in the rainforests of Central and South America. ' +
    'The ancient Maya prized the beans so highly that they actually used them as money — you really could buy things with a handful of cacao beans. ' +
    'For a very long time, though, nobody ate chocolate; it was only ever taken as a bitter drink. ' +
    'It was Spanish explorers who brought it back to Europe in the sixteenth century. ' +
    'Europeans didn’t much like the bitterness, so they added sugar to make the drink sweet, and it quickly became fashionable. ' +
    'And the chocolate we know best? The very first solid chocolate bar wasn’t produced until the 1840s.',
  stem: {
    title: 'Talk: A Short History of Chocolate',
    html:
      '<p>The cacao tree first grew in the rainforests of Central and South {{q30}}.</p>' +
      '<p>The ancient Maya valued the beans so highly that they used them as {{q31}}.</p>' +
      '<p>For centuries, chocolate was only ever taken as a bitter {{q32}}.</p>' +
      '<p>Spanish explorers brought it to {{q33}} in the sixteenth century.</p>' +
      '<p>Europeans added sugar to make the drink {{q34}}.</p>' +
      '<p>The first solid chocolate {{q35}} was produced in the 1840s.</p>',
  },
  items: [
    { id: 'q30', number: 30, answers: ['America'], loc: 'where the cacao tree first grew', quote: 'first grew wild in the rainforests of Central and South America' },
    { id: 'q31', number: 31, answers: ['money', 'currency'], loc: 'what the Maya used the beans as', quote: 'they actually used them as money' },
    { id: 'q32', number: 32, answers: ['drink', 'beverage'], loc: 'how chocolate was taken', quote: 'it was only ever taken as a bitter drink' },
    { id: 'q33', number: 33, answers: ['Europe'], loc: 'where explorers brought it', quote: 'brought it back to Europe in the sixteenth century' },
    { id: 'q34', number: 34, answers: ['sweet', 'sweeter'], loc: 'what sugar made the drink', quote: 'they added sugar to make the drink sweet' },
    { id: 'q35', number: 35, answers: ['bar', 'bars'], loc: 'the first solid chocolate item', quote: 'The very first solid chocolate bar wasn’t produced until the 1840s' },
  ].map((g) => ({
    id: g.id,
    number: g.number,
    type: 'gap',
    points: 1,
    answer: g.answers,
    explanation: ex(`Part 6, gap ${g.number}`, g.quote, `The answer comes from where the talk mentions ${g.loc}.`),
  })),
}

const content = {
  id: SLUG,
  slug: SLUG,
  skill: 'listening',
  title: 'CEFR Listening Mock Test 1',
  targetLevels: ['B1', 'B2', 'C1'],
  durationSec: 2400,
  audioMode: AUDIO_MODE,
  ...(AUDIO_MODE === 'single'
    ? { singleAudio: { assetPath: `${DIR}/full.wav`, playLimit: 2, previewSec: 30 } }
    : {}),
  parts: [part1, part2, part3, part4, part5, part6],
}

writeFileSync(join(root, 'supabase/seed/listening-test-1.json'), JSON.stringify(content, null, 2))

// dollar-quoted SQL insert (draft, skill=listening)
const jsonForSql = JSON.stringify(content)
const sql = `-- Seeded Listening test (generated by scripts/build-listening-seed.mjs, mode=${AUDIO_MODE}).
insert into public.tests (id, slug, skill, title, target_levels, duration_sec, status)
values ('${TEST_ID}', '${SLUG}', 'listening', '${content.title}', '{B1,B2,C1}', ${content.durationSec}, 'draft')
on conflict (id) do update set slug=excluded.slug, skill=excluded.skill, title=excluded.title,
  target_levels=excluded.target_levels, duration_sec=excluded.duration_sec;

insert into public.test_content (test_id, content, updated_at)
values ('${TEST_ID}', $seed$${jsonForSql}$seed$::jsonb, now())
on conflict (test_id) do update set content=excluded.content, updated_at=now();
`
writeFileSync(join(root, 'supabase/seed/listening-seed.sql'), sql)

const count = content.parts.reduce((s, p) => s + (p.items?.length ?? 0) + (p.groups?.reduce((a, g) => a + g.items.length, 0) ?? 0), 0)
console.log(`built listening seed (mode=${AUDIO_MODE}): ${count} questions across ${content.parts.length} parts`)

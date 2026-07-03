-- Generated from reading-test-1.json by scripts/generate-seed.mjs. Do not edit by hand.
-- Run this in the Supabase SQL editor (or via supabase db execute) AFTER the migrations.

insert into public.tests (id, slug, title, skill, target_levels, duration_sec, status)
values ('00000000-0000-4000-8000-000000000001', 'reading-mock-1', 'CEFR Reading Mock Test 1', 'reading', '{B1,B2,C1}', 3600, 'published')
on conflict (id) do update
  set slug = excluded.slug,
      title = excluded.title,
      target_levels = excluded.target_levels,
      duration_sec = excluded.duration_sec,
      status = 'published';

insert into public.test_content (test_id, content)
values ('00000000-0000-4000-8000-000000000001', $seed${
  "id": "00000000-0000-4000-8000-000000000001",
  "slug": "reading-mock-1",
  "skill": "reading",
  "title": "CEFR Reading Mock Test 1",
  "targetLevels": [
    "B1",
    "B2",
    "C1"
  ],
  "durationSec": 3600,
  "parts": [
    {
      "id": "part1",
      "number": 1,
      "layout": "cloze_from_text",
      "instructions": "Read the text below and complete gaps 1–6. Write ONE word in each gap.",
      "passage": {
        "title": "A Drink That Changed the World",
        "html": "<p>Tea is one of the most popular drinks in the world. According to legend, it was discovered in China almost five thousand years {{r1q1}}, when leaves from a wild tree fell into a pot of water that a servant was boiling for the emperor. The emperor tasted the golden liquid and found it delicious.</p><p>At first, tea was valued as a medicine rather {{r1q2}} an everyday drink, and for centuries it was prepared only in temples and palaces. It took a long time before drinking tea {{r1q3}} a social activity enjoyed by ordinary families.</p><p>Tea reached Europe in the seventeenth century, {{r1q4}} it quickly became fashionable among the rich. Because fresh leaves lost their flavour on the long sea voyage, merchants began to dry and press them, {{r1q5}} allowed the tea to arrive in good condition.</p><p>Today more than two billion cups of tea are drunk every day, and the drink's popularity shows no sign {{r1q6}} slowing down.</p>"
      },
      "items": [
        {
          "id": "r1q1",
          "type": "gap",
          "points": 1,
          "answer": [
            "ago"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 1",
            "quote": "it was discovered in China almost five thousand years ago",
            "reasoning": "To place an event a period of time before now, English uses 'ago' after the time expression."
          }
        },
        {
          "id": "r1q2",
          "type": "gap",
          "points": 1,
          "answer": [
            "than"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 2",
            "quote": "tea was valued as a medicine rather than an everyday drink",
            "reasoning": "'Rather than' is a fixed expression used to contrast two alternatives."
          }
        },
        {
          "id": "r1q3",
          "type": "gap",
          "points": 1,
          "answer": [
            "became"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 2",
            "quote": "before drinking tea became a social activity",
            "reasoning": "A past-simple verb is needed; 'became' fits the meaning of a change of state."
          }
        },
        {
          "id": "r1q4",
          "type": "gap",
          "points": 1,
          "answer": [
            "where"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 3",
            "quote": "Tea reached Europe in the seventeenth century, where it quickly became fashionable",
            "reasoning": "The relative adverb 'where' refers back to the place, Europe."
          }
        },
        {
          "id": "r1q5",
          "type": "gap",
          "points": 1,
          "answer": [
            "which"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 3",
            "quote": "merchants began to dry and press them, which allowed the tea to arrive in good condition",
            "reasoning": "'Which' introduces a relative clause referring to the whole previous action."
          }
        },
        {
          "id": "r1q6",
          "type": "gap",
          "points": 1,
          "answer": [
            "of"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 4",
            "quote": "shows no sign of slowing down",
            "reasoning": "The pattern is 'show no sign of + -ing form'."
          }
        }
      ]
    },
    {
      "id": "part2",
      "number": 2,
      "layout": "match_texts",
      "instructions": "Read what eight people say about learning English (questions 7–14). Match each person to the correct statement (A–J). There are TWO extra statements which you do not need to use.",
      "optionPool": [
        {
          "key": "A",
          "label": "This person learns new expressions from watching films."
        },
        {
          "key": "B",
          "label": "This person believes grammar matters more than vocabulary."
        },
        {
          "key": "C",
          "label": "This person practises speaking with someone in another country."
        },
        {
          "key": "D",
          "label": "This person improved by reading books that were difficult at first."
        },
        {
          "key": "E",
          "label": "This person uses music to remember new words."
        },
        {
          "key": "F",
          "label": "This person gave up studying because of work."
        },
        {
          "key": "G",
          "label": "This person studies before starting the working day."
        },
        {
          "key": "H",
          "label": "This person passed an exam without taking any courses."
        },
        {
          "key": "I",
          "label": "This person writes regularly in English."
        },
        {
          "key": "J",
          "label": "This person thinks short daily practice works better than long, rare sessions."
        }
      ],
      "items": [
        {
          "id": "r2q7",
          "type": "match",
          "points": 1,
          "prompt": "Aziz: I hardly ever open a textbook. Instead, I watch films in English with the subtitles on, and whenever I hear a phrase I like, I pause the film and copy it into a notebook.",
          "answer": "A",
          "explanation": {
            "location": "Text 7 (Aziz)",
            "quote": "I watch films in English... whenever I hear a phrase I like, I pause the film and copy it into a notebook",
            "reasoning": "Aziz picks up new expressions directly from films, which matches statement A."
          }
        },
        {
          "id": "r2q8",
          "type": "match",
          "points": 1,
          "prompt": "Malika: I remember the words of every song I love. Singing along to English music taught me more vocabulary than any lesson ever did — the melody makes the words stick.",
          "answer": "E",
          "explanation": {
            "location": "Text 8 (Malika)",
            "quote": "Singing along to English music taught me more vocabulary than any lesson ever did",
            "reasoning": "Malika memorises words through songs, which matches statement E about using music."
          }
        },
        {
          "id": "r2q9",
          "type": "match",
          "points": 1,
          "prompt": "Bobur: Twice a week I have a video call with Emma, a retired teacher from Canada. We just chat about our lives. Talking to someone on the other side of the world keeps me motivated.",
          "answer": "C",
          "explanation": {
            "location": "Text 9 (Bobur)",
            "quote": "Twice a week I have a video call with Emma, a retired teacher from Canada",
            "reasoning": "Bobur regularly speaks with a partner abroad, matching statement C."
          }
        },
        {
          "id": "r2q10",
          "type": "match",
          "points": 1,
          "prompt": "Nilufar: Every night before bed I write a few sentences in English about my day. My grammar is not perfect, but after a year of daily entries I can express almost anything.",
          "answer": "I",
          "explanation": {
            "location": "Text 10 (Nilufar)",
            "quote": "Every night before bed I write a few sentences in English about my day",
            "reasoning": "Nilufar keeps a daily written diary in English, matching statement I about writing regularly."
          }
        },
        {
          "id": "r2q11",
          "type": "match",
          "points": 1,
          "prompt": "Jasur: I could not afford lessons, so I prepared for the B2 exam completely on my own with free videos and past papers. When the results came, even my family was surprised — I had passed.",
          "answer": "H",
          "explanation": {
            "location": "Text 11 (Jasur)",
            "quote": "I prepared for the B2 exam completely on my own... I had passed",
            "reasoning": "Jasur passed an exam with self-study only and no courses, matching statement H."
          }
        },
        {
          "id": "r2q12",
          "type": "match",
          "points": 1,
          "prompt": "Dilnoza: People think you need hours of free time, but fifteen focused minutes every single day did more for my English than the two-hour Sunday marathons I used to force myself through.",
          "answer": "J",
          "explanation": {
            "location": "Text 12 (Dilnoza)",
            "quote": "fifteen focused minutes every single day did more for my English than the two-hour Sunday marathons",
            "reasoning": "Dilnoza contrasts short daily sessions with long weekly ones, matching statement J."
          }
        },
        {
          "id": "r2q13",
          "type": "match",
          "points": 1,
          "prompt": "Sardor: My first English novel took me two months, and I understood maybe half of it. I kept going, book after book, and now I read without touching a dictionary.",
          "answer": "D",
          "explanation": {
            "location": "Text 13 (Sardor)",
            "quote": "My first English novel took me two months, and I understood maybe half of it. I kept going",
            "reasoning": "Sardor improved by persisting with books that were initially too hard, matching statement D."
          }
        },
        {
          "id": "r2q14",
          "type": "match",
          "points": 1,
          "prompt": "Kamola: The house is silent at five in the morning. That is my hour: coffee, grammar and vocabulary before anyone else wakes up. By the time I leave for the office, my studying is already done.",
          "answer": "G",
          "explanation": {
            "location": "Text 14 (Kamola)",
            "quote": "By the time I leave for the office, my studying is already done",
            "reasoning": "Kamola studies early in the morning before work, matching statement G."
          }
        }
      ]
    },
    {
      "id": "part3",
      "number": 3,
      "layout": "match_headings",
      "instructions": "Read the text about growing food in cities. Choose the best heading (A–H) for each paragraph (I–VI). There are TWO extra headings which you do not need to use.",
      "optionPool": [
        {
          "key": "A",
          "label": "Food that travels less"
        },
        {
          "key": "B",
          "label": "A hobby that brings people together"
        },
        {
          "key": "C",
          "label": "The problem of limited space"
        },
        {
          "key": "D",
          "label": "Farming without soil"
        },
        {
          "key": "E",
          "label": "Cooling the concrete jungle"
        },
        {
          "key": "F",
          "label": "Not always cheaper than the shop"
        },
        {
          "key": "G",
          "label": "Schools joining the movement"
        },
        {
          "key": "H",
          "label": "From rooftops to old factories"
        }
      ],
      "passage": {
        "title": "Growing Food in the City",
        "paragraphs": [
          {
            "label": "I",
            "html": "<p>In cities around the world, food is being grown in unexpected places. Lettuce sprouts on supermarket rooftops in Paris; tomatoes ripen in a disused underground station in London; and in Detroit, abandoned car factories have been converted into indoor farms. What began as a small experiment has become a familiar part of the urban landscape.</p>"
          },
          {
            "label": "II",
            "html": "<p>Many of these farms do not use soil at all. Instead, plants grow with their roots suspended in water enriched with nutrients, a technique known as hydroponics. Because light, temperature and feeding are controlled precisely, crops can be produced all year round using up to ninety per cent less water than traditional agriculture.</p>"
          },
          {
            "label": "III",
            "html": "<p>Supporters point out that a salad grown two streets away from the restaurant that serves it has travelled a few hundred metres, not a few thousand kilometres. Shorter journeys mean fresher food and fewer lorries on the road, which reduces both transport costs and emissions.</p>"
          },
          {
            "label": "IV",
            "html": "<p>Urban farms are also social places. Community gardens give neighbours who might otherwise never meet a reason to work side by side, sharing tools, seeds and advice. Several studies have found that people involved in such projects report feeling more connected to their local area.</p>"
          },
          {
            "label": "V",
            "html": "<p>There are benefits for the buildings themselves, too. A layer of plants on a roof absorbs sunlight that would otherwise heat the concrete below, keeping the building cooler in summer and reducing the need for air conditioning across whole districts.</p>"
          },
          {
            "label": "VI",
            "html": "<p>Nevertheless, urban farming is not a magic solution. Powerful lamps, heating and pumps consume electricity, and city rents are high. As a result, urban produce can end up more expensive than vegetables trucked in from the countryside, and some projects struggle to survive without support from local government.</p>"
          }
        ]
      },
      "items": [
        {
          "id": "r3q15",
          "type": "match",
          "points": 1,
          "prompt": "Paragraph I",
          "answer": "H",
          "explanation": {
            "location": "Paragraph I",
            "quote": "Lettuce sprouts on supermarket rooftops... abandoned car factories have been converted into indoor farms",
            "reasoning": "The paragraph lists the unusual places where urban farms appear — rooftops, stations and old factories — so heading H fits best."
          }
        },
        {
          "id": "r3q16",
          "type": "match",
          "points": 1,
          "prompt": "Paragraph II",
          "answer": "D",
          "explanation": {
            "location": "Paragraph II",
            "quote": "plants grow with their roots suspended in water enriched with nutrients, a technique known as hydroponics",
            "reasoning": "The paragraph is about growing crops without soil (hydroponics), so heading D fits."
          }
        },
        {
          "id": "r3q17",
          "type": "match",
          "points": 1,
          "prompt": "Paragraph III",
          "answer": "A",
          "explanation": {
            "location": "Paragraph III",
            "quote": "a salad grown two streets away... has travelled a few hundred metres, not a few thousand kilometres",
            "reasoning": "The paragraph focuses on shorter food journeys, matching heading A."
          }
        },
        {
          "id": "r3q18",
          "type": "match",
          "points": 1,
          "prompt": "Paragraph IV",
          "answer": "B",
          "explanation": {
            "location": "Paragraph IV",
            "quote": "Community gardens give neighbours who might otherwise never meet a reason to work side by side",
            "reasoning": "The paragraph describes the social, community-building side of urban farming, matching heading B."
          }
        },
        {
          "id": "r3q19",
          "type": "match",
          "points": 1,
          "prompt": "Paragraph V",
          "answer": "E",
          "explanation": {
            "location": "Paragraph V",
            "quote": "keeping the building cooler in summer and reducing the need for air conditioning",
            "reasoning": "The paragraph explains how green roofs cool hot city buildings, matching heading E."
          }
        },
        {
          "id": "r3q20",
          "type": "match",
          "points": 1,
          "prompt": "Paragraph VI",
          "answer": "F",
          "explanation": {
            "location": "Paragraph VI",
            "quote": "urban produce can end up more expensive than vegetables trucked in from the countryside",
            "reasoning": "The paragraph is about the high costs of urban farming compared with ordinary shop produce, matching heading F."
          }
        }
      ]
    },
    {
      "id": "part4",
      "number": 4,
      "layout": "passage_questions",
      "instructions": "Read the text and answer questions 21–29. For questions 21–25, choose the correct answer (A–D). For questions 26–29, decide whether the statement is True, False or Not Given.",
      "passage": {
        "title": "The Sea That Came Back",
        "html": "<p>In the middle of the twentieth century, the Aral Sea, which lies on the border between Kazakhstan and Uzbekistan, was the fourth-largest inland body of water on Earth. Its waters supported a thriving fishing industry that provided tens of thousands of jobs and, at its height, around one sixth of all the fish caught in the Soviet Union. Ports such as Muynak in the south and Aralsk in the north were busy, prosperous towns.</p><p>The sea's decline began in the 1960s, when Soviet planners diverted the two great rivers that fed it, the Amu Darya and the Syr Darya, into a vast network of irrigation canals. Their goal was to water the desert and turn Central Asia into a leading producer of cotton — 'white gold'. The plan succeeded for cotton, but at a terrible price. Starved of fresh water, the Aral Sea began to shrink, and by the 1990s it had lost more than half its area and most of its volume. As the water retreated, it also grew saltier, until the native fish species could no longer survive.</p><p>The consequences for local people were severe. Muynak, once a lively port, found itself more than a hundred kilometres from the shore, its stranded ships rusting in the sand. Winds picked up salt, dust and traces of agricultural chemicals from the exposed seabed and carried them across villages and farmland; doctors in the region recorded rising levels of breathing problems and other illnesses. Without the moderating influence of the huge lake, summers became hotter, winters colder, and the growing season shorter.</p><p>For decades the story of the Aral seemed to be one of unavoidable loss. Then, in 2005, Kazakhstan completed the Kokaral dam, a twelve-kilometre barrier separating the small northern part of the sea from the larger southern basins, with the project partly financed by the World Bank. The effect surprised even the engineers: the water level in the North Aral rose by more than three metres in months rather than the years predicted, and its saltiness fell steadily.</p><p>Fish returned with remarkable speed. Species such as carp, bream and pike-perch, reintroduced from rivers and hatcheries, multiplied in the fresher water, and fishing villages that had been abandoned came slowly back to life. Aralsk's fish-processing plants reopened, and some scientists believe the region may one day attract visitors curious to see a landscape recovering from disaster.</p><p>Nobody, however, pretends that the whole sea can be saved. Most experts agree that the vast southern section, largely in Uzbekistan, has passed the point of full recovery, and attention there has turned to reducing the damage: millions of drought-resistant saxaul trees are being planted on the dried seabed to anchor the sand and soften the dust storms. The Aral's story is therefore two stories at once — in the north, a rare piece of environmental good news; in the south, a lesson in what happens when nature's limits are ignored.</p>"
      },
      "items": [
        {
          "id": "r4q21",
          "type": "mcq",
          "points": 1,
          "prompt": "According to the first paragraph, in the middle of the twentieth century the Aral Sea…",
          "options": [
            {
              "key": "A",
              "label": "was already becoming smaller."
            },
            {
              "key": "B",
              "label": "supported a large fishing industry."
            },
            {
              "key": "C",
              "label": "was the largest lake in the world."
            },
            {
              "key": "D",
              "label": "had only recently been discovered."
            }
          ],
          "answer": "B",
          "explanation": {
            "location": "Paragraph 1",
            "quote": "Its waters supported a thriving fishing industry that provided tens of thousands of jobs",
            "reasoning": "The paragraph describes a healthy, prosperous fishing economy. It was the fourth-largest lake, not the largest, and the decline had not yet begun."
          }
        },
        {
          "id": "r4q22",
          "type": "mcq",
          "points": 1,
          "prompt": "What was the main cause of the sea's decline?",
          "options": [
            {
              "key": "A",
              "label": "A long period of unusually hot weather."
            },
            {
              "key": "B",
              "label": "The diversion of the rivers that fed it."
            },
            {
              "key": "C",
              "label": "Overfishing by local fleets."
            },
            {
              "key": "D",
              "label": "The construction of the Kokaral dam."
            }
          ],
          "answer": "B",
          "explanation": {
            "location": "Paragraph 2",
            "quote": "Soviet planners diverted the two great rivers that fed it... Starved of fresh water, the Aral Sea began to shrink",
            "reasoning": "The rivers were redirected into irrigation canals for cotton, cutting off the sea's water supply. The Kokaral dam came much later and helped the northern part recover."
          }
        },
        {
          "id": "r4q23",
          "type": "mcq",
          "points": 1,
          "prompt": "The writer mentions Muynak in the third paragraph in order to…",
          "options": [
            {
              "key": "A",
              "label": "show how far the water had retreated."
            },
            {
              "key": "B",
              "label": "give an example of a successful modern port."
            },
            {
              "key": "C",
              "label": "explain how old ships were repaired."
            },
            {
              "key": "D",
              "label": "describe a popular new tourist attraction."
            }
          ],
          "answer": "A",
          "explanation": {
            "location": "Paragraph 3",
            "quote": "Muynak, once a lively port, found itself more than a hundred kilometres from the shore",
            "reasoning": "Muynak illustrates the scale of the disaster: a port town left a hundred kilometres from the water."
          }
        },
        {
          "id": "r4q24",
          "type": "mcq",
          "points": 1,
          "prompt": "What surprised the engineers after the Kokaral dam was finished?",
          "options": [
            {
              "key": "A",
              "label": "How much the project finally cost."
            },
            {
              "key": "B",
              "label": "How quickly the water level rose."
            },
            {
              "key": "C",
              "label": "How salty the northern sea became."
            },
            {
              "key": "D",
              "label": "How few fish returned to the area."
            }
          ],
          "answer": "B",
          "explanation": {
            "location": "Paragraph 4",
            "quote": "the water level in the North Aral rose by more than three metres in months rather than the years predicted",
            "reasoning": "The recovery was far faster than forecast — months instead of years — which surprised even the engineers."
          }
        },
        {
          "id": "r4q25",
          "type": "mcq",
          "points": 1,
          "prompt": "In the final paragraph, the writer suggests that the southern part of the sea…",
          "options": [
            {
              "key": "A",
              "label": "will be fully restored within a few decades."
            },
            {
              "key": "B",
              "label": "is unlikely ever to recover completely."
            },
            {
              "key": "C",
              "label": "no longer suffers from dust storms."
            },
            {
              "key": "D",
              "label": "should be separated by another dam."
            }
          ],
          "answer": "B",
          "explanation": {
            "location": "Paragraph 6",
            "quote": "Most experts agree that the vast southern section... has passed the point of full recovery",
            "reasoning": "The text says work in the south now aims to reduce the damage, not to restore the sea, because full recovery is no longer considered possible."
          }
        },
        {
          "id": "r4q26",
          "type": "tfng",
          "points": 1,
          "prompt": "Dust from the dried seabed has damaged people's health.",
          "thirdOptionLabel": "Not Given",
          "answer": "true",
          "explanation": {
            "location": "Paragraph 3",
            "quote": "doctors in the region recorded rising levels of breathing problems and other illnesses",
            "reasoning": "The text directly links dust, salt and chemicals from the exposed seabed to rising illness, so the statement is True."
          }
        },
        {
          "id": "r4q27",
          "type": "tfng",
          "points": 1,
          "prompt": "The Kokaral dam was paid for entirely with Kazakh money.",
          "thirdOptionLabel": "Not Given",
          "answer": "false",
          "explanation": {
            "location": "Paragraph 4",
            "quote": "with the project partly financed by the World Bank",
            "reasoning": "The text says the World Bank partly financed the dam, so it was not paid for entirely by Kazakhstan — the statement is False."
          }
        },
        {
          "id": "r4q28",
          "type": "tfng",
          "points": 1,
          "prompt": "Tourism is now the main source of income in Aralsk.",
          "thirdOptionLabel": "Not Given",
          "answer": "not_given",
          "explanation": {
            "location": "Paragraph 5",
            "quote": "some scientists believe the region may one day attract visitors",
            "reasoning": "The text only says tourism might develop in the future; it says nothing about tourism being a source of income now, so the statement is Not Given."
          }
        },
        {
          "id": "r4q29",
          "type": "tfng",
          "points": 1,
          "prompt": "Native fish species died out as the sea became saltier.",
          "thirdOptionLabel": "Not Given",
          "answer": "true",
          "explanation": {
            "location": "Paragraph 2",
            "quote": "it also grew saltier, until the native fish species could no longer survive",
            "reasoning": "The text states that rising salinity killed the native fish, so the statement is True."
          }
        }
      ]
    },
    {
      "id": "part5",
      "number": 5,
      "layout": "passage_questions",
      "instructions": "Read the text and answer questions 30–35. For questions 30–33, complete the summary at the end of the text with ONE word from the text. For questions 34–35, choose the correct answer (A–D).",
      "passage": {
        "title": "Why Sleep Helps Us Remember",
        "html": "<p>For much of the twentieth century, scientists regarded sleep as a passive state — a period in which the brain simply switched off to rest. Research over the past three decades has overturned this view. Sleep is now understood to play an active role in memory consolidation, the process by which fragile new memories are stabilised and stored.</p><p>The key work happens during slow-wave sleep, the deepest stage of the night. Recordings of brain activity show that the hippocampus, a structure essential for forming new memories, replays the patterns of activity it produced during the day, as though rehearsing them. Through this repeated replay, information is gradually transferred to the neocortex, where it can be stored for the long term. In a classic experiment, students who memorised a list of word pairs and then slept for eight hours recalled far more of them than students who stayed awake — a difference that remained even after the sleepless group was allowed to recover.</p><p>Rapid eye movement (REM) sleep appears to make a different contribution, strengthening emotional memories and supporting the kind of flexible thinking that allows the mind to connect ideas in new ways. Volunteers woken during REM sleep perform unusually well on creative problems, which may help to explain the old advice to 'sleep on' a difficult decision.</p><p>The costs of missing sleep run in the other direction. After a night of deprivation, the hippocampus records new information far less effectively, and attention and concentration decline sharply. For students, the practical conclusion is clear, if unwelcome: staying up late to revise is usually self-defeating, because an extra hour of sleep may do more for tomorrow's exam than an extra hour of study.</p><h4>Summary — complete the gaps</h4><p>Scientists no longer see sleep as a {{r5q30}} state. During slow-wave sleep, the hippocampus {{r5q31}} the day's patterns of activity, gradually moving information to the neocortex for long-term storage. In one experiment, students who slept after memorising word pairs remembered more than those who {{r5q32}} awake. Because a tired brain records information poorly, researchers advise that an extra hour of {{r5q33}} may help an exam result more than an extra hour of study.</p>"
      },
      "items": [
        {
          "id": "r5q30",
          "type": "gap",
          "points": 1,
          "answer": [
            "passive"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 1",
            "quote": "scientists regarded sleep as a passive state",
            "reasoning": "The old view described in the text is that sleep was 'passive'; the summary says this view has been abandoned."
          }
        },
        {
          "id": "r5q31",
          "type": "gap",
          "points": 1,
          "answer": [
            "replays"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 2",
            "quote": "the hippocampus... replays the patterns of activity it produced during the day",
            "reasoning": "The verb used in the text for what the hippocampus does with the day's activity is 'replays'."
          }
        },
        {
          "id": "r5q32",
          "type": "gap",
          "points": 1,
          "answer": [
            "stayed"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 2",
            "quote": "recalled far more of them than students who stayed awake",
            "reasoning": "The text contrasts the group that slept with the group that 'stayed awake'."
          }
        },
        {
          "id": "r5q33",
          "type": "gap",
          "points": 1,
          "answer": [
            "sleep"
          ],
          "caseSensitive": false,
          "explanation": {
            "location": "Paragraph 4",
            "quote": "an extra hour of sleep may do more for tomorrow's exam than an extra hour of study",
            "reasoning": "The final sentence weighs an extra hour of 'sleep' against an extra hour of study."
          }
        },
        {
          "id": "r5q34",
          "type": "mcq",
          "points": 1,
          "prompt": "What is the main purpose of the text?",
          "options": [
            {
              "key": "A",
              "label": "To explain how sleep supports learning and memory."
            },
            {
              "key": "B",
              "label": "To compare sleeping habits in different countries."
            },
            {
              "key": "C",
              "label": "To describe medical treatments for sleep problems."
            },
            {
              "key": "D",
              "label": "To argue that dreams can predict future events."
            }
          ],
          "answer": "A",
          "explanation": {
            "location": "Whole text",
            "quote": "Sleep is now understood to play an active role in memory consolidation",
            "reasoning": "Every paragraph develops the link between sleep and memory or learning; the other topics are never discussed."
          }
        },
        {
          "id": "r5q35",
          "type": "mcq",
          "points": 1,
          "prompt": "According to the text, what should students do the night before an exam?",
          "options": [
            {
              "key": "A",
              "label": "Revise as late as possible."
            },
            {
              "key": "B",
              "label": "Choose extra sleep over extra late-night revision."
            },
            {
              "key": "C",
              "label": "Wake themselves during REM sleep to think creatively."
            },
            {
              "key": "D",
              "label": "Memorise word pairs just before going to bed."
            }
          ],
          "answer": "B",
          "explanation": {
            "location": "Paragraph 4",
            "quote": "staying up late to revise is usually self-defeating, because an extra hour of sleep may do more for tomorrow's exam",
            "reasoning": "The text concludes that sleep benefits exam performance more than late-night study."
          }
        }
      ]
    }
  ]
}$seed$::jsonb)
on conflict (test_id) do update
  set content = excluded.content,
      updated_at = now();

// GENERATED — do not hand-edit. See the preview note in WritingAnalyzePage.
//
// Sample marked papers, used ONLY by /writing/analyze/preview so the report
// screen can be reviewed without a deployed grader. The numbers here are NOT
// typed by hand: this file is the output of running the real scoring code
// (supabase/functions/grade-writing/scoring.ts) over sample papers and sample
// examiner judgements, so what the preview shows is what the grader computes.
//
//   /writing/analyze/preview          a full paper, 3 tasks
//   /writing/analyze/preview?case=short   an essay handed in half-finished
//                                         (the underlength cap in action)
//   /writing/analyze/preview?case=drill   one task only (the estimate banner)
//
// DEV ONLY — remove this file and its route before launch, like /cat-preview.
import type { WritingAttemptRow } from '../types/writingResult'

export const WRITING_PREVIEWS: Record<string, WritingAttemptRow> = {
  "full": {
    "id": "preview",
    "test_id": "writing-mock-1",
    "test_title": "CEFR Writing Mock 1",
    "scope": "full",
    "task_type": null,
    "status": "done",
    "error_message": null,
    "raw_score": 30.22,
    "rating": 67,
    "band": "C1",
    "answers": [
      {
        "taskId": "writing-mock-1-t1",
        "taskType": "task_1_1",
        "taskLabel": "Task 1.1",
        "text": "Hi Alex,\n\nHow are you? I have a great news for you. The new library is open in our town since last week and I was there yesterday. It is very big and modern building near the park.\n\nWhat I liked most is the reading room on second floor, it is very quiet and they have many english books. Do you want to come with me on Saturday? We can read together and after drink coffee.\n\nWrite me soon!\n\nBest wishes,\nAziz",
        "targetWords": 50
      },
      {
        "taskId": "writing-mock-1-t2",
        "taskType": "task_1_2",
        "taskLabel": "Task 1.2",
        "text": "Dear Ms Karimova,\n\nI am writing to you about the new public library which was opened recently in our town. My name is Aziz Rakhimov and I am a student of the local university, and I visit the library almost every day.\n\nFirstly, I would like to suggest that the library could open a study zone for students where we can work in groups. At the moment there is only quiet reading room, so students who want to discuss a project must to go to a cafe instead. Secondly, it would be very useful if the library organised free English speaking clubs at the weekend, because many young people in our town do not have opportunity to practise with other people.\n\nI believe these two services would help the community a lot. Students would have a proper place for study, and young people would improve their language skills without paying expensive courses.\n\nThank you for your attention. I look forward to hearing from you.\n\nYours sincerely,\nAziz Rakhimov",
        "targetWords": 150
      },
      {
        "taskId": "writing-mock-1-t3",
        "taskType": "part_2",
        "taskLabel": "Task 2",
        "text": "In recent years many people claim that physical libraries are waste of public money because everything can be found on the internet. Although I understand this opinion, I strongly disagree with it, and in this post I will explain my reasons.\n\nFirst of all, a library is not only a place where books are stored. It is a public space where people can study in silence, which is something that a lot of students simply do not have at home. In my city, for example, many families live in small flats where three or four people share one room, so the reading room of our library is often the only quiet place available to them.\n\nSecondly, not everybody has equal access to the internet. Older people frequently lack the digital skills to find reliable information online, and libraries offer free computers and staff who can help them. If we closed these buildings, we would increase the gap between those who can afford technology and those who cannot.\n\nHowever, I agree that libraries must change. They should invest to digital resources and offer online courses, instead of keeping thousands of books that nobody reads.\n\nIn conclusion, libraries are not a waste of money but a public service which supports education and equality. Rather than closing them, governments should modernise them.",
        "targetWords": 200
      }
    ],
    "result": {
      "tasks": [
        {
          "taskId": "writing-mock-1-t1",
          "taskType": "task_1_1",
          "taskLabel": "Task 1.1",
          "band": 6,
          "criteria": {
            "task_achievement": 7,
            "grammar": 5,
            "vocabulary": 6,
            "coherence": 7
          },
          "inferredCriteria": [],
          "points": 2.6666666666666665,
          "weight": 4,
          "wordCount": 82,
          "targetWords": 50,
          "bandBeforeCap": 6,
          "underlengthCapped": false,
          "zeroMark": null,
          "evidence": "All three content points are there and the tone is properly informal (\"How are you?\", \"Write me soon!\"). The grammar sits at B1: \"a great news\" and \"is open ... since last week\" are basic countability and tense faults, and \"after drink coffee\" is not a formed clause. Vocabulary is adequate but plain.",
          "comment": "You covered everything the task asked for and the friendly tone is exactly right. What is holding this back is accuracy in simple structures — the tense you use for something that started in the past and is still true, and articles before uncountable nouns.",
          "contentPoints": [
            {
              "point": "Tell Alex the library has opened",
              "covered": true
            },
            {
              "point": "Describe what you liked most about it",
              "covered": true
            },
            {
              "point": "Invite Alex to visit it with you",
              "covered": true
            }
          ],
          "strengths": [
            {
              "quote": "Do you want to come with me on Saturday?",
              "why": "A natural, correctly formed invitation — exactly the register this task wants."
            }
          ],
          "corrections": [
            {
              "quote": "I have a great news for you",
              "type": "grammar",
              "suggestion": "I have great news for you",
              "note": "\"news\" is uncountable, so it takes no article",
              "start": 23,
              "end": 50
            },
            {
              "quote": "is open in our town since last week",
              "type": "grammar",
              "suggestion": "has been open in our town since last week",
              "note": "\"since\" needs the present perfect",
              "start": 68,
              "end": 103
            },
            {
              "quote": "very big and modern building",
              "type": "grammar",
              "suggestion": "a very big and modern building",
              "start": 137,
              "end": 165
            },
            {
              "quote": "on second floor",
              "type": "grammar",
              "suggestion": "on the second floor",
              "start": 220,
              "end": 235
            },
            {
              "quote": "many english books",
              "type": "spelling",
              "suggestion": "many English books",
              "note": "languages take a capital letter",
              "start": 268,
              "end": 286
            },
            {
              "quote": "and after drink coffee",
              "type": "grammar",
              "suggestion": "and afterwards have a coffee",
              "start": 350,
              "end": 372
            }
          ],
          "improved": "Hi Alex,\n\nHow are you? I have great news for you. The new library in our town has been open since last week and I went there yesterday. It is a big, modern building right next to the park.\n\nWhat I liked most was the reading room on the second floor — it is wonderfully quiet and they have a huge English section. Do you want to come with me on Saturday? We could read for a while and then go for a coffee afterwards.\n\nWrite back soon!\n\nBest wishes,\nAziz"
        },
        {
          "taskId": "writing-mock-1-t2",
          "taskType": "task_1_2",
          "taskLabel": "Task 1.2",
          "band": 7,
          "criteria": {
            "task_achievement": 8,
            "grammar": 6,
            "vocabulary": 7,
            "coherence": 8
          },
          "inferredCriteria": [],
          "points": 6.222222222222222,
          "weight": 8,
          "wordCount": 168,
          "targetWords": 150,
          "bandBeforeCap": 7,
          "underlengthCapped": false,
          "zeroMark": null,
          "evidence": "The formal register is sustained throughout (\"I am writing to you about\", \"Yours sincerely\") and both suggestions are developed with a reason. Complex structures are attempted and mostly land (\"it would be very useful if the library organised\"), but \"must to go\" and \"do not have opportunity\" are the kind of slips that keep grammar below 7.",
          "comment": "This is a genuinely well-organised formal email — the two suggestions are clearly separated and each one is justified. Tighten the article use and the modal verbs and this moves up a band.",
          "contentPoints": [
            {
              "point": "Introduce yourself and say why you are writing",
              "covered": true
            },
            {
              "point": "Suggest two services for students",
              "covered": true
            },
            {
              "point": "Explain how these would help the community",
              "covered": true
            }
          ],
          "strengths": [
            {
              "quote": "it would be very useful if the library organised free English speaking clubs",
              "why": "A correctly formed conditional — this is the kind of structure that lifts a formal email."
            },
            {
              "quote": "Students would have a proper place for study, and young people would improve their language skills",
              "why": "You answered the \"how would it help\" part explicitly instead of leaving it implied."
            }
          ],
          "corrections": [
            {
              "quote": "there is only quiet reading room",
              "type": "grammar",
              "suggestion": "there is only a quiet reading room",
              "start": 349,
              "end": 381
            },
            {
              "quote": "must to go to a cafe",
              "type": "grammar",
              "suggestion": "have to go to a café",
              "note": "modal verbs are never followed by \"to\"",
              "start": 425,
              "end": 445
            },
            {
              "quote": "do not have opportunity to practise",
              "type": "grammar",
              "suggestion": "do not have the opportunity to practise",
              "start": 596,
              "end": 631
            },
            {
              "quote": "a proper place for study",
              "type": "vocabulary",
              "suggestion": "a proper place to study",
              "start": 733,
              "end": 757
            },
            {
              "quote": "without paying expensive courses",
              "type": "vocabulary",
              "suggestion": "without paying for expensive courses",
              "start": 812,
              "end": 844
            }
          ],
          "improved": "Dear Ms Karimova,\n\nI am writing regarding the new public library which opened in our town recently. My name is Aziz Rakhimov; I am a student at the local university and I visit the library almost daily.\n\nFirstly, I would like to suggest that the library open a study zone where students can work in groups. At present there is only a quiet reading room, so anyone who needs to discuss a project has to go to a café instead. Secondly, it would be extremely useful if the library organised free English speaking clubs at weekends, as many young people here have no opportunity to practise with others.\n\nI believe both services would benefit the community considerably. Students would gain a proper place to study, and young people could improve their language skills without paying for expensive courses.\n\nThank you for your attention. I look forward to hearing from you.\n\nYours sincerely,\nAziz Rakhimov"
        },
        {
          "taskId": "writing-mock-1-t3",
          "taskType": "part_2",
          "taskLabel": "Task 2",
          "band": 8,
          "criteria": {
            "task_achievement": 8,
            "grammar": 7,
            "vocabulary": 7,
            "coherence": 9
          },
          "inferredCriteria": [],
          "points": 21.333333333333332,
          "weight": 24,
          "wordCount": 219,
          "targetWords": 200,
          "bandBeforeCap": 8,
          "underlengthCapped": false,
          "zeroMark": null,
          "evidence": "A clear position is stated in the first paragraph and sustained to the conclusion, and the concession paragraph (\"However, I agree that libraries must change\") shows real argumentative control. The examples are specific rather than generic — the detail about families sharing one room is what pushes task achievement to 8. Grammar is B2: complex sentences are handled, with occasional slips like \"waste of public money\" and \"invest to\".",
          "comment": "This is a strong, properly shaped argument — position, two developed reasons, a concession, and a conclusion that follows. The remaining marks are in accuracy: watch articles before singular countable nouns and the prepositions that follow verbs.",
          "contentPoints": [
            {
              "point": "State whether you agree or disagree",
              "covered": true
            },
            {
              "point": "Give reasons for your view",
              "covered": true
            },
            {
              "point": "Support your view with examples",
              "covered": true
            }
          ],
          "strengths": [
            {
              "quote": "we would increase the gap between those who can afford technology and those who cannot",
              "why": "A precise, well-balanced sentence — exactly the register an argumentative post wants."
            },
            {
              "quote": "However, I agree that libraries must change.",
              "why": "Conceding a point and then answering it is what separates a C1 argument from a list of opinions."
            }
          ],
          "corrections": [
            {
              "quote": "physical libraries are waste of public money",
              "type": "grammar",
              "suggestion": "physical libraries are a waste of public money",
              "start": 39,
              "end": 83
            },
            {
              "quote": "Older people frequently lack the digital skills",
              "type": "vocabulary",
              "suggestion": "Older people often lack the digital skills",
              "note": "\"frequently\" is slightly off for a permanent state",
              "start": 682,
              "end": 729
            },
            {
              "quote": "They should invest to digital resources",
              "type": "grammar",
              "suggestion": "They should invest in digital resources",
              "note": "\"invest\" takes \"in\"",
              "start": 995,
              "end": 1034
            }
          ],
          "improved": "In recent years many people have claimed that physical libraries are a waste of public money, since everything can now be found online. While I understand the argument, I strongly disagree with it, and I will explain why.\n\nFirst of all, a library is far more than a place where books are stored. It is a public space in which people can study in silence — something a great many students simply do not have at home. In my city, for instance, whole families live in small flats where three or four people share a single room, so the reading room of our library is often the only quiet space available to them.\n\nSecondly, access to the internet is not equal. Older people often lack the digital skills to find reliable information online, and libraries provide free computers along with staff who can help. Closing these buildings would only widen the gap between those who can afford technology and those who cannot.\n\nThat said, I do accept that libraries must change. They should invest in digital resources and offer online courses rather than storing thousands of volumes nobody reads.\n\nIn conclusion, libraries are not a waste of money but a public service that underpins education and equality. Governments should modernise them, not close them."
        }
      ],
      "raw36": 30.22,
      "maxRaw": 36,
      "rating": 67,
      "band": "C1",
      "estimate": false,
      "summary": "You write like a solid B2 candidate with a genuinely strong sense of structure — the essay in particular is properly shaped, with a real concession paragraph rather than a list of opinions. What separates you from the next band is accuracy in the small things rather than ambition: articles before nouns, the preposition a verb takes, and the tense that goes with \"since\". Those cost you marks on every task, and they are the most fixable thing in this paper.",
      "fixFirst": "Spend a week on articles (a / the / no article) — they are behind more of the corrections in this paper than any other single fault.",
      "model": "preview"
    },
    "created_at": "2026-09-09T18:43:48.210Z",
    "graded_at": "2026-09-09T18:43:48.210Z"
  },
  "short": {
    "id": "preview",
    "test_id": "writing-mock-1",
    "test_title": "Task 2 · handed in half-finished",
    "scope": "part",
    "task_type": "part_2",
    "status": "done",
    "error_message": null,
    "raw_score": 13.33,
    "rating": 49,
    "band": null,
    "answers": [
      {
        "taskId": "writing-mock-1-t3",
        "taskType": "part_2",
        "taskLabel": "Task 2",
        "text": "In recent years many people claim that physical libraries are waste of public money because everything can be found on the internet. Although I understand this opinion, I strongly disagree with it, and in this post I will explain my reasons.\n\nFirst of all, a library is not only a place where books are stored. It is a public space where people can study in silence, which is something that a lot of students simply do not have at home. In my city, for example, many families live in small flats where three or four people share one room, so the reading room of our library is often the only quiet place available to them.",
        "targetWords": 200
      }
    ],
    "result": {
      "tasks": [
        {
          "taskId": "writing-mock-1-t3",
          "taskType": "part_2",
          "taskLabel": "Task 2",
          "band": 5,
          "criteria": {
            "task_achievement": 8,
            "grammar": 7,
            "vocabulary": 7,
            "coherence": 9
          },
          "inferredCriteria": [],
          "points": 13.333333333333334,
          "weight": 24,
          "wordCount": 115,
          "targetWords": 200,
          "bandBeforeCap": 8,
          "underlengthCapped": true,
          "zeroMark": null,
          "evidence": "A clear position is stated in the first paragraph and sustained to the conclusion, and the concession paragraph (\"However, I agree that libraries must change\") shows real argumentative control. The examples are specific rather than generic — the detail about families sharing one room is what pushes task achievement to 8. Grammar is B2: complex sentences are handled, with occasional slips like \"waste of public money\" and \"invest to\".",
          "comment": "This is a strong, properly shaped argument — position, two developed reasons, a concession, and a conclusion that follows. The remaining marks are in accuracy: watch articles before singular countable nouns and the prepositions that follow verbs.",
          "contentPoints": [
            {
              "point": "State whether you agree or disagree",
              "covered": true
            },
            {
              "point": "Give reasons for your view",
              "covered": true
            },
            {
              "point": "Support your view with examples",
              "covered": true
            }
          ],
          "strengths": [
            {
              "quote": "we would increase the gap between those who can afford technology and those who cannot",
              "why": "A precise, well-balanced sentence — exactly the register an argumentative post wants."
            },
            {
              "quote": "However, I agree that libraries must change.",
              "why": "Conceding a point and then answering it is what separates a C1 argument from a list of opinions."
            }
          ],
          "corrections": [
            {
              "quote": "physical libraries are waste of public money",
              "type": "grammar",
              "suggestion": "physical libraries are a waste of public money",
              "start": 39,
              "end": 83
            }
          ],
          "improved": "In recent years many people have claimed that physical libraries are a waste of public money, since everything can now be found online. While I understand the argument, I strongly disagree with it, and I will explain why.\n\nFirst of all, a library is far more than a place where books are stored. It is a public space in which people can study in silence — something a great many students simply do not have at home. In my city, for instance, whole families live in small flats where three or four people share a single room, so the reading room of our library is often the only quiet space available to them.\n\nSecondly, access to the internet is not equal. Older people often lack the digital skills to find reliable information online, and libraries provide free computers along with staff who can help. Closing these buildings would only widen the gap between those who can afford technology and those who cannot.\n\nThat said, I do accept that libraries must change. They should invest in digital resources and offer online courses rather than storing thousands of volumes nobody reads.\n\nIn conclusion, libraries are not a waste of money but a public service that underpins education and equality. Governments should modernise them, not close them."
        }
      ],
      "raw36": 13.33,
      "maxRaw": 36,
      "rating": 49,
      "band": "B1",
      "estimate": true,
      "summary": "What is here is good — a clear position and a genuinely specific example. The problem is that it stops less than halfway through: an argument this short cannot show a second reason, a concession or a conclusion, and the official length rules cap the mark before quality is even weighed.",
      "fixFirst": "Finish the essay. Length is costing you more here than any language fault.",
      "model": "preview"
    },
    "created_at": "2026-09-09T18:43:48.210Z",
    "graded_at": "2026-09-09T18:43:48.210Z"
  },
  "drill": {
    "id": "preview",
    "test_id": "writing-mock-1",
    "test_title": "A suggestion to the library",
    "scope": "part",
    "task_type": "task_1_2",
    "status": "done",
    "error_message": null,
    "raw_score": 6.22,
    "rating": 64,
    "band": null,
    "answers": [
      {
        "taskId": "writing-mock-1-t2",
        "taskType": "task_1_2",
        "taskLabel": "Task 1.2",
        "text": "Dear Ms Karimova,\n\nI am writing to you about the new public library which was opened recently in our town. My name is Aziz Rakhimov and I am a student of the local university, and I visit the library almost every day.\n\nFirstly, I would like to suggest that the library could open a study zone for students where we can work in groups. At the moment there is only quiet reading room, so students who want to discuss a project must to go to a cafe instead. Secondly, it would be very useful if the library organised free English speaking clubs at the weekend, because many young people in our town do not have opportunity to practise with other people.\n\nI believe these two services would help the community a lot. Students would have a proper place for study, and young people would improve their language skills without paying expensive courses.\n\nThank you for your attention. I look forward to hearing from you.\n\nYours sincerely,\nAziz Rakhimov",
        "targetWords": 150
      }
    ],
    "result": {
      "tasks": [
        {
          "taskId": "writing-mock-1-t2",
          "taskType": "task_1_2",
          "taskLabel": "Task 1.2",
          "band": 7,
          "criteria": {
            "task_achievement": 8,
            "grammar": 6,
            "vocabulary": 7,
            "coherence": 8
          },
          "inferredCriteria": [],
          "points": 6.222222222222222,
          "weight": 8,
          "wordCount": 168,
          "targetWords": 150,
          "bandBeforeCap": 7,
          "underlengthCapped": false,
          "zeroMark": null,
          "evidence": "The formal register is sustained throughout (\"I am writing to you about\", \"Yours sincerely\") and both suggestions are developed with a reason. Complex structures are attempted and mostly land (\"it would be very useful if the library organised\"), but \"must to go\" and \"do not have opportunity\" are the kind of slips that keep grammar below 7.",
          "comment": "This is a genuinely well-organised formal email — the two suggestions are clearly separated and each one is justified. Tighten the article use and the modal verbs and this moves up a band.",
          "contentPoints": [
            {
              "point": "Introduce yourself and say why you are writing",
              "covered": true
            },
            {
              "point": "Suggest two services for students",
              "covered": true
            },
            {
              "point": "Explain how these would help the community",
              "covered": true
            }
          ],
          "strengths": [
            {
              "quote": "it would be very useful if the library organised free English speaking clubs",
              "why": "A correctly formed conditional — this is the kind of structure that lifts a formal email."
            },
            {
              "quote": "Students would have a proper place for study, and young people would improve their language skills",
              "why": "You answered the \"how would it help\" part explicitly instead of leaving it implied."
            }
          ],
          "corrections": [
            {
              "quote": "there is only quiet reading room",
              "type": "grammar",
              "suggestion": "there is only a quiet reading room",
              "start": 349,
              "end": 381
            },
            {
              "quote": "must to go to a cafe",
              "type": "grammar",
              "suggestion": "have to go to a café",
              "note": "modal verbs are never followed by \"to\"",
              "start": 425,
              "end": 445
            },
            {
              "quote": "do not have opportunity to practise",
              "type": "grammar",
              "suggestion": "do not have the opportunity to practise",
              "start": 596,
              "end": 631
            },
            {
              "quote": "a proper place for study",
              "type": "vocabulary",
              "suggestion": "a proper place to study",
              "start": 733,
              "end": 757
            },
            {
              "quote": "without paying expensive courses",
              "type": "vocabulary",
              "suggestion": "without paying for expensive courses",
              "start": 812,
              "end": 844
            }
          ],
          "improved": "Dear Ms Karimova,\n\nI am writing regarding the new public library which opened in our town recently. My name is Aziz Rakhimov; I am a student at the local university and I visit the library almost daily.\n\nFirstly, I would like to suggest that the library open a study zone where students can work in groups. At present there is only a quiet reading room, so anyone who needs to discuss a project has to go to a café instead. Secondly, it would be extremely useful if the library organised free English speaking clubs at weekends, as many young people here have no opportunity to practise with others.\n\nI believe both services would benefit the community considerably. Students would gain a proper place to study, and young people could improve their language skills without paying for expensive courses.\n\nThank you for your attention. I look forward to hearing from you.\n\nYours sincerely,\nAziz Rakhimov"
        }
      ],
      "raw36": 6.22,
      "maxRaw": 36,
      "rating": 64,
      "band": "B2",
      "estimate": true,
      "summary": "A well-organised formal email: both suggestions are separated clearly and each one is justified. Accuracy in articles and modal verbs is what stands between this and the next band.",
      "fixFirst": "Drill articles before singular countable nouns — \"only a quiet reading room\", \"the opportunity\".",
      "model": "preview"
    },
    "created_at": "2026-09-09T18:43:48.210Z",
    "graded_at": "2026-09-09T18:43:48.210Z"
  }
}

/* ICIRE — in-house labeled training set for the coach's intent classifier. This IS
 * the "training data": curated example phrasings per intent. It's plain code, so it
 * grows by adding real, anonymised phrasings over time — retrained on this system,
 * never sent anywhere. No external dataset, no LLM. */
import type { Intent } from "./coach"

export const TRAINING: { text: string; intent: Intent }[] = [
  // matches — "which roles fit me"
  { text: "which jobs are best for me", intent: "matches" },
  { text: "what roles should I apply to", intent: "matches" },
  { text: "point me somewhere I'd be a good hire", intent: "matches" },
  { text: "where would I fit as a candidate", intent: "matches" },
  { text: "show me roles that suit my skills", intent: "matches" },
  { text: "find me a job", intent: "matches" },
  { text: "any openings for someone like me", intent: "matches" },
  { text: "what positions match my profile", intent: "matches" },
  { text: "recommend roles I can get", intent: "matches" },

  // learn — "what should I study / upskill"
  { text: "what should I learn next", intent: "learn" },
  { text: "which skills should I pick up", intent: "learn" },
  { text: "how do I close my skill gap", intent: "learn" },
  { text: "what would make me more employable", intent: "learn" },
  { text: "highest leverage thing to study", intent: "learn" },
  { text: "what technology should I learn", intent: "learn" },
  { text: "help me upskill", intent: "learn" },

  // level — seniority / readiness
  { text: "am I ready for a senior role", intent: "level" },
  { text: "what level am I at", intent: "level" },
  { text: "am I experienced enough for a lead position", intent: "level" },
  { text: "do I qualify as mid level", intent: "level" },
  { text: "how senior am I", intent: "level" },
  { text: "am I ready to be promoted", intent: "level" },

  // resume
  { text: "how do I improve my resume", intent: "resume" },
  { text: "review my cv", intent: "resume" },
  { text: "will my resume pass ats", intent: "resume" },
  { text: "fix my resume bullets", intent: "resume" },
  { text: "make my cv stronger", intent: "resume" },

  // interview
  { text: "how do I prepare for an interview", intent: "interview" },
  { text: "give me mock interview questions", intent: "interview" },
  { text: "help me with interview prep", intent: "interview" },
  { text: "what will they ask in the interview", intent: "interview" },
  { text: "practice questions for my interview", intent: "interview" },

  // dna — strengths / who am I
  { text: "what are my strengths", intent: "dna" },
  { text: "what's my career dna", intent: "dna" },
  { text: "describe my profile", intent: "dna" },
  { text: "how good am I", intent: "dna" },
  { text: "what am I good at", intent: "dna" },
  { text: "who am I as a professional", intent: "dna" },
  { text: "what's my archetype", intent: "dna" },

  // path — progression / future
  { text: "what's my career path", intent: "path" },
  { text: "where can I go from here", intent: "path" },
  { text: "what's my next role", intent: "path" },
  { text: "how do I progress in my career", intent: "path" },
  { text: "what can I grow into", intent: "path" },
  { text: "future roles for me", intent: "path" },

  // progress — growth over time
  { text: "how am I progressing", intent: "progress" },
  { text: "show my growth over time", intent: "progress" },
  { text: "am I getting better", intent: "progress" },
  { text: "what's my momentum", intent: "progress" },
  { text: "my skill trend", intent: "progress" },

  // salary
  { text: "how much do these roles pay", intent: "salary" },
  { text: "what's the salary for me", intent: "salary" },
  { text: "what compensation can I expect", intent: "salary" },
  { text: "how much can I earn", intent: "salary" },
  { text: "what stipend do internships pay", intent: "salary" },

  // help — greetings / meta
  { text: "hi", intent: "help" },
  { text: "hello", intent: "help" },
  { text: "what can you do", intent: "help" },
  { text: "how does this work", intent: "help" },
  { text: "help", intent: "help" },
  { text: "show me the menu", intent: "help" },
]

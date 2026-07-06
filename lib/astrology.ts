// In-house astrology + numerology engine — deterministic, no third-party service.
// Career-oriented: framed for a professional platform (strengths, work style, ideal roles).

export type AstroSign = {
  name: string
  dates: string
  element: "Fire" | "Earth" | "Air" | "Water"
  modality: "Cardinal" | "Fixed" | "Mutable"
  rulingPlanet: string
  polarity: "Assertive" | "Receptive"
  keywords: string[]
  overview: string
  strengths: string[]
  growthAreas: string[]
  workStyle: string
  idealRoles: string[]
  bestMatches: string[]
  luckyDay: string
  luckyNumbers: number[]
}

// [name, startMonth, startDay, endMonth, endDay]
const RANGES: [string, number, number, number, number][] = [
  ["Capricorn", 12, 22, 1, 19], ["Aquarius", 1, 20, 2, 18], ["Pisces", 2, 19, 3, 20],
  ["Aries", 3, 21, 4, 19], ["Taurus", 4, 20, 5, 20], ["Gemini", 5, 21, 6, 20],
  ["Cancer", 6, 21, 7, 22], ["Leo", 7, 23, 8, 22], ["Virgo", 8, 23, 9, 22],
  ["Libra", 9, 23, 10, 22], ["Scorpio", 10, 23, 11, 21], ["Sagittarius", 11, 22, 12, 21],
]

export const SIGNS: Record<string, AstroSign> = {
  Aries: { name: "Aries", dates: "Mar 21 – Apr 19", element: "Fire", modality: "Cardinal", rulingPlanet: "Mars", polarity: "Assertive",
    keywords: ["driven", "pioneering", "decisive", "bold"],
    overview: "A natural initiator who thrives on new challenges and moves fast from idea to action. Aries energy is competitive, courageous and impatient with stagnation.",
    strengths: ["Takes decisive ownership", "Starts and ships quickly", "Leads from the front", "Unafraid of hard conversations"],
    growthAreas: ["Patience with slower processes", "Following through on the long tail", "Delegating instead of doing it all"],
    workStyle: "Best when given autonomy and a clear target to charge at. Motivated by momentum and being first.",
    idealRoles: ["Founder / intrapreneur", "Sales lead", "Operations firefighter", "Product launcher"],
    bestMatches: ["Leo", "Sagittarius", "Gemini", "Aquarius"], luckyDay: "Tuesday", luckyNumbers: [1, 9] },
  Taurus: { name: "Taurus", dates: "Apr 20 – May 20", element: "Earth", modality: "Fixed", rulingPlanet: "Venus", polarity: "Receptive",
    keywords: ["steady", "reliable", "patient", "grounded"],
    overview: "Dependable and results-driven, Taurus builds things that last. Values stability, quality and a calm, consistent pace over flash.",
    strengths: ["Exceptional follow-through", "Calm under pressure", "Builds durable systems", "Deeply trustworthy"],
    growthAreas: ["Openness to sudden change", "Letting go of sunk costs", "Faster decision-making"],
    workStyle: "Excels with clear scope and time to do things properly. Loyal to teams and processes that respect craft.",
    idealRoles: ["Finance / operations", "Backend engineering", "Quality & compliance", "Account management"],
    bestMatches: ["Virgo", "Capricorn", "Cancer", "Pisces"], luckyDay: "Friday", luckyNumbers: [2, 6] },
  Gemini: { name: "Gemini", dates: "May 21 – Jun 20", element: "Air", modality: "Mutable", rulingPlanet: "Mercury", polarity: "Assertive",
    keywords: ["versatile", "curious", "articulate", "quick"],
    overview: "A fast, communicative mind that connects ideas and people. Gemini adapts quickly and thrives on variety and conversation.",
    strengths: ["Sharp communicator", "Learns anything fast", "Connects across teams", "Great at ideation"],
    growthAreas: ["Finishing before starting the next thing", "Depth over breadth", "Managing scattered focus"],
    workStyle: "Energised by variety, collaboration and information flow. Bored by rigid, repetitive work.",
    idealRoles: ["Marketing / content", "Business development", "Journalism / PR", "Product / partnerships"],
    bestMatches: ["Libra", "Aquarius", "Aries", "Leo"], luckyDay: "Wednesday", luckyNumbers: [5, 3] },
  Cancer: { name: "Cancer", dates: "Jun 21 – Jul 22", element: "Water", modality: "Cardinal", rulingPlanet: "Moon", polarity: "Receptive",
    keywords: ["intuitive", "caring", "loyal", "protective"],
    overview: "Emotionally intelligent and people-first, Cancer builds trust and safety around them. Reads a room instantly and protects their team.",
    strengths: ["High emotional intelligence", "Nurtures talent", "Loyal and dependable", "Strong intuition for people"],
    growthAreas: ["Not taking feedback personally", "Setting boundaries", "Acting despite uncertainty"],
    workStyle: "Thrives in psychologically safe, mission-driven teams. Motivated by care for people and purpose.",
    idealRoles: ["People / HR", "Customer success", "Healthcare", "Community management"],
    bestMatches: ["Scorpio", "Pisces", "Taurus", "Virgo"], luckyDay: "Monday", luckyNumbers: [2, 7] },
  Leo: { name: "Leo", dates: "Jul 23 – Aug 22", element: "Fire", modality: "Fixed", rulingPlanet: "Sun", polarity: "Assertive",
    keywords: ["confident", "charismatic", "generous", "expressive"],
    overview: "A natural leader who inspires and rallies people around a vision. Leo brings warmth, confidence and a sense of occasion to work.",
    strengths: ["Inspires and motivates", "Owns the stage", "Generous mentor", "Strong sense of vision"],
    growthAreas: ["Sharing credit", "Receiving criticism gracefully", "Attention to unglamorous detail"],
    workStyle: "Shines when visible and trusted to lead. Motivated by recognition and building something people admire.",
    idealRoles: ["Team lead / manager", "Brand & creative", "Public-facing roles", "Entrepreneurship"],
    bestMatches: ["Aries", "Sagittarius", "Gemini", "Libra"], luckyDay: "Sunday", luckyNumbers: [1, 4] },
  Virgo: { name: "Virgo", dates: "Aug 23 – Sep 22", element: "Earth", modality: "Mutable", rulingPlanet: "Mercury", polarity: "Receptive",
    keywords: ["precise", "analytical", "diligent", "improving"],
    overview: "Detail-obsessed and improvement-driven, Virgo makes everything around them run better. Practical, thorough and quietly indispensable.",
    strengths: ["Meticulous quality", "Systems and process thinking", "Reliable problem-solver", "Honest, useful feedback"],
    growthAreas: ["Perfectionism / over-polishing", "Trusting others' work", "Celebrating wins"],
    workStyle: "Best with clear standards and room to refine. Motivated by mastery and being genuinely useful.",
    idealRoles: ["Analytics / data", "QA / process", "Editing / research", "Operations"],
    bestMatches: ["Taurus", "Capricorn", "Cancer", "Scorpio"], luckyDay: "Wednesday", luckyNumbers: [5, 3] },
  Libra: { name: "Libra", dates: "Sep 23 – Oct 22", element: "Air", modality: "Cardinal", rulingPlanet: "Venus", polarity: "Assertive",
    keywords: ["diplomatic", "fair", "collaborative", "aesthetic"],
    overview: "A natural diplomat who builds consensus and balance. Libra reads both sides, values fairness, and elevates the quality of any collaboration.",
    strengths: ["Negotiation and mediation", "Design and taste", "Builds partnerships", "Sees every perspective"],
    growthAreas: ["Deciding under conflict", "Saying no", "Owning an unpopular call"],
    workStyle: "Thrives in collaborative, harmonious environments with a stake in relationships and design.",
    idealRoles: ["Partnerships / BD", "Design / UX", "Legal / mediation", "Client relations"],
    bestMatches: ["Gemini", "Aquarius", "Leo", "Sagittarius"], luckyDay: "Friday", luckyNumbers: [6, 9] },
  Scorpio: { name: "Scorpio", dates: "Oct 23 – Nov 21", element: "Water", modality: "Fixed", rulingPlanet: "Pluto / Mars", polarity: "Receptive",
    keywords: ["intense", "strategic", "resilient", "focused"],
    overview: "Deeply focused and strategic, Scorpio goes all-in and sees what others miss. Resilient, private, and formidable when committed to a goal.",
    strengths: ["Deep focus and grit", "Strategic insight", "Reads hidden dynamics", "Transforms broken things"],
    growthAreas: ["Trusting and delegating", "Transparency", "Letting go of control"],
    workStyle: "Excels on high-stakes, complex problems where depth beats breadth. Motivated by mastery and impact.",
    idealRoles: ["Strategy / research", "Security / investigation", "Turnaround / crisis", "Deep engineering"],
    bestMatches: ["Cancer", "Pisces", "Virgo", "Capricorn"], luckyDay: "Tuesday", luckyNumbers: [8, 4] },
  Sagittarius: { name: "Sagittarius", dates: "Nov 22 – Dec 21", element: "Fire", modality: "Mutable", rulingPlanet: "Jupiter", polarity: "Assertive",
    keywords: ["optimistic", "visionary", "independent", "adventurous"],
    overview: "A big-picture optimist who chases growth, meaning and new frontiers. Sagittarius brings vision, honesty and infectious energy.",
    strengths: ["Vision and big-picture thinking", "Comfortable with risk", "Honest and direct", "Learns across domains"],
    growthAreas: ["Attention to detail", "Consistency and routine", "Tactful delivery"],
    workStyle: "Thrives with freedom, growth and a mission bigger than the day-to-day. Restless without progress.",
    idealRoles: ["Growth / strategy", "Consulting", "International / expansion", "Teaching / evangelism"],
    bestMatches: ["Aries", "Leo", "Libra", "Aquarius"], luckyDay: "Thursday", luckyNumbers: [3, 9] },
  Capricorn: { name: "Capricorn", dates: "Dec 22 – Jan 19", element: "Earth", modality: "Cardinal", rulingPlanet: "Saturn", polarity: "Receptive",
    keywords: ["ambitious", "disciplined", "strategic", "responsible"],
    overview: "Disciplined and ambitious, Capricorn plays the long game and climbs steadily. Structured, accountable and built for leadership over time.",
    strengths: ["Long-term discipline", "Structured execution", "Takes responsibility", "Earns trust through consistency"],
    growthAreas: ["Work–life balance", "Showing warmth", "Flexibility with change"],
    workStyle: "Excels with clear goals, ownership and a ladder to climb. Motivated by mastery, status and legacy.",
    idealRoles: ["Management / executive", "Finance / strategy", "Project leadership", "Founder"],
    bestMatches: ["Taurus", "Virgo", "Scorpio", "Pisces"], luckyDay: "Saturday", luckyNumbers: [8, 4] },
  Aquarius: { name: "Aquarius", dates: "Jan 20 – Feb 18", element: "Air", modality: "Fixed", rulingPlanet: "Uranus / Saturn", polarity: "Assertive",
    keywords: ["inventive", "independent", "principled", "future-facing"],
    overview: "An original thinker driven by ideas and progress. Aquarius challenges convention, champions fairness, and builds for the future.",
    strengths: ["Innovative problem-solving", "Systems and vision", "Principled and fair", "Comfortable being different"],
    growthAreas: ["Emotional attunement", "Compromise", "Following routine"],
    workStyle: "Thrives with intellectual freedom and a mission to improve things. Bored by convention for its own sake.",
    idealRoles: ["R&D / innovation", "Engineering / tech", "Social impact", "Product vision"],
    bestMatches: ["Gemini", "Libra", "Aries", "Sagittarius"], luckyDay: "Saturday", luckyNumbers: [4, 7] },
  Pisces: { name: "Pisces", dates: "Feb 19 – Mar 20", element: "Water", modality: "Mutable", rulingPlanet: "Neptune / Jupiter", polarity: "Receptive",
    keywords: ["imaginative", "empathetic", "adaptable", "creative"],
    overview: "Deeply imaginative and empathetic, Pisces senses what people need and creates with feeling. Adaptable, intuitive and quietly resilient.",
    strengths: ["Creativity and imagination", "Deep empathy", "Adaptable and intuitive", "Sees meaning others miss"],
    growthAreas: ["Boundaries and focus", "Practical structure", "Assertiveness"],
    workStyle: "Thrives in creative, humane, purpose-led work. Motivated by meaning and helping people.",
    idealRoles: ["Design / creative", "Counselling / care", "Storytelling / content", "UX research"],
    bestMatches: ["Cancer", "Scorpio", "Taurus", "Capricorn"], luckyDay: "Thursday", luckyNumbers: [3, 7] },
}

export function sunSign(dateISO: string | Date): string | null {
  const d = typeof dateISO === "string" ? new Date(dateISO) : dateISO
  if (!d || isNaN(d.getTime())) return null
  const m = d.getUTCMonth() + 1, day = d.getUTCDate()
  for (const [name, sm, sd, em, ed] of RANGES) {
    if (sm === m && day >= sd) return name
    if (em === m && day <= ed) return name
  }
  return null
}

// Numerology life path from the full birth date (reduce to a single digit, keep masters 11/22/33).
const LIFE_PATHS: Record<number, { title: string; summary: string }> = {
  1: { title: "The Leader", summary: "Independent, driven and original — built to initiate and stand on your own." },
  2: { title: "The Diplomat", summary: "Cooperative, sensitive and fair — the peacemaker who makes teams work." },
  3: { title: "The Communicator", summary: "Expressive, creative and social — you inspire through words and ideas." },
  4: { title: "The Builder", summary: "Practical, disciplined and dependable — you turn plans into lasting structures." },
  5: { title: "The Explorer", summary: "Adaptable, curious and free — you thrive on change, variety and progress." },
  6: { title: "The Nurturer", summary: "Responsible, caring and loyal — you carry people and create harmony." },
  7: { title: "The Analyst", summary: "Thoughtful, deep and independent — you seek truth and mastery of your craft." },
  8: { title: "The Achiever", summary: "Ambitious, capable and results-driven — built for authority and impact." },
  9: { title: "The Humanitarian", summary: "Compassionate, idealistic and wise — you work for something bigger than yourself." },
  11: { title: "The Visionary (Master 11)", summary: "Intuitive and inspiring — a heightened path of insight and influence." },
  22: { title: "The Master Builder (Master 22)", summary: "Rare capacity to turn big visions into real, large-scale outcomes." },
  33: { title: "The Master Teacher (Master 33)", summary: "Devoted to uplifting others through service and wisdom." },
}

export function lifePath(dateISO: string | Date): { number: number; title: string; summary: string } | null {
  const d = typeof dateISO === "string" ? new Date(dateISO) : dateISO
  if (!d || isNaN(d.getTime())) return null
  const digits = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`
  const reduce = (n: number): number => {
    while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = String(n).split("").reduce((s, c) => s + +c, 0)
    return n
  }
  const num = reduce(digits.split("").reduce((s, c) => s + +c, 0))
  const meta = LIFE_PATHS[num] || LIFE_PATHS[9]
  return { number: num, ...meta }
}

// ---- Vedic guna balance (Sattva / Rajas / Tamas) from element + modality ----
export type Guna = { sattva: number; rajas: number; tamas: number; dominant: "Sattva" | "Rajas" | "Tamas"; summary: string }

const ELEMENT_GUNA: Record<string, [number, number, number]> = {
  Fire: [25, 60, 15], Air: [50, 35, 15], Earth: [20, 30, 50], Water: [45, 20, 35],
}
const MODALITY_GUNA: Record<string, [number, number, number]> = {
  Cardinal: [-5, 10, -5], Fixed: [-5, -5, 10], Mutable: [10, -5, -5],
}
const GUNA_NOTE: Record<string, string> = {
  Sattva: "Clarity, ethics and balanced judgement lead. Best in advisory, teaching, design, research and roles that reward integrity and calm decision-making.",
  Rajas: "Drive, ambition and action lead. Best in leadership, sales, entrepreneurship, growth and fast-moving roles where momentum wins.",
  Tamas: "Stability, endurance and depth lead. Best in specialist, operational and structural roles that reward persistence and reliability over the long haul.",
}
export function guna(sign: AstroSign): Guna {
  const e = ELEMENT_GUNA[sign.element], m = MODALITY_GUNA[sign.modality]
  let v = [e[0] + m[0], e[1] + m[1], e[2] + m[2]].map(x => Math.max(0, x))
  const sum = v[0] + v[1] + v[2]
  v = v.map(x => Math.round((x / sum) * 100))
  const names = ["Sattva", "Rajas", "Tamas"] as const
  const dominant = names[v.indexOf(Math.max(...v))]
  return { sattva: v[0], rajas: v[1], tamas: v[2], dominant, summary: GUNA_NOTE[dominant] }
}

// ---- Ayurvedic dosha (effect on the body / constitution) from element ----
export type Dosha = { name: string; body: string; energy: string; balance: string }
const ELEMENT_DOSHA: Record<string, Dosha> = {
  Fire: { name: "Pitta", body: "Fire & water. Sharp, warm, medium build with strong metabolism and focus.", energy: "Peak drive midday; intense, goal-locked concentration.", balance: "Guard against burnout and irritability — cool down, pace intensity, rest deliberately." },
  Air: { name: "Vata", body: "Air & space. Light, quick, mobile — creative and full of ideas.", energy: "Bursts of inspiration; many threads at once.", balance: "Needs routine, grounding and warmth to avoid scattered, restless energy." },
  Earth: { name: "Kapha", body: "Earth & water. Solid, steady, strong stamina and endurance.", energy: "Calm, consistent output over long stretches.", balance: "Benefits from stimulation and movement to avoid inertia and over-attachment to comfort." },
  Water: { name: "Kapha–Vata", body: "Water-led. Fluid, nurturing, emotionally deep and adaptable.", energy: "Steady, empathetic, intuitive endurance.", balance: "Benefits from clear boundaries and forward motion to avoid over-absorbing others' weight." },
}

export type AstroAnalysis = {
  sign: AstroSign
  guna: Guna
  dosha: Dosha
  lifePath: { number: number; title: string; summary: string } | null
} | null

export function analyze(birthDateISO?: string | Date | null): AstroAnalysis {
  if (!birthDateISO) return null
  const name = sunSign(birthDateISO)
  if (!name) return null
  const sign = SIGNS[name]
  return { sign, guna: guna(sign), dosha: ELEMENT_DOSHA[sign.element], lifePath: lifePath(birthDateISO) }
}

// ---- Career fit: blend the chart with the career pathway completed so far ----
export type CareerFit = {
  recommended: string[]
  synergy: "aligned" | "transitioning" | "emerging"
  headline: string
  note: string
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ")
export function careerFit(a: NonNullable<AstroAnalysis>, experience: { title?: string }[] = []): CareerFit {
  const past = experience.map(e => norm(e.title || "")).filter(Boolean)
  const roleWords = a.sign.idealRoles.flatMap(r => norm(r).split(/[ /]+/)).filter(w => w.length > 3)
  const hits = new Set<string>()
  for (const p of past) for (const w of roleWords) if (p.includes(w)) hits.add(w)
  const yrs = experience.length
  let synergy: CareerFit["synergy"], headline: string, note: string
  if (past.length === 0) {
    synergy = "emerging"
    headline = `Your ${a.sign.element}/${a.guna.dominant} chart points to a clear starting direction.`
    note = `With no roles on your profile yet, your ${a.sign.name} strengths (${a.sign.keywords.slice(0, 3).join(", ")}) and ${a.dosha.name} constitution suggest beginning where your natural energy already runs strong. Add your experience to sharpen this.`
  } else if (hits.size > 0) {
    synergy = "aligned"
    headline = `Your path so far already runs with your chart — build deeper, aim higher.`
    note = `Your ${yrs} recorded role${yrs > 1 ? "s" : ""} overlap with your ${a.sign.name} ideal (${[...hits].slice(0, 3).join(", ")}). Your ${a.guna.dominant}-led temperament and ${a.dosha.name} energy favour advancing within this line rather than switching — seniority, ownership and specialism are the natural next steps.`
  } else {
    synergy = "transitioning"
    headline = `A bridge role would align your experience with your chart's strengths.`
    note = `Your recorded experience sits a little apart from your ${a.sign.name} ideal roles. Given your ${a.guna.dominant}-led drive and ${a.dosha.name} constitution, roles that reuse your current skills while shifting toward the recommendations below will feel most sustainable and rewarding.`
  }
  return { recommended: a.sign.idealRoles, synergy, headline, note }
}

export const ELEMENT_COLOR: Record<string, string> = {
  Fire: "#C2571F", Earth: "#0B6B45", Air: "#2C7CB8", Water: "#5A4FB0",
}

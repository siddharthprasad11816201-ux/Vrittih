// Import the Viśvambhara aerospace + frontier research opportunity catalog as
// fully-detailed job postings, at the standard serious aerospace organisations
// publish (SpaceX / Rocket Lab / ISRO / ESA style): what the team does, what you
// will actually work on, what you need, what you get, and how to apply.
//
// These are posted NATIVELY by the Viśvambhara employer account, so candidates
// apply on Vrittih and the application is really received and tracked. No
// external applyUrl is invented — the roles don't exist in the edurankai.in
// careers system, so pointing there would be a dead link.
//
// Usage:
//   node prisma/seed-visvambhara.mjs            # publish the whole catalog
//   node prisma/seed-visvambhara.mjs --core     # core engineering divisions only
//   node prisma/seed-visvambhara.mjs --draft    # import but leave unpublished (active=false)
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { CATALOG, FRONTIER, CORE_INSTITUTE, MISSIONS } from "./data/visvambhara-catalog.mjs"

// The expansion catalog (generated + credibility-reviewed) carries its own context
// and skills per division, so new domains need no edits here. Optional: the seed
// works with or without it.
let EXPANSION = []
try { ({ EXPANSION } = await import("./data/visvambhara-expansion.mjs")) } catch { /* not generated yet */ }

const p = new PrismaClient()
const argv = process.argv.slice(2)
const CORE_ONLY = argv.includes("--core")
const DRAFT = argv.includes("--draft")

const BRAND = "Viśvambhara"
const HQ = "Guwahati, India"
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)

// ---------------------------------------------------------------- context
// What each division actually does — so a posting reads like the team wrote it.
const DIVISION_CONTEXT = {
  "Propulsion": "Viśvambhara's propulsion group designs, builds and fires the engines that get vehicles off the ground and through space — from solid and liquid rocket engines to cryogenic, green and electric propulsion. You will sit with the people who cut metal, run the test stand and read the data.",
  "Aerodynamics & Fluid Dynamics": "The aerodynamics group predicts and shapes how air and gases behave around and inside our vehicles, from subsonic flight through the hypersonic regime — combining CFD, wind tunnel campaigns and flight data.",
  "Structures & Mechanical Design": "The structures group makes vehicles that are as light as physics allows and as strong as flight demands — composite and metallic airframes, tanks, mechanisms and load paths, validated by analysis and test to failure.",
  "Thermal Engineering": "Thermal engineering keeps every component inside its survivable temperature band — through cryogenic propellants, re-entry heating, engine plumes and the vacuum of space.",
  "Manufacturing": "Manufacturing turns a drawing into flight hardware — precision machining, additive manufacturing, composite layup, assembly and the process discipline that makes the hundredth unit as good as the first.",
  "Materials Science": "Materials science selects, characterises and qualifies what our vehicles are made of, and investigates why things fail — from high-temperature alloys to composites, ceramics and coatings.",
  "Avionics": "Avionics builds the flight electronics — computers, sensors, telemetry and the boards that must keep working through vibration, vacuum, radiation and shock.",
  "Electrical Power Systems": "Electrical power systems generate, store and distribute every watt on the vehicle — batteries, solar arrays, power electronics and the harnesses that tie them together.",
  "Communications": "Communications keeps the link alive — RF and antenna design, telemetry, space networking and the deep-space links where every decibel matters.",
  "Flight Software & Embedded": "Flight software writes the code that flies the vehicle. It is real-time, safety-critical and unforgiving: it must be right the first time, because there is no patch mid-flight.",
  "Guidance, Navigation & Control": "GNC answers three questions continuously — where are we, where should we be, and what do we fire to close the gap. Estimation, control law design and trajectory optimisation.",
  "AI, Robotics & Autonomy": "This group builds the autonomy: perception, decision-making and control that let vehicles and robots operate when a human cannot be in the loop.",
  "Simulation & Digital Engineering": "Simulation lets us fly the mission thousands of times before we fly it once — physics models, digital twins, Monte Carlo campaigns and hardware-in-the-loop rigs.",
  "Data Engineering & Mission Analytics": "Every test and every flight produces data that must become insight — pipelines, telemetry analytics and the models that predict a failure before it happens.",
  "Spacecraft Engineering": "Spacecraft engineering designs what flies once orbit is reached — satellite buses, payloads, CubeSats and deep-space platforms built to survive years without a service call.",
  "Robotics & Mechanisms": "Mechanisms are the moving parts that must work exactly once, perfectly — deployments, manipulators, actuators and planetary rovers.",
  "Orbital Mechanics": "Astrodynamics plans the path — orbits, transfers, interplanetary trajectories and the manoeuvres that get a spacecraft where it needs to be with the propellant it has.",
  "Systems Engineering": "Systems engineering owns the whole vehicle: requirements, interfaces, architecture and the trade studies that decide what the design actually becomes.",
  "Flight Test & Operations": "Flight test and operations run the campaign — launch operations, mission control, ground systems and the data review that turns a flight into knowledge.",
  "Integration, Testing & Validation": "Integration and test proves the vehicle before it flies — vibration, shock, thermal vacuum, EMI and the qualification campaign that earns flight clearance.",
  "Reliability & Safety": "Reliability and safety asks how this could fail, and what happens when it does — FMEA, fault trees, risk analysis and mission assurance.",
  "Research & Emerging Technologies": "The advanced technology group works on what flies in a decade, not this quarter — hypersonics, quantum sensing, in-situ resource utilisation and habitation systems.",
}

// Skills by division — concrete and checkable, not filler.
const DIVISION_SKILLS = {
  "Propulsion": ["thermodynamics and fluid mechanics", "rocket propulsion fundamentals (Isp, thrust, cycle analysis)", "CAD (SolidWorks / NX / CATIA)", "test data analysis in Python or MATLAB"],
  "Aerodynamics & Fluid Dynamics": ["fluid dynamics and gas dynamics", "CFD (ANSYS Fluent / OpenFOAM / SU2)", "Python or MATLAB for post-processing", "experimental methods and uncertainty analysis"],
  "Structures & Mechanical Design": ["strength of materials and structural analysis", "FEA (ANSYS / Abaqus / Nastran)", "CAD and GD&T", "composite or metallic design practice"],
  "Thermal Engineering": ["heat transfer (conduction, convection, radiation)", "thermal analysis tools (Thermal Desktop / ANSYS)", "Python or MATLAB modelling", "instrumentation and thermal test methods"],
  "Manufacturing": ["manufacturing processes (machining, forming, joining)", "CAD/CAM and tooling design", "GD&T and metrology", "process control and quality methods"],
  "Materials Science": ["materials science and metallurgy", "mechanical and microstructural characterisation", "failure analysis methods", "test standards (ASTM / ISO)"],
  "Avionics": ["analog and digital electronics", "PCB design (Altium / KiCad)", "embedded C and microcontrollers", "lab instruments: oscilloscope, spectrum analyser"],
  "Electrical Power Systems": ["power electronics and circuit design", "battery and energy storage fundamentals", "electrical simulation (SPICE / PLECS)", "harness design and EMC practice"],
  "Communications": ["RF and communication theory", "antenna design and simulation (HFSS / CST)", "link budget analysis", "SDR and signal processing"],
  "Flight Software & Embedded": ["C / C++ and Python", "real-time and embedded systems", "version control, code review and unit testing", "RTOS concepts and hardware interfaces"],
  "Guidance, Navigation & Control": ["control theory and state estimation", "Kalman filtering and sensor fusion", "MATLAB/Simulink and Python", "rigid-body dynamics"],
  "AI, Robotics & Autonomy": ["Python and modern ML frameworks (PyTorch / JAX)", "computer vision or reinforcement learning", "robotics middleware (ROS 2)", "probability, linear algebra and optimisation"],
  "Simulation & Digital Engineering": ["numerical methods and simulation", "Python / MATLAB / C++", "multi-body or physics modelling", "statistical analysis and Monte Carlo methods"],
  "Data Engineering & Mission Analytics": ["Python and SQL", "data pipelines and time-series processing", "statistics and anomaly detection", "visualisation and reporting"],
  "Spacecraft Engineering": ["spacecraft subsystems and bus architecture", "space environment effects", "CAD and systems modelling", "verification and test practice"],
  "Robotics & Mechanisms": ["mechanism and kinematic design", "actuators, motors and drivetrains", "CAD and tolerance analysis", "control and embedded integration"],
  "Orbital Mechanics": ["orbital mechanics and astrodynamics", "trajectory tools (GMAT / STK / poliastro)", "numerical optimisation", "Python or MATLAB"],
  "Systems Engineering": ["systems engineering fundamentals (V-model, requirements)", "interface and configuration management", "MBSE tooling (SysML / Cameo)", "technical writing and trade studies"],
  "Flight Test & Operations": ["test planning and execution", "data acquisition and instrumentation", "operational procedures and safety discipline", "Python for flight data analysis"],
  "Integration, Testing & Validation": ["environmental test methods (vibration, TVAC, EMI)", "test procedure authoring", "instrumentation and DAQ", "anomaly investigation"],
  "Reliability & Safety": ["FMEA, FTA and reliability modelling", "risk analysis and hazard tracking", "statistics and Weibull analysis", "quality standards (AS9100 familiarity a plus)"],
  "Research & Emerging Technologies": ["strong physics and mathematics", "research methodology and literature review", "simulation or experimental skills", "scientific writing"],
}

const DEFAULT_SKILLS = ["strong engineering fundamentals", "Python or MATLAB", "analytical problem solving", "clear technical communication"]

// Responsibilities scaffold — combined with the role title for specificity.
// Not every division is an engineering division. A space-law intern does not
// "execute tests" and is not mentored by an engineer — writing it that way reads
// auto-generated and tells a serious candidate we did not think about their field.
const TRACK_MODE = {
  "Applied Science & Research": "science",
  "Earth Observation & Applications": "science",
  "Research & Advanced Technologies": "science",
  "Human Systems & Life Sciences": "life",
  "Business, Policy & Legal": "advisory",
  "Sustainability & Environment": "advisory",
  "Design & Experience": "design",
  "Education & Knowledge": "education",
}

const MODES = {
  engineering: {
    mentor: "senior engineer", peers: "engineer", group: "engineering group",
    verbs: "Build and validate models, run analyses or execute tests, and defend your results in technical review.",
  },
  science: {
    mentor: "senior researcher", peers: "researcher", group: "research group",
    verbs: "Design and run experiments or simulations, reduce the data honestly, and defend your conclusions — including the error bars — in technical review.",
  },
  life: {
    mentor: "principal investigator", peers: "researcher", group: "research group",
    verbs: "Run protocols or analyses under supervision, handle human- and biological-subject data to the standards it demands, and present results with their limitations stated.",
  },
  advisory: {
    mentor: "senior specialist", peers: "colleague", group: "programme team",
    verbs: "Work from primary sources — regulation, treaty text, filings, financial data — and produce the written analysis a decision-maker can actually act on.",
  },
  design: {
    mentor: "senior designer", peers: "designer", group: "design and engineering review",
    verbs: "Take work from sketch to validated design — prototypes, models or interfaces — and defend your decisions against real user and engineering constraints.",
  },
  education: {
    mentor: "senior instructional designer", peers: "colleague", group: "faculty and engineering reviewers",
    verbs: "Build learning material or tooling, test it with real learners, and iterate on what the evidence says rather than what you hoped.",
  },
}

function responsibilities(title, division, frontier, fellowship, missionGoal, track) {
  const m = MODES[TRACK_MODE[track] || "engineering"]
  const focus = title.replace(/\s*(Intern|Research Fellow)$/i, "").trim()
  const subject = fellowship && missionGoal ? "the mission objective above" : `real ${focus.toLowerCase()} work`
  const base = [
    `Own a scoped piece of ${subject}, with a named ${m.mentor} as your mentor.`,
    m.verbs,
    `Document what you did to a standard another ${m.peers} can pick up and repeat, including your assumptions and what you are uncertain about.`,
    `Work across ${division.toLowerCase()} and the interfacing teams; the hard problems here are never solved by one discipline alone.`,
    fellowship
      ? `Publish or present your findings to the research group at the close of the term, including negative results and why they matter.`
      : `Present your findings at the end of the internship to the ${m.group}, including what did not work and why.`,
  ]
  if (frontier) {
    base.splice(1, 0, `Survey the state of the art, identify what is genuinely unknown, and design an experiment or study that would move the question forward.`)
  }
  return base
}

function eligibility(frontier) {
  return [
    "Students in an undergraduate, Master's or PhD programme, and recent graduates, in engineering, physics, mathematics, materials or computer science.",
    "Exceptional candidates from non-traditional backgrounds who can demonstrate the ability through projects, competitions or prior work.",
    frontier
      ? "A genuine appetite for open scientific questions, and the discipline to distinguish a result from a hope."
      : "A bias toward building, testing and measuring rather than only theorising.",
    "Ability to work in India or remotely as agreed; specific arrangements are discussed at offer stage.",
  ]
}

// The honest research framing — attached to every frontier posting.
const FRONTIER_NOTE =
  "A note on how we describe this work: these are research directions, not solved problems or existing products. " +
  "Viśvambhara pursues ambitious objectives — dramatically higher energy density, far longer endurance, far lighter structures — " +
  "as rigorous scientific and engineering research. We do not claim, and do not ask anyone to claim, results that conflict with " +
  "established physical law such as conservation of energy. If a line of enquiry turns out to be a dead end, publishing that is a " +
  "real result and is treated as one. Scientific credibility is a condition of the work, not an obstacle to it."

function buildDescription({ title, division, track, institute, lab, centre, frontier, missionGoal, fellowship, context, skills }) {
  const parts = []
  const focus = title.replace(/\s*(Intern|Research Fellow)$/i, "").trim()

  // Opening
  if (missionGoal) {
    parts.push(`${CORE_INSTITUTE.name} — Grand Challenge programme.\n\nObjective: ${missionGoal}`)
  } else if (institute || centre) {
    parts.push(`${institute || centre}${lab ? ` · ${lab}` : ""}\n\n${CORE_INSTITUTE.vision}`)
  } else {
    parts.push(context || DIVISION_CONTEXT[division] || `Viśvambhara's ${division} group builds flight hardware and the analysis behind it.`)
  }

  parts.push(`\nAbout the role\n` + (fellowship
    ? `As a ${title}, you will lead a strand of this Grand Challenge within ${centre || "the Institute"}. Fellows are given a genuine open question, the resources to attack it, and the freedom to report what they actually find.`
    : `As a ${title.replace(/\s*Intern$/, " intern").trim()}, you will work on ${focus.toLowerCase()} within ${division}. This is not a shadowing programme — interns at Viśvambhara are given a real problem, real data and real responsibility, with the mentorship to succeed at it.`))

  parts.push(`\nWhat you'll do\n` + responsibilities(title, division, frontier, fellowship, missionGoal, track).map((x) => `• ${x}`).join("\n"))

  const need = (skills && skills.length) ? skills : (DIVISION_SKILLS[division] || DEFAULT_SKILLS)
  parts.push(`\nWhat you'll bring\n` + need.map((x) => `• ${x}`).join("\n") +
    `\n• Curiosity, rigour and the honesty to say "I don't know yet"`)

  parts.push(`\nWho should apply\n` + eligibility(frontier).map((x) => `• ${x}`).join("\n"))

  const mode = MODES[TRACK_MODE[track] || "engineering"]
  parts.push(`\nWhat we offer\n` +
    [`A real problem that matters, not busywork.`,
     `A named mentor and weekly review with our ${mode.mentor}s.`,
     `Access to the tools, compute, lab, archives or test facilities the work actually needs.`,
     `A written reference and, for strong performers, a pathway to a full-time offer.`,
     `Work that is credited: your name on the report you wrote.`].map((x) => `• ${x}`).join("\n"))

  if (frontier) parts.push(`\n${FRONTIER_NOTE}`)

  parts.push(`\nStructure\nTrack: ${track}` +
    (institute ? `\nInstitute: ${institute}` : "") +
    (centre ? `\nCentre: ${centre}` : "") +
    (lab ? `\nLaboratory: ${lab}` : "") +
    `\nDivision: ${division}` +
    `\nOrganisation: Viśvambhara — aerospace & deep-tech, EduRankAI`)

  parts.push(`\nHow to apply\nApply directly on Vrittih. Your application goes to the Viśvambhara hiring team and you can follow it live through every stage — we would rather tell you "no" quickly than leave you waiting.`)

  return parts.join("\n")
}

// ---------------------------------------------------------------- collect
const postings = []

for (const group of CATALOG) {
  for (const title of group.roles) {
    postings.push({ title, division: group.division, track: group.track, frontier: false })
  }
}

if (!CORE_ONLY) {
  for (const g of FRONTIER) {
    for (const title of g.roles) {
      postings.push({ title, division: g.lab, track: "Research & Advanced Technologies", institute: g.institute, lab: g.lab, frontier: true })
    }
  }
  for (const c of CORE_INSTITUTE.centres) {
    for (const title of c.roles) {
      postings.push({ title, division: c.lab, track: "Research & Advanced Technologies", centre: c.centre, lab: c.lab, frontier: true })
    }
  }
  for (const m of MISSIONS) {
    postings.push({ title: m.role, division: "Grand Challenge Programmes", track: "Research & Advanced Technologies", centre: CORE_INSTITUTE.name, frontier: true, missionGoal: m.goal, fellowship: true })
  }
  // expansion domains carry their own reviewed context + skills
  for (const d of EXPANSION) {
    for (const title of d.roles) {
      postings.push({ title, division: d.division, track: d.track, frontier: !!d.frontier, context: d.context, skills: d.skills })
    }
  }
}

// de-duplicate by title (a few titles recur across divisions)
const seen = new Set()
const unique = postings.filter((x) => { const k = x.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })

// ---------------------------------------------------------------- employer
let owner = await p.user.findFirst({ where: { name: BRAND, role: "EMPLOYER" }, select: { id: true } })
if (!owner) {
  owner = await p.user.create({
    data: { name: BRAND, email: `careers+${slugify(BRAND)}@edurankai.in`, password: await bcrypt.hash("EduRankAI@2026!", 10),
      role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "edurankai",
      headline: "Aerospace & deep-tech for the next frontier", location: HQ, profile: { create: {} } },
    select: { id: true },
  })
}

// clear a previous run of THIS catalog only (leave the 14 careers-catalog roles alone)
const prior = await p.job.deleteMany({ where: { company: BRAND, sourceKey: "visvambhara-catalog" } })
if (prior.count) console.log(`cleared ${prior.count} previously imported catalog roles`)

// ---------------------------------------------------------------- write
let batch = [], created = 0
async function flush() { if (batch.length) { await p.job.createMany({ data: batch }); created += batch.length; batch = [] } }

for (const x of unique) {
  batch.push({
    title: x.title,
    company: BRAND,
    industry: "Manufacturing",
    location: HQ,
    type: x.fellowship ? "CONTRACT" : "INTERNSHIP",
    salary: null,
    remote: false,
    description: buildDescription(x),
    active: !DRAFT,
    views: 0,
    postedById: owner.id,
    sourceKey: "visvambhara-catalog",
    externalId: slugify(x.title),
  })
  if (batch.length >= 400) await flush()
}
await flush()

const byTrack = {}
for (const x of unique) byTrack[x.track] = (byTrack[x.track] || 0) + 1

console.log(`\n✅ Published ${created} Viśvambhara opportunities${DRAFT ? " (as DRAFTS — active=false)" : ""}:`)
for (const [t, n] of Object.entries(byTrack).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${t}`)
console.log(`\n   ${unique.filter((x) => x.frontier).length} frontier research roles · ${unique.filter((x) => !x.frontier).length} core engineering roles`)
console.log(`   Viśvambhara total on board: ${await p.job.count({ where: { company: BRAND } })}`)
console.log(`   Board total: ${await p.job.count()}`)
await p.$disconnect()

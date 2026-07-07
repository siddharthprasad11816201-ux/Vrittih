// Comprehensive demo seed — fills every surface with realistic activity so the
// product feels deep and alive: candidates, applications across all pipeline
// stages, feed posts, connections, and a staffed HRMS (attendance + leave).
// Everything is owned by the super admin so it shows the moment you sign in.
// Re-runnable: clears prior demo data (users tagged source="demo") first.
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const p = new PrismaClient()
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const daysAgo = (n) => new Date(Date.now() - n * 86400000)
const dayStart = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

const FIRST = ["Aarav", "Diya", "Kabir", "Ananya", "Vivaan", "Ishita", "Arjun", "Meera", "Rohan", "Sara", "Aditya", "Priya", "Karan", "Neha", "Rahul", "Tara", "Dev", "Anjali", "Nikhil", "Riya", "Omar", "Lena", "Marco", "Sofia"]
const LAST = ["Sharma", "Patel", "Reddy", "Nair", "Khan", "Iyer", "Bose", "Mehta", "Das", "Kapoor", "Verma", "Rao", "Fernandez", "Costa", "Müller", "Rossi"]
const HEAD = ["Software Engineer", "Product Designer", "Data Analyst", "HR Business Partner", "Marketing Lead", "Backend Engineer", "UX Researcher", "Talent Acquisition Specialist", "Financial Analyst", "DevOps Engineer", "Content Strategist", "Project Manager"]
const LOC = ["Zurich, Switzerland", "Bengaluru, India", "London, UK", "Mumbai, India", "Berlin, Germany", "Remote", "Geneva, Switzerland", "Pune, India", "Singapore"]
const CO = ["TechCorp", "Nexus Labs", "BrightWave", "FinEdge", "Northwind", "Aurora Systems", "BlueOak", "Meridian"]
const SCHOOL = ["IIT Bombay", "ETH Zürich", "NIT Trichy", "Delhi University", "TU Munich", "BITS Pilani", "University of Zurich", "IIM Ahmedabad"]
const DEGREE = [["B.Tech", "Computer Science"], ["M.Sc", "Data Science"], ["MBA", "Human Resources"], ["B.Des", "Interaction Design"], ["B.Com", "Finance"], ["M.Tech", "AI & ML"]]
const SKILLS = ["React", "TypeScript", "Python", "SQL", "Figma", "Recruiting", "Node.js", "Data Analysis", "Leadership", "Communication", "AWS", "Product Strategy", "Docker", "Machine Learning", "Excel", "Stakeholder Management"]
const POSTS = [
  "Thrilled to share I've completed my certification in cloud architecture. Onwards and upwards!",
  "Hot take: the best hires come from a transparent process. Candidates remember how you made them feel.",
  "Just wrapped a 3-month project migrating our stack — 40% faster builds. Proud of the team. 🙌",
  "Looking to connect with people working in AI ethics — reach out if that's you.",
  "The 7-tier hiring pipeline on Vrittih is a game changer. You always know where you stand.",
  "Mentorship matters. Grateful to everyone who took a chance on me early in my career.",
  "Shipping beats perfection. Ship, learn, iterate.",
  "Attended a brilliant talk on inclusive design today. Notes in the comments.",
  "Six months at my new role and still learning something every single day.",
  "Reminder: your résumé gets you the interview; your curiosity gets you the job.",
  "Open to new opportunities in product design — DMs open.",
  "Built a small tool this weekend to compress interview recordings. Might open-source it.",
]
const NOTES = { APPLIED: "New application received.", SHORTLISTED: "Strong profile — moved to shortlist.", INTERVIEW: "Interview scheduled for next week.", OFFERED: "Offer extended.", HIRED: "Offer accepted — welcome aboard!", REJECTED: "Not the right fit this time." }

const admin = await p.user.findUnique({ where: { email: "superadmin@vrittih.online" }, select: { id: true } })
if (!admin) { console.log("No super admin — run seed-admin first."); process.exit(1) }

// ---- clear prior demo data ----
const prev = await p.user.findMany({ where: { source: "demo" }, select: { id: true } })
const prevIds = prev.map((u) => u.id)
if (prevIds.length) {
  await p.employee.deleteMany({ where: { userId: { in: prevIds } } }) // cascades attendance + leave
  await p.postComment.deleteMany({ where: { userId: { in: prevIds } } })
  await p.postLike.deleteMany({ where: { userId: { in: prevIds } } })
  await p.post.deleteMany({ where: { authorId: { in: prevIds } } })
  await p.connection.deleteMany({ where: { OR: [{ userId: { in: prevIds } }, { connectedId: { in: prevIds } }] } })
  await p.user.deleteMany({ where: { id: { in: prevIds } } }) // cascades applications, experience, education, skills, profile
}
console.log(`cleared ${prevIds.length} prior demo users`)

const hash = await bcrypt.hash("Demo@2026!", 10)
const skillMap = {}
for (const s of SKILLS) { const rec = await p.skill.upsert({ where: { name: s }, update: {}, create: { name: s } }); skillMap[s] = rec.id }

// ---- candidates ----
const candidates = []
for (let i = 0; i < 24; i++) {
  const first = FIRST[i % FIRST.length], last = pick(LAST)
  const name = `${first} ${last}`
  const head = pick(HEAD), loc = pick(LOC)
  const u = await p.user.create({
    data: {
      name, email: `demo.${first.toLowerCase()}${i}@vrittih.online`, password: hash,
      headline: head, location: loc, role: "JOBSEEKER", paid: true, paidAt: new Date(),
      source: "demo", phone: "+41 79 000 00" + String(10 + i),
      bio: `${head} with a track record of shipping real work. Based in ${loc}. Passionate about doing things properly and helping teams win.`,
      idVerified: Math.random() < 0.6,
      profile: { create: { birthDate: new Date(1990 + (i % 12), i % 12, 1 + (i % 27)) } },
    }, select: { id: true, name: true },
  })
  // experience
  await p.experience.create({ data: { userId: u.id, company: pick(CO), title: head, location: loc, startDate: daysAgo(700 + i * 20), endDate: null, description: `Led key initiatives as ${head}.` } })
  await p.experience.create({ data: { userId: u.id, company: pick(CO), title: "Associate " + head, location: loc, startDate: daysAgo(1500), endDate: daysAgo(720) } })
  // education
  const [deg, field] = pick(DEGREE)
  await p.education.create({ data: { userId: u.id, school: pick(SCHOOL), degree: deg, field, startYear: 2012 + (i % 6), endYear: 2016 + (i % 6) } })
  // skills
  const chosen = [...SKILLS].sort(() => Math.random() - 0.5).slice(0, 4)
  for (const s of chosen) { await p.userSkill.create({ data: { userId: u.id, skillId: skillMap[s] } }).catch(() => {}) }
  candidates.push(u)
}
console.log(`created ${candidates.length} candidates`)

// ---- give the super admin some jobs to own, with applicants ----
const jobs = await p.job.findMany({ take: 15, orderBy: { createdAt: "desc" }, select: { id: true } })
await p.job.updateMany({ where: { id: { in: jobs.map((j) => j.id) } }, data: { postedById: admin.id, active: true } })

const STAGES = ["APPLIED", "APPLIED", "SHORTLISTED", "SHORTLISTED", "INTERVIEW", "INTERVIEW", "OFFERED", "HIRED", "REJECTED"]
let appCount = 0
const hired = []
for (const c of candidates) {
  const n = 1 + Math.floor(Math.random() * 3)
  const chosenJobs = [...jobs].sort(() => Math.random() - 0.5).slice(0, n)
  for (const j of chosenJobs) {
    const status = pick(STAGES)
    const appliedAt = daysAgo(Math.floor(Math.random() * 55))
    const app = await p.application.create({
      data: { userId: c.id, jobId: j.id, status, appliedAt, source: "demo",
        notes: NOTES[status], timeline: { create: { status, note: NOTES[status] } } },
    }).catch(() => null)
    if (app) { appCount++; if (status === "HIRED") hired.push(c) }
  }
}
console.log(`created ${appCount} applications across all stages`)

// ---- feed posts + engagement ----
for (let i = 0; i < POSTS.length; i++) {
  const author = pick(candidates)
  const post = await p.post.create({ data: { authorId: author.id, content: POSTS[i], createdAt: daysAgo(Math.floor(Math.random() * 20)) } })
  const likers = [...candidates].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 6))
  for (const l of likers) await p.postLike.create({ data: { postId: post.id, userId: l.id } }).catch(() => {})
  if (Math.random() < 0.6) await p.postComment.create({ data: { postId: post.id, userId: pick(candidates).id, content: pick(["Well said!", "Congratulations 🎉", "This resonates.", "Great insight, thanks for sharing.", "Couldn't agree more."]) } })
}
console.log(`created ${POSTS.length} feed posts with engagement`)

// ---- connections + profile views for the admin ----
for (const c of [...candidates].slice(0, 12)) {
  await p.connection.create({ data: { userId: admin.id, connectedId: c.id, status: "ACCEPTED" } }).catch(() => {})
  await p.profileView.create({ data: { viewerId: c.id, profileId: admin.id, createdAt: daysAgo(Math.floor(Math.random() * 30)) } }).catch(() => {})
}
console.log("created connections + profile views")

// ---- HRMS: onboard hired candidates as employees + attendance + leave ----
const DEPTS = ["Engineering", "Product", "People & HR", "Marketing", "Finance"]
const ONB = ["Offer letter signed", "Documents & ID collected", "Accounts & access created", "Workspace / equipment set up", "Induction & orientation", "Buddy / manager assigned"]
let empN = await p.employee.count({ where: { employerId: admin.id } })
const seenHire = new Set()
// staff the org with a real team: everyone hired, topped up to at least 9 people
const team = [...new Map([...hired, ...candidates.slice(0, 9)].map((c) => [c.id, c])).values()].slice(0, 10)
for (const c of team) {
  if (seenHire.has(c.id)) continue; seenHire.add(c.id)
  empN++
  const done = 2 + Math.floor(Math.random() * 5)
  const steps = JSON.stringify(ONB.map((label, i) => ({ label, done: i < done })))
  const status = done >= ONB.length ? "ACTIVE" : "ONBOARDING"
  const emp = await p.employee.create({
    data: { userId: c.id, employerId: admin.id, employeeCode: "EMP-" + String(empN).padStart(4, "0"),
      department: pick(DEPTS), designation: c.name.includes(" ") ? "Team Member" : "Associate", employmentType: "Full-time",
      status, salary: (80 + Math.floor(Math.random() * 60)) + ",000 CHF", onboarding: steps, joinedAt: daysAgo(Math.floor(Math.random() * 120)) },
  }).catch(() => null)
  if (!emp) continue
  // attendance for the last 5 working days
  for (let d = 0; d < 6; d++) {
    const day = dayStart(daysAgo(d))
    const st = pick(["PRESENT", "PRESENT", "PRESENT", "LATE", "REMOTE"])
    const ci = new Date(day); ci.setUTCHours(st === "LATE" ? 10 : 9, st === "LATE" ? 5 : 8)
    const co = new Date(day); co.setUTCHours(18, 0)
    await p.attendance.create({ data: { employeeId: emp.id, date: day, checkIn: ci, checkOut: d === 0 ? null : co, status: st, workedMins: d === 0 ? 0 : 540, method: "manual" } }).catch(() => {})
  }
  if (Math.random() < 0.5) {
    await p.leaveRequest.create({ data: { employeeId: emp.id, type: pick(["Annual", "Sick", "Casual"]), startDate: daysAgo(-7), endDate: daysAgo(-10), days: 3, reason: "Personal", status: "PENDING" } }).catch(() => {})
  }
}
console.log(`onboarded ${seenHire.size} employees with attendance + leave`)

console.log("\n✅ Demo data seeded. Sign in as super admin to see the product fully alive.")
await p.$disconnect()

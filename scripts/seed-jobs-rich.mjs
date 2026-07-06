// Seeds a realistic multi-industry job board so browsing feels populated.
// Idempotent: skips a job if the same title+company already exists.
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const employer = await prisma.user.findFirst({ where: { role: "EMPLOYER" }, orderBy: { createdAt: "asc" }, select: { id: true } })
if (!employer) { console.log("No employer found."); process.exit(1) }

const L = ["Zurich", "Geneva", "Basel", "Bern", "Lausanne", "Remote", "Zug", "Winterthur"]
const T = ["FULLTIME", "FULLTIME", "FULLTIME", "PARTTIME", "INTERNSHIP", "CONTRACT", "FREELANCE"]
const pick = (a, i) => a[i % a.length]
const sal = (lo, hi) => `${lo.toLocaleString()}–${hi.toLocaleString()} CHF`

// [industry, [ [title, company, salaryLo, salaryHi], ... ]]
const DATA = [
  ["Technology", [["Senior Software Engineer", "Helvetia Systems", 110000, 145000], ["Frontend Engineer (React)", "NovaCloud", 95000, 125000], ["DevOps Engineer", "AlpineScale", 105000, 135000], ["Data Scientist", "Insight AI", 115000, 150000], ["Mobile Developer (iOS)", "Peak Apps", 98000, 128000]]],
  ["Finance", [["Financial Analyst", "Léman Capital", 90000, 120000], ["Investment Associate", "Zurich Partners", 120000, 160000], ["Risk Manager", "SecureBank", 130000, 170000], ["Accountant", "HDFC Consulting", 80000, 100000], ["FinTech Product Manager", "PayFlux", 115000, 150000]]],
  ["Healthcare", [["Registered Nurse — ICU", "Apollo Hospitals", 75000, 95000], ["Clinical Research Associate", "MediTrials", 85000, 110000], ["Physiotherapist", "Alpine Health", 70000, 92000], ["Healthcare Data Analyst", "CareMetrics", 90000, 118000]]],
  ["Education", [["Secondary Maths Teacher", "Geneva International School", 68000, 88000], ["Instructional Designer", "LearnBridge", 78000, 100000], ["Academic Program Coordinator", "EduRank Institute", 72000, 94000], ["EdTech Content Lead", "BrightPath", 85000, 110000]]],
  ["Manufacturing", [["Production Supervisor", "PrecisionWerk", 78000, 98000], ["Quality Engineer", "SwissForm", 88000, 112000], ["Supply Chain Planner", "MechCore", 82000, 105000], ["Industrial Designer", "FormFactory", 80000, 104000]]],
  ["Retail", [["Store Manager", "AlpenMart", 65000, 85000], ["E-commerce Manager", "UrbanCart", 80000, 105000], ["Visual Merchandiser", "Vogue Retail", 60000, 78000], ["Category Buyer", "FreshGoods", 75000, 98000]]],
  ["Legal", [["Corporate Counsel", "Lex Helvetia", 120000, 160000], ["Compliance Officer", "RegShield", 100000, 130000], ["Paralegal", "Zurich Legal", 70000, 90000], ["Contracts Manager", "Meridian Law", 95000, 122000]]],
  ["Government", [["Policy Analyst", "Federal Office", 88000, 112000], ["Public Health Officer", "Canton Health", 85000, 108000], ["Urban Planner", "City of Bern", 90000, 115000]]],
  ["Logistics", [["Logistics Coordinator", "SwissMove", 70000, 90000], ["Warehouse Operations Lead", "CargoLink", 68000, 88000], ["Fleet Manager", "TransAlpine", 82000, 105000], ["Procurement Specialist", "SupplyChainCo", 85000, 108000]]],
  ["Energy", [["Renewable Energy Engineer", "SolarPeak", 100000, 130000], ["Grid Operations Analyst", "PowerGrid CH", 92000, 118000], ["Sustainability Consultant", "GreenFuture", 95000, 125000]]],
  ["Agriculture", [["Agronomist", "AlpFarms", 70000, 90000], ["Food Safety Specialist", "PureHarvest", 75000, 96000], ["AgriTech Product Lead", "FarmSense", 90000, 118000]]],
  ["Media", [["Content Strategist", "StoryLab", 78000, 100000], ["Graphic Designer", "CreativeStudio", 65000, 85000], ["Video Producer", "MotionHouse", 75000, 98000], ["Social Media Manager", "BuzzReach", 68000, 88000]]],
  ["Other", [["Talent Acquisition Manager", "PeopleFirst", 90000, 118000], ["Operations Manager", "Vertex Group", 95000, 125000], ["Customer Success Lead", "Delight", 82000, 106000], ["Executive Assistant", "Summit Corp", 62000, 80000]]],
]

let created = 0, skipped = 0, k = 0
for (const [industry, roles] of DATA) {
  for (const [title, company, lo, hi] of roles) {
    const exists = await prisma.job.findFirst({ where: { title, company } })
    if (exists) { skipped++; continue }
    const location = pick(L, k); const type = pick(T, k); k++
    await prisma.job.create({
      data: {
        title, company, industry, location, type,
        salary: sal(lo, hi),
        remote: location === "Remote" || k % 4 === 0,
        active: true,
        postedById: employer.id,
        description: `${company} is hiring a ${title}. You will own key outcomes, work with a strong team, and grow fast. We value verified professionals and offer a transparent, structured hiring process — you'll see your status live at every stage.\n\nWhat you'll do:\n• Deliver high-quality work in ${industry.toLowerCase()}\n• Collaborate across teams\n• Drive measurable impact\n\nWhat we offer: competitive CHF compensation, growth, and a modern workplace.`,
      },
    })
    created++
  }
}
console.log(`Seeded jobs — created: ${created}, skipped(existing): ${skipped}`)
const total = await prisma.job.count()
console.log(`Total jobs now: ${total}`)
await prisma.$disconnect()

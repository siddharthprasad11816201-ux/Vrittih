import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const employer = await p.user.findFirst({ where:{ role:{ in:["EMPLOYER","SUPER_ADMIN"] } } })
if (!employer) { console.log("No employer found"); await p.$disconnect(); process.exit(1) }
const jobs = [
  { title:"Senior Software Engineer", company:"TechCorp India", industry:"Technology", location:"Bengaluru", type:"FULLTIME", salary:"110,000–140,000 CHF", remote:false, description:"We are looking for a senior software engineer with 5+ years of experience in full-stack development." },
  { title:"Marketing Manager", company:"BrandHouse", industry:"Media", location:"Mumbai", type:"FULLTIME", salary:"95,000–120,000 CHF", remote:false, description:"Lead our marketing team and drive brand growth across digital and offline channels." },
  { title:"Data Analyst Intern", company:"FinanceAI", industry:"Finance", location:"Remote", type:"INTERNSHIP", salary:"2,500 CHF/month", remote:true, description:"Work with our data science team to analyze financial datasets and build insights dashboards." },
  { title:"Civil Engineer", company:"BuildRight", industry:"Manufacturing", location:"Delhi NCR", type:"FULLTIME", salary:"85,000–105,000 CHF", remote:false, description:"Join our infrastructure team working on large-scale construction projects across India." },
  { title:"HR Executive", company:"PeopleFirst", industry:"Other", location:"Hyderabad", type:"FULLTIME", salary:"70,000–90,000 CHF", remote:false, description:"Manage recruitment, onboarding, and employee relations for a growing team of 200+." },
  { title:"Graphic Designer", company:"CreativeStudio", industry:"Media", location:"Pune", type:"CONTRACT", salary:"6,000 CHF/month", remote:true, description:"Create compelling visual designs for digital campaigns, social media, and brand materials." },
  { title:"Accountant", company:"HDFC Consulting", industry:"Finance", location:"Chennai", type:"FULLTIME", salary:"80,000–100,000 CHF", remote:false, description:"Handle financial reporting, GST compliance, and audit preparation for corporate clients." },
  { title:"Nurse — ICU", company:"Apollo Hospitals", industry:"Healthcare", location:"Bengaluru", type:"FULLTIME", salary:"78,000–95,000 CHF", remote:false, description:"Provide critical care nursing in our ICU ward. 2+ years ICU experience required." },
]
for (const job of jobs) {
  await p.job.create({ data: { ...job, postedById: employer.id, active: true } })
  console.log("Created:", job.title)
}
await p.$disconnect()
console.log("Done — jobs seeded")

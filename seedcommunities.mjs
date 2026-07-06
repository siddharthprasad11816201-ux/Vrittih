import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const jobs = await p.job.findMany({ include:{ community:true } })
for (const job of jobs) {
  if (!job.community) {
    const slug = job.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-+/g,"-").slice(0,40)
    await p.jobCommunity.create({
      data: {
        jobId: job.id,
        name: `${job.title} @ ${job.company}`,
        description: `Community for applicants and professionals interested in the ${job.title} role at ${job.company}`,
        members: { create: { userId: job.postedById, role: "HOST" } }
      }
    })
    console.log("Created community for:", job.title)
  }
}

const spaces = [
  { name:"CEOs & Founders", slug:"ceo-founders", category:"LEADERSHIP", description:"A space for founders, CEOs, and senior leaders to connect and share insights", icon:"👔" },
  { name:"Engineers", slug:"engineers", category:"TECHNOLOGY", description:"All engineers — software, hardware, civil, mechanical — one space", icon:"💻" },
  { name:"Healthcare Professionals", slug:"healthcare", category:"HEALTHCARE", description:"Doctors, nurses, researchers, and healthcare workers", icon:"🩺" },
  { name:"Finance & Accounting", slug:"finance", category:"FINANCE", description:"CAs, bankers, analysts, and finance professionals", icon:"💰" },
  { name:"Educators & Researchers", slug:"education", category:"EDUCATION", description:"Teachers, professors, researchers, and academics", icon:"🎓" },
  { name:"Creative Professionals", slug:"creatives", category:"MEDIA", description:"Designers, writers, filmmakers, and artists", icon:"🎨" },
  { name:"Legal Professionals", slug:"legal", category:"LEGAL", description:"Lawyers, advocates, judges, and legal professionals", icon:"⚖️" },
  { name:"Job Seekers Lounge", slug:"job-seekers", category:"GENERAL", description:"A supportive space for all job seekers — share tips, get help, stay motivated", icon:"🤝" },
]

const admin = await p.user.findFirst({ where:{ role:{ in:["SUPER_ADMIN","ADMIN"] } } })
if (admin) {
  for (const space of spaces) {
    const existing = await p.professionalSpace.findUnique({ where:{ slug:space.slug } })
    if (!existing) {
      await p.professionalSpace.create({
        data: { ...space, createdById: admin.id, verified: true, members:{ create:{ userId:admin.id, role:"ADMIN" } } }
      })
      console.log("Created space:", space.name)
    }
  }
}

await p.$disconnect()
console.log("Done")

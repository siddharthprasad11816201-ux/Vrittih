import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const admin = await p.user.findFirst({ where:{ role:{ in:["SUPER_ADMIN","ADMIN","EMPLOYER"] } } })
if (!admin) { console.log("No admin/employer found"); await p.$disconnect(); process.exit(1) }

const tests = [
  {
    title: "General Aptitude Test",
    description: "Assess logical reasoning, numerical ability, and verbal comprehension",
    type: "APTITUDE",
    duration: 30,
    passingScore: 60,
    questions: [
      { type:"MCQ", text:"If a train travels 120km in 2 hours, what is its speed?", options:["40 km/h","60 km/h","80 km/h","100 km/h"], correctAnswer:"60 km/h", points:10 },
      { type:"MCQ", text:"Which word is the odd one out?", options:["Apple","Mango","Carrot","Banana"], correctAnswer:"Carrot", points:10 },
      { type:"MCQ", text:"What is 15% of 200?", options:["25","30","35","40"], correctAnswer:"30", points:10 },
      { type:"MCQ", text:"If BOOK = 2+15+15+11 = 43, what is PEN?", options:["33","35","37","39"], correctAnswer:"33", points:10 },
      { type:"MCQ", text:"Complete the series: 2, 4, 8, 16, ?", options:["24","28","32","36"], correctAnswer:"32", points:10 },
    ]
  },
  {
    title: "JavaScript Fundamentals",
    description: "Test your knowledge of JavaScript core concepts",
    type: "TECHNICAL",
    duration: 45,
    passingScore: 70,
    questions: [
      { type:"MCQ", text:"What does 'typeof null' return in JavaScript?", options:["null","undefined","object","string"], correctAnswer:"object", points:10 },
      { type:"MCQ", text:"Which method adds an element to the end of an array?", options:["push()","pop()","shift()","unshift()"], correctAnswer:"push()", points:10 },
      { type:"MCQ", text:"What is the output of: console.log(0.1 + 0.2 === 0.3)?", options:["true","false","undefined","error"], correctAnswer:"false", points:10 },
      { type:"MCQ", text:"Which keyword is used to declare a block-scoped variable?", options:["var","let","const","both let and const"], correctAnswer:"both let and const", points:10 },
      { type:"SHORT", text:"Explain the difference between == and === in JavaScript", correctAnswer:null, points:20 },
    ]
  },
  {
    title: "Personality & Work Style",
    description: "Understand your work preferences and behavioral tendencies",
    type: "PSYCHOMETRIC",
    duration: 20,
    passingScore: 0,
    questions: [
      { type:"SCALE", text:"I prefer working independently rather than in a team", options:["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"], correctAnswer:null, points:0 },
      { type:"SCALE", text:"I remain calm and focused under pressure and tight deadlines", options:["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"], correctAnswer:null, points:0 },
      { type:"SCALE", text:"I enjoy taking initiative and leading projects", options:["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"], correctAnswer:null, points:0 },
      { type:"SCALE", text:"I prefer a structured routine over a flexible, changing environment", options:["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"], correctAnswer:null, points:0 },
      { type:"MCQ", text:"How do you typically approach a complex problem?", options:["Break it into smaller parts","Research extensively first","Ask colleagues for input","Trust my instincts"], correctAnswer:null, points:0 },
    ]
  }
]

for (const t of tests) {
  const existing = await p.test.findFirst({ where:{ title: t.title } })
  if (!existing) {
    await p.test.create({
      data: {
        title: t.title,
        description: t.description,
        type: t.type,
        duration: t.duration,
        passingScore: t.passingScore,
        createdById: admin.id,
        active: true,
        questions: {
          create: t.questions.map((q, i) => ({
            type: q.type,
            text: q.text,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer || null,
            points: q.points,
            order: i
          }))
        }
      }
    })
    console.log("Created test:", t.title)
  } else {
    console.log("Already exists:", t.title)
  }
}

await p.$disconnect()
console.log("Done")
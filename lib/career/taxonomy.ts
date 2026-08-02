/* ICIRE — in-house skill taxonomy + implication graph. No external NLP libs, no
 * LLM: this is the owned knowledge base that turns free text into a structured
 * skill graph and infers IMPLIED skills (§4). Curated, extensible, patent-safe.
 *
 *  - SKILLS: canonical skill -> { category, aliases[] }.  Aliases drive explicit
 *    detection (case/space/punctuation-insensitive).
 *  - IMPLY: a trigger (a canonical skill, or a domain/phrase keyword) -> the
 *    skills it implies. E.g. "banking platform" implies auth, JWT, SQL, security…
 *    Applied transitively (bounded) so React -> JavaScript -> Git, etc.
 */

export type Category =
  | "language" | "frontend" | "backend" | "database" | "cloud" | "devops"
  | "data-ml" | "mobile" | "security" | "testing" | "design" | "domain" | "soft"

export type SkillDef = { category: Category; aliases?: string[] }

// Canonical skills. Keys are the display/canonical names.
export const SKILLS: Record<string, SkillDef> = {
  // languages
  "JavaScript": { category: "language", aliases: ["js", "ecmascript", "es6", "es2015"] },
  "TypeScript": { category: "language", aliases: ["ts"] },
  "Python": { category: "language", aliases: ["py", "python3"] },
  "Java": { category: "language" },
  "C++": { category: "language", aliases: ["cpp", "c plus plus"] },
  "C": { category: "language" },
  "C#": { category: "language", aliases: ["c-sharp", "csharp", "dotnet c#"] },
  "Go": { category: "language", aliases: ["golang"] },
  "Rust": { category: "language" },
  "Ruby": { category: "language" },
  "PHP": { category: "language" },
  "Swift": { category: "language" },
  "Kotlin": { category: "language" },
  "SQL": { category: "language", aliases: ["structured query language"] },
  "R": { category: "language" },
  "Scala": { category: "language" },
  "MATLAB": { category: "language" },
  "Solidity": { category: "language" },
  // frontend
  "React": { category: "frontend", aliases: ["react.js", "reactjs"] },
  "Next.js": { category: "frontend", aliases: ["nextjs", "next js"] },
  "Vue": { category: "frontend", aliases: ["vue.js", "vuejs"] },
  "Angular": { category: "frontend" },
  "Svelte": { category: "frontend", aliases: ["sveltekit"] },
  "HTML": { category: "frontend", aliases: ["html5"] },
  "CSS": { category: "frontend", aliases: ["css3"] },
  "Tailwind CSS": { category: "frontend", aliases: ["tailwind", "tailwindcss"] },
  "Redux": { category: "frontend" },
  "Frontend": { category: "frontend", aliases: ["front-end", "front end", "ui development"] },
  // backend
  "Node.js": { category: "backend", aliases: ["node", "nodejs"] },
  "Express": { category: "backend", aliases: ["express.js", "expressjs"] },
  "Django": { category: "backend" },
  "Flask": { category: "backend" },
  "FastAPI": { category: "backend" },
  "Spring Boot": { category: "backend", aliases: ["spring", "springboot"] },
  "Rails": { category: "backend", aliases: ["ruby on rails", "ror"] },
  "GraphQL": { category: "backend" },
  "REST API": { category: "backend", aliases: ["rest", "restful", "rest apis", "api development"] },
  "Microservices": { category: "backend", aliases: ["microservice"] },
  "Backend": { category: "backend", aliases: ["back-end", "back end", "server-side"] },
  "Authentication": { category: "backend", aliases: ["auth", "login system", "sign-in"] },
  "Authorization": { category: "backend", aliases: ["rbac", "access control", "permissions"] },
  "JWT": { category: "backend", aliases: ["json web token", "json web tokens"] },
  // database
  "PostgreSQL": { category: "database", aliases: ["postgres", "psql"] },
  "MySQL": { category: "database" },
  "MongoDB": { category: "database", aliases: ["mongo"] },
  "Redis": { category: "database" },
  "SQLite": { category: "database" },
  "Elasticsearch": { category: "database", aliases: ["elastic search", "opensearch"] },
  "Prisma": { category: "database" },
  "Database Design": { category: "database", aliases: ["schema design", "data modeling", "data modelling"] },
  // cloud / devops
  "AWS": { category: "cloud", aliases: ["amazon web services", "ec2", "s3", "lambda"] },
  "Azure": { category: "cloud", aliases: ["microsoft azure"] },
  "GCP": { category: "cloud", aliases: ["google cloud", "google cloud platform"] },
  "Docker": { category: "devops", aliases: ["containerization", "containers"] },
  "Kubernetes": { category: "devops", aliases: ["k8s"] },
  "CI/CD": { category: "devops", aliases: ["ci cd", "continuous integration", "continuous deployment", "github actions", "jenkins"] },
  "Terraform": { category: "devops", aliases: ["infrastructure as code", "iac"] },
  "Linux": { category: "devops", aliases: ["unix", "bash", "shell scripting"] },
  "Git": { category: "devops", aliases: ["github", "gitlab", "version control"] },
  "Deployment": { category: "devops", aliases: ["deploy", "hosting"] },
  // data / ml
  "Machine Learning": { category: "data-ml", aliases: ["ml"] },
  "Deep Learning": { category: "data-ml", aliases: ["dl", "neural networks"] },
  "TensorFlow": { category: "data-ml", aliases: ["tf"] },
  "PyTorch": { category: "data-ml", aliases: ["torch"] },
  "scikit-learn": { category: "data-ml", aliases: ["sklearn", "scikit learn"] },
  "Pandas": { category: "data-ml" },
  "NumPy": { category: "data-ml", aliases: ["numpy"] },
  "NLP": { category: "data-ml", aliases: ["natural language processing"] },
  "Computer Vision": { category: "data-ml", aliases: ["cv", "opencv", "image processing"] },
  "Data Analysis": { category: "data-ml", aliases: ["data analytics", "analytics"] },
  "Data Science": { category: "data-ml" },
  // mobile
  "Android": { category: "mobile" },
  "iOS": { category: "mobile" },
  "React Native": { category: "mobile", aliases: ["react-native"] },
  "Flutter": { category: "mobile" },
  // security / testing / design
  "Security": { category: "security", aliases: ["cybersecurity", "cyber security", "appsec", "application security"] },
  "Cryptography": { category: "security", aliases: ["encryption", "crypto"] },
  "Testing": { category: "testing", aliases: ["unit testing", "qa", "test automation", "jest", "pytest"] },
  "System Design": { category: "backend", aliases: ["distributed systems", "scalability"] },
  "Data Structures": { category: "backend", aliases: ["dsa", "data structures and algorithms"] },
  "Algorithms": { category: "backend", aliases: ["algorithm design"] },
  "UI/UX": { category: "design", aliases: ["ui ux", "ux design", "ui design", "user experience"] },
  "Figma": { category: "design" },
  // soft
  "Leadership": { category: "soft", aliases: ["team lead", "led a team", "team leadership"] },
  "Communication": { category: "soft", aliases: ["communication skills"] },
  "Teamwork": { category: "soft", aliases: ["collaboration", "team player"] },
  "Problem Solving": { category: "soft", aliases: ["problem-solving"] },
  "Project Management": { category: "soft", aliases: ["agile", "scrum", "kanban"] },
  "Research": { category: "soft", aliases: ["research work"] },
  "Mentoring": { category: "soft", aliases: ["mentorship", "mentored"] },
}

/* Implication graph. Key = a trigger: a canonical skill OR a lowercase phrase/
 * keyword found in text. Value = skills it implies. Applied to detected skills
 * and to raw text (domain phrases). Transitive closure is bounded in the engine. */
export const IMPLY: Record<string, string[]> = {
  // framework -> language / foundations
  "React": ["JavaScript", "Frontend", "HTML", "CSS"],
  "Next.js": ["React", "Node.js", "Frontend", "Backend"],
  "Vue": ["JavaScript", "Frontend", "HTML", "CSS"],
  "Angular": ["TypeScript", "Frontend"],
  "Redux": ["React", "JavaScript"],
  "Node.js": ["JavaScript", "Backend"],
  "Express": ["Node.js", "REST API", "Backend"],
  "Django": ["Python", "Backend", "REST API", "Database Design"],
  "Flask": ["Python", "Backend", "REST API"],
  "FastAPI": ["Python", "Backend", "REST API"],
  "Spring Boot": ["Java", "Backend", "REST API"],
  "Rails": ["Ruby", "Backend", "REST API"],
  "TensorFlow": ["Python", "Machine Learning", "Deep Learning"],
  "PyTorch": ["Python", "Machine Learning", "Deep Learning"],
  "scikit-learn": ["Python", "Machine Learning", "Data Analysis"],
  "Pandas": ["Python", "Data Analysis"],
  "NumPy": ["Python", "Data Analysis"],
  "Deep Learning": ["Machine Learning"],
  "NLP": ["Machine Learning", "Python"],
  "Computer Vision": ["Machine Learning", "Python"],
  "React Native": ["React", "JavaScript", "Mobile"],
  "Kubernetes": ["Docker", "CI/CD", "Linux"],
  "Terraform": ["CI/CD"],
  "JWT": ["Authentication", "Security"],
  "Authentication": ["Security", "Backend"],
  "Authorization": ["Security", "Backend"],
  "GraphQL": ["Backend", "REST API"],
  "Microservices": ["Backend", "System Design", "Docker"],
  "PostgreSQL": ["SQL", "Database Design"],
  "MySQL": ["SQL", "Database Design"],
  "SQLite": ["SQL"],
  "Prisma": ["Database Design", "TypeScript"],
  "TypeScript": ["JavaScript"],
  "AWS": ["Cloud", "Deployment"],
  "Docker": ["Deployment", "Linux"],
  // domain / project phrases -> a realistic implied skill set (§4 example)
  "banking": ["Authentication", "Authorization", "JWT", "Security", "SQL", "REST API", "Database Design", "Testing", "Git", "Frontend", "Backend", "Problem Solving"],
  "payment": ["Security", "REST API", "Authentication", "JWT", "Database Design"],
  "platform": ["System Design", "Backend"],
  "e-commerce": ["REST API", "Database Design", "Authentication", "Frontend", "Backend"],
  "ecommerce": ["REST API", "Database Design", "Authentication", "Frontend", "Backend"],
  "chat": ["WebSockets", "Backend", "REST API"],
  "real-time": ["WebSockets", "Backend"],
  "recommendation": ["Machine Learning", "Data Analysis"],
  "chatbot": ["NLP", "Machine Learning"],
  "dashboard": ["Frontend", "Data Analysis", "REST API"],
  "full stack": ["Frontend", "Backend", "Database Design", "REST API"],
  "full-stack": ["Frontend", "Backend", "Database Design", "REST API"],
  "web app": ["Frontend", "Backend", "REST API"],
  "web application": ["Frontend", "Backend", "REST API"],
  "mobile app": ["Mobile"],
  "api": ["REST API", "Backend"],
  "microservice": ["Microservices", "Backend"],
  "deployed": ["Deployment"],
  "scalable": ["System Design"],
  "led": ["Leadership"],
  "mentored": ["Mentoring", "Leadership"],
  "published": ["Research"],
  "hackathon": ["Problem Solving", "Teamwork"],
}

// Skills referenced only via IMPLY (not primary catalogue entries) still need a category.
const EXTRA: Record<string, Category> = { "WebSockets": "backend", "Cloud": "cloud", "Mobile": "mobile" }

export function categoryOf(skill: string): Category {
  return SKILLS[skill]?.category || EXTRA[skill] || "backend"
}

// Build a fast alias -> canonical lookup (lowercased, normalized).
const norm = (s: string) => s.toLowerCase().replace(/[-._/]/g, " ").replace(/\s+/g, " ").trim()
const ALIAS: Record<string, string> = {}
for (const [canon, def] of Object.entries(SKILLS)) {
  ALIAS[norm(canon)] = canon
  for (const a of def.aliases || []) ALIAS[norm(a)] = canon
}
export function canonical(alias: string): string | null {
  return ALIAS[norm(alias)] || null
}
export function allAliases(): { alias: string; canon: string }[] {
  return Object.entries(ALIAS).map(([alias, canon]) => ({ alias, canon }))
}
export { norm as normalizeText }

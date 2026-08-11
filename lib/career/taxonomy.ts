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

  // ── expanded coverage: more tech breadth + cross-industry (data/business/finance/
  //    healthcare/education/trades map to domain|soft since the coach serves every field) ──
  // languages
  "Dart": { category: "language" },
  "Objective-C": { category: "language", aliases: ["objc"] },
  "Elixir": { category: "language" },
  "Perl": { category: "language" },
  "VBA": { category: "language", aliases: ["visual basic"] },
  // frontend
  "Sass": { category: "frontend", aliases: ["scss"] },
  "Webpack": { category: "frontend" },
  "Vite": { category: "frontend" },
  "jQuery": { category: "frontend" },
  "Bootstrap": { category: "frontend" },
  "Accessibility": { category: "frontend", aliases: ["a11y", "wcag"] },
  // backend
  "NestJS": { category: "backend", aliases: ["nest.js"] },
  "Laravel": { category: "backend" },
  "ASP.NET": { category: "backend", aliases: ["asp net", ".net core", "dotnet core"] },
  "gRPC": { category: "backend" },
  "Kafka": { category: "backend", aliases: ["apache kafka"] },
  "RabbitMQ": { category: "backend", aliases: ["message queue"] },
  "OAuth": { category: "backend", aliases: ["oauth2", "openid connect"] },
  // database
  "DynamoDB": { category: "database" },
  "Cassandra": { category: "database" },
  "Snowflake": { category: "database" },
  "BigQuery": { category: "database" },
  "Oracle": { category: "database", aliases: ["oracle db", "pl/sql"] },
  "Firebase": { category: "database", aliases: ["firestore"] },
  "Supabase": { category: "database" },
  // cloud / devops
  "Ansible": { category: "devops" },
  "Helm": { category: "devops" },
  "Prometheus": { category: "devops" },
  "Grafana": { category: "devops" },
  "Nginx": { category: "devops" },
  "Vercel": { category: "cloud", aliases: ["netlify"] },
  // data / ml
  "Keras": { category: "data-ml" },
  "XGBoost": { category: "data-ml" },
  "Apache Spark": { category: "data-ml", aliases: ["spark", "pyspark"] },
  "Airflow": { category: "data-ml", aliases: ["apache airflow"] },
  "Tableau": { category: "data-ml" },
  "Power BI": { category: "data-ml", aliases: ["powerbi"] },
  "Matplotlib": { category: "data-ml" },
  "Statistics": { category: "data-ml", aliases: ["statistical analysis"] },
  "LLMs": { category: "data-ml", aliases: ["large language models", "llm", "generative ai", "genai"] },
  "MLOps": { category: "data-ml" },
  "Jupyter": { category: "data-ml", aliases: ["jupyter notebook"] },
  // mobile
  "SwiftUI": { category: "mobile" },
  "Ionic": { category: "mobile" },
  // security / testing
  "Penetration Testing": { category: "security", aliases: ["pentesting", "pen testing", "ethical hacking"] },
  "OWASP": { category: "security" },
  "IAM": { category: "security", aliases: ["identity and access management"] },
  "Selenium": { category: "testing" },
  "Cypress": { category: "testing" },
  "Playwright": { category: "testing" },
  // design
  "Adobe XD": { category: "design" },
  "Sketch": { category: "design" },
  "Photoshop": { category: "design", aliases: ["adobe photoshop"] },
  "Wireframing": { category: "design", aliases: ["wireframes"] },
  "User Research": { category: "design", aliases: ["ux research", "usability testing"] },
  // domain — cross-industry
  "Product Management": { category: "domain", aliases: ["product manager", "roadmapping"] },
  "Digital Marketing": { category: "domain", aliases: ["online marketing"] },
  "SEO": { category: "domain", aliases: ["search engine optimization", "search engine optimisation"] },
  "Content Writing": { category: "domain", aliases: ["copywriting", "content creation"] },
  "Sales": { category: "domain", aliases: ["b2b sales", "business development"] },
  "CRM": { category: "domain", aliases: ["salesforce", "hubspot", "customer relationship management"] },
  "Accounting": { category: "domain", aliases: ["bookkeeping", "accounts payable", "accounts receivable"] },
  "Financial Analysis": { category: "domain", aliases: ["financial modeling", "financial modelling"] },
  "Excel": { category: "domain", aliases: ["microsoft excel", "spreadsheets", "advanced excel"] },
  "Customer Service": { category: "domain", aliases: ["customer support", "client service"] },
  "Supply Chain": { category: "domain", aliases: ["logistics", "inventory management", "procurement"] },
  "Payroll": { category: "domain" },
  "Recruiting": { category: "domain", aliases: ["talent acquisition", "sourcing"] },
  "Patient Care": { category: "domain", aliases: ["nursing", "clinical care", "bedside care"] },
  "Teaching": { category: "domain", aliases: ["instruction", "curriculum design", "lesson planning"] },
  "Event Management": { category: "domain", aliases: ["event planning"] },
  // soft
  "Adaptability": { category: "soft", aliases: ["flexibility"] },
  "Critical Thinking": { category: "soft" },
  "Time Management": { category: "soft", aliases: ["prioritization", "prioritisation"] },
  "Negotiation": { category: "soft" },
  "Creativity": { category: "soft" },
  "Attention to Detail": { category: "soft", aliases: ["detail-oriented"] },
  "Public Speaking": { category: "soft", aliases: ["presentation skills"] },
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
  // expanded skill implications
  "NestJS": ["Node.js", "TypeScript", "Backend"],
  "Laravel": ["PHP", "Backend", "REST API"],
  "ASP.NET": ["C#", "Backend"],
  "Kafka": ["Backend", "System Design"],
  "RabbitMQ": ["Backend"],
  "OAuth": ["Authentication", "Security"],
  "gRPC": ["REST API", "Backend"],
  "Keras": ["Deep Learning", "Python", "Machine Learning"],
  "XGBoost": ["Machine Learning", "Python"],
  "Apache Spark": ["Data Analysis", "Data Science"],
  "Airflow": ["Data Analysis", "Python"],
  "Tableau": ["Data Analysis"],
  "Power BI": ["Data Analysis"],
  "Matplotlib": ["Data Analysis", "Python"],
  "LLMs": ["NLP", "Machine Learning", "Deep Learning"],
  "MLOps": ["Machine Learning", "Docker", "CI/CD"],
  "Jupyter": ["Python", "Data Analysis"],
  "SwiftUI": ["Swift", "iOS", "Mobile"],
  "Ionic": ["Mobile", "JavaScript"],
  "Penetration Testing": ["Security"],
  "OWASP": ["Security"],
  "IAM": ["Security", "Authorization"],
  "Selenium": ["Testing"],
  "Cypress": ["Testing", "JavaScript"],
  "Playwright": ["Testing", "TypeScript"],
  "Sass": ["CSS", "Frontend"],
  "Webpack": ["Frontend", "JavaScript"],
  "Vite": ["Frontend"],
  "jQuery": ["JavaScript", "Frontend"],
  "Bootstrap": ["CSS", "Frontend"],
  "DynamoDB": ["Database Design", "AWS"],
  "Cassandra": ["Database Design"],
  "Snowflake": ["SQL", "Data Analysis"],
  "BigQuery": ["SQL", "Data Analysis", "GCP"],
  "Firebase": ["Database Design"],
  "Supabase": ["PostgreSQL", "Database Design"],
  "Ansible": ["CI/CD", "Linux"],
  "Helm": ["Kubernetes"],
  "Prometheus": ["CI/CD"],
  "Grafana": ["Data Analysis"],
  "Nginx": ["Deployment", "Linux"],
  "SEO": ["Digital Marketing"],
  "CRM": ["Sales"],
  "Financial Analysis": ["Excel", "Accounting"],
  "Product Management": ["Project Management"],
  "User Research": ["UI/UX"],
  "Wireframing": ["UI/UX", "Figma"],
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

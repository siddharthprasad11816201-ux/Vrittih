/* ICIRE §12 — curated, in-house resource catalog. High-quality only, in the
 * spec's priority order (official docs → top universities → official books → top
 * repos → practice → projects). These are recommended LINKS (content), not
 * dependencies. Per-skill entries with category fallbacks so every gap gets a
 * credible plan. Extend freely. */
import type { Category } from "./taxonomy"

export type ResourceType = "docs" | "course" | "book" | "repo" | "practice" | "video" | "project"
export type Resource = { title: string; provider: string; url: string; type: ResourceType }

const CATALOG: Record<string, Resource[]> = {
  "JavaScript": [
    { title: "JavaScript Guide", provider: "MDN", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", type: "docs" },
    { title: "Eloquent JavaScript", provider: "Marijn Haverbeke", url: "https://eloquentjavascript.net/", type: "book" },
  ],
  "TypeScript": [
    { title: "TypeScript Handbook", provider: "Microsoft", url: "https://www.typescriptlang.org/docs/handbook/intro.html", type: "docs" },
    { title: "type-challenges", provider: "GitHub", url: "https://github.com/type-challenges/type-challenges", type: "practice" },
  ],
  "Python": [
    { title: "The Python Tutorial", provider: "python.org", url: "https://docs.python.org/3/tutorial/", type: "docs" },
    { title: "CS50P — Intro to Python", provider: "Harvard", url: "https://cs50.harvard.edu/python/", type: "course" },
  ],
  "React": [
    { title: "React Docs (Learn)", provider: "react.dev", url: "https://react.dev/learn", type: "docs" },
    { title: "Frontend Masters — Complete React", provider: "Frontend Masters", url: "https://frontendmasters.com/courses/complete-react-v9/", type: "course" },
  ],
  "Next.js": [{ title: "Next.js Learn", provider: "Vercel", url: "https://nextjs.org/learn", type: "course" }],
  "Node.js": [{ title: "Node.js Guides", provider: "nodejs.org", url: "https://nodejs.org/en/learn", type: "docs" }],
  "Django": [{ title: "Django Documentation", provider: "Django", url: "https://docs.djangoproject.com/en/stable/", type: "docs" }],
  "SQL": [{ title: "SQLBolt — interactive SQL", provider: "SQLBolt", url: "https://sqlbolt.com/", type: "practice" }, { title: "Use The Index, Luke", provider: "Markus Winand", url: "https://use-the-index-luke.com/", type: "docs" }],
  "PostgreSQL": [{ title: "PostgreSQL Documentation", provider: "PostgreSQL", url: "https://www.postgresql.org/docs/current/", type: "docs" }],
  "Redis": [{ title: "Redis University", provider: "Redis", url: "https://university.redis.io/", type: "course" }],
  "Docker": [{ title: "Docker: Get Started", provider: "Docker", url: "https://docs.docker.com/get-started/", type: "docs" }],
  "Kubernetes": [{ title: "Kubernetes Basics", provider: "Kubernetes", url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/", type: "docs" }, { title: "Kubernetes the Hard Way", provider: "Kelsey Hightower", url: "https://github.com/kelseyhightower/kubernetes-the-hard-way", type: "repo" }],
  "AWS": [{ title: "AWS Skill Builder", provider: "AWS", url: "https://skillbuilder.aws/", type: "course" }],
  "CI/CD": [{ title: "GitHub Actions Docs", provider: "GitHub", url: "https://docs.github.com/actions", type: "docs" }],
  "System Design": [
    { title: "System Design Primer", provider: "GitHub", url: "https://github.com/donnemartin/system-design-primer", type: "repo" },
    { title: "System Design 101", provider: "ByteByteGo", url: "https://github.com/ByteByteGoHq/system-design-101", type: "repo" },
  ],
  "Data Structures": [{ title: "MIT 6.006 Intro to Algorithms", provider: "MIT OCW", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", type: "course" }],
  "Algorithms": [{ title: "MIT 6.006 Intro to Algorithms", provider: "MIT OCW", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", type: "course" }],
  "Machine Learning": [{ title: "Machine Learning Specialization", provider: "Stanford / DeepLearning.AI", url: "https://www.coursera.org/specializations/machine-learning-introduction", type: "course" }],
  "Deep Learning": [{ title: "Deep Learning Book", provider: "Goodfellow, Bengio, Courville", url: "https://www.deeplearningbook.org/", type: "book" }],
  "TensorFlow": [{ title: "TensorFlow Tutorials", provider: "Google", url: "https://www.tensorflow.org/tutorials", type: "docs" }],
  "PyTorch": [{ title: "PyTorch Tutorials", provider: "Meta", url: "https://pytorch.org/tutorials/", type: "docs" }],
  "NLP": [{ title: "Hugging Face NLP Course", provider: "Hugging Face", url: "https://huggingface.co/learn/nlp-course", type: "course" }],
  "REST API": [{ title: "MDN — HTTP", provider: "MDN", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP", type: "docs" }],
  "GraphQL": [{ title: "GraphQL — Learn", provider: "graphql.org", url: "https://graphql.org/learn/", type: "docs" }],
  "Security": [{ title: "OWASP Cheat Sheet Series", provider: "OWASP", url: "https://cheatsheetseries.owasp.org/", type: "docs" }],
  "Git": [{ title: "Pro Git", provider: "Scott Chacon", url: "https://git-scm.com/book/en/v2", type: "book" }],
  "Linux": [{ title: "The Linux Command Line", provider: "William Shotts", url: "https://linuxcommand.org/tlcl.php", type: "book" }],
  "UI/UX": [{ title: "Refactoring UI", provider: "Adam Wathan & Steve Schoger", url: "https://www.refactoringui.com/", type: "book" }],
}

const CATEGORY_FALLBACK: Partial<Record<Category, Resource[]>> = {
  frontend: [{ title: "web.dev — Learn", provider: "Google", url: "https://web.dev/learn/", type: "course" }],
  backend: [{ title: "System Design Primer", provider: "GitHub", url: "https://github.com/donnemartin/system-design-primer", type: "repo" }],
  "data-ml": [{ title: "Machine Learning Specialization", provider: "Stanford / DeepLearning.AI", url: "https://www.coursera.org/specializations/machine-learning-introduction", type: "course" }],
  devops: [{ title: "roadmap.sh — DevOps", provider: "roadmap.sh", url: "https://roadmap.sh/devops", type: "docs" }],
  cloud: [{ title: "AWS Skill Builder", provider: "AWS", url: "https://skillbuilder.aws/", type: "course" }],
  database: [{ title: "SQLBolt", provider: "SQLBolt", url: "https://sqlbolt.com/", type: "practice" }],
  security: [{ title: "OWASP Cheat Sheets", provider: "OWASP", url: "https://cheatsheetseries.owasp.org/", type: "docs" }],
  soft: [{ title: "MIT 6.005/comm resources", provider: "MIT OCW", url: "https://ocw.mit.edu/", type: "course" }],
}

// Practice venues (§12) — offered alongside technical skills.
export const PRACTICE: Resource[] = [
  { title: "LeetCode", provider: "LeetCode", url: "https://leetcode.com/", type: "practice" },
  { title: "Codeforces", provider: "Codeforces", url: "https://codeforces.com/", type: "practice" },
  { title: "HackerRank", provider: "HackerRank", url: "https://www.hackerrank.com/", type: "practice" },
]

// A concrete project idea to demonstrate a skill (§25 — portfolio proof).
export function projectIdea(skill: string): Resource {
  const ideas: Record<string, string> = {
    "System Design": "Design and document a URL shortener that scales to 100M links (write-up + diagram).",
    "Kubernetes": "Containerize a 3-service app and deploy it to a local k8s cluster with a Helm chart.",
    "Redis": "Add a Redis cache + rate limiter in front of an existing API and measure the latency win.",
    "Machine Learning": "Train and deploy a model on a real dataset with an evaluation write-up.",
    "React": "Build a small production-quality app (auth + data + tests) and deploy it.",
  }
  return { title: ideas[skill] || `Build a small project that uses ${skill} end-to-end and publish it on GitHub.`, provider: "Portfolio project", url: "", type: "project" }
}

export function resourcesFor(skill: string, category: Category): Resource[] {
  const base = CATALOG[skill] || CATEGORY_FALLBACK[category] || [{ title: `Official ${skill} documentation`, provider: "Official", url: "", type: "docs" as ResourceType }]
  const out = [...base]
  if (category !== "soft" && category !== "design") out.push(PRACTICE[0]) // a place to practise
  out.push(projectIdea(skill)) // and something to build
  return out
}

/* Professional-link platform catalog — PURE data (no node imports), safe to
 * import in client components. lib/social/verify.ts (server) re-uses this. */

export type Platform = { key: string; label: string; host?: RegExp; placeholder: string; hint?: string }

export const PLATFORMS: Platform[] = [
  { key: "linkedin", label: "LinkedIn", host: /(^|\.)linkedin\.com$/i, placeholder: "https://www.linkedin.com/in/your-handle" },
  { key: "github", label: "GitHub", host: /(^|\.)github\.com$/i, placeholder: "https://github.com/your-handle", hint: "Add the token to your GitHub bio or profile README." },
  { key: "twitter", label: "X / Twitter", host: /(^|\.)(twitter|x)\.com$/i, placeholder: "https://x.com/your-handle" },
  { key: "linktree", label: "Linktree", host: /(^|\.)linktr\.ee$/i, placeholder: "https://linktr.ee/your-handle" },
  { key: "website", label: "Website", placeholder: "https://your-domain.com", hint: "Add the token anywhere on the page (footer works)." },
  { key: "portfolio", label: "Portfolio", placeholder: "https://your-portfolio.com" },
  { key: "behance", label: "Behance", host: /(^|\.)behance\.net$/i, placeholder: "https://www.behance.net/your-handle" },
  { key: "dribbble", label: "Dribbble", host: /(^|\.)dribbble\.com$/i, placeholder: "https://dribbble.com/your-handle" },
  { key: "medium", label: "Medium", host: /(^|\.)medium\.com$/i, placeholder: "https://medium.com/@your-handle" },
  { key: "stackoverflow", label: "Stack Overflow", host: /(^|\.)stackoverflow\.com$/i, placeholder: "https://stackoverflow.com/users/…" },
  { key: "gitlab", label: "GitLab", host: /(^|\.)gitlab\.com$/i, placeholder: "https://gitlab.com/your-handle" },
  { key: "devto", label: "Dev.to", host: /(^|\.)dev\.to$/i, placeholder: "https://dev.to/your-handle" },
  { key: "youtube", label: "YouTube", host: /(^|\.)(youtube\.com|youtu\.be)$/i, placeholder: "https://youtube.com/@your-handle" },
  { key: "scholar", label: "Google Scholar", host: /(^|\.)scholar\.google\.com$/i, placeholder: "https://scholar.google.com/citations?user=…" },
  { key: "orcid", label: "ORCID", host: /(^|\.)orcid\.org$/i, placeholder: "https://orcid.org/0000-0000-0000-0000" },
]
export const PLATFORM_BY_KEY = new Map(PLATFORMS.map((p) => [p.key, p]))
export const PLATFORM_LABEL = (k: string) => PLATFORM_BY_KEY.get(k)?.label || k

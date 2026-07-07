// Curated directory of real funding sources for students, researchers, early-career
// founders and innovators. Public information; in-house data (no paid API).

export type FundingSource = {
  name: string
  type: "VC" | "Angel" | "Accelerator" | "Grant" | "Government" | "Foundation" | "Scholarship"
  region: "Global" | "Europe" | "Switzerland" | "US" | "India" | "UK"
  stage: string[]          // idea / seed / early / growth / research / student
  focus: string[]          // deeptech / saas / research / social / health / education / general / climate
  ticket: string
  url: string
  desc: string
}

export const FUNDING: FundingSource[] = [
  // Accelerators
  { name: "Y Combinator", type: "Accelerator", region: "Global", stage: ["idea", "seed"], focus: ["general", "deeptech", "saas"], ticket: "$500k for 7%", url: "https://ycombinator.com", desc: "The most influential startup accelerator; standard deal, huge alumni network and demo day." },
  { name: "Techstars", type: "Accelerator", region: "Global", stage: ["seed"], focus: ["general"], ticket: "$20k + $100k note", url: "https://techstars.com", desc: "Global mentorship-driven accelerator with dozens of city and vertical programs." },
  { name: "Antler", type: "Accelerator", region: "Global", stage: ["idea", "seed"], focus: ["general", "deeptech"], ticket: "~$100k–250k", url: "https://antler.co", desc: "Day-zero investor — helps you find co-founders and build from scratch." },
  { name: "Entrepreneur First", type: "Accelerator", region: "Europe", stage: ["idea"], focus: ["deeptech", "general"], ticket: "Stipend + pre-seed", url: "https://joinef.com", desc: "Backs individuals before they have a company or team." },
  { name: "SOSV / HAX", type: "Accelerator", region: "Global", stage: ["seed"], focus: ["deeptech", "climate", "health"], ticket: "$250k+", url: "https://sosv.com", desc: "Deep-tech, hard-science and climate accelerator (HAX for hardware, IndieBio for bio)." },
  { name: "Plug and Play", type: "Accelerator", region: "Global", stage: ["seed", "early"], focus: ["general"], ticket: "Varies", url: "https://plugandplaytechcenter.com", desc: "Corporate-innovation platform connecting startups to enterprises + investment." },

  // VCs
  { name: "Sequoia Capital", type: "VC", region: "Global", stage: ["seed", "early", "growth"], focus: ["general", "deeptech", "saas"], ticket: "$1M–100M+", url: "https://sequoiacap.com", desc: "Legendary multi-stage VC backing category-defining companies." },
  { name: "Andreessen Horowitz (a16z)", type: "VC", region: "US", stage: ["seed", "early", "growth"], focus: ["general", "deeptech", "health"], ticket: "$1M–100M+", url: "https://a16z.com", desc: "Full-stack VC across software, bio, crypto, and American dynamism." },
  { name: "Accel", type: "VC", region: "Global", stage: ["early", "growth"], focus: ["saas", "general"], ticket: "$5M–50M", url: "https://accel.com", desc: "Early and growth investor behind many SaaS and consumer leaders." },
  { name: "Index Ventures", type: "VC", region: "Europe", stage: ["early", "growth"], focus: ["general", "saas"], ticket: "$3M–50M", url: "https://indexventures.com", desc: "Transatlantic VC strong across Europe and the US." },
  { name: "Balderton Capital", type: "VC", region: "Europe", stage: ["early"], focus: ["general", "saas"], ticket: "$3M–25M", url: "https://balderton.com", desc: "Leading European early-stage fund." },
  { name: "Point Nine", type: "VC", region: "Europe", stage: ["seed"], focus: ["saas"], ticket: "$500k–5M", url: "https://pointnine.com", desc: "Seed specialist for B2B SaaS and marketplaces." },
  { name: "Lightspeed", type: "VC", region: "Global", stage: ["seed", "early", "growth"], focus: ["general", "deeptech"], ticket: "$1M–50M", url: "https://lsvp.com", desc: "Multi-stage global fund across enterprise and consumer." },

  // Angel networks
  { name: "European Business Angels Network (EBAN)", type: "Angel", region: "Europe", stage: ["idea", "seed"], focus: ["general"], ticket: "€25k–500k", url: "https://eban.org", desc: "Federation of angel networks across Europe — find local angels." },
  { name: "Indian Angel Network", type: "Angel", region: "India", stage: ["seed"], focus: ["general"], ticket: "₹25L–5Cr", url: "https://indianangelnetwork.com", desc: "One of the world's largest angel networks; early-stage across sectors." },
  { name: "Angel Investment Network", type: "Angel", region: "Global", stage: ["idea", "seed"], focus: ["general"], ticket: "$10k–1M", url: "https://angelinvestmentnetwork.co.uk", desc: "Global platform matching founders with individual angels." },
  { name: "SICTIC (Swiss Angels)", type: "Angel", region: "Switzerland", stage: ["seed"], focus: ["deeptech", "general"], ticket: "CHF 50k–2M", url: "https://sictic.ch", desc: "Swiss ICT Investor Club — active angels for Swiss tech startups." },

  // Government / innovation agencies
  { name: "Innosuisse", type: "Government", region: "Switzerland", stage: ["research", "seed"], focus: ["deeptech", "research"], ticket: "Grants + coaching", url: "https://innosuisse.ch", desc: "Swiss Innovation Agency — innovation projects, start-up coaching, Innocheques." },
  { name: "Horizon Europe (EIC)", type: "Government", region: "Europe", stage: ["research", "seed", "early"], focus: ["deeptech", "climate", "health"], ticket: "€0.5M–17.5M", url: "https://eic.ec.europa.eu", desc: "EU's flagship innovation funding — EIC Accelerator grants + equity for deep tech." },
  { name: "Startup India Seed Fund", type: "Government", region: "India", stage: ["idea", "seed"], focus: ["general"], ticket: "Up to ₹50L", url: "https://seedfund.startupindia.gov.in", desc: "Government seed capital for proof-of-concept, prototype, and market entry." },
  { name: "SBIR / STTR (US)", type: "Government", region: "US", stage: ["research", "seed"], focus: ["deeptech", "health"], ticket: "$50k–1.7M", url: "https://sbir.gov", desc: "US non-dilutive R&D grants for small businesses across federal agencies." },
  { name: "DST / BIRAC (India)", type: "Government", region: "India", stage: ["research", "seed"], focus: ["deeptech", "health", "research"], ticket: "Grants", url: "https://birac.nic.in", desc: "Indian government support for science, biotech and deep-tech innovation." },

  // Research funding & foundations
  { name: "Swiss National Science Foundation (SNSF)", type: "Grant", region: "Switzerland", stage: ["research"], focus: ["research"], ticket: "Project grants", url: "https://snf.ch", desc: "Primary Swiss funder of fundamental research across all disciplines." },
  { name: "European Research Council (ERC)", type: "Grant", region: "Europe", stage: ["research"], focus: ["research"], ticket: "€1.5M–2.5M", url: "https://erc.europa.eu", desc: "Prestigious frontier-research grants (Starting/Consolidator/Advanced)." },
  { name: "UKRI", type: "Grant", region: "UK", stage: ["research"], focus: ["research"], ticket: "Varies", url: "https://ukri.org", desc: "UK Research and Innovation — councils funding research and innovation." },
  { name: "US National Science Foundation (NSF)", type: "Grant", region: "US", stage: ["research"], focus: ["research"], ticket: "Varies", url: "https://nsf.gov", desc: "Major US funder of non-medical fundamental research." },
  { name: "Wellcome Trust", type: "Foundation", region: "Global", stage: ["research"], focus: ["health", "research"], ticket: "Fellowships + grants", url: "https://wellcome.org", desc: "Global charitable foundation funding health and life-sciences research." },
  { name: "Gates Foundation", type: "Foundation", region: "Global", stage: ["research", "seed"], focus: ["health", "social"], ticket: "Grand Challenges", url: "https://gatesfoundation.org", desc: "Global health, development and education grants, incl. Grand Challenges." },

  // Scholarships (students / early career)
  { name: "Fulbright Program", type: "Scholarship", region: "Global", stage: ["student"], focus: ["education", "research"], ticket: "Full funding", url: "https://fulbrightprogram.org", desc: "Flagship US international exchange scholarships for study and research." },
  { name: "Chevening", type: "Scholarship", region: "UK", stage: ["student"], focus: ["education"], ticket: "Full master's", url: "https://chevening.org", desc: "UK government global scholarships for future leaders." },
  { name: "DAAD", type: "Scholarship", region: "Europe", stage: ["student", "research"], focus: ["education", "research"], ticket: "Stipends", url: "https://daad.de", desc: "German academic exchange — scholarships for study and research in Germany." },
  { name: "Swiss Government Excellence Scholarships", type: "Scholarship", region: "Switzerland", stage: ["student", "research"], focus: ["research", "education"], ticket: "Full funding", url: "https://sbfi.admin.ch", desc: "Scholarships for international researchers and artists to study in Switzerland." },
  { name: "Erasmus+", type: "Scholarship", region: "Europe", stage: ["student"], focus: ["education"], ticket: "Mobility grants", url: "https://erasmus-plus.ec.europa.eu", desc: "EU programme funding study, training and exchange across Europe." },
]

export const F_TYPES = ["VC", "Angel", "Accelerator", "Grant", "Government", "Foundation", "Scholarship"] as const
export const F_REGIONS = ["Global", "Europe", "Switzerland", "US", "India", "UK"] as const
export const F_STAGES = ["idea", "seed", "early", "growth", "research", "student"] as const

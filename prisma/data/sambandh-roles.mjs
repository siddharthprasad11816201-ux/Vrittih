// Sambandh hiring catalog, derived from the org blueprint (Volumes 19-24) by
// department hiring leads and then adversarially reviewed for credibility.
// Titles are distinct roles, not one per head: headcount indicates team size.

export const SAMBANDH = [
  {
    "department": "Executive Leadership",
    "reportsTo": "Board of Directors",
    "context": "You sit at the top of Sambandh and answer directly to the Board of Directors. You set company strategy, allocate people and budget across functions, break ties on cross-functional decisions, and run the quarterly business review cycle that holds every department to its commitments. Because Sambandh face-verifies every member and builds compatibility and honesty signals from sensitive personal data, the officer group also owns the standing decisions on verification, safety, age assurance and privacy that no single function can make alone.",
    "skills": [
      "officer or senior vice president level experience running a company-wide function in a consumer technology or regulated platform business",
      "direct accountability for a P&L, a multi-team organisation, or a company-wide operating budget",
      "working knowledge of India's Digital Personal Data Protection Act 2023 and IT intermediary rules as they apply to user-generated content and identity data",
      "experience setting or defending trust, safety, age-assurance or verification policy where failure results in real harm to users",
      "track record of running a quarterly planning and business review cycle across functions, including cutting scope when priorities conflict",
      "ability to present clearly and honestly to a board of directors, including material risks and bad news",
      "willingness to decide with incomplete information and to write down the reasoning so it can be reviewed later"
    ],
    "teams": [
      {
        "team": "Executive Leadership Team — Corporate and Technology Officers",
        "teamContext": "Owns company strategy, operating cadence, financial control, and the engineering, product, AI, security and information systems that Sambandh runs on.",
        "roles": [
          {
            "title": "Chief Executive Officer",
            "purpose": "Sets Sambandh's strategy and priorities, makes the final call on resource allocation and unresolved cross-functional decisions, and is accountable to the Board of Directors."
          },
          {
            "title": "Chief Operating Officer",
            "purpose": "Turns strategy into a quarterly operating plan and runs the review cadence that keeps every department's commitments visible and on track."
          },
          {
            "title": "Chief Technology Officer",
            "purpose": "Owns platform engineering, architecture and reliability for the systems that carry out member verification and serve matches."
          },
          {
            "title": "Chief Product Officer",
            "purpose": "Owns product direction for the member experience, including how face verification, the Lakshan Book and matching are explained, presented and consented to."
          },
          {
            "title": "Chief Financial Officer",
            "purpose": "Owns financial planning, controls, reporting and the unit economics behind pricing and spend decisions."
          },
          {
            "title": "Chief AI Officer",
            "purpose": "Owns the AI systems behind honesty and compatibility signals, including evaluation, bias testing, human review, abuse-detection methods and controls against misuse."
          },
          {
            "title": "Chief Information Security Officer",
            "purpose": "Owns security of member identity records, biometric verification artefacts and personal data, including threat modelling, access control and incident response."
          },
          {
            "title": "Chief Information Officer",
            "purpose": "Owns internal systems, corporate IT and data governance, including how employees and vendors are granted and audited access to member data."
          }
        ]
      },
      {
        "team": "Executive Leadership Team — Market, Member and Corporate Affairs Officers",
        "teamContext": "Owns revenue, brand and communications, member community standards and conduct enforcement, and the legal, people and expansion functions that govern how Sambandh operates in public.",
        "roles": [
          {
            "title": "Chief Marketing Officer",
            "purpose": "Owns brand positioning and marketing, and is accountable for every public claim about verification and honesty being accurate and substantiated before it is published."
          },
          {
            "title": "Chief Revenue Officer",
            "purpose": "Owns revenue delivery, pricing execution and commercial partnerships."
          },
          {
            "title": "Chief Community Officer",
            "purpose": "Owns community standards and member conduct policy, including how safety and age-assurance rules are written, enforced, appealed and escalated when a member reports harassment, impersonation or harm."
          },
          {
            "title": "Chief Legal Officer",
            "purpose": "Owns legal affairs, regulatory compliance and grievance and law-enforcement response under India's intermediary and data protection obligations."
          },
          {
            "title": "Chief People Officer",
            "purpose": "Owns hiring, organisation design, performance and employee wellbeing, including psychological support for staff who review distressing safety reports."
          },
          {
            "title": "Chief Communications Officer",
            "purpose": "Owns press, public affairs and internal communications, and leads communications during safety, verification or privacy incidents."
          },
          {
            "title": "Chief International Officer",
            "purpose": "Owns expansion beyond India, including jurisdiction-specific verification, age assurance and data residency requirements."
          },
          {
            "title": "Chief Administrative Officer",
            "purpose": "Owns the physical estate, workplace services, administration and business continuity — the Facilities, Infrastructure & Administration department reports to this officer."
          },
          {
            "title": "Chief Sustainability Officer",
            "purpose": "Owns environmental, ESG, accessibility and social impact commitments — the Sustainability, ESG & Social Impact department reports to this officer."
          },
          {
            "title": "Chief Research & Innovation Officer",
            "purpose": "Owns applied research into compatibility, verification and platform safety, and the long-horizon research agenda across the company."
          },
          {
            "title": "Chief Customer Officer",
            "purpose": "Owns the end-to-end member experience — onboarding, support, retention and the quality of every member-facing interaction."
          }
        ]
      }
    ],
    "removed": [
      "Chief Research & Innovation Officer — duplicates the Chief AI Officer. Its stated scope (applied research into compatibility, verification and abuse detection) is the same subject matter the Chief AI Officer already owns end to end, and 'Innovation Officer' is the vaguer of the two titles. Abuse-detection research folded into the Chief AI Officer purpose.",
      "Chief Administrative Officer — padding at officer level. Facilities, procurement, vendor management and business continuity are not in the team's stated remit (strategy, operating cadence, financial control, engineering, product, AI, security, information systems), and they sit naturally under the COO and CFO. Vendor access to member data is already owned by the CIO.",
      "Chief Customer Officer — duplicates the Chief Community Officer. Both were accountable for outcomes when a member reports harassment, impersonation or harm, which creates two officers owning the same failure and no clear decision-maker. Kept the Community role, which states the policy, enforcement, age-assurance and appeals ownership more precisely, and moved escalation ownership into it.",
      "Chief Sustainability Officer — invented scope. Environmental and social responsibility reporting is not among the team's stated responsibilities (revenue, brand and communications, member standards, legal, people, expansion), and the role as written is a reporting-and-commitments title with no operating accountability in this blueprint."
    ],
    "verdict": "FIXED"
  },
  {
    "department": "Facilities, Infrastructure & Administration",
    "reportsTo": "Chief Administrative Officer",
    "context": "You own the physical estate Sambandh runs on — offices, the verification and moderation floors, lab space and campus sites — from lease signature through daily upkeep, security and shutdown. Because our people handle government ID documents, face-verification media and user safety reports, the things this department controls (who gets through a door, how CCTV and visitor records are retained, which vendor is allowed unescorted onto a floor) are part of the platform's data protection posture, not just building housekeeping. You report to the Chief Administrative Officer and are judged on uptime, safety record, cost per seat and audit-ready documentation.",
    "skills": [
      "hands-on experience running commercial property or facilities in Indian metros, including statutory work: fire NOC, occupancy certificates, municipal and pollution-board permissions, lift and DG licences",
      "ability to work to written SLAs and planned preventive maintenance schedules, and to keep records that survive an external audit",
      "careful handling of restricted material generated by this department — CCTV footage, access-control logs, visitor registers, incident reports — with a working understanding of DPDP Act obligations and retention limits",
      "vendor and contractor management end to end: scoping, tendering, rate negotiation, SLA enforcement, safety inductions and invoice verification",
      "willingness to join an on-call or shift rota and to run incidents out of hours, including fire, power, water, medical and security events",
      "clear written English plus at least one Indian language used with contractors and site staff",
      "clearance of background verification before being granted site access, and willingness to be re-verified periodically"
    ],
    "teams": [
      {
        "team": "Corporate Real Estate",
        "teamContext": "Owns every lease Sambandh signs and the shape of the office portfolio as the company opens in new cities.",
        "roles": [
          {
            "title": "Director, Corporate Real Estate",
            "purpose": "Owns Sambandh's property strategy and the portfolio plan, and takes lease commitments to the Chief Administrative Officer for approval."
          },
          {
            "title": "Senior Real Estate Transaction Manager",
            "purpose": "Shortlists and due-diligences candidate sites against brief, power reliability, connectivity and staff commute, then runs negotiations with landlords and developers from term sheet to signed lease alongside Legal and Finance."
          },
          {
            "title": "Lease Administration Manager",
            "purpose": "Maintains the lease register and calendar so no rent revision, escalation, renewal or exit notice is missed."
          },
          {
            "title": "Lease Administrator",
            "purpose": "Processes rent, CAM and deposit transactions, reconciles landlord invoices and keeps lease documentation complete and retrievable for audit."
          },
          {
            "title": "Portfolio Strategy Analyst",
            "purpose": "Models occupancy cost, seat supply and consolidation options so portfolio decisions rest on documented analysis."
          },
          {
            "title": "Real Estate Project Manager, Expansion",
            "purpose": "Takes a signed lease through handover, fit-out and occupation so a new site opens on the date it was committed."
          }
        ]
      },
      {
        "team": "Campus Development",
        "teamContext": "Master-plans and builds Sambandh's larger sites, including research facilities, laboratories and innovation space.",
        "roles": [
          {
            "title": "Head of Campus Development",
            "purpose": "Owns the master plan and the capital construction programme across Sambandh's campus sites."
          },
          {
            "title": "Senior Master Planner",
            "purpose": "Sets the long-range land use, phasing and circulation plan that individual buildings are designed against."
          },
          {
            "title": "Design Manager",
            "purpose": "Manages architects and consultants so designs meet the brief, statutory codes and the agreed budget before anything is built."
          },
          {
            "title": "Construction Project Manager",
            "purpose": "Runs construction and fit-out packages on programme, cost and quality, and holds contractors to their contracts."
          },
          {
            "title": "Project Manager, Research Facilities and Laboratories",
            "purpose": "Delivers laboratory and research space with the specialist building services and restricted access controls those environments require."
          },
          {
            "title": "Cost Manager (Quantity Surveyor)",
            "purpose": "Prepares estimates, tender comparisons and valuations, and controls variations across the development programme."
          },
          {
            "title": "Sustainability and Green Building Manager",
            "purpose": "Sets green building certification targets and low-energy design requirements, and reviews project designs against them before construction starts."
          },
          {
            "title": "Construction Field Engineer",
            "purpose": "Supervises work on site day to day, checks quality against drawings and specifications, and records progress and snags."
          }
        ]
      },
      {
        "team": "Facilities Operations",
        "teamContext": "Keeps every occupied building running — power, cooling, water, fabric and the vendors behind them.",
        "roles": [
          {
            "title": "Head of Facilities Operations",
            "purpose": "Owns building performance, maintenance strategy and the operating budget across all occupied Sambandh sites."
          },
          {
            "title": "Regional Facilities Manager",
            "purpose": "Runs facilities delivery for a cluster of sites and is the single accountable contact for those buildings."
          },
          {
            "title": "Building Operations Supervisor",
            "purpose": "Runs the daily shift on a site: opening, rounds, fault response, permits to work and handover."
          },
          {
            "title": "Senior HVAC Engineer",
            "purpose": "Owns chillers, air handling and ventilation so occupied floors stay within temperature, humidity and air quality limits."
          },
          {
            "title": "Electrical Engineer, Building Services",
            "purpose": "Owns HT/LT distribution, UPS and generator systems so verification and moderation floors do not lose power."
          },
          {
            "title": "Plumbing and Water Systems Engineer",
            "purpose": "Maintains water supply, storage, treatment and drainage, including potable water quality testing."
          },
          {
            "title": "Preventive Maintenance Planner",
            "purpose": "Builds and schedules the PPM calendar in the CMMS and reports where planned work is slipping."
          },
          {
            "title": "Facilities Vendor Manager",
            "purpose": "Manages the contractor base for housekeeping, technical services and consumables against SLA and cost, including safety inductions and invoice verification."
          },
          {
            "title": "BMS and Controls Technician",
            "purpose": "Operates and tunes the building management system and investigates alarms before they become failures."
          },
          {
            "title": "Multi-skilled Facilities Technician",
            "purpose": "Carries out routine and reactive maintenance across electrical, plumbing and fabric work on assigned sites."
          }
        ]
      },
      {
        "team": "Physical Security",
        "teamContext": "Controls who enters Sambandh's premises and protects the floors where identity documents and verification media are handled.",
        "roles": [
          {
            "title": "Head of Physical Security",
            "purpose": "Owns the physical security standard for Sambandh, including how restricted floors handling member identity data are protected."
          },
          {
            "title": "Security Operations Centre Manager",
            "purpose": "Runs the SOC rota and ensures every alarm, alert and incident is triaged, escalated and closed with a record."
          },
          {
            "title": "Access Control Systems Engineer",
            "purpose": "Administers badge, door and turnstile systems and enforces least-privilege access to restricted areas."
          },
          {
            "title": "Video Surveillance Systems Specialist",
            "purpose": "Maintains CCTV coverage and manages footage retention, review and lawful release under documented controls and DPDP Act retention limits."
          },
          {
            "title": "Physical Security Analyst",
            "purpose": "Monitors access logs and camera systems on shift and reports anomalies such as tailgating or out-of-hours entry to restricted floors."
          },
          {
            "title": "Site Security Supervisor",
            "purpose": "Supervises the guarding contract at a site, runs deployment and briefings, and audits guard performance."
          },
          {
            "title": "Visitor Management Coordinator",
            "purpose": "Runs visitor registration, escorting rules and badge issue so no unescorted visitor or vendor reaches a restricted area, and keeps the visitor register accurate."
          },
          {
            "title": "Asset Protection and Investigations Manager",
            "purpose": "Investigates theft, device loss and physical policy breaches and works with Legal and HR on outcomes."
          }
        ]
      },
      {
        "team": "Workplace Experience",
        "teamContext": "Plans how space is used day to day — desks, meeting rooms, amenities and hybrid attendance.",
        "roles": [
          {
            "title": "Workplace Experience Manager",
            "purpose": "Owns workplace service standards across Sambandh offices and the service levels the facilities and hospitality vendors are measured against."
          },
          {
            "title": "Senior Workspace Planner",
            "purpose": "Produces block-and-stack and seating plans that match team adjacency and growth without over-leasing."
          },
          {
            "title": "Occupancy Planning Analyst",
            "purpose": "Measures actual utilisation and forecasts seat demand so space decisions are evidence-based and reported in aggregate, without identifying individuals."
          },
          {
            "title": "Meeting and Collaboration Spaces Coordinator",
            "purpose": "Keeps meeting rooms bookable, equipped and reliably usable, including private rooms needed for sensitive conversations such as safety escalations and HR matters."
          },
          {
            "title": "Hybrid Workplace Programme Manager",
            "purpose": "Runs the operational side of hybrid working — desk booking, peak-day floor readiness and coordination with the on-site shift rotas."
          }
        ]
      },
      {
        "team": "Administration",
        "teamContext": "Runs the back office of the offices: assets, supplies, mail and general administrative support.",
        "roles": [
          {
            "title": "Administration Manager",
            "purpose": "Owns office administration standards, budgets and the administrative team across Sambandh sites."
          },
          {
            "title": "Office Manager",
            "purpose": "Runs the day-to-day operation of a site, including supplies and pantry stock levels, and is the first point of contact for anything administrative there."
          },
          {
            "title": "Asset Administration Lead",
            "purpose": "Maintains the fixed asset and equipment register, including issue, return and documented disposal of devices that may have held sensitive data."
          },
          {
            "title": "Administrative Procurement and Vendor Coordinator",
            "purpose": "Raises and tracks administrative purchase orders and coordinates routine vendors against agreed rates."
          },
          {
            "title": "Mail and Courier Services Supervisor",
            "purpose": "Runs inward and outward mail and courier handling, including chain of custody for legal and regulatory correspondence."
          },
          {
            "title": "Administrative Coordinator",
            "purpose": "Provides scheduling, documentation and general administrative support to departments on site."
          }
        ]
      },
      {
        "team": "Travel & Mobility",
        "teamContext": "Books, controls and supports employee travel, visas and ground transport.",
        "roles": [
          {
            "title": "Travel and Mobility Manager",
            "purpose": "Owns Sambandh's travel policy, agency relationship and travel spend."
          },
          {
            "title": "Corporate Travel Coordinator",
            "purpose": "Books and reissues flights, rail and hotels within policy and supports travellers when plans break."
          },
          {
            "title": "Visa and Immigration Coordinator",
            "purpose": "Prepares and tracks visa and travel documentation for outbound and inbound trips, working with Legal on requirements."
          },
          {
            "title": "Ground Transportation Coordinator",
            "purpose": "Runs employee transport and cab arrangements, with particular attention to safe late-shift travel for staff on moderation and verification rotas."
          }
        ]
      },
      {
        "team": "Health, Safety & Environment",
        "teamContext": "Keeps people safe on Sambandh premises and keeps the company compliant with safety and environmental law.",
        "roles": [
          {
            "title": "Head of Health, Safety and Environment",
            "purpose": "Owns the HSE management system, statutory compliance and safety performance reporting for the company."
          },
          {
            "title": "Occupational Health and Safety Manager",
            "purpose": "Runs risk assessments, safe systems of work and incident investigation across sites."
          },
          {
            "title": "Fire Safety Officer",
            "purpose": "Maintains fire detection, suppression and evacuation readiness and keeps site fire NOCs and licences current."
          },
          {
            "title": "Emergency Preparedness Coordinator",
            "purpose": "Writes, drills and improves site emergency plans across fire, medical, power, intrusion and lockdown scenarios, and coordinates the on-site response rota."
          },
          {
            "title": "Environmental Compliance Specialist",
            "purpose": "Manages pollution-board consents, waste handling including e-waste, and environmental reporting obligations."
          },
          {
            "title": "HSE Officer",
            "purpose": "Carries out site inspections, contractor safety inductions and permit-to-work checks on the ground."
          },
          {
            "title": "Occupational Health Nurse",
            "purpose": "Provides on-site first response and occupational health support, including for staff exposed to distressing content in verification, moderation and user-safety roles."
          }
        ]
      },
      {
        "team": "Business Continuity",
        "teamContext": "Makes sure Sambandh can keep operating, and recover, when a site or service is lost.",
        "roles": [
          {
            "title": "Business Continuity Manager",
            "purpose": "Owns the continuity programme, the business impact analysis and the recovery commitments made to the business."
          },
          {
            "title": "Disaster Recovery Planner",
            "purpose": "Maintains recovery plans and alternate-site arrangements for critical operations, including the verification and user-safety functions that cannot simply pause."
          },
          {
            "title": "Crisis Management Lead",
            "purpose": "Runs the crisis command structure, call trees and mass-notification tooling, and coordinates response and authority liaison across departments when an event escalates."
          },
          {
            "title": "Business Continuity Analyst",
            "purpose": "Plans and runs continuity exercises and tests, records the failures they expose and tracks remediation to closure."
          }
        ]
      },
      {
        "team": "Smart Infrastructure",
        "teamContext": "Instruments and automates the estate — building IoT, energy and maintenance analytics in production use.",
        "roles": [
          {
            "title": "Head of Smart Infrastructure",
            "purpose": "Owns the technology roadmap for Sambandh's buildings and the business case behind each deployment."
          },
          {
            "title": "Smart Buildings Systems Engineer",
            "purpose": "Integrates BMS, metering, lighting and access systems into a single operable platform."
          },
          {
            "title": "IoT Engineer, Building Systems",
            "purpose": "Deploys and maintains building sensor networks and their gateways on a segmented network with authenticated devices."
          },
          {
            "title": "Energy Manager",
            "purpose": "Monitors and reduces energy and water consumption across the estate and verifies the savings claimed."
          },
          {
            "title": "Reliability Engineer, Predictive Maintenance",
            "purpose": "Turns equipment telemetry into failure predictions that change the maintenance schedule before assets fail."
          }
        ]
      },
      {
        "team": "Hospitality Services",
        "teamContext": "The front-of-house layer: reception, conferences, guest services and dining coordination.",
        "roles": [
          {
            "title": "Hospitality Services Manager",
            "purpose": "Owns front-of-house standards and the hospitality vendor contracts across Sambandh sites."
          },
          {
            "title": "Front Office Supervisor",
            "purpose": "Supervises the reception team and ensures every arrival is verified, logged and handed to an escort where required before entry."
          },
          {
            "title": "Front Desk Executive",
            "purpose": "Receives visitors, issues badges to the visitor management standard, and handles calls and enquiries at the building entrance."
          },
          {
            "title": "Conference and Events Coordinator",
            "purpose": "Plans and runs on-site meetings and events end to end, from room setup to catering and clear-down."
          },
          {
            "title": "Dining Services Coordinator",
            "purpose": "Coordinates cafeteria and catering vendors, including menu, hygiene audits and food safety compliance."
          }
        ]
      },
      {
        "team": "Smart Campus Research Lab",
        "teamContext": "Applied research on how buildings and campuses are run — digital twins, energy, robotics and positioning — with results tested against the live estate.",
        "roles": [
          {
            "title": "Head of Smart Campus Research Lab",
            "purpose": "Sets the lab's research agenda and decides which results graduate into the live estate."
          },
          {
            "title": "Research Scientist, Digital Twin Systems",
            "purpose": "Builds digital twin models of Sambandh campuses that are accurate enough to test operational decisions before making them."
          },
          {
            "title": "Research Engineer, Smart Energy Systems",
            "purpose": "Researches control strategies, storage and demand response that cut campus energy use without hurting occupant comfort."
          },
          {
            "title": "Robotics Engineer, Facility Operations",
            "purpose": "Develops and trials robots for cleaning, inspection and material movement in occupied buildings."
          },
          {
            "title": "Research Scientist, Indoor Positioning",
            "purpose": "Advances indoor positioning for wayfinding and emergency response, designed so it does not track identifiable individuals."
          },
          {
            "title": "Research Software Engineer",
            "purpose": "Turns lab prototypes into deployable, maintainable software that facilities teams can actually operate."
          }
        ]
      }
    ],
    "removed": [
      "Corporate Real Estate — Site Acquisition Manager: duplicates the front end of Senior Real Estate Transaction Manager (search, shortlist, due diligence are that role's normal scope). Site acquisition as a standalone title belongs to tower/retail rollout, not a corporate office portfolio. Search and due-diligence responsibilities folded into the Transaction Manager purpose.",
      "Physical Security — Emergency Response Manager: duplicates HSE's Emergency Preparedness Coordinator, HSE's Fire Safety Officer and Business Continuity's Crisis Management Lead. The department had four overlapping emergency roles; kept the two with the clearest ownership (preparedness/drills in HSE, escalated crisis command in Business Continuity).",
      "Workplace Experience — Employee Amenities Coordinator: vague purpose (\"amenities... actually work\") and duplicates Dining Services Coordinator and Office Manager pantry/supplies scope.",
      "Administration — Office Supplies and Inventory Coordinator: padding. Stocking consumables to par level is a task of the Office Manager and the Administrative Procurement and Vendor Coordinator, not a distinct title; added to the Office Manager purpose.",
      "Travel & Mobility — Global Mobility Specialist: relocations and long-stay assignments are not in the team's stated responsibilities (travel, visas, ground transport), and immigration work duplicates the Visa and Immigration Coordinator.",
      "Business Continuity — Emergency Coordination Officer: duplicates Crisis Management Lead. Call trees, mass notification and authority liaison merged into that role.",
      "Smart Infrastructure — Occupancy Analytics Engineer: duplicates Workplace Experience's Occupancy Planning Analyst and Corporate Real Estate's Portfolio Strategy Analyst. Kept the operational planning role, which already commits to aggregated, non-identifying reporting.",
      "Hospitality Services — Guest Services Executive: duplicates Front Desk Executive and Front Office Supervisor; \"looks after visiting partners and executives while on site\" is not a separate job on a controlled-access floor.",
      "Smart Campus Research Lab — Research Scientist, Sustainable Buildings: duplicates Campus Development's Sustainability and Green Building Manager plus the lab's own Research Engineer, Smart Energy Systems.",
      "Smart Campus Research Lab — Research Engineer, Autonomous Maintenance: duplicates Smart Infrastructure's Reliability Engineer, Predictive Maintenance, which already owns telemetry-driven maintenance action in production.",
      "Smart Campus Research Lab — Workplace Analytics Researcher: researching how working patterns affect \"productivity and wellbeing\" is People/HR territory, not facilities, duplicates the Occupancy Planning Analyst, and reads as employee monitoring at a company that must be beyond reproach on personal data."
    ],
    "verdict": "FIXED"
  },
  {
    "department": "Global Operations & Shared Services",
    "reportsTo": "Chief Operating Officer",
    "context": "You run the operational backbone that lets Sambandh's product, verification and safety teams work at scale — shared administrative and finance support, service delivery, process design, automation and operations research. Much of what passes through this department touches member records, identity-verification artefacts and Lakshan Book data, so every workflow, vendor arrangement and automation you build has to hold up under privacy scrutiny and a documented audit trail. You report to the Chief Operating Officer and are responsible for the SOPs, SLAs, dashboards and continuity plans the rest of the company depends on.",
    "skills": [
      "experience running or supporting operations in a consumer technology, marketplace or platform business",
      "ability to write and maintain SOPs, process maps and audit-ready operational documentation",
      "working knowledge of handling personal and identity-verification data under India's DPDP Act, including data minimisation and access control",
      "proficiency with SQL and a BI or dashboarding tool for operational reporting",
      "demonstrated experience defining, tracking and reporting operational KPIs and SLAs",
      "experience coordinating across engineering, trust and safety, and business teams without direct authority",
      "professional written and spoken English; working proficiency in Hindi or another Indian language is an advantage"
    ],
    "teams": [
      {
        "team": "Shared Business Services",
        "teamContext": "Runs the centralised administrative, finance, HR, procurement and contract processing that supports every other function, plus the internal service request desk.",
        "roles": [
          {
            "title": "Director, Shared Business Services",
            "purpose": "Owns the shared services function end to end, including service standards, staffing and the internal request desk other Sambandh teams depend on."
          },
          {
            "title": "Shared Services Manager",
            "purpose": "Manages a processing pod day to day, balancing queues, turnaround times and quality across administrative and finance support work."
          },
          {
            "title": "Finance Operations Analyst",
            "purpose": "Processes and reconciles operational finance transactions and supports month-end close for the business teams."
          },
          {
            "title": "Accounts Payable Specialist",
            "purpose": "Handles supplier invoice processing, payment runs and exception resolution."
          },
          {
            "title": "HR Operations Specialist",
            "purpose": "Administers employee lifecycle transactions and HR records under the access and confidentiality controls those records require."
          },
          {
            "title": "Procurement Operations Specialist",
            "purpose": "Runs purchase requisition and purchase order processing and keeps supplier master data accurate."
          },
          {
            "title": "Contracts Manager",
            "purpose": "Owns contract administration for the department, from the repository and renewal tracking through to the data processing terms required of any vendor that touches member data."
          },
          {
            "title": "Business Support Specialist",
            "purpose": "Resolves internal service requests from employees and routes anything requiring specialist handling to the named owner."
          }
        ]
      },
      {
        "team": "Business Operations",
        "teamContext": "Owns operational planning, KPI tracking and the review cadence that keeps cross-functional delivery on track.",
        "roles": [
          {
            "title": "Director, Business Operations",
            "purpose": "Owns the operational planning cycle and the review rhythm through which the COO tracks delivery."
          },
          {
            "title": "Business Operations Manager",
            "purpose": "Runs operational planning and KPI tracking for a defined set of business areas and reconciles plans against available capacity."
          },
          {
            "title": "Senior Business Operations Analyst",
            "purpose": "Builds the KPI models and review analysis that show where operational performance is improving or declining."
          },
          {
            "title": "Business Operations Analyst",
            "purpose": "Maintains operational metrics, prepares review materials and tracks follow-up actions to closure."
          },
          {
            "title": "Program Manager, Cross-Functional Operations",
            "purpose": "Coordinates delivery on operational programmes that span product, verification, safety and support teams."
          }
        ]
      },
      {
        "team": "Process Excellence",
        "teamContext": "Redesigns how operational work gets done — process architecture, lean initiatives, SOP development and benchmarking.",
        "roles": [
          {
            "title": "Head of Process Excellence",
            "purpose": "Sets the process improvement agenda for the department and decides which operational workflows are redesigned first."
          },
          {
            "title": "Senior Process Improvement Manager",
            "purpose": "Leads high-impact redesign programmes, including the review and verification workflows where an error has direct consequences for member safety."
          },
          {
            "title": "Process Improvement Manager",
            "purpose": "Runs lean and continuous improvement initiatives with the teams that own the affected processes."
          },
          {
            "title": "Business Process Analyst",
            "purpose": "Maps current-state processes, quantifies rework and handoff cost, specifies the target-state design and benchmarks the result against the prior baseline."
          }
        ]
      },
      {
        "team": "Enterprise Service Delivery",
        "teamContext": "Owns the internal service catalog, SLA commitments, service monitoring and escalation handling.",
        "roles": [
          {
            "title": "Head of Service Delivery",
            "purpose": "Owns the internal service catalog — scope, owner and request path for every service — and accountability for the SLAs the department commits to."
          },
          {
            "title": "Service Delivery Manager",
            "purpose": "Manages delivery of a defined portfolio of internal services against agreed service levels."
          },
          {
            "title": "Service Level Manager",
            "purpose": "Defines, negotiates and reports on SLAs, and drives remediation when commitments are missed."
          },
          {
            "title": "Service Operations Analyst",
            "purpose": "Monitors live service health and queue performance and flags degradation before it affects the teams relying on the service."
          },
          {
            "title": "Major Incident and Escalation Manager",
            "purpose": "Coordinates escalations end to end, including safety- and verification-critical issues that require immediate handling outside the normal queue."
          }
        ]
      },
      {
        "team": "Global Capability Centers",
        "teamContext": "Runs Sambandh's regional operating sites, including workforce planning, capacity management and cross-location support.",
        "roles": [
          {
            "title": "Head of Global Capability Centers",
            "purpose": "Owns the operating model, performance and governance of Sambandh's capability center locations."
          },
          {
            "title": "Site Operations Manager",
            "purpose": "Runs day-to-day operations at a capability center site, including physical and system access controls over member and verification data."
          },
          {
            "title": "Workforce Planning Manager",
            "purpose": "Owns medium- and long-term workforce and capacity plans across locations against forecast operational demand."
          },
          {
            "title": "Workforce Management Analyst",
            "purpose": "Builds schedules and manages intraday staffing so queues stay covered across shifts and time zones."
          },
          {
            "title": "Operations Coordinator, Cross-Location Support",
            "purpose": "Keeps handoffs, shift transitions and support requests moving cleanly between sites."
          }
        ]
      },
      {
        "team": "Vendor Operations",
        "teamContext": "Owns vendor onboarding, performance management, SLA monitoring and the governance around third parties supporting operations.",
        "roles": [
          {
            "title": "Head of Vendor Management",
            "purpose": "Owns the vendor governance framework and the decision on which operational work may be placed with a third party."
          },
          {
            "title": "Vendor Operations Manager",
            "purpose": "Manages the day-to-day operational relationship and performance of a portfolio of vendors."
          },
          {
            "title": "Vendor Onboarding Specialist",
            "purpose": "Runs vendor onboarding, including the due diligence and data handling checks required before a vendor is granted any access."
          },
          {
            "title": "Vendor Performance Analyst",
            "purpose": "Tracks vendor SLAs and quality metrics and prepares the evidence for performance reviews."
          },
          {
            "title": "Vendor Compliance Auditor",
            "purpose": "Audits vendor operations, with particular attention to how personal and identity-verification data is accessed, stored and disposed of."
          }
        ]
      },
      {
        "team": "Enterprise Documentation",
        "teamContext": "Governs SOPs, policy libraries, operational records and version control across the department.",
        "roles": [
          {
            "title": "Documentation Manager",
            "purpose": "Owns the documentation estate — SOPs, policies and operational records — and the governance that keeps it current and correctly approved."
          },
          {
            "title": "Senior Technical Writer, Operations",
            "purpose": "Writes and reviews documentation for the department's most sensitive workflows, including verification and escalation procedures."
          },
          {
            "title": "Technical Writer",
            "purpose": "Produces and maintains SOPs and operational guides with the teams that perform the work."
          },
          {
            "title": "Records Manager",
            "purpose": "Owns records management, including retention schedules and defensible disposal of records containing personal data."
          },
          {
            "title": "Document Control Specialist",
            "purpose": "Runs version control, review cycles and change history across controlled documents."
          },
          {
            "title": "Knowledge Management Specialist",
            "purpose": "Structures documentation so operational teams can reliably locate the current approved procedure."
          }
        ]
      },
      {
        "team": "Operational Analytics",
        "teamContext": "Builds the dashboards, KPI reporting and forecasts the department runs on.",
        "roles": [
          {
            "title": "Manager, Operational Analytics",
            "purpose": "Leads the analytics team and owns the definitions behind the department's reported operational metrics."
          },
          {
            "title": "Senior Operations Analyst",
            "purpose": "Leads analysis on capacity, throughput and productivity questions raised by the COO's leadership team."
          },
          {
            "title": "Business Intelligence Engineer",
            "purpose": "Builds and maintains the operational data models and pipelines that feed reporting, including access controls on any dataset containing member data."
          },
          {
            "title": "Business Intelligence Analyst",
            "purpose": "Builds and maintains operational dashboards and recurring KPI reporting."
          },
          {
            "title": "Forecasting Analyst",
            "purpose": "Produces demand and performance forecasts that drive staffing and capacity decisions."
          }
        ]
      },
      {
        "team": "Intelligent Automation",
        "teamContext": "Deploys AI workflow automation, RPA, document processing and operational copilots across the department's processes.",
        "roles": [
          {
            "title": "Head of Intelligent Automation",
            "purpose": "Owns the automation portfolio and decides which operational processes may be automated and which must retain human decision-making."
          },
          {
            "title": "Automation Solutions Architect",
            "purpose": "Designs automation solutions end to end, including how automated steps access, minimise and log the use of personal data."
          },
          {
            "title": "Senior RPA Developer",
            "purpose": "Leads development of the department's most complex process automations and reviews others' builds before release."
          },
          {
            "title": "RPA Developer",
            "purpose": "Builds, tests and maintains process automations against documented SOPs."
          },
          {
            "title": "Machine Learning Engineer, Document Processing",
            "purpose": "Builds intelligent document processing models for the operational documents the department handles at volume."
          },
          {
            "title": "Workflow Orchestration Engineer",
            "purpose": "Builds and operates the orchestration layer that sequences automated and human steps across a process."
          },
          {
            "title": "Automation Business Analyst",
            "purpose": "Assesses candidate processes for automation and specifies requirements, exceptions and control points."
          }
        ]
      },
      {
        "team": "Service Governance",
        "teamContext": "Owns governance frameworks, service standards, internal operational audits and compliance review.",
        "roles": [
          {
            "title": "Head of Service Governance",
            "purpose": "Owns the framework under which the department's services are defined, measured and reviewed, including decision rights and the review calendar."
          },
          {
            "title": "Internal Audit Manager, Operations",
            "purpose": "Plans and leads internal audits of operational processes, including controls over access to member and verification data."
          },
          {
            "title": "Operational Compliance Analyst",
            "purpose": "Tests operational processes against internal policy and DPDP Act obligations such as data minimisation and access control, and tracks remediation to closure."
          }
        ]
      },
      {
        "team": "Business Continuity Operations",
        "teamContext": "Owns crisis coordination, operational recovery procedures and continuity testing.",
        "roles": [
          {
            "title": "Business Continuity Manager",
            "purpose": "Owns the operational continuity programme, including recovery plans for incidents affecting member safety or verification services."
          },
          {
            "title": "Senior Business Continuity Analyst",
            "purpose": "Runs business impact analysis and maintains recovery objectives and procedures for critical operational processes."
          },
          {
            "title": "Crisis Management Coordinator",
            "purpose": "Coordinates the crisis response process, from activation and communication through to stand-down and review."
          },
          {
            "title": "Resilience Testing Specialist",
            "purpose": "Designs and runs continuity exercises and documents the gaps they expose."
          }
        ]
      },
      {
        "team": "Operations Research",
        "teamContext": "Applies optimisation, queueing theory, simulation and decision science to Sambandh's scheduling, capacity and logistics problems.",
        "roles": [
          {
            "title": "Head of Operations Research",
            "purpose": "Leads the operations research function and decides which operational decisions warrant formal modelling."
          },
          {
            "title": "Principal Operations Research Scientist",
            "purpose": "Sets the technical direction for the department's optimisation and decision models."
          },
          {
            "title": "Senior Operations Research Scientist",
            "purpose": "Develops optimisation, queueing and scheduling models for the department's hardest capacity problems."
          },
          {
            "title": "Operations Research Analyst",
            "purpose": "Builds and validates resource scheduling and capacity models and translates results into operational recommendations."
          },
          {
            "title": "Optimization Engineer",
            "purpose": "Implements optimisation models as production services the operational teams can run against."
          },
          {
            "title": "Simulation Modeling Engineer",
            "purpose": "Builds simulation models to test operational designs and staffing scenarios before they are rolled out."
          }
        ]
      },
      {
        "team": "Enterprise Automation Lab",
        "teamContext": "Builds the next generation of autonomous enterprise workflows — AI process orchestration, digital process twins, multi-agent systems and self-healing operations.",
        "roles": [
          {
            "title": "Director, Enterprise Automation Lab",
            "purpose": "Owns the lab's research agenda and the evidence an autonomous workflow must produce before it is allowed into production operations."
          },
          {
            "title": "Principal Engineer, Autonomous Workflows",
            "purpose": "Sets the technical architecture for workflows that run without a human at every step, including containment, rollback and the conditions that force escalation to a person."
          },
          {
            "title": "AI Agent Engineer",
            "purpose": "Builds the agents that execute enterprise workflows, together with the permission scoping and audit logging that constrain what they can reach."
          },
          {
            "title": "Research Engineer, Multi-Agent Systems",
            "purpose": "Researches coordination and failure behaviour in multi-agent workflows and turns the findings into design rules the lab builds against."
          },
          {
            "title": "Machine Learning Engineer, Predictive Operations",
            "purpose": "Builds models that predict operational failures and demand shifts early enough to act on."
          }
        ]
      }
    ],
    "removed": [
      "Shared Business Services — Contract Administrator: duplicates Contracts Manager; repository, renewals and obligation tracking folded into that role.",
      "Business Operations — Operational Planning Manager: duplicates the Director's ownership of the planning cycle and the Business Operations Manager's planning remit.",
      "Business Operations — Resource Planning Analyst: duplicates Workforce Planning Manager and Forecasting Analyst; three separate capacity-modelling analysts in one department is padding.",
      "Process Excellence — Process Engineer: manufacturing-floor title misapplied to a software operations org; tooling implementation is already owned by Workflow Orchestration Engineer and the RPA developers.",
      "Process Excellence — Process Design Specialist: SOP authoring is Enterprise Documentation's stated remit (Technical Writer / Senior Technical Writer, Operations).",
      "Process Excellence — Operational Benchmarking Analyst: invented padding — benchmarking is a task within process analysis, not a standing job; folded into Business Process Analyst.",
      "Enterprise Service Delivery — Service Catalog Manager: padding; catalog ownership sits with the Head of Service Delivery, whose purpose was extended to state it.",
      "Enterprise Service Delivery — Service Improvement Manager: duplicates Process Improvement Manager in Process Excellence, which is the department's improvement function.",
      "Global Capability Centers — Regional Operations Manager: an extra management layer sandwiched between the Head and Site Operations Manager with no distinct responsibility in the blueprint.",
      "Global Capability Centers — Capacity Planning Analyst: duplicates Workforce Planning Manager (long-range capacity) and Forecasting Analyst.",
      "Vendor Operations — Supplier Governance Manager: duplicates the Head of Vendor Management on governance standards and the Contracts Manager on obligation tracking.",
      "Enterprise Documentation — Policy and Standards Documentation Specialist: duplicates Document Control Specialist (approved versions, review cycles) and Technical Writer.",
      "Operational Analytics — Analytics Engineer: duplicates Business Intelligence Engineer; metric definitions are explicitly owned by the Manager, Operational Analytics.",
      "Operational Analytics — Data Analyst, Capacity and Productivity: duplicates Senior Operations Analyst, whose purpose is already capacity, throughput and productivity.",
      "Intelligent Automation — AI Automation Engineer: duplicates AI Agent Engineer in the Enterprise Automation Lab; kept the one whose purpose states the permission and audit-logging controls.",
      "Service Governance — Governance Framework Manager: duplicates the Head of Service Governance; decision rights and review calendar folded into that role.",
      "Service Governance — Service Standards Analyst: duplicates Service Level Manager, who already defines and reports the standards teams are measured against.",
      "Service Governance — Governance Reporting Analyst: not a standard standalone position; the reporting is produced by Operational Analytics and the Operational Compliance Analyst.",
      "Business Continuity Operations — Operational Recovery Coordinator: duplicates Crisis Management Coordinator and the Senior Business Continuity Analyst, who owns recovery objectives and procedures.",
      "Operations Research — Decision Scientist: duplicates Operations Research Analyst, and the purpose ('rather than assertion') read as positioning rather than a job.",
      "Operations Research — Applied Scientist, Resource Scheduling: duplicates Senior Operations Research Scientist and Optimization Engineer on scheduling and assignment work.",
      "Enterprise Automation Lab — Digital Twin Engineer: buzzword framing of work already covered by Simulation Modeling Engineer in Operations Research.",
      "Enterprise Automation Lab — Platform Engineer, Process Orchestration: duplicates Workflow Orchestration Engineer in Intelligent Automation.",
      "Enterprise Automation Lab — Reliability Automation Engineer: non-standard title; self-healing, stop conditions and human escalation are already the Principal Engineer, Autonomous Workflows' stated architecture responsibility."
    ],
    "verdict": "FIXED"
  },
  {
    "department": "International Expansion & Regional Operations",
    "reportsTo": "Chief International Officer",
    "context": "You take Sambandh from an India-first product to one that launches responsibly in other countries. That means deciding which markets to enter and in what order, standing up regional operating teams, adapting the product, payments and content rules to local expectations, and making sure face verification, age assurance and personal data handling meet each country's law before a single launch date is set. You work under the Chief International Officer alongside Legal, Trust & Safety and Product, and you are accountable for the operational detail of every market Sambandh operates in.",
    "skills": [
      "experience launching or operating a consumer product in three or more countries, including at least one outside your home region",
      "working knowledge of at least two consumer data protection regimes (for example India's DPDP Act 2023, GDPR, or a comparable framework) and how data residency requirements affect product architecture",
      "ability to handle trust and safety escalations involving identity verification, age assurance and minors, following documented escalation and reporting procedures rather than improvising",
      "track record of managing external stakeholders such as regulators, local counsel, telecom or platform partners in at least one market",
      "professional working proficiency in English plus one additional language relevant to a target region",
      "ability to define and report on operational metrics, including proficiency with SQL or an equivalent query tool",
      "experience coordinating across time zones with written status reporting and documented decision records"
    ],
    "teams": [
      {
        "team": "Global Expansion Strategy",
        "teamContext": "Owns which countries Sambandh enters, in what order, and the investment case behind each entry.",
        "roles": [
          {
            "title": "Director, Global Expansion Strategy",
            "purpose": "Owns the multi-year market entry roadmap for Sambandh and defends the sequencing and investment case to the Chief International Officer."
          },
          {
            "title": "Senior Manager, Market Entry Strategy",
            "purpose": "Builds the entry model for each candidate country, covering operating model, regulatory prerequisites, availability of workable identity and age verification, and the conditions that must be met before a go-live date is set."
          },
          {
            "title": "Manager, Expansion Investment Planning",
            "purpose": "Builds and maintains the financial plans and business cases attached to each expansion decision, and reports actuals back against them."
          },
          {
            "title": "Senior Strategy Analyst, International",
            "purpose": "Produces the country-level analysis, models and briefing material that expansion decisions are made on."
          },
          {
            "title": "Strategy Analyst, International",
            "purpose": "Supports market sizing, entry-cost modelling and post-entry tracking against the assumptions in the original business case."
          }
        ]
      },
      {
        "team": "Regional Operations",
        "teamContext": "Runs Sambandh's day-to-day operations in each region and holds regional teams to a single operating standard.",
        "roles": [
          {
            "title": "Vice President, Regional Operations",
            "purpose": "Accountable for operational performance and governance across every region Sambandh operates in."
          },
          {
            "title": "Regional Operations Director",
            "purpose": "Runs operations across an assigned region, owns local team performance, and holds the region to the central operating standard. Openings exist for South Asia, Southeast Asia and other regions as they open."
          },
          {
            "title": "Regional Operations Manager",
            "purpose": "Runs the day-to-day operational cadence in an assigned group of markets, including the moderation coverage, support staffing and local conduct standards each market requires. Openings exist across Europe, the Middle East, the Americas, Africa and Oceania."
          },
          {
            "title": "Manager, Operational Governance",
            "purpose": "Defines the standard operating procedures, controls and audit cadence every region is required to follow, and reviews whether they are being applied."
          },
          {
            "title": "Senior Business Operations Analyst, International",
            "purpose": "Builds the reporting that lets regional and central leadership see the same operational numbers, and evidences sustained underperformance when it appears."
          }
        ]
      },
      {
        "team": "Country Programs",
        "teamContext": "Turns an approved market entry into a live, operating country with a launch plan, partners and local staff.",
        "roles": [
          {
            "title": "Director, Country Programs",
            "purpose": "Owns the portfolio of country launches and the standard playbook every country team executes against."
          },
          {
            "title": "Country Manager",
            "purpose": "Accountable for Sambandh's performance, partnerships and operational compliance within a single assigned country, including the day-to-day cadence once the country is past launch."
          },
          {
            "title": "Senior Country Launch Manager",
            "purpose": "Runs a country from approved plan to live service, including verification readiness, moderation coverage and support staffing before launch day."
          },
          {
            "title": "Product Rollout Manager, International",
            "purpose": "Sequences which parts of the Sambandh product ship in each country and holds the gate on features that are not yet legally or operationally ready there."
          },
          {
            "title": "Market Activation Manager",
            "purpose": "Plans and runs in-country launch activity for a new market, from early community building to onboarding of the first member cohorts, within the verification and conduct rules that apply in that market."
          },
          {
            "title": "Country Programs Analyst",
            "purpose": "Tracks launch milestones and post-launch performance across the country portfolio and flags slippage early."
          }
        ]
      },
      {
        "team": "Localization",
        "teamContext": "Adapts the Sambandh product, language, payment options and content rules to each market it ships in.",
        "roles": [
          {
            "title": "Head of Localization",
            "purpose": "Owns localisation quality and coverage across every language and market Sambandh ships in."
          },
          {
            "title": "Localization Program Manager",
            "purpose": "Runs the localisation pipeline for each release so that language, payment and content changes land together with the product."
          },
          {
            "title": "Senior Localization Engineer",
            "purpose": "Builds and maintains the internationalisation infrastructure in the Sambandh codebase, including string handling, locale formats and right-to-left support."
          },
          {
            "title": "Language Quality Manager",
            "purpose": "Owns translation quality standards and the review process for every language Sambandh publishes, including safety, reporting and verification copy."
          },
          {
            "title": "Regional Content Policy Manager",
            "purpose": "Defines the market-specific content and conduct guidelines that moderation applies, in line with local law and local expectations of acceptable conduct."
          },
          {
            "title": "Product Designer, International UX",
            "purpose": "Adapts Sambandh's interface and onboarding flows — including verification and age assurance steps — so they read clearly to users in each region."
          },
          {
            "title": "Product Manager, International Payments",
            "purpose": "Owns support for local payment methods and currencies in each market Sambandh operates in."
          },
          {
            "title": "Localization QA Analyst",
            "purpose": "Tests localised builds for linguistic, layout and functional defects before they reach users in-market."
          }
        ]
      },
      {
        "team": "International Partnerships",
        "teamContext": "Builds and manages Sambandh's institutional relationships outside India, from telecom operators to universities and government bodies.",
        "roles": [
          {
            "title": "Director, International Partnerships",
            "purpose": "Owns the international partnership portfolio and the terms Sambandh is willing to agree to in each category."
          },
          {
            "title": "Senior Partner Manager, Telecom Operators",
            "purpose": "Negotiates and manages carrier relationships covering distribution, billing and phone-number verification."
          },
          {
            "title": "Partner Manager, Technology Platforms",
            "purpose": "Manages relationships with app stores, identity and verification providers, payment providers and other technology partners Sambandh depends on in each market."
          },
          {
            "title": "Partnerships Manager, Government and Public Sector",
            "purpose": "Manages engagement with government bodies and regulators on programmes touching online safety and identity verification."
          },
          {
            "title": "Partnerships Manager, Universities and NGOs",
            "purpose": "Builds relationships with universities and non-profit organisations, particularly those working on online safety, harassment prevention and digital literacy."
          },
          {
            "title": "Partnerships Operations Manager",
            "purpose": "Runs contract lifecycle, due diligence and performance review for the international partner base."
          },
          {
            "title": "Partnerships Analyst",
            "purpose": "Evaluates prospective partners and reports on whether existing partnerships are delivering what was agreed."
          }
        ]
      },
      {
        "team": "Regional Compliance Coordination",
        "teamContext": "Coordinates legal, data residency and licensing obligations across every region Sambandh operates in.",
        "roles": [
          {
            "title": "Director, Regional Compliance",
            "purpose": "Owns Sambandh's regional compliance posture and is the escalation point when a market's requirements conflict with the product as built."
          },
          {
            "title": "Regional Compliance Manager, EMEA",
            "purpose": "Coordinates legal and regulatory obligations across European, Middle Eastern and African markets."
          },
          {
            "title": "Regional Compliance Manager, APAC",
            "purpose": "Coordinates legal and regulatory obligations across Asia-Pacific markets."
          },
          {
            "title": "Privacy Program Manager, Data Residency",
            "purpose": "Owns the mapping of where member data — including verification imagery and Lakshan Book records — is stored and processed, and evidences that it meets each market's residency and data protection requirements."
          },
          {
            "title": "Regulatory Affairs Manager, Consumer Protection",
            "purpose": "Tracks consumer protection, advertising, age assurance and online safety rules in each market and translates them into product and operational requirements."
          },
          {
            "title": "Licensing and Regulatory Operations Specialist",
            "purpose": "Obtains and maintains the registrations, filings and licences Sambandh needs to operate in each country."
          },
          {
            "title": "Counsel, International Regulatory Affairs",
            "purpose": "Provides in-house legal advice on regional requirements and manages the external counsel network across markets."
          }
        ]
      },
      {
        "team": "Cross-Border Programs",
        "teamContext": "Runs the programmes that span more than one country, so multi-market launches and shared initiatives are executed once rather than repeated badly.",
        "roles": [
          {
            "title": "Director, Cross-Border Programs",
            "purpose": "Owns the portfolio of programmes that run across multiple countries and resolves conflicts between regional priorities."
          },
          {
            "title": "Senior Program Manager, Multi-Country Launches",
            "purpose": "Runs launches that go live in several countries at once, keeping legal, product and operational readiness aligned across all of them."
          },
          {
            "title": "Program Manager, International Events",
            "purpose": "Plans and delivers Sambandh's international events, including the identity verification and participant safety requirements for any in-person element."
          },
          {
            "title": "Cross-Border Program Coordinator",
            "purpose": "Keeps schedules, dependencies and action items current across the programmes running in parallel, and surfaces where one country is blocking a multi-country milestone."
          }
        ]
      },
      {
        "team": "International Market Intelligence",
        "teamContext": "Provides the evidence base on markets, competitors and consumer behaviour that expansion decisions rely on.",
        "roles": [
          {
            "title": "Director, International Market Intelligence",
            "purpose": "Owns the intelligence function and ensures expansion decisions are made against evidence rather than assumption."
          },
          {
            "title": "Senior Market Research Manager",
            "purpose": "Designs and runs primary research programmes in markets Sambandh is considering or has recently entered, including participant recruitment and consent handling that meets Sambandh's privacy standards."
          },
          {
            "title": "Competitive Intelligence Analyst",
            "purpose": "Monitors competing dating and social platforms' launches, positioning and product changes across international markets, and what their verification and safety claims actually deliver."
          },
          {
            "title": "Consumer Insights Manager",
            "purpose": "Studies how people in each market approach online dating, disclosure and trust, and turns that into usable product and operational input."
          },
          {
            "title": "Market Intelligence Analyst",
            "purpose": "Runs opportunity assessments on individual markets and maintains the underlying market datasets."
          }
        ]
      },
      {
        "team": "Global Mobility",
        "teamContext": "Moves Sambandh employees between countries and keeps those moves lawful and well supported.",
        "roles": [
          {
            "title": "Global Mobility Manager",
            "purpose": "Owns Sambandh's mobility programme end to end, from policy to individual employee moves."
          },
          {
            "title": "Senior Immigration Specialist",
            "purpose": "Manages visa, work permit and sponsorship cases for employees moving between Sambandh's markets."
          },
          {
            "title": "International Assignment Manager",
            "purpose": "Structures and administers long- and short-term international assignments, including cost projections and tax coordination."
          },
          {
            "title": "Relocation Coordinator",
            "purpose": "Supports relocating employees and their families through the practical steps of moving country."
          },
          {
            "title": "Mobility Policy and Compliance Analyst",
            "purpose": "Maintains mobility policy and checks that assignments stay compliant with immigration, payroll and tax obligations in both locations."
          }
        ]
      },
      {
        "team": "Regional Communications",
        "teamContext": "Handles what Sambandh says in each region, including when something has gone wrong.",
        "roles": [
          {
            "title": "Director, Regional Communications",
            "purpose": "Owns regional communications strategy and approves what Sambandh says publicly in each market."
          },
          {
            "title": "Regional Communications Manager, APAC",
            "purpose": "Runs announcements, media relationships and messaging across Asia-Pacific markets."
          },
          {
            "title": "Regional Communications Manager, EMEA and Americas",
            "purpose": "Runs announcements, media relationships and messaging across European, Middle Eastern, African and American markets."
          },
          {
            "title": "Crisis Communications Manager",
            "purpose": "Owns the response plan and message discipline for incidents affecting member safety, verification integrity or personal data, working directly with Trust & Safety and Legal and following the documented escalation and notification procedures."
          },
          {
            "title": "Campaign Localisation Manager",
            "purpose": "Adapts central marketing campaigns so they land correctly in each region without overstating what verification guarantees."
          },
          {
            "title": "Communications Specialist",
            "purpose": "Drafts and coordinates the day-to-day regional communications output across channels."
          }
        ]
      },
      {
        "team": "International PMO",
        "teamContext": "Provides governance, schedule discipline and executive reporting for everything the department runs.",
        "roles": [
          {
            "title": "Director, International Program Management Office",
            "purpose": "Owns programme governance across the department and the reporting line into the Chief International Officer."
          },
          {
            "title": "Senior Technical Program Manager, International",
            "purpose": "Runs the technically complex international programmes where engineering, infrastructure and regional requirements intersect, including data residency work."
          },
          {
            "title": "Program Manager, Governance and Delivery",
            "purpose": "Maintains the delivery framework, stage gates and risk register the department's programmes run against, and keeps Product, Engineering, Legal and Trust & Safety aligned on international commitments."
          },
          {
            "title": "Portfolio Analyst",
            "purpose": "Tracks timelines, dependencies and resourcing across the international programme portfolio and produces the recurring reporting pack leadership reviews."
          }
        ]
      },
      {
        "team": "Emerging Markets",
        "teamContext": "Assesses and pilots frontier markets before they are ready for a full country launch.",
        "roles": [
          {
            "title": "Director, Emerging Markets",
            "purpose": "Owns Sambandh's approach to frontier markets and decides which ones progress from pilot to full entry."
          },
          {
            "title": "Senior Manager, Frontier Market Strategy",
            "purpose": "Analyses frontier markets for viability, including whether reliable identity and age verification is achievable there at all."
          },
          {
            "title": "Product Manager, Emerging Markets",
            "purpose": "Adapts the Sambandh product for low-bandwidth, low-cost-device and cash-heavy environments without weakening verification."
          },
          {
            "title": "Pilot Launch Manager, Emerging Markets",
            "purpose": "Runs time-boxed market pilots with defined success criteria and an agreed exit path."
          },
          {
            "title": "Ecosystem Development Manager",
            "purpose": "Builds and tests the local ecosystem — payments, connectivity, verification providers, community organisations — that a frontier market launch would depend on."
          },
          {
            "title": "Emerging Markets Analyst",
            "purpose": "Maintains the data and pilot results that inform whether a frontier market advances or is set aside."
          }
        ]
      },
      {
        "team": "Global Expansion Research Center",
        "teamContext": "Conducts the applied research on cross-cultural behaviour, adoption and platform economics that underpins Sambandh's international strategy.",
        "roles": [
          {
            "title": "Director, Global Expansion Research",
            "purpose": "Sets the research agenda for the centre and is accountable for the rigour of what it publishes internally."
          },
          {
            "title": "Principal Research Scientist, Cross-Cultural Digital Behaviour",
            "purpose": "Leads research into how norms around disclosure, courtship and trust differ across cultures and what that means for Sambandh's design."
          },
          {
            "title": "Senior Research Scientist, International Adoption",
            "purpose": "Models how platforms like Sambandh are adopted in different markets, including how network effects form across countries and city sizes."
          },
          {
            "title": "Research Scientist, Digital Inclusion",
            "purpose": "Studies who is excluded from verified platforms in each market — by device, connectivity, documentation or literacy — and what closes that gap."
          },
          {
            "title": "Senior Economist, Platform Economics",
            "purpose": "Researches the economics of Sambandh's model across international markets, including pricing, willingness to pay and market structure."
          },
          {
            "title": "UX Researcher, Localisation Effectiveness",
            "purpose": "Measures whether localised experiences actually work for users in-market rather than simply being translated."
          },
          {
            "title": "Research Program Manager",
            "purpose": "Runs the centre's research operations, including ethics review, participant consent and data handling for international studies."
          }
        ]
      }
    ],
    "removed": [
      "Global Expansion Strategy — Manager, Market Prioritisation: maintaining a scoring framework is a task inside market entry strategy, not a standalone position; folded into Senior Manager, Market Entry Strategy.",
      "Global Expansion Strategy — Competitive Analysis Manager: duplicates Competitive Intelligence Analyst in International Market Intelligence, which is the team that owns competitor tracking.",
      "Regional Operations — Regional Operations Director, Southeast Asia / Regional Operations Manager, Middle East / Regional Operations Manager, Europe / Regional Operations Manager, North America and Latin America / Regional Operations Manager, Africa and Oceania: six geographic variants of two jobs. Collapsed into one Regional Operations Director and one Regional Operations Manager with regions listed as openings — headcount, not distinct titles.",
      "Regional Operations — Regional Performance Manager: target-setting and escalation is the same remit as Manager, Operational Governance plus the Senior Business Operations Analyst; merged rather than kept as a third overlapping role.",
      "Country Programs — Country Operations Manager: duplicates Country Manager (post-launch day-to-day cadence is that role's job) and the Regional Operations Manager above it.",
      "Country Programs — Local Partnerships Manager: duplicates the International Partnerships team, which already owns verification vendors, payment providers and community partners; kept there under Partner Manager, Technology Platforms.",
      "International Partnerships — Enterprise Partnerships Manager: enterprise customer management is not a responsibility the team blueprint mentions (telecoms, universities, government bodies) and imports an unrelated EduRankAI-wide sales remit into a consumer expansion team.",
      "Cross-Border Programs — Program Manager, Regional Collaborations: vague; 'shared programmes between regional teams' with no defined deliverable is the Director's remit restated.",
      "Cross-Border Programs — Program Operations Analyst: duplicates both the Cross-Border Program Coordinator in the same team and Portfolio Analyst in the International PMO; the coordinator absorbed the milestone-blocking reporting.",
      "International Market Intelligence — Senior Analyst, Strategic Foresight: 'medium-term forecasts on regulatory, technology and consumer trends' is futurist padding; regulatory tracking already sits with Regulatory Affairs Manager, Consumer Protection and market forecasting with the strategy team.",
      "International Market Intelligence — Research Operations Manager: duplicates Research Program Manager in the Global Expansion Research Center (vendors, recruitment, consent); the research ethics and consent remit was kept there and the recruitment/consent line folded into Senior Market Research Manager.",
      "Regional Communications — Media Relations Manager, International: media relationships are explicitly the job of the two Regional Communications Managers; a third role over the same journalists is duplication.",
      "International PMO — Manager, Executive Reporting: producing a recurring reporting pack is a deliverable, not a management position; folded into Portfolio Analyst.",
      "International PMO — Senior Program Manager, Cross-Functional Coordination: title describes a coordination habit rather than a job, and overlaps Program Manager, Governance and Delivery; the Product/Engineering/Legal/Trust & Safety alignment duty moved there.",
      "Emerging Markets — Partnership Development Manager, Emerging Markets: duplicates Ecosystem Development Manager in the same team and the International Partnerships function; partner exploration merged into the ecosystem role.",
      "Global Expansion Research Center — Computational Social Scientist, Network Effects: same modelling work as Senior Research Scientist, International Adoption; the network-effects scope was merged into that role.",
      "Global Expansion Research Center — Regulatory Research Analyst, Comparative Policy: duplicates Regulatory Affairs Manager, Consumer Protection and Counsel, International Regulatory Affairs in Regional Compliance Coordination, which own comparative regulatory analysis with accountability attached."
    ],
    "verdict": "FIXED"
  },
  {
    "department": "Corporate Communications, Executive Affairs & Brand Reputation",
    "reportsTo": "Chief Communications Officer",
    "context": "You own everything Sambandh says as an institution — corporate announcements, executive and leadership messaging, press engagement, internal communications, published reports and the archive of how the platform was built. Because Sambandh is a face-verified dating platform holding sensitive personal data, much of your work is explaining verification, the Lakshan Book honesty and compatibility system, moderation decisions and safety incidents accurately to press, government bodies, analysts and members. You work directly with the Chief Communications Officer and the incoming CEO, and you are on the escalation path when a trust or safety incident becomes public.",
    "skills": [
      "professional writing and editing experience in english, plus working fluency in hindi and at least one other indian language",
      "a portfolio of published corporate work you personally drafted — press materials, executive statements, reports, briefings or research",
      "experience communicating about trust, safety, verification or privacy matters, including incidents, takedowns or law-enforcement requests",
      "working knowledge of india's digital personal data protection act, 2023 and the it rules obligations that apply to consumer platforms",
      "demonstrated handling of confidential material under nda, including case material relating to member safety and minors-adjacent risk",
      "experience running approval and review cycles with executive, legal and trust-and-safety stakeholders before anything is published",
      "availability for out-of-hours escalation during live incidents, on a rostered basis"
    ],
    "teams": [
      {
        "team": "Corporate Communications",
        "teamContext": "Owns Sambandh's official corporate voice: announcements, press materials, executive messaging and the consistency of corporate identity across everything published in the company's name.",
        "roles": [
          {
            "title": "Director of Corporate Communications",
            "purpose": "Leads the corporate communications function and holds final sign-off on what Sambandh states publicly as a company."
          },
          {
            "title": "Senior Corporate Communications Manager",
            "purpose": "Runs major corporate announcements end to end, from drafting through legal and trust-and-safety review to publication."
          },
          {
            "title": "Corporate Communications Manager",
            "purpose": "Handles recurring corporate messaging — product and policy announcements, verification and safety updates, partner statements."
          },
          {
            "title": "Executive Communications Manager",
            "purpose": "Drafts and manages messaging delivered in the name of the CEO and other senior leaders, keeping their stated positions consistent over time."
          },
          {
            "title": "Senior Communications Writer",
            "purpose": "Writes and edits press releases, statements and corporate copy to a publishable standard, including sensitive material on verification and moderation decisions."
          },
          {
            "title": "Corporate Identity Manager",
            "purpose": "Maintains how the Sambandh name, marks and corporate descriptions are used across all published material and third-party mentions."
          },
          {
            "title": "Corporate Communications Associate",
            "purpose": "Supports drafting, distribution, approvals tracking and version control across active communications projects."
          }
        ]
      },
      {
        "team": "Executive Affairs",
        "teamContext": "Owns the preparation and coordination behind every leadership appearance, decision meeting and piece of correspondence signed by an executive.",
        "roles": [
          {
            "title": "Director, Executive Affairs",
            "purpose": "Leads executive affairs and is accountable for leadership being properly briefed, prepared and represented in every engagement."
          },
          {
            "title": "Executive Briefing Program Manager",
            "purpose": "Builds the briefing packs and pre-reads leaders take into external meetings, regulator sessions, partner discussions and leadership decision meetings."
          },
          {
            "title": "Executive Correspondence Manager",
            "purpose": "Drafts and manages correspondence issued over executive signature, including responses on member complaints and safety matters."
          },
          {
            "title": "Senior Executive Assistant, Office of Leadership",
            "purpose": "Coordinates executive calendars, travel and confidential document flow across the leadership team."
          },
          {
            "title": "Executive Affairs Coordinator",
            "purpose": "Tracks actions, deadlines and document status across the executive affairs workload."
          }
        ]
      },
      {
        "team": "Media Relations",
        "teamContext": "Owns Sambandh's working relationship with journalists — pitching, interviews, press conferences, inbound inquiries and daily news monitoring.",
        "roles": [
          {
            "title": "Head of Media Relations",
            "purpose": "Leads press engagement for Sambandh and decides which stories, interviews and outlets the company pursues or declines."
          },
          {
            "title": "Senior Media Relations Manager",
            "purpose": "Manages relationships with national business, technology and consumer press and handles the most sensitive inbound inquiries, including those on safety and moderation."
          },
          {
            "title": "Media Relations Manager, Regional Language Press",
            "purpose": "Builds and manages press coverage in regional-language outlets across India's major markets."
          },
          {
            "title": "Press Officer",
            "purpose": "Fields day-to-day media inquiries, issues approved statements and maintains the media contact record."
          },
          {
            "title": "Spokesperson and Media Training Manager",
            "purpose": "Prepares and schedules spokespeople for interviews and press conferences, including message discipline and question rehearsal on verification and safety topics."
          },
          {
            "title": "Media Monitoring Analyst",
            "purpose": "Monitors news and reporting on Sambandh in real time and escalates coverage that needs a response."
          },
          {
            "title": "Media Relations Associate",
            "purpose": "Supports press outreach, event logistics, coverage logs and briefing note preparation."
          }
        ]
      },
      {
        "team": "Internal Communications",
        "teamContext": "Owns what employees hear from the company — company updates, leadership messages, newsletters, change communications and town halls.",
        "roles": [
          {
            "title": "Head of Internal Communications",
            "purpose": "Leads internal communications and is accountable for employees hearing significant company news from the company first."
          },
          {
            "title": "Senior Internal Communications Manager",
            "purpose": "Plans and delivers the internal communications calendar across departments and locations, including leadership messages and company-wide town halls."
          },
          {
            "title": "Change Communications Manager",
            "purpose": "Communicates reorganisations, policy changes and new ways of working to the teams they affect."
          },
          {
            "title": "Internal Communications Editor",
            "purpose": "Edits and publishes the internal newsletter and the company's internal news channels."
          }
        ]
      },
      {
        "team": "Reputation Management",
        "teamContext": "Owns measurement and planning around how Sambandh is perceived by members, press, partners and the public.",
        "roles": [
          {
            "title": "Head of Reputation Management",
            "purpose": "Leads reputation strategy for Sambandh and reports to leadership on where public trust in the platform stands and why."
          },
          {
            "title": "Senior Reputation Strategy Manager",
            "purpose": "Builds multi-quarter reputation plans and defines what communications does when measured perception moves."
          },
          {
            "title": "Public Perception Research Manager",
            "purpose": "Commissions and runs perception research across members, press, partners and public bodies, including studies of trust in verification and the platform's honesty claims."
          },
          {
            "title": "Reputation Risk Analyst",
            "purpose": "Identifies emerging reputation risks arising from platform, safety and privacy issues before they surface publicly."
          },
          {
            "title": "Reputation Insights Associate",
            "purpose": "Compiles the recurring reputation reporting and maintains the underlying tracking data."
          }
        ]
      },
      {
        "team": "Crisis Communications",
        "teamContext": "Owns the plans, playbooks and live response for incidents where Sambandh must speak publicly under pressure.",
        "roles": [
          {
            "title": "Head of Crisis Communications",
            "purpose": "Leads crisis communications and holds decision authority on the company's public position during a live incident."
          },
          {
            "title": "Crisis Communications Manager",
            "purpose": "Runs the communications response for incidents involving member safety, personal data or platform misuse, working alongside trust and safety, legal and privacy."
          },
          {
            "title": "Incident Communications Manager",
            "purpose": "Staffs the out-of-hours rota and issues approved factual updates while an incident is still unfolding, with no statement going out ahead of verified facts."
          },
          {
            "title": "Crisis Readiness Programme Manager",
            "purpose": "Maintains the crisis playbooks, scenario exercises and escalation paths so response is not improvised."
          },
          {
            "title": "Senior Writer, Executive Statements",
            "purpose": "Drafts executive statements and apologies under time pressure, precise enough to survive legal and regulatory scrutiny."
          }
        ]
      },
      {
        "team": "Analyst Relations",
        "teamContext": "Owns Sambandh's relationships with industry analysts and how the company is represented in their research and market coverage.",
        "roles": [
          {
            "title": "Head of Analyst Relations",
            "purpose": "Leads the analyst relations programme and owns how Sambandh is understood by the analysts covering consumer and social platforms."
          },
          {
            "title": "Senior Analyst Relations Manager",
            "purpose": "Runs briefings and inquiry cycles with priority analyst firms and manages their coverage of Sambandh."
          },
          {
            "title": "Analyst Relations Manager",
            "purpose": "Prepares briefing content and coordinates the internal experts analysts need access to."
          },
          {
            "title": "Analyst Research Coordinator",
            "purpose": "Coordinates responses to research requests and industry report submissions, and tracks published findings."
          }
        ]
      },
      {
        "team": "Public Affairs Communications",
        "teamContext": "Owns communications directed at government, regulators, public institutions and the partnerships Sambandh holds with them.",
        "roles": [
          {
            "title": "Head of Public Affairs Communications",
            "purpose": "Leads communications with government and public institutions and is accountable for the accuracy of what Sambandh tells them."
          },
          {
            "title": "Senior Government Communications Manager",
            "purpose": "Prepares submissions, briefings and responses for central and state government bodies and regulators, including on verification, safety and data handling obligations."
          },
          {
            "title": "Institutional Partnerships Communications Manager",
            "purpose": "Communicates around partnerships with universities, civil society organisations and public institutions."
          },
          {
            "title": "Public Initiatives Communications Specialist",
            "purpose": "Develops communications for the online-safety and public awareness initiatives Sambandh takes part in with public bodies and civil society."
          }
        ]
      },
      {
        "team": "Corporate Publications",
        "teamContext": "Owns the company's formal published documents: annual and sustainability reports, research reports, corporate brochures and white papers.",
        "roles": [
          {
            "title": "Head of Corporate Publications",
            "purpose": "Leads the corporate publications programme and is accountable for the accuracy of every document published under the company name."
          },
          {
            "title": "Managing Editor, Corporate Publications",
            "purpose": "Runs the editorial calendar, commissioning and review cycle across all corporate publications."
          },
          {
            "title": "Senior Writer, Annual and Sustainability Reporting",
            "purpose": "Writes the annual and sustainability reports and works with contributing departments to source and verify their content."
          },
          {
            "title": "White Paper and Research Editor",
            "purpose": "Edits technical white papers and research reports, including material on verification methods and the Lakshan Book system."
          },
          {
            "title": "Publications Production Manager",
            "purpose": "Manages layout, proofing, accessibility and print and digital production for each publication."
          },
          {
            "title": "Senior Publication Designer",
            "purpose": "Designs corporate reports and brochures within the company's identity standards."
          }
        ]
      },
      {
        "team": "Executive Events",
        "teamContext": "Owns events where Sambandh's leadership appears: leadership summits, university engagements and external conferences.",
        "roles": [
          {
            "title": "Head of Executive Events",
            "purpose": "Leads the executive events programme and decides which platforms Sambandh's leadership appears on."
          },
          {
            "title": "Senior Executive Events Manager",
            "purpose": "Delivers leadership summits and external stakeholder events end to end, including content, run of show and attendee management."
          },
          {
            "title": "Executive Event Producer",
            "purpose": "Produces the on-stage experience — staging, AV, rehearsals and speaker preparation."
          },
          {
            "title": "University Engagement Manager",
            "purpose": "Plans and runs leadership engagements at universities and academic institutions."
          },
          {
            "title": "Conference Programme Coordinator",
            "purpose": "Coordinates speaking submissions, schedules and logistics for external conferences."
          }
        ]
      },
      {
        "team": "Thought Leadership",
        "teamContext": "Owns the substantive external content published in leaders' names — articles, conference presentations, opinion pieces and commentary on the company's research.",
        "roles": [
          {
            "title": "Head of Thought Leadership",
            "purpose": "Leads the thought leadership programme and sets the positions Sambandh's leaders take publicly on verification, honesty and online safety."
          },
          {
            "title": "Senior Speechwriter",
            "purpose": "Writes conference presentations and keynote remarks for the CEO and senior leaders."
          },
          {
            "title": "Thought Leadership Content Manager",
            "purpose": "Develops and places executive articles and opinion pieces with credible publications."
          },
          {
            "title": "Research Communications Specialist",
            "purpose": "Translates the company's internal research into external commentary that holds up to expert scrutiny."
          }
        ]
      },
      {
        "team": "Communications Strategy",
        "teamContext": "Owns the underlying architecture of what the company says, to whom, and how campaigns are approved and coordinated.",
        "roles": [
          {
            "title": "Head of Communications Strategy",
            "purpose": "Leads communications strategy and owns the messaging architecture every other team writes from."
          },
          {
            "title": "Senior Messaging Strategist",
            "purpose": "Defines and maintains core messaging on verification, the Lakshan Book system and honesty-first matching, and keeps claims within what the company can substantiate."
          },
          {
            "title": "Audience Strategy Manager",
            "purpose": "Segments the company's external audiences and defines what each is told and through which channels."
          },
          {
            "title": "Campaign Governance Manager",
            "purpose": "Runs the approval, sequencing and conflict-checking process across communications campaigns."
          }
        ]
      },
      {
        "team": "Corporate Storytelling & Archives",
        "teamContext": "Owns the institutional record — archives, product and research history, founder and leadership material — and the multimedia storytelling drawn from it.",
        "roles": [
          {
            "title": "Head of Corporate Storytelling and Archives",
            "purpose": "Leads the institutional archive and decides what of the company's history is preserved and what is told publicly."
          },
          {
            "title": "Corporate Archivist",
            "purpose": "Catalogues and preserves company records, founder and leadership material, and the documented history of product and research milestones."
          },
          {
            "title": "Digital Asset and Records Manager",
            "purpose": "Runs the archive systems, retention rules and access controls, keeping archived material clear of members' personal data."
          },
          {
            "title": "Multimedia Producer",
            "purpose": "Produces video and audio pieces that draw on the archive to tell the company's story."
          }
        ]
      },
      {
        "team": "Communications Research Lab",
        "teamContext": "Owns original research on how communication actually works — digital communication behaviour, crisis communication models, public trust, information diffusion and media analytics.",
        "roles": [
          {
            "title": "Head of Communications Research",
            "purpose": "Leads the research lab and sets its agenda across public trust, crisis communication and information diffusion."
          },
          {
            "title": "Senior Research Scientist, Public Trust and Communication",
            "purpose": "Designs and runs studies on how public trust in verified platforms is built, damaged and recovered."
          },
          {
            "title": "Research Scientist, Information Diffusion",
            "purpose": "Studies how information and misinformation about the platform spreads across networks and channels."
          },
          {
            "title": "Senior Data Scientist, Media Analytics",
            "purpose": "Builds the measurement models behind media analysis, sentiment and coverage impact."
          },
          {
            "title": "Research Engineer, Communications Analytics",
            "purpose": "Builds and maintains the data pipelines and tooling the lab's studies depend on."
          },
          {
            "title": "Research Programme Manager",
            "purpose": "Manages the lab's study pipeline, ethics review and publication process."
          }
        ]
      }
    ],
    "removed": [
      "Corporate Communications — Press Materials Editor: duplicates the editorial scope already held by the Senior Communications Writer and the Managing Editor, Corporate Publications; fact-checking press assets is part of those jobs, not a separate title.",
      "Executive Affairs — Meeting Preparation Manager: not a title found on real org charts, and the work (agendas, pre-reads, follow-ups) is already covered by the Executive Briefing Program Manager and the Executive Affairs Coordinator. Briefing-pack role rewritten to absorb it.",
      "Internal Communications — Leadership Messaging Manager, Internal: duplicates the Executive Communications Manager in Corporate Communications and the Senior Internal Communications Manager; leadership messages to employees do not need a third owner.",
      "Internal Communications — Town Hall Production Coordinator: padding. A coordinator dedicated to one recurring meeting format is not a distinct position; town hall delivery folded into the Senior Internal Communications Manager.",
      "Reputation Management — Stakeholder Sentiment Manager: invented title, and the stated work is the Public Perception Research Manager's job. Stakeholder groups added to that role's purpose instead.",
      "Analyst Relations — Market Positioning Manager: competitive positioning is product marketing, not analyst relations, and it collides directly with the Senior Messaging Strategist in Communications Strategy.",
      "Public Affairs Communications — Public Sector Messaging Manager: duplicates the Senior Government Communications Manager; verification, safety and data-handling messaging for public bodies folded into that role.",
      "Corporate Storytelling & Archives — Institutional History Researcher: duplicates the Corporate Archivist. A dedicated company historian alongside an archivist is not a credible second opening for a company of this stage.",
      "Communications Research Lab — Research Scientist, Organisational and Executive Communication: not derived from the lab's stated agenda (digital communication behaviour, crisis communication models, public trust, information diffusion, media analytics), and overlaps the Internal Communications team's remit."
    ],
    "verdict": "FIXED"
  },
  {
    "department": "Sustainability, ESG & Social Impact",
    "reportsTo": "Chief Sustainability Officer",
    "context": "You own how Sambandh accounts for its environmental footprint, its social effects on the people who use a dating product, and the governance evidence behind both. That means running the carbon and energy programme across our cloud and office footprint, publishing ESG disclosures that survive external assurance and Indian regulatory scrutiny, reviewing new AI and product features for ethical and societal risk before they ship, and funding and measuring community programmes in digital literacy, digital wellbeing and inclusion. Because the platform holds face-verification data and other sensitive personal information, every programme, research study and report you run works from privacy-reviewed, minimised data — never raw member records.",
    "skills": [
      "demonstrable delivery of sustainability, ESG, accessibility or social impact programmes at a technology, consumer internet or comparably regulated organisation",
      "working command of at least one relevant framework and the ability to evidence claims against it — GHG Protocol, BRSR, GRI, WCAG 2.2, or a recognised impact evaluation methodology",
      "handling of personal data strictly under India's DPDP Act and Sambandh's internal privacy controls, using minimised or aggregated data for all research, reporting and programme work — no exceptions granted for a deadline",
      "written work that survives external assurance, legal review and journalist scrutiny: sourced figures, stated limitations, and no claim you cannot defend",
      "comfort with quantitative evidence — SQL, spreadsheets at scale or a statistical tool — and the discipline to report null or negative results as readily as positive ones",
      "experience working alongside trust and safety, privacy or legal functions on work that touches user safety, safeguarding or sensitive data",
      "professional working English plus at least one other Indian language, given programmes run outside metro and English-first contexts"
    ],
    "teams": [
      {
        "team": "Environmental Sustainability",
        "teamContext": "Owns Sambandh's carbon inventory, resource and waste programmes, supplier environmental standards and environmental regulatory compliance.",
        "roles": [
          {
            "title": "Head of Environmental Sustainability",
            "purpose": "Owns Sambandh's environmental strategy, reduction targets and compliance position, and is accountable for the accuracy of every environmental figure the company reports."
          },
          {
            "title": "Senior Carbon Programme Manager",
            "purpose": "Runs the Scope 1, 2 and 3 inventory and the reduction roadmap across cloud infrastructure, offices and the supplier base."
          },
          {
            "title": "Carbon Accounting Analyst",
            "purpose": "Collects, reconciles and documents emissions data to GHG Protocol methodology so every reported figure is traceable to a source."
          },
          {
            "title": "Environmental Compliance Manager",
            "purpose": "Tracks applicable Indian environmental and e-waste obligations for our offices and hardware, and keeps filings and permits current."
          },
          {
            "title": "Sustainable Procurement Manager",
            "purpose": "Sets environmental and social criteria for vendor selection, hardware procurement and hosting decisions, and works with Procurement to assess suppliers against them."
          },
          {
            "title": "Waste and Circularity Specialist",
            "purpose": "Runs office waste reduction, device refurbishment and end-of-life hardware disposal, including certified data destruction before any asset leaves our control."
          }
        ]
      },
      {
        "team": "ESG Strategy & Reporting",
        "teamContext": "Owns Sambandh's ESG strategy, disclosure cycle, metric definitions and governance frameworks for internal and external stakeholders.",
        "roles": [
          {
            "title": "Director of ESG Strategy",
            "purpose": "Sets Sambandh's ESG priorities and materiality assessment, and translates them into commitments the business can actually meet."
          },
          {
            "title": "ESG Reporting Manager",
            "purpose": "Runs the annual ESG report end to end, from data collection through legal review and external assurance, and keeps answers to investor, partner and regulator information requests consistent with what has been published."
          },
          {
            "title": "Senior ESG Analyst",
            "purpose": "Maps our disclosures against BRSR, GRI and investor questionnaires and closes the gaps that reviewers will find."
          },
          {
            "title": "Sustainability Metrics Analyst",
            "purpose": "Defines and maintains the metric catalogue so a given ESG number means the same thing in every report and every quarter."
          },
          {
            "title": "ESG Governance Specialist",
            "purpose": "Maintains the policy set, board reporting pack and control evidence that back our governance claims."
          }
        ]
      },
      {
        "team": "Responsible Innovation",
        "teamContext": "Owns the review process that new AI systems, verification features and product experiments pass through before launch, and the risk record that comes out of it.",
        "roles": [
          {
            "title": "Head of Responsible Innovation",
            "purpose": "Owns the responsible innovation framework at Sambandh and has the standing to hold a launch until identified risks are addressed."
          },
          {
            "title": "Responsible AI Programme Manager",
            "purpose": "Coordinates responsible AI reviews across the Lakshan Book matching and verification systems, tracking commitments through to implementation."
          },
          {
            "title": "Senior Technology Ethics Advisor",
            "purpose": "Assesses the ethical implications of proposed features — particularly anything that infers, scores or discloses attributes about a member — and works with product and design teams early enough that the design can still change."
          },
          {
            "title": "AI Risk Assessment Specialist",
            "purpose": "Documents model risks including bias, misuse and failure modes in the safety-critical path, defines the mitigations and monitoring required before release, and maintains the evidence trail for each launch decision."
          },
          {
            "title": "Responsible AI Policy Manager",
            "purpose": "Turns emerging AI regulation and platform accountability expectations in India and abroad into internal standards engineering teams can build against."
          }
        ]
      },
      {
        "team": "Social Impact Programs",
        "teamContext": "Designs and runs Sambandh's community, digital wellbeing and non-profit programmes, and the partnerships that deliver them.",
        "roles": [
          {
            "title": "Director of Social Impact",
            "purpose": "Sets the social impact portfolio for Sambandh and is accountable for the programmes we fund and the outcomes we claim."
          },
          {
            "title": "Digital Wellbeing Programme Manager",
            "purpose": "Runs adult-facing programmes on healthy online relationship behaviour, consent and harassment awareness, with content and delivery agreed with Trust and Safety and Legal."
          },
          {
            "title": "Community Development Manager",
            "purpose": "Builds and sustains relationships with community organisations in the regions where our members live."
          },
          {
            "title": "Non-profit Partnerships Manager",
            "purpose": "Sources, contracts and manages non-profit delivery partners, including due diligence and performance review."
          },
          {
            "title": "Social Impact Programme Coordinator",
            "purpose": "Runs the operational side of live programmes — scheduling, partner reporting, budget tracking and field logistics."
          }
        ]
      },
      {
        "team": "Education & Digital Inclusion",
        "teamContext": "Owns digital literacy and inclusion programmes, educational institution partnerships and rural technology access work.",
        "roles": [
          {
            "title": "Head of Digital Inclusion",
            "purpose": "Owns Sambandh's digital literacy and inclusion strategy and the partnerships required to deliver it."
          },
          {
            "title": "Digital Literacy Programme Manager",
            "purpose": "Runs community learning programmes on safe internet use, account security and recognising online fraud."
          },
          {
            "title": "Education Partnerships Manager",
            "purpose": "Establishes and manages relationships with colleges, training institutes and education non-profits that host our programmes."
          },
          {
            "title": "Rural Access Programme Manager",
            "purpose": "Adapts and delivers programmes for low-bandwidth, low-device-access and regional-language contexts outside metro India."
          },
          {
            "title": "Learning Content Designer",
            "purpose": "Builds the curricula, facilitator guides and multilingual materials our delivery partners teach from."
          }
        ]
      },
      {
        "team": "Accessibility",
        "teamContext": "Owns accessibility standards for the Sambandh product, inclusive design review, conformance testing and workplace accommodation support.",
        "roles": [
          {
            "title": "Head of Accessibility",
            "purpose": "Owns the accessibility standard Sambandh builds to and the conformance position we are willing to state publicly."
          },
          {
            "title": "Senior Accessibility Engineer",
            "purpose": "Fixes and prevents accessibility defects in the product, and gives engineering teams patterns they can reuse."
          },
          {
            "title": "Inclusive Design Specialist",
            "purpose": "Reviews designs before build so that verification, onboarding and messaging flows are usable by members with disabilities."
          },
          {
            "title": "Accessibility Test Analyst",
            "purpose": "Runs manual, automated and assistive-technology conformance testing against WCAG 2.2 — including screen reader, magnification and alternative input behaviour in Indian language contexts — and logs defects with reproducible evidence."
          },
          {
            "title": "Workplace Accessibility Partner",
            "purpose": "Handles employee accommodation requests and internal tooling accessibility with People and IT."
          }
        ]
      },
      {
        "team": "Climate & Energy",
        "teamContext": "Owns renewable energy sourcing, energy efficiency across compute and facilities, climate resilience planning and sustainable infrastructure standards.",
        "roles": [
          {
            "title": "Climate and Energy Programme Lead",
            "purpose": "Owns Sambandh's energy sourcing and climate resilience programme and the technical case behind each investment."
          },
          {
            "title": "Renewable Energy Manager",
            "purpose": "Sources renewable supply for our offices and cloud footprint and verifies the claims behind every certificate or contract we rely on."
          },
          {
            "title": "Energy Efficiency Engineer",
            "purpose": "Works with Infrastructure and Facilities to cut energy intensity in compute workloads, data centre usage and building systems."
          },
          {
            "title": "Climate Resilience Analyst",
            "purpose": "Assesses physical and transition climate risk to our sites, suppliers and service continuity, and feeds it into business continuity planning."
          }
        ]
      },
      {
        "team": "Corporate Philanthropy",
        "teamContext": "Owns Sambandh's grant-making, foundation relationships and the governance controls over charitable giving.",
        "roles": [
          {
            "title": "Head of Corporate Philanthropy",
            "purpose": "Sets giving strategy and is accountable for where Sambandh's charitable funds go and what they achieve."
          },
          {
            "title": "Grants Manager",
            "purpose": "Runs the grant cycle from application through diligence, disbursement and grantee reporting."
          },
          {
            "title": "Foundation Partnerships Manager",
            "purpose": "Manages relationships with foundations and institutional funders, including co-funded programmes."
          },
          {
            "title": "Donation Governance Analyst",
            "purpose": "Maintains the controls, approvals and records that keep our giving compliant with Indian CSR and charitable regulations and auditable end to end."
          }
        ]
      },
      {
        "team": "Employee Volunteering",
        "teamContext": "Runs Sambandh's employee volunteering programme, including skills-based placements and recognition.",
        "roles": [
          {
            "title": "Employee Volunteering Manager",
            "purpose": "Owns the volunteering programme, its partner network, its events and recognition, and its participation and outcome reporting."
          },
          {
            "title": "Skills-Based Volunteering Specialist",
            "purpose": "Matches engineering, design and data colleagues to non-profit projects where their skills genuinely help, and manages scope and confidentiality boundaries."
          }
        ]
      },
      {
        "team": "Impact Measurement",
        "teamContext": "Owns the frameworks, KPIs, evaluations and longitudinal analysis that establish whether department programmes actually work.",
        "roles": [
          {
            "title": "Head of Impact Measurement",
            "purpose": "Owns the impact measurement framework across the department, is accountable for the credibility of every outcome figure we publish, and takes results to executives and the board including the unflattering ones."
          },
          {
            "title": "Senior Programme Evaluation Manager",
            "purpose": "Designs and runs evaluations of social impact and inclusion programmes, including comparison groups where feasible and follow-up over time under approved consent and retention terms."
          },
          {
            "title": "Impact Data Scientist",
            "purpose": "Builds the analysis behind impact claims, working only with aggregated or consented, privacy-reviewed data."
          },
          {
            "title": "Impact Measurement Analyst",
            "purpose": "Defines KPIs with programme owners and maintains the dashboards and data pipelines that track them."
          }
        ]
      },
      {
        "team": "Sustainability Research Institute",
        "teamContext": "Conducts and publishes applied research on sustainable digital infrastructure, responsible AI, digital inclusion, social resilience and the long-term societal effects of digital platforms.",
        "roles": [
          {
            "title": "Director, Sustainability Research Institute",
            "purpose": "Sets the institute's research agenda, publication standards and external collaborations, and keeps published findings independent of product marketing."
          },
          {
            "title": "Principal Research Scientist, Sustainable Digital Infrastructure",
            "purpose": "Leads research into the energy and resource intensity of large-scale platform and model infrastructure, including the datasets and models the work depends on."
          },
          {
            "title": "Senior Research Scientist, Responsible AI",
            "purpose": "Investigates fairness, bias and societal risk in matching, verification and recommendation systems, and publishes methods others can reproduce."
          },
          {
            "title": "Research Scientist, Digital Inclusion",
            "purpose": "Studies barriers to safe internet participation across language, disability, geography and gender in the Indian context."
          },
          {
            "title": "Research Scientist, Social Resilience",
            "purpose": "Researches how online platforms affect trust, isolation and relationship formation over the long term, including harms."
          },
          {
            "title": "Research Engineer",
            "purpose": "Builds the tooling, datasets and reproducible experiment infrastructure the research programme runs on."
          },
          {
            "title": "Policy Research Manager, Technology for Public Good",
            "purpose": "Translates institute findings into policy-facing publications and engagement with regulators, academics and civil society."
          },
          {
            "title": "Research Programme Manager",
            "purpose": "Runs the institute's project portfolio, external academic partnerships, ethics review submissions and publication pipeline."
          }
        ]
      }
    ],
    "removed": [
      "Resource Efficiency Analyst (Environmental Sustainability) — padding. Water, materials and consumables analysis is a manufacturing-sector role; for an office and cloud footprint the work is already covered by the Carbon Accounting Analyst and the Waste and Circularity Specialist.",
      "Stakeholder Reporting Manager (ESG Strategy & Reporting) — vague title and a duplicate. Investor questionnaires are explicitly the Senior ESG Analyst's remit and disclosure consistency is the ESG Reporting Manager's; that responsibility was folded into the ESG Reporting Manager purpose.",
      "Innovation Assessment Analyst (Responsible Innovation) — invented title. 'Structured pre-launch assessments and the evidence trail' is the AI Risk Assessment Specialist's job; the evidence-trail wording was folded into that role.",
      "Responsible Product Advisor (Responsible Innovation) — duplicates the Senior Technology Ethics Advisor. Two advisory roles advising product on the same question; kept the clearer one and moved the 'embed early, while design can still change' wording into it.",
      "Youth Engagement Programme Manager (Social Impact Programs) — removed on credibility grounds. A dating platform staffing a role to run programmes in schools is indefensible in front of a journalist or regulator regardless of how the caveats are worded, and youth engagement is not in the team's stated responsibilities. Adult-facing consent and harassment education stays with the Digital Wellbeing Programme Manager.",
      "Social Innovation Lead (Social Impact Programs) — padding. Developing, piloting and killing programme concepts is what the Director of Social Impact and the programme managers already do.",
      "Digital Inclusion Analyst (Education & Digital Inclusion) — duplicate. Reach, completion and outcome measurement sits with the Impact Measurement team (Impact Measurement Analyst, Senior Programme Evaluation Manager); measuring your own programmes' success inside the delivery team also weakens the evidence.",
      "Assistive Technology Specialist (Accessibility) — duplicate of the Accessibility Test Analyst, whose purpose already covers assistive-technology testing. Screen reader, magnification, alternative input and Indian language contexts were folded into that role.",
      "Sustainable Infrastructure Specialist (Climate & Energy) — duplicate. Environmental standards for hardware procurement and hosting are the Sustainable Procurement Manager's; building systems are the Energy Efficiency Engineer's. Procurement and hosting wording was folded into the Sustainable Procurement Manager.",
      "Community Engagement Coordinator (Employee Volunteering) — padding in a three-person team. Events, logistics and recognition were folded into the Employee Volunteering Manager.",
      "Longitudinal Research Analyst (Impact Measurement) — duplicate of the Senior Programme Evaluation Manager and of the Research Institute. A standalone role whose job is multi-year retention of participant data is also the wrong shape for a company under DPDP data-minimisation; the follow-up work now sits under the evaluation manager with consent and retention terms stated.",
      "Impact Reporting Manager (Impact Measurement) — duplicate. The Head of Impact Measurement is already accountable for published outcome figures; board and executive reporting, including unflattering findings, was folded into that role.",
      "Research Fellow, Ethical Innovation (Sustainability Research Institute) — vague and duplicative. 'A defined research question on ethical technology design' is the Senior Research Scientist, Responsible AI's remit; the title reads as a placeholder rather than a post.",
      "Environmental Data Scientist (Sustainability Research Institute) — duplicate. The analytical models and datasets behind the environmental research belong to the Principal Research Scientist, Sustainable Digital Infrastructure (wording folded in) and the tooling to the Research Engineer."
    ],
    "verdict": "FIXED"
  }
]

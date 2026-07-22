// Viśvambhara — aerospace & frontier research opportunity catalog.
//
// Structured as the aerospace industry organises itself: 8 tracks → divisions →
// roles, plus the Frontier Research Institutes and the Grand Challenge missions.
//
// FRAMING NOTE (deliberate): the frontier work is described as RESEARCH DIRECTIONS,
// not as technologies that already work. "Ultra-high-endurance energy systems",
// never "infinite fuel". Nothing here implies a violation of conservation of
// energy or any other established physical law. This is what keeps the programme
// credible to universities, funding agencies and serious researchers — the people
// these roles exist to attract.

export const TRACKS = [
  "Launch Vehicle Engineering",
  "Spacecraft Engineering",
  "Aerospace Manufacturing",
  "Flight Software & AI",
  "Electronics & Avionics",
  "Mission Operations & Systems Engineering",
  "Research & Advanced Technologies",
  "Ground Infrastructure & Testing",
]

// ---- Core engineering divisions ----
export const CATALOG = [
  { track: "Launch Vehicle Engineering", division: "Propulsion", roles: [
    "Propulsion Engineering Intern", "Rocket Propulsion Intern", "Solid Propulsion Systems Intern",
    "Liquid Propulsion Systems Intern", "Hybrid Propulsion Systems Intern", "Cryogenic Propulsion Intern",
    "Green Propulsion Systems Intern", "Electric Propulsion Intern", "Ion Thruster Development Intern",
    "Hall Effect Thruster Intern", "Propulsion Test & Validation Intern", "Engine Performance Analysis Intern",
    "Turbomachinery Engineering Intern", "Combustion Engineering Intern", "Injector Design Intern",
    "Nozzle Design Intern", "Feed System Engineering Intern", "Propellant Management Intern",
    "Engine Instrumentation Intern", "Propulsion Controls Intern",
  ]},
  { track: "Launch Vehicle Engineering", division: "Aerodynamics & Fluid Dynamics", roles: [
    "CFD & Aerodynamics Intern", "External Aerodynamics Intern", "Internal Flow Analysis Intern",
    "Supersonic Aerodynamics Intern", "Hypersonic Aerodynamics Intern", "Wind Tunnel Testing Intern",
    "Flight Dynamics Intern", "Aerothermal Engineering Intern", "Flow Simulation Intern",
    "Aerodynamic Optimization Intern",
  ]},
  { track: "Launch Vehicle Engineering", division: "Structures & Mechanical Design", roles: [
    "Aerospace Structures Intern", "Structural Design Intern", "Composite Structures Intern",
    "Lightweight Structures Intern", "Mechanical Design Intern", "CAD Design Engineering Intern",
    "Mechanism Design Intern", "Payload Structure Intern", "Finite Element Analysis (FEA) Intern",
    "Structural Dynamics Intern", "Fatigue Analysis Intern", "Fracture Mechanics Intern",
    "Mechanical Integration Intern", "Configuration Design Intern", "Pressure Vessel Engineering Intern",
  ]},
  { track: "Launch Vehicle Engineering", division: "Thermal Engineering", roles: [
    "Thermal Systems Intern", "Thermal Analysis Intern", "Heat Transfer Engineering Intern",
    "Cryogenic Systems Intern", "Thermal Protection Systems Intern", "Radiator Design Intern",
    "Thermal Modeling Intern", "Space Thermal Control Intern",
  ]},
  { track: "Aerospace Manufacturing", division: "Manufacturing", roles: [
    "Manufacturing Engineering Intern", "Precision Manufacturing Intern", "Aerospace Assembly Intern",
    "Advanced Manufacturing Intern", "CNC Manufacturing Intern", "Additive Manufacturing Intern",
    "Metal 3D Printing Intern", "Composite Manufacturing Intern", "Production Engineering Intern",
    "Tooling Design Intern", "Industrial Engineering Intern", "Process Optimization Intern",
    "Lean Manufacturing Intern", "Factory Automation Intern", "Manufacturing Quality Intern",
  ]},
  { track: "Aerospace Manufacturing", division: "Materials Science", roles: [
    "Aerospace Materials Intern", "Composite Materials Intern", "High Temperature Materials Intern",
    "Metallurgy Intern", "Material Testing Intern", "Failure Analysis Intern", "Ceramic Materials Intern",
    "Smart Materials Intern", "Nanomaterials Intern", "Surface Engineering Intern",
  ]},
  { track: "Electronics & Avionics", division: "Avionics", roles: [
    "Avionics Systems Intern", "Flight Electronics Intern", "Embedded Systems Intern",
    "Flight Computer Intern", "Navigation Electronics Intern", "Sensor Systems Intern",
    "Communication Electronics Intern", "Telemetry Systems Intern", "Payload Electronics Intern",
    "FPGA Engineering Intern", "PCB Design Intern", "Electronic Integration Intern",
    "EMI/EMC Engineering Intern", "Radiation Electronics Intern", "Electronics Test Engineering Intern",
  ]},
  { track: "Electronics & Avionics", division: "Electrical Power Systems", roles: [
    "Electrical Systems Intern", "Power Electronics Intern", "Power Distribution Intern",
    "Harness Design Intern", "Battery Systems Intern", "Energy Storage Intern",
    "Solar Power Systems Intern", "Electrical Integration Intern", "High Voltage Systems Intern",
    "Power Management Intern",
  ]},
  { track: "Electronics & Avionics", division: "Communications", roles: [
    "Satellite Communications Intern", "RF Engineering Intern", "Antenna Engineering Intern",
    "Space Networking Intern", "Deep Space Communications Intern", "Communication Systems Engineering Intern",
  ]},
  { track: "Flight Software & AI", division: "Flight Software & Embedded", roles: [
    "Flight Software Intern", "Embedded Software Intern", "Real-Time Systems Intern",
    "Firmware Engineering Intern", "Guidance Software Intern", "Navigation Software Intern",
    "Control Systems Software Intern", "Autonomous Flight Software Intern", "Middleware Engineering Intern",
    "Simulation Software Intern", "Software Verification Intern", "Software Validation Intern",
    "Safety Critical Software Intern", "Operating Systems Intern", "Edge Computing Intern",
  ]},
  { track: "Flight Software & AI", division: "Guidance, Navigation & Control", roles: [
    "Guidance Engineering Intern", "Navigation Engineering Intern", "Control Systems Intern",
    "AOCS (Attitude & Orbit Control Systems) Intern", "Flight Control Intern", "Sensor Fusion Intern",
    "Kalman Filtering Intern", "Autonomous Guidance Intern", "Orbit Determination Intern",
    "Trajectory Optimization Intern",
  ]},
  { track: "Flight Software & AI", division: "AI, Robotics & Autonomy", roles: [
    "AI for Aerospace Intern", "Autonomous Systems Intern", "Space Robotics Intern", "Guidance AI Intern",
    "Computer Vision Intern", "Machine Learning Intern", "Reinforcement Learning Intern",
    "Autonomous Navigation Intern", "Swarm Robotics Intern", "Intelligent Mission Planning Intern",
  ]},
  { track: "Flight Software & AI", division: "Simulation & Digital Engineering", roles: [
    "Simulation & Modeling Intern", "Digital Twin Engineering Intern", "Physics Simulation Intern",
    "Multi-Body Dynamics Intern", "Monte Carlo Simulation Intern", "Mission Simulation Intern",
    "Hardware-in-the-Loop (HIL) Intern", "Software-in-the-Loop (SIL) Intern", "Digital Engineering Intern",
  ]},
  { track: "Flight Software & AI", division: "Data Engineering & Mission Analytics", roles: [
    "Mission Data Engineering Intern", "Telemetry Analytics Intern", "Flight Data Science Intern",
    "Aerospace Data Engineering Intern", "Predictive Maintenance Intern",
  ]},
  { track: "Spacecraft Engineering", division: "Spacecraft Engineering", roles: [
    "Satellite Engineering Intern", "CubeSat Engineering Intern", "Spacecraft Bus Engineering Intern",
    "Payload Engineering Intern", "Spacecraft Integration Intern", "Spacecraft Verification Intern",
    "Onboard Systems Intern", "Space Environment Engineering Intern", "Deep Space Systems Intern",
    "Planetary Systems Engineering Intern",
  ]},
  { track: "Spacecraft Engineering", division: "Robotics & Mechanisms", roles: [
    "Robotics Engineering Intern", "Mechatronics Intern", "Space Manipulator Systems Intern",
    "Rover Engineering Intern", "Actuation Systems Intern", "Deployment Mechanisms Intern",
  ]},
  { track: "Spacecraft Engineering", division: "Orbital Mechanics", roles: [
    "Astrodynamics Intern", "Orbital Mechanics Intern", "Mission Design Intern",
    "Trajectory Analysis Intern", "Interplanetary Navigation Intern",
  ]},
  { track: "Mission Operations & Systems Engineering", division: "Systems Engineering", roles: [
    "Systems Engineering Intern", "Spacecraft Systems Intern", "Launch Vehicle Systems Intern",
    "Mission Systems Intern", "Requirements Engineering Intern", "Systems Architecture Intern",
    "Interface Engineering Intern", "Technical Program Systems Intern", "Configuration Management Intern",
    "Model-Based Systems Engineering (MBSE) Intern",
  ]},
  { track: "Mission Operations & Systems Engineering", division: "Flight Test & Operations", roles: [
    "Flight Test Engineering Intern", "Launch Operations Intern", "Mission Operations Intern",
    "Ground Systems Intern", "Ground Support Equipment Intern", "Mission Control Intern",
    "Launch Pad Operations Intern", "Recovery Operations Intern", "Flight Data Analysis Intern",
    "Range Operations Intern",
  ]},
  { track: "Ground Infrastructure & Testing", division: "Integration, Testing & Validation", roles: [
    "Integration & Testing Intern", "Vehicle Integration Intern", "System Verification Intern",
    "Hardware Validation Intern", "Environmental Testing Intern", "Vibration Testing Intern",
    "Shock Testing Intern", "Thermal Vacuum Testing Intern", "EMI Testing Intern",
    "Qualification Testing Intern",
  ]},
  { track: "Ground Infrastructure & Testing", division: "Reliability & Safety", roles: [
    "Quality Engineering Intern", "Reliability Engineering Intern", "Safety Engineering Intern",
    "Failure Investigation Intern", "Risk Analysis Intern", "Fault Tree Analysis Intern",
    "Mission Assurance Intern", "Product Assurance Intern",
  ]},
  { track: "Research & Advanced Technologies", division: "Research & Emerging Technologies", roles: [
    "Advanced Aerospace Research Intern", "Space Technology Research Intern", "Hypersonics Research Intern",
    "Quantum Aerospace Systems Intern", "Photonics Engineering Intern", "Advanced Sensors Research Intern",
    "Advanced Energy Systems Intern", "Future Space Transportation Intern",
    "In-Situ Resource Utilization (ISRU) Intern", "Space Habitation Systems Intern",
    "Lunar Systems Engineering Intern", "Mars Mission Engineering Intern",
    "Interplanetary Systems Engineering Intern",
  ]},
]

// ---- Frontier Research Institutes (long-horizon R&D) ----
export const FRONTIER = [
  { institute: "Advanced Aerospace Materials Discovery Institute", lab: "Ultra-Lightweight Materials Laboratory", roles: [
    "Ultra-Light Structural Materials Intern", "Aerospace Nano-Composites Intern", "Graphene Aerospace Structures Intern",
    "Carbon Nanotube Engineering Intern", "MXene Materials Research Intern", "Aerogel Engineering Intern",
    "High Entropy Alloy Research Intern", "Ultra High Strength Alloy Development Intern",
    "Ceramic Matrix Composites Intern", "Hybrid Composite Engineering Intern",
  ]},
  { institute: "Advanced Aerospace Materials Discovery Institute", lab: "Smart Materials Laboratory", roles: [
    "Shape Memory Materials Intern", "Self-Healing Materials Intern", "Self-Sensing Structures Intern",
    "Piezoelectric Materials Intern", "Electroactive Polymer Research Intern", "Magnetostrictive Materials Intern",
    "Adaptive Materials Engineering Intern", "Programmable Matter Research Intern",
    "Intelligent Structural Materials Intern", "Responsive Aerospace Materials Intern",
  ]},
  { institute: "Advanced Aerospace Materials Discovery Institute", lab: "Structural Battery Laboratory", roles: [
    "Structural Battery Systems Intern", "Energy Storage Composites Intern", "Battery Composite Materials Intern",
    "Multifunctional Structures Intern", "Lightweight Energy Structures Intern", "Structural Supercapacitors Intern",
    "Aerospace Battery Integration Intern", "Structural Electronics Intern",
    "Smart Structural Energy Systems Intern", "Future Structural Power Systems Intern",
  ]},
  { institute: "Aerospace Bioengineering Institute", lab: "Biomimetic Systems Laboratory", roles: [
    "Biomimetic Aerospace Systems Intern", "Artificial Feather Engineering Intern", "Wing Surface Biology Research Intern",
    "Bio Surface Aerodynamics Intern", "Living Materials Research Intern", "Bio Inspired Composite Materials Intern",
    "Biological Motion Systems Intern", "Artificial Tendon Systems Intern", "Soft Flight Mechanisms Intern",
    "Bio Adaptive Flight Structures Intern",
  ]},
  { institute: "Autonomous Manufacturing Institute", lab: "Self-Designing Systems Laboratory", roles: [
    "Self Designing Manufacturing Intern", "AI Manufacturing Systems Intern", "Robotic Factory Engineering Intern",
    "Autonomous Assembly Research Intern", "Intelligent Inspection Systems Intern", "Self Correcting Manufacturing Intern",
    "Manufacturing Digital Twin Intern", "Future Aerospace Production Intern", "Lights-Out Manufacturing Intern",
    "Intelligent Factory Automation Intern",
  ]},
  { institute: "Future Engine Research Institute", lab: "Adaptive Engine Architecture Laboratory", roles: [
    "Ultra Efficient Engine Design Intern", "Variable Cycle Engine Research Intern", "Adaptive Engine Architecture Intern",
    "Distributed Engine Systems Intern", "Hybrid Aero Engine Research Intern", "Electric Aero Engine Systems Intern",
    "High Temperature Engine Materials Intern", "Engine Health Intelligence Intern", "Engine Digital Engineering Intern",
    "Future Engine Architecture Intern",
  ]},
  { institute: "High-Endurance Flight Institute", lab: "Persistent Flight Laboratory", roles: [
    "Persistent Flight Systems Intern", "Ultra Long Endurance UAV Intern", "Energy Optimized Aircraft Intern",
    "Long Duration Flight Research Intern", "Autonomous Endurance Optimization Intern", "Intelligent Energy Management Intern",
    "Lightweight Flight Architecture Intern", "High Efficiency Airframe Research Intern",
    "Endurance Performance Analytics Intern", "Future Endurance Systems Intern",
  ]},
  { institute: "Advanced Aerodynamics Institute", lab: "Flow Control Laboratory", roles: [
    "Low Drag Aircraft Intern", "Flow Control Engineering Intern", "Active Aerodynamics Intern",
    "Adaptive Airfoil Research Intern", "Plasma Flow Control Research Intern", "Laminar Flow Engineering Intern",
    "Turbulence Modeling Intern", "Aerodynamic Shape Optimization Intern", "Vortex Engineering Intern",
    "Future Lift Systems Intern",
  ]},
  { institute: "Aerospace Energy Systems Institute", lab: "Energy Density Laboratory", roles: [
    "High Density Energy Research Intern", "Future Battery Chemistry Intern", "Battery Materials Discovery Intern",
    "Battery Thermal Management Intern", "Aerospace Fuel Cell Research Intern", "Hydrogen Storage Engineering Intern",
    "Hybrid Energy Architecture Intern", "Aerospace Power Electronics Intern", "Intelligent Energy Systems Intern",
    "Advanced Power Distribution Intern",
  ]},
  { institute: "Autonomous Mission Systems Institute", lab: "Mission Intelligence Laboratory", roles: [
    "Intelligent Mission Planning Research Intern", "Autonomous Decision Systems Intern", "Mission AI Engineering Intern",
    "Swarm Mission Coordination Intern", "Autonomous Fleet Management Intern", "Autonomous Space Mission Systems Intern",
    "Distributed Mission Intelligence Intern", "Self Learning Mission Systems Intern", "AI Mission Analytics Intern",
    "Intelligent Operations Engineering Intern",
  ]},
  { institute: "Advanced Computational Engineering Institute", lab: "Scientific AI Laboratory", roles: [
    "Engineering Foundation Models Intern", "AI Scientist for Aerospace Intern", "Engineering Knowledge Graphs Intern",
    "Scientific Machine Learning Intern", "Engineering Simulation AI Intern", "AI Driven Optimization Intern",
    "Physics Informed AI Intern", "Autonomous Engineering Agents Intern", "Engineering Reasoning Systems Intern",
    "Computational Discovery Systems Intern",
  ]},
  { institute: "Aerospace Micro Systems Institute", lab: "Micro Flight Laboratory", roles: [
    "Micro UAV Engineering Intern", "Nano UAV Systems Intern", "Micro Propulsion Research Intern",
    "Micro Sensors Engineering Intern", "MEMS Flight Systems Intern", "Micro Avionics Research Intern",
    "Miniature Power Systems Intern", "Swarm Micro Robotics Intern", "Insect Scale Flight Research Intern",
    "Micro Aerospace Manufacturing Intern",
  ]},
  { institute: "Aerospace Infrastructure Institute", lab: "Autonomous Facilities Laboratory", roles: [
    "Smart Hangar Systems Intern", "Autonomous Launch Complex Intern", "Spaceport Engineering Intern",
    "Future Airport Systems Intern", "Autonomous Ground Support Systems Intern", "Smart Mission Control Intern",
    "Intelligent Aerospace Logistics Intern", "Aerospace Infrastructure AI Intern",
    "Digital Infrastructure Engineering Intern", "Future Aerospace Facilities Intern",
  ]},
  { institute: "Aerospace Education & Research Institute", lab: "Engineering Learning Laboratory", roles: [
    "Engineering Curriculum Research Intern", "Virtual Aerospace Laboratory Intern", "XR Engineering Education Intern",
    "Digital Flight Training Intern", "Aerospace Simulation Education Intern", "AI Tutor for Aerospace Intern",
    "Engineering Assessment Systems Intern", "Aerospace Knowledge Platform Intern",
    "Engineering Learning Analytics Intern", "Future Engineering Education Intern",
  ]},
  { institute: "Space Resource Utilization Institute", lab: "Off-World Resources Laboratory", roles: [
    "Lunar Resource Engineering Intern", "Mars Resource Systems Intern", "Asteroid Mining Engineering Intern",
    "Planetary Construction Materials Intern", "Regolith Processing Research Intern", "Off World Manufacturing Intern",
    "Autonomous Mining Robotics Intern", "Space Resource Logistics Intern", "Extraterrestrial Industrial Systems Intern",
    "Space Economy Engineering Intern",
  ]},
]

// ---- The core: Frontier Science & Breakthrough Research Institute ----
export const CORE_INSTITUTE = {
  name: "Viśvambhara Frontier Science & Breakthrough Research Institute",
  vision: "To pursue breakthrough scientific discoveries and engineering innovations that redefine the future of aerospace, energy, transportation and space exploration — investigating technologies beyond current engineering limits through rigorous research, experimentation and validation.",
  centres: [
    { centre: "Centre for Revolutionary Propulsion Systems", lab: "Ultra High-Endurance Propulsion Laboratory", roles: [
      "Ultra High-Endurance Propulsion Research Intern", "Self-Sustaining Propulsion Systems Intern",
      "Closed-Loop Energy Propulsion Intern", "Regenerative Propulsion Systems Intern",
      "Persistent Flight Systems Research Intern", "Advanced Energy Recovery Systems Intern",
      "High-Efficiency Energy Utilization Intern", "Future Aerospace Propulsion Concepts Intern",
      "Autonomous Energy Management Intern", "Breakthrough Propulsion Architecture Intern",
    ]},
    { centre: "Centre for Future Energy Systems", lab: "Energy Discovery Laboratory", roles: [
      "Ultra High Energy Density Storage Intern", "Aerospace Energy Discovery Intern", "Advanced Battery Chemistry Intern",
      "Structural Energy Storage Intern", "Intelligent Power Systems Intern", "Nano Energy Materials Intern",
      "Future Fuel Research Intern", "Ultra Lightweight Energy Systems Intern", "High Specific Energy Systems Intern",
      "Advanced Energy Conversion Intern",
    ]},
    { centre: "Centre for Revolutionary Flight", lab: "Future Flight Laboratory", roles: [
      "Persistent Flight Initiative Intern", "Ultra Long Endurance Aircraft Intern", "Future Wing Architecture Intern",
      "Adaptive Aircraft Systems Intern", "Silent Flight Engineering Intern", "Morphing Flight Systems Intern",
      "Bio Inspired Flight Research Intern", "Distributed Flight Systems Intern",
      "Autonomous Aircraft Architecture Intern", "Future Flight Concepts Intern",
    ]},
    { centre: "Centre for Future Engine Technologies", lab: "Next-Generation Powerplant Laboratory", roles: [
      "Future Turbine Research Intern", "Ultra Efficient Compressor Systems Intern", "Variable Geometry Engine Intern",
      "Advanced Thermal Engine Research Intern", "High Temperature Engine Materials Research Intern",
      "Distributed Engine Systems Research Intern", "Adaptive Engine Intelligence Intern",
      "AI Designed Engine Architecture Intern", "Hybrid Powerplant Research Intern",
      "Future Aerospace Engine Concepts Intern",
    ]},
    { centre: "Centre for Advanced Materials Discovery", lab: "Materials Discovery Laboratory", roles: [
      "Aerospace Materials Discovery Intern", "Graphene Engineering Intern", "Carbon Nanotube Structures Intern",
      "MXene Aerospace Materials Intern", "Self Healing Aerospace Structures Intern",
      "Programmable Aerospace Materials Intern", "Smart Composite Engineering Intern", "Aerospace Metamaterials Intern",
      "Structural Battery Materials Intern", "Ultra Lightweight Structures Research Intern",
    ]},
    { centre: "Centre for Frontier Physics", lab: "Exploratory Aerospace Physics Laboratory", roles: [
      "Novel Propulsion Concepts Research Intern", "Advanced Energy Conversion Research Intern",
      "Future Electromagnetic Propulsion Intern", "Plasma Flight Systems Intern", "Breakthrough Thermal Systems Intern",
      "Advanced Fluid Dynamics Research Intern", "Aerospace Field Interaction Studies Intern",
      "High-Efficiency Energy Transfer Intern", "Advanced Flight Physics Intern", "Emerging Aerospace Physics Intern",
    ]},
    { centre: "Centre for AI-Driven Scientific Discovery", lab: "Autonomous Research Laboratory", roles: [
      "AI Scientist Intern", "Autonomous Research Laboratory Intern", "Engineering Discovery AI Intern",
      "Physics Discovery AI Intern", "Materials Discovery AI Intern", "Autonomous Experiment Design Intern",
      "Scientific Foundation Models Intern", "AI Simulation Research Intern", "AI Engineering Agents Intern",
      "Autonomous Innovation Systems Intern",
    ]},
  ],
}

// ---- Grand Challenge missions: long-horizon research fellowships ----
// Each is stated as a research OBJECTIVE, never as an achieved capability.
export const MISSIONS = [
  { name: "Mission Infinity", role: "Mission Infinity Research Fellow",
    goal: "Research ultra-high-endurance aerospace energy systems for dramatically extended mission durations." },
  { name: "Mission Phoenix", role: "Mission Phoenix Research Fellow",
    goal: "Develop next-generation adaptive propulsion architectures with significantly higher efficiency." },
  { name: "Mission Garuda", role: "Mission Garuda Research Fellow",
    goal: "Create bio-inspired aircraft capable of unprecedented endurance, manoeuvrability and efficiency." },
  { name: "Mission Vajra", role: "Mission Vajra Research Fellow",
    goal: "Discover advanced structural materials that dramatically reduce mass while improving strength and durability." },
  { name: "Mission Amrita", role: "Mission Amrita Research Fellow",
    goal: "Investigate future energy storage technologies aiming for order-of-magnitude improvements in specific energy over today's systems." },
  { name: "Mission Vayu", role: "Mission Vayu Research Fellow",
    goal: "Develop intelligent autonomous flight systems that continuously optimise energy use, propulsion and aerodynamics in flight." },
]

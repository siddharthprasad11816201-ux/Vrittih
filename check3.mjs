import fs from "fs"

const checks = [
  // Auth flow
  ["app/(auth)/login/page.tsx", "Login page"],
  ["app/api/auth/otp-request/route.ts", "OTP request API"],
  ["app/api/auth/otp-verify/route.ts", "OTP verify API"],
  ["app/verify/2fa/page.tsx", "2FA page"],
  ["app/verify/face-login/page.tsx", "Face login page"],

  // Tests
  ["app/tests/page.tsx", "Tests list"],
  ["app/tests/[id]/page.tsx", "Take test"],
  ["app/tests/create/page.tsx", "Create test"],
  ["app/api/tests/route.ts", "Tests API"],
  ["app/api/tests/[id]/route.ts", "Test detail API"],
  ["app/api/tests/[id]/attempt/route.ts", "Start attempt API"],
  ["app/api/tests/[id]/submit/route.ts", "Submit test API"],

  // Community pages
  ["app/community/pages/page.tsx", "Pages hub"],
  ["app/community/pages/create/page.tsx", "Create page"],
  ["app/community/pages/[id]/page.tsx", "Individual page view"],
  ["app/api/community/pages/route.ts", "Pages API"],
  ["app/api/community/pages/[id]/route.ts", "Page detail API"],
  ["app/api/community/pages/[id]/follow/route.ts", "Follow API"],
  ["app/api/community/pages/[id]/post/route.ts", "Page post API"],

  // Dashboard
  ["app/dashboard/page.tsx", "Dashboard"],
  ["app/dashboard/applications/page.tsx", "Applications tracker"],
  ["app/dashboard/recruiter/page.tsx", "Recruiter dashboard"],

  // Profile
  ["app/profile/page.tsx", "Profile view"],
  ["app/profile/edit/page.tsx", "Profile edit"],

  // Settings
  ["app/settings/page.tsx", "Settings"],

  // Jobs
  ["app/jobs/page.tsx", "Jobs list"],
  ["app/jobs/[id]/page.tsx", "Job detail"],
  ["app/dashboard/post-job/page.tsx", "Post job"],

  // Interviews
  ["app/interviews/page.tsx", "Interviews list"],
  ["app/interviews/schedule/page.tsx", "Schedule interview"],
  ["app/interviews/[code]/page.tsx", "Interview room"],

  // Channels
  ["app/channels/page.tsx", "Channels"],

  // Mail
  ["app/mail/page.tsx", "Mail"],

  // Verify
  ["app/verify/face-setup/page.tsx", "Face setup"],
  ["app/verify/doc-verify/page.tsx", "Doc verify"],

  // Admin
  ["app/admin/page.tsx", "Admin overview"],
  ["app/admin/users/page.tsx", "Admin users"],
  ["app/admin/super/page.tsx", "Super admin"],

  // API gaps
  ["app/api/messages/send/route.ts", "Messages send"],
  ["app/api/mail/[id]/route.ts", "Mail by ID"],
  ["app/api/verify/face-challenge/route.ts", "Face challenge"],
]

let built = 0, missing = 0
for (const [path, label] of checks) {
  const exists = fs.existsSync(path)
  if (exists) { built++; console.log("?", label) }
  else { missing++; console.log("? MISSING:", label, "?", path) }
}
console.log(`\nBuilt: ${built} | Missing: ${missing}`)

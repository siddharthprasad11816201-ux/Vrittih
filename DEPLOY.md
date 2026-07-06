# Steps to switch from SQLite to Supabase PostgreSQL:
#
# 1. Create project at supabase.com
# 2. Get connection string from Settings > Database
# 3. Update prisma/schema.prisma:
#    - Change: provider = "sqlite"
#    - To:     provider = "postgresql"
# 4. Update .env:
#    - DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"
# 5. Run:
#    npx prisma db push
#    node prisma/seed-admin.mjs
#    node prisma/seed-channels.mjs
#    node prisma/seed-tests.mjs
#    node seedjobs.mjs
# 6. Run build:
#    npm run build
# 7. Deploy:
#    - Vercel: connect GitHub repo, add env vars
#    - Or: npm start (port 3000)
#    - Signal server: node server/signal.js (port 3002)
#    - Chat server: node server/chat.js (port 3001)
# Authentication API deployment

The website is static on GitHub Pages. Authentication API routes run as Vercel
functions and save accounts in Neon. Passwords are stored as scrypt hashes, not
as plain text. The API uses an HTTP-only cookie for the sign-in session. The
website currently has no sign-in or account-creation page.

## Set up Neon

1. Create a Neon project and copy its pooled connection string.
2. Open Neon's SQL Editor and run [`schema.sql`](./schema.sql).

## Deploy the API to Vercel

1. Import this GitHub repository as a Vercel project. Keep the project root at
   the repository root and use Node.js 22.
2. Deploy the project. Vercel provides an HTTPS URL such as
   `https://your-project.vercel.app`; a custom domain is optional.
3. Add these Vercel environment variables for Production:
   - `DATABASE_URL`: the Neon pooled connection string.
   - `FRONTEND_ORIGIN`: `https://www.myworld.com` (the exact published site origin).
4. The API routes are under `/api/auth/`.
5. Before sharing the site publicly, enable Vercel Firewall rate limits for
   `POST /api/auth/login` and `POST /api/auth/signup`.

Do not put the Neon connection string in frontend code. The authentication API
remains deployed, but the website has no frontend for using it.

Email verification and password recovery are not included.

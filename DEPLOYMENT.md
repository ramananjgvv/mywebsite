# Account sign-in deployment

The website is static on GitHub Pages; account creation and sign-in run as Vercel
functions and save accounts in Neon. Passwords are stored as scrypt hashes, not
as plain text. The API uses an HTTP-only cookie for the sign-in session.

## Set up Neon

1. Create a Neon project and copy its pooled connection string.
2. Open Neon's SQL Editor and run [`schema.sql`](./schema.sql).

## Deploy the API to Vercel

1. Import this GitHub repository as a Vercel project. Keep the project root at
   the repository root and use Node.js 22.
2. Add the custom domain `api.myworld.com` to this Vercel project and configure
   the DNS record Vercel provides. The API needs HTTPS.
3. Add these Vercel environment variables for Production:
   - `DATABASE_URL`: the Neon pooled connection string.
   - `FRONTEND_ORIGIN`: `https://www.myworld.com` (the exact published site origin).
4. Deploy the project. The API routes are under `/api/auth/`.
5. Before sharing the site publicly, enable Vercel Firewall rate limits for
   `POST /api/auth/login` and `POST /api/auth/signup`.

## Publish the frontend

The sign-in page calls `https://api.myworld.com/api/auth`. If your Vercel API
uses a different custom domain, update `authApiBaseUrl` in `login.html` to that
domain. Keep `FRONTEND_ORIGIN` in Vercel set to the exact HTTPS origin serving
the page. Open the published HTTPS site to create accounts; local `file://`
pages are not allowed by the API.

Email/password sign-in does not verify that a user controls the email address.
Email verification and password recovery need an email delivery provider and
are not included in this initial account flow.

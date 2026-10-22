# Elevate Sales OS

Elevate Sales OS is a workspace-based sales application for account research, lead management, outreach, campaigns, meetings, and pipeline reporting. The browser application uses React, Vite, and Supabase. Authenticated AI, Gmail, Calendar, billing, and demo operations run through the Node server in `server/`.

## Run locally

1. Install Node.js 20.12 or newer and npm.
2. Copy `.env.example` to `.env` and fill in the Supabase browser values.
3. Install dependencies with `npm install`.
4. Start the app and API together with `npm run dev`.

The local app listens on port 8080 by default. Set `PORT` to use another port.

## Supabase setup

Apply the database migrations in `supabase/migrations` to the Supabase project before using invitations, billing, or campaign approvals. For example, with the Supabase CLI linked to the intended project, run `supabase db push`.

The client must use the publishable/anon key. Never place `SUPABASE_SERVICE_ROLE_KEY`, AI provider keys, connector client keys, Stripe keys, or `APP_USER_CONNECTION_KEY_SECRET` in a `VITE_*` variable.

## Server configuration

The server reads `.env` locally and reads environment variables directly in production. The app starts with `npm start` after `npm run build`. Deploy it to a Node host that supports a long-running Node process and serves the same origin for the app and `/api/*` routes; a static-only host cannot run the API.

Required or feature-specific server variables:

| Variable                                            | Used for                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `SUPABASE_URL`                                      | Supabase server API                                                   |
| `SUPABASE_PUBLISHABLE_KEY`                          | User-scoped server queries                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                         | Encrypted connector-key storage and Stripe webhook updates            |
| `APP_USER_CONNECTION_KEY_SECRET`                    | Encrypting per-user connector credentials at rest                     |
| `LOVABLE_API_KEY`                                   | Default AI provider; alternatively configure a supported provider key |
| `GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY`     | Gmail connector OAuth                                                 |
| `GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY` | Calendar connector OAuth                                              |
| `CRON_SECRET`                                       | Private bearer token for the scheduled-email worker endpoint          |

Research can use one or more of `FIRECRAWL_API_KEY`, `JINA_API_KEY`, `TAVILY_API_KEY`, or `EXA_API_KEY`. AI can be configured with `AI_PROVIDER` / `AI_MODEL`; supported providers are documented in `src/lib/ai/provider.server.ts`.

Create a strong random `APP_USER_CONNECTION_KEY_SECRET` and keep it stable. Changing it makes previously stored connector keys unreadable. Use test-mode Stripe keys and webhook configuration in non-production environments.

## Build and release

- `npm run build` creates the static client build and the production server bundle.
- `npm start` serves the built app and authenticated API.
- `npm run lint` runs ESLint.
- `npx tsc --noEmit` runs the TypeScript checker.

The Dockerfile builds the production Node app. To deliver scheduled Gmail messages, apply the migrations, configure `CRON_SECRET`, and configure a scheduler to POST to `/api/cron/scheduled-emails` with `Authorization: Bearer <CRON_SECRET>` every minute. Failed jobs are surfaced as failed rather than automatically retried, to avoid duplicate sends when a provider response is ambiguous. Activating a campaign records approval and status but does not send its sequence automatically.

The CRM integrations for HubSpot, Salesforce, and Pipedrive still need provider OAuth applications and two-way sync implementations. Legal copy, retention terms, and operational security details must be reviewed and completed for the actual business before public launch.

# Sales_OS

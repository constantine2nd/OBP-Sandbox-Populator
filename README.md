# OBP Sandbox Populator

A tool for quickly creating and populating [Open Bank Project](https://www.openbankproject.com/) sandbox instances with realistic test data. It provides a modern web UI for interactive use and legacy Python scripts for direct API automation.

## Features

- **Interactive web UI** — configure and populate a sandbox in a few clicks
- **CSV bulk import** — create banks, accounts, customers, and transactions from CSV files
- **Realistic data generation** — Botswana, Singapore, and other country data sets with business names, currencies, and transaction patterns
- **OAuth2 authentication** — connects to OBP using your own credentials
- **One-command deployment** — Docker Compose setup (requires a local Redis and OBP instance on the host)

## Quick Start (Docker)

Prerequisites:
- OBP API running on your host at `http://localhost:8080`
- Redis running on your host at `localhost:6379`

The Docker Compose setup uses `network_mode: host` so the app container shares your host network and reaches both services via `localhost`. No separate Redis container is started.

1. Copy the environment template and fill in your values:

   ```bash
   cp .env.example .env
   ```

2. At minimum, set the following in `.env`:

   ```env
   OBP_OAUTH_CLIENT_ID=your_client_id
   OBP_OAUTH_CLIENT_SECRET=your_client_secret
   ```

3. Start the app:

   ```bash
   docker-compose up
   ```

4. Open [http://localhost:3000](http://localhost:3000) and log in with your OBP account.

## Local Development

Requirements: Node 22+, Redis running locally.

```bash
npm install
npm run dev        # dev server on http://localhost:5178
```

Set `REDIS_HOST=localhost` and `REDIS_PORT=6379` in your `.env`.

Other useful commands:

```bash
npm run build      # production build
npm run preview    # preview the production build
npm run check      # TypeScript + Svelte type check
npm run lint       # formatting check
npm run format     # auto-format with Prettier
```

## Environment Variables

All options are documented in `.env.example`. The key groups are:

| Group | Variables |
|---|---|
| App | `ORIGIN`, `PUBLIC_OBP_BASE_URL`, `OBP_API_VERSION` |
| OAuth | `OBP_OAUTH_CLIENT_ID`, `OBP_OAUTH_CLIENT_SECRET`, `APP_CALLBACK_URL` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| Sandbox defaults | `DEFAULT_NUM_BANKS`, `DEFAULT_NUM_ACCOUNTS_PER_BANK`, `DEFAULT_COUNTRY`, `DEFAULT_CURRENCY` |
| Python scripts (legacy) | `OBP_DIRECT_LOGIN_TOKEN`, `OBP_USERNAME`, `OBP_PASSWORD`, `OBP_CONSUMER_KEY` |

## Using the Web UI

### Populate (interactive)

Navigate to `/populate` after logging in. Configure:

- Number of banks and accounts per bank
- Country (determines business names, customer templates, currency)
- Which entities to create: counterparties, customers, FX rates, transactions

Then click **Populate** to run. The UI shows live results and links to API Explorer for verification.

### CSV Import

Navigate to `/populate/csv`. Upload CSV files for any combination of:

- Banks
- Accounts
- Customers (individual and corporate)
- Transactions

See [ONBOARDING.md](ONBOARDING.md#csv-format-reference) for the exact column format of each CSV type.

## Legacy Python Scripts

For environments without Node or for scripted use:

```bash
pip install -r requirements.txt

# Populate a sandbox (reads token from env or first argument)
python sandbox_populator.py [optional_token]

# Create a dynamic entity for tracking sandbox actions
python create_sandbox_actions_entity.py
```

## Architecture Overview

```
src/
  routes/
    login/          OAuth flow
    (protected)/
      populate/     Interactive form + server action
      csv/          CSV upload + server action
  lib/
    obp/            TypeScript OBP API client and types
    data/           Country/business data definitions
    csv/            CSV parser
    oauth/          OAuth2 provider management
    redis/          Redis session service
```

The app is built with **SvelteKit 5**, styled with **Tailwind CSS v4** and **Skeleton Labs**, and uses **Redis** for session storage. All OBP API calls go through the typed client in `src/lib/obp/client.ts`.

## Deployment

The Docker image is built and pushed to Docker Hub automatically on every push to `main` via GitHub Actions. Tags: `latest`, `main`, and the short commit SHA.

## License

[AGPL-3.0](LICENSE)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

GOAL Account Manager (GAM) — a React PWA with an Express backend for unified account management across Close CRM, Gmail, Google Calendar, Slack, Notion, and local filesystem. Used internally to manage GOAL Platform insurance agency client accounts.

## Commands

```bash
npm run dev       # Start both client (Vite on :5173) and server (Express on :3001) via concurrently
npm run client    # Vite dev server only
npm run server    # Express API server only (node server/index.js)
npm run build     # Production build via Vite
npm run preview   # Preview production build
```

No test runner is configured.

## Architecture

### File Structure

```
src/
  main.jsx              # Entry: BrowserRouter + AppProvider
  App.jsx               # Router + sidebar nav
  index.css             # Tailwind + component classes
  context/AppContext.jsx # useReducer state management
  hooks/useApi.js       # Data fetching hooks
  utils/helpers.js      # Date formatting, account merging, badge classes
  pages/                # Route components (Dashboard, Accounts, AccountDetail, Tasks, Scanner, SearchPage, AddAccount, SettingsPage)
server/
  index.js              # Express API server
  tokens.json           # Google OAuth2 tokens (auto-created, gitignored)
  data/                 # Legacy cached JSON files (no longer used by server)
```

### Frontend (React + Vite)

- **Entry**: `src/main.jsx` → wraps `App` in `BrowserRouter` + `AppProvider`
- **Router** (`src/App.jsx`): sidebar nav with routes — `/` Dashboard, `/accounts` list, `/accounts/:id` detail, `/tasks`, `/scanner`, `/search`, `/add`, `/settings`
- **State** (`src/context/AppContext.jsx`): `useReducer`-based context. Actions: `SET_ACCOUNTS`, `SET_NOTION_ACCOUNTS`, `SET_LOCAL_ACCOUNTS`, `ADD_TASK`, `UPDATE_TASK`, `DELETE_TASK`, `DELETE_ACCOUNT`, `SET_SEARCH_RESULTS`, `SET_SELECTED_ACCOUNT`. Tasks persist to `localStorage` under key `gam_tasks`.
- **Data hooks** (`src/hooks/useApi.js`): `useApi(url)` for GET with auto-fetch + `refetch()`, `useApiPost()` for POST. Both return `{data, loading, error}`.
- **Helpers** (`src/utils/helpers.js`): date formatting, account merging (Notion + local files), status/tier badge classes, email snippet parsing.

### Backend (Express on port 3001)

Single file: `server/index.js`. Vite proxies `/api` to `:3001`.

**All data sources are live** — the server calls external APIs directly for real-time data.

| Endpoint | Source | Notes |
|---|---|---|
| `GET /api/health` | all | Service connectivity status (checks tokens/keys) |
| `GET /api/auth/status` | local | Which services are connected |
| `GET /auth/google` | Google OAuth2 | Redirects to Google consent screen |
| `GET /auth/google/callback` | Google OAuth2 | Handles OAuth callback, stores tokens |
| `POST /auth/google/disconnect` | local | Clears stored Google tokens |
| `GET /api/notion/accounts` | Notion API | Queries accounts database via `@notionhq/client` |
| `GET /api/notion/search?q=` | Notion API | Filters accounts by name/contact |
| `POST /api/notion/account` | Notion API | Creates page in accounts database |
| `DELETE /api/accounts/:name` | Notion API | Archives Notion page by name match |
| `GET /api/gmail/search?q=` | Gmail API | Live email search via `googleapis` |
| `GET /api/calendar/events?q=` | Calendar API | Live event listing via `googleapis`, filters "Clock In" |
| `GET /api/slack/channels` | Slack API | Lists channels via `@slack/web-api` |
| `GET /api/slack/search?q=` | Slack API | Filters channels by name/purpose |
| `GET /api/files/accounts` | filesystem | Reads `ACCOUNTS_DIR` (default: `~/GOAL/My Accounts`) |
| `GET /api/files/account/:name` | filesystem | Files for a specific account folder |
| `GET /api/close/leads?query=` | Close API | Live lead search; requires `CLOSE_API_KEY` |
| `GET /api/search?q=` | all live sources | Unified cross-source search (parallel) |
| `GET /api/scanner/tasks?account=` | Gmail + Calendar | Email/calendar data for an account |
| `GET /api/account/:name/scan-tasks` | all sources | Smart task scanner — pattern-matches emails for follow-ups, action items, reviews; calendar for meeting prep; Slack for relevant channels |

### Key Patterns

- **Account merging**: `mergeAccounts()` in `helpers.js` joins Notion accounts with local filesystem folders by case-insensitive name match, producing a unified list with `source: 'notion' | 'local' | 'both'`.
- **Live data helpers**: Internal functions `fetchGmailThreads()`, `fetchCalendarEvents()`, `fetchSlackChannels()`, `fetchNotionAccounts()` are reused across individual endpoints, unified search, and scanner.
- **Google OAuth2**: Tokens stored in `server/tokens.json`. The `googleapis` library auto-refreshes access tokens using the stored refresh token. The `tokens` event handler persists new tokens on refresh.
- **Notion property extraction**: `notionPageToAccount()` transforms Notion API page objects (nested property types) into flat objects matching the frontend's expected shape (`Name`, `Status`, `Tier`, etc.).

## Design System

- **Tailwind CSS 3** with custom dark theme tokens defined in `tailwind.config.js`
- Color namespace: `brand-*` (bg, surface, elevated, hover, blue, success, warning, error, border, form), `text-*` (primary, secondary, muted, dim), `goal-*` (blue, dark, teal, accent, mint, light)
- Fonts: Red Hat Display (headings/display), Geist (body), Fira Code (mono)
- Component classes in `src/index.css` `@layer components`: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.badge`, `.badge-*`, `.status-*`
- Icons: `lucide-react`

## Environment

- `.env` at project root (see `.env.example` for all keys):
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth2 credentials (Gmail + Calendar)
  - `SLACK_BOT_TOKEN` — Slack bot token with `channels:read` scope
  - `NOTION_API_KEY`, `NOTION_DATABASE_ID` — Notion integration credentials
  - `CLOSE_API_KEY` — Close CRM API key
  - `ACCOUNTS_DIR` (optional, defaults to `~/GOAL/My Accounts`)
- PWA configured via `vite-plugin-pwa` with `registerType: 'autoUpdate'`
- Google OAuth tokens auto-stored in `server/tokens.json` (gitignored)

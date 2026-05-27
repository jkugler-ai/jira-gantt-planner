# 🚀 Mission Control

**NVIDIA OMPE Program Management Dashboard**

A visually appealing, executive-friendly single-page application for managing sprint goals, tracking dependencies, and generating status reports — all powered by live Jira data.

## Features

- **Stories / Sprint Goals / Releases / Bugs** — JQL-powered data pages with sortable columns, filters, and saved queries
- **Daily Tasks** — Personal task management: Jira assigned items + manual tasks + follow-ups with local notes
- **Gantt Chart** — Timeline visualization with dependency arrows and overbooked detection
- **Calendar View** — Month view with start/due dates, auto-populates from default queries
- **Dependency Graph** — Interactive node map showing issue relationships (React Flow)
- **Executive Email Generator** — NVIDIA-branded status emails with wins, risks, and resource alerts
- **Bug Triage** — Priority/fixVersion/reporter columns, staleness flags, triage highlighting
- **Filters** — Dev team, assignee, status, program/product manager, Eng PIC

## Quick Start (Windows)

### Prerequisites
- [Node.js 18+](https://nodejs.org/) installed
- Git installed
- Jira PAT (Personal Access Token) for jirasw.nvidia.com

### First-Time Setup

```powershell
# Clone the repo
cd C:\Users\YourName
git clone https://github.com/jkugler-ai/jira-gantt-planner.git mission-control
cd mission-control

# Install dependencies (must clear NODE_ENV first!)
$env:NODE_ENV=""
npm run install:all

# Build frontend
cd client
npm install
npx vite build
cd ..

# Start the server
$env:NODE_ENV="production"
npm start
```

Open http://localhost:4201 in your browser. Enter your Jira PAT to log in.

### Create Desktop Shortcut

```powershell
cd C:\Users\YourName\mission-control
.\create-shortcut.bat
```

This creates a "Mission Control" shortcut on your Desktop. Double-click it to launch.

### Daily Usage

Either:
- Double-click the Desktop shortcut, OR
- Run `.\start.bat` from the mission-control folder

The start script automatically: pulls latest code → installs deps → builds → launches server + browser.

## Setting Up on Another Computer

1. Install [Node.js 18+](https://nodejs.org/) and [Git](https://git-scm.com/)
2. Clone: `git clone https://github.com/jkugler-ai/jira-gantt-planner.git mission-control`
3. Follow "First-Time Setup" above
4. Run `.\create-shortcut.bat` for a desktop icon
5. Log in with your own Jira PAT

That's it — each person uses their own PAT, no shared credentials needed.

## Authentication

Each user enters their own Jira PAT on first visit. The token is stored server-side in an encrypted session cookie (7-day expiry). Tokens are never logged or exposed to the frontend.

Generate your PAT: Jira → Profile → Personal Access Tokens

## Architecture

```
mission-control/
├── client/              # React + Vite + TypeScript frontend
│   └── src/
│       ├── pages/       # Stories, Bugs, Daily Tasks, Gantt, Calendar, etc.
│       ├── components/  # Layout, JqlDataPage, shared UI
│       ├── context/     # Auth + Filter contexts
│       └── lib/         # Saved queries, utilities
├── server/              # Express backend (Jira API proxy)
│   └── src/
│       ├── index.js     # Server entry point
│       └── routes/      # /api/auth, /api/jira, /api/daily-tasks
├── start.bat            # One-click launcher (Windows)
├── create-shortcut.bat  # Creates desktop shortcut
└── package.json         # Root scripts
```

## Jira Configuration

- **Project:** OMPE
- **Instance:** jirasw.nvidia.com
- **Custom Fields:**
  - `customfield_14311` — Status Update
  - `customfield_37300` — Development Team
  - `customfield_10015` — Start Date
  - `customfield_12711` — Product Manager
  - `customfield_12712` — Program Manager
  - `customfield_35415` — NVBugs ID
  - "Parent Link" — Hierarchy

## Hosting

Runs on port 4201, bound to 0.0.0.0 (accessible on VPN). Share the machine's IP + port with team members.

---

Built with ⚡ by Kit | Program Manager: Jen Kugler

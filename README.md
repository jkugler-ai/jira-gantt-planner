# 🚀 Mission Control

**NVIDIA OMPE Program Management Dashboard**

A visually appealing, executive-friendly single-page application for managing sprint goals, tracking dependencies, and generating status reports — all powered by live Jira data.

![NVIDIA](https://www.nvidia.com/content/dam/en-zz/Solutions/about-nvidia/logo-and-brand/02-nvidia-logo-color-grn-500x200-4c25-p@2x.png)

## Features

- **Sprint Goals Board** — Collapsible sprint goals with expandable user stories, inline editing, status updates
- **Gantt Chart** — Timeline visualization with dependency arrows and overbooked detection
- **Calendar View** — Month view with start/due/need-by dates color-coded
- **Dependency Graph** — Interactive node map showing issue relationships (React Flow)
- **Executive Email Generator** — NVIDIA-branded status emails with wins, risks, and resource alerts
- **Role-based visibility** — PM, PgM, and Eng PIC labels on assignees
- **Filters** — By dev team (Storage Infrastructure APIs, USD Storage, Caching Services, Portal) and assignee

## Quick Start

### Prerequisites
- Node.js 18+
- Jira PAT (Personal Access Token) for jirasw.nvidia.com

### Install & Run

```bash
# Clone the repo
git clone https://github.com/jkugler-ai/jira-gantt-planner.git
cd jira-gantt-planner

# Install all dependencies
npm run install:all

# Development mode (hot reload)
npm run dev

# Production mode
cd client && npm run build && cd ..
NODE_ENV=production node server/src/index.js
```

### Access
- **Production:** http://localhost:4201
- **Development:** http://localhost:5173 (frontend) + http://localhost:4201 (API)

## Authentication

Each user enters their own Jira PAT on first visit. The token is stored server-side in an encrypted session cookie (7-day expiry). Tokens are never logged or exposed to the frontend.

Generate your PAT: Jira → Profile → Personal Access Tokens

## Architecture

```
mission-control/
├── client/          # React + Vite + TypeScript frontend
│   └── src/
│       ├── pages/       # Sprint Goals, Gantt, Calendar, Dependencies, Email
│       ├── components/  # Layout, shared components
│       └── context/     # Auth context
├── server/          # Express backend (Jira API proxy)
│   └── src/
│       ├── index.js     # Server entry point
│       └── routes/      # /api/auth, /api/jira
└── package.json     # Root scripts
```

## Jira Configuration

- **Project:** OMPE
- **Instance:** jirasw.nvidia.com
- **Custom Fields:**
  - `customfield_14311` — Status Update
  - `customfield_37300` — Development Team
  - `customfield_10015` — Start Date
  - "Parent Link" — Hierarchy

## Dev Teams Tracked
- Storage Infrastructure APIs
- USD Storage
- Caching Services
- Portal

## Hosting

Runs on port 4201, bound to 0.0.0.0 (accessible on VPN). Share the machine's IP + port with team members.

---

Built with ⚡ by Kit | Program Manager: Jen Kugler

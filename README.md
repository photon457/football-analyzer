# Football Analysis Desktop Application

A desktop football-analysis application designed from the perspective of a football manager.

## Overview

The primary purpose of this application is to:

- Import match data
- Validate and normalize football event/match statistics
- Analyze player and team performance
- Store match history persistently
- Compare performance across multiple matches
- Expose actionable performance trends via custom D3.js visualizations

## Architecture & Technology Stack

The application follows strict boundary separation documented in `docs/architecture.md`:

- **Desktop Runtime**: Electron (`contextIsolation: true`, `nodeIntegration: false`)
- **Frontend / Manager UI**: React + TypeScript
- **Visualizations**: D3.js (Mandatory custom suite: Bar Chart, Line Chart, Table, Heat Map, Treemap, Packed Bubble, Tooltip system)
- **Data Analysis & Processing**: Python (Pandas, NumPy, FastAPI backend layer)
- **Persistence**: Supabase / PostgreSQL
- **Containerization**: Docker (for reproducible Python backend/analysis service)

## Core-4 Documentation

Implementation decisions must adhere to the Core-4 instruction documents:

1. `docs/architecture.md` — Architectural boundaries & technology stack
2. `docs/memory.md` — Persistent decisions & product context
3. `docs/rules.md` — Implementation rules & engineering standards
4. `docs/tasks.md` — Implementation roadmap & phase tracking

## Getting Started

_(Refer to `docs/tasks.md` for current implementation phase status)_

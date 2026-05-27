# BMAD MCP Server

<div align="center">

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![CI](https://github.com/japentaca/bmad-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/japentaca/bmad-mcp-server/actions/workflows/ci.yml)

A Model Context Protocol server that brings the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) to AI assistants.

> **Fork** of [mkellerman/bmad-mcp-server](https://github.com/mkellerman/bmad-mcp-server) with hard-fail error handling, database persistence (SQLite + PostgreSQL), and enhanced observability.

[Features](#features) • [Fork Differences](#fork-differences) • [Installation](#installation) • [Usage](#usage) • [Documentation](#documentation)

</div>

---

## Overview

The BMAD MCP Server provides AI assistants with access to 11 specialized agents and 36+ automated workflows from the BMAD (Building Modern Apps Decisively) methodology. Configure once, use everywhere across all your projects.

**What is BMAD?**

BMAD is a comprehensive software development methodology with specialized AI agents for different roles (Business Analyst, Architect, Developer, UX Designer, etc.) and workflows for common tasks (PRD generation, architecture design, debugging, testing).

**Why MCP?**

Instead of copying BMAD files to every project, the MCP server provides universal access:

- ✅ Single installation serves all projects
- ✅ Consistent methodology everywhere
- ✅ No project clutter
- ✅ Easy updates

---

## Features

### Unified Tool Architecture

Single `bmad` tool with intelligent operations:

```typescript
// List available agents and workflows
{ operation: "list", query: "agents" }

// Read agent details (no execution)
{ operation: "read", type: "agent", agent: "analyst" }

// Execute agent with context
{ operation: "execute", agent: "analyst", message: "Help me..." }
```

### 11 Specialized Agents

| Agent      | Role             | Load with     |
| ---------- | ---------------- | ------------- |
| 📊 Mary    | Business Analyst | `analyst`     |
| 🏗️ Winston | System Architect | `architect`   |
| 💻 Amelia  | Developer        | `dev`         |
| 🎨 Sally   | UX Designer      | `ux-designer` |
| 🧪 Murat   | Test Architect   | `tea`         |
| 📋 John    | Product Manager  | `pm`          |
| 🔄 Bob     | Scrum Master     | `sm`          |
| 🐛 Diana   | Debug Specialist | `debug`       |
| ...        | [+3 more agents] |               |

### 36+ Automated Workflows

```bash
prd              # Product Requirements Document
architecture     # System architecture design
debug-inspect    # Comprehensive debugging
atdd             # Acceptance test generation
ux-design        # UX specifications
party-mode       # Multi-agent brainstorming
... and 30+ more
```

### MCP Capabilities

- **Tools** - Unified `bmad` tool for all operations
- **Resources** - Access BMAD files via `bmad://` URIs
- **Prompts** - Agents as native MCP prompts
- **Completions** - Smart autocomplete for arguments
- **Multi-source** - Project, user, and Git remote support

---

## Fork Differences

This fork diverges from the [original](https://github.com/mkellerman/bmad-mcp-server) in several key ways:

### Error Handling — Hard Fail, No Fallbacks

| Behavior | Original | This Fork |
|---|---|---|
| DB connection fails | Falls back silently to file storage | **Throws** — connection error propagates |
| Missing `BMAD_DB_URL` | Uses file storage transparently | **Read-only mode** — agents/workflows work, DB operations return clear error |
| Agent file not found | Generates synthetic content from metadata | **Throws** — missing files are hard errors |
| Manifest parse failure | Returns empty name-only list | **Throws** — bad data is surfaced immediately |
| YAML/XML parse errors | Silently skipped | **Throws** — malformed content must be fixed |
| Git update failure | Falls back to full reclone | **Throws** — network/data issues are reported |

All silent `catch {}` blocks in the resource loader, source adapter, and engine have been removed.

### Database Persistence

- **SQLite** via `BMAD_DB_URL=sqlite:///path/to/db.sqlite` (file-based, zero setup)
- **PostgreSQL** via `BMAD_DB_URL=postgresql://user:pass@host/db`
- Documents, full-text search (Spanish + English), and workflow status tracking
- Check health at any time: read `bmad://_db/status` (returns `latencyMs`, `pool` size, `driver`)

### DB Parameters — Nested Sub-object

```typescript
// This fork (nested)
{ operation: "db", db: { action: "save", path: "docs/a.md", content: "..." } }

// Original (flat)
{ operation: "db", dbAction: "save", dbPath: "docs/a.md", dbContent: "..." }
```

### Observability

- `bmad://_db/status` returns `{ connected, driver, health: { latencyMs, pool: { active, idle, waiting } } }`
- `bmad://_cfg/help.md` — virtual self-documentation resource with setup, configuration, and examples
- Startup logs include DB latency and driver info

### Testing

- 219 unit tests (vs original ~195) including 24 KnexStorage tests with `sqlite://:memory:`

---

## Installation

### Prerequisites

- Node.js 18 or later
- An MCP-compatible client (Claude Desktop, VS Code with Copilot, Cline, etc.)

### Quick Start

**Option 1: npx (Recommended)**

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "bmad": {
      "command": "npx",
      "args": ["-y", "bmad-mcp-server"]
    }
  }
}
```

**Option 2: Global Installation**

```bash
npm install -g bmad-mcp-server
```

```json
{
  "mcpServers": {
    "bmad": {
      "command": "bmad-mcp-server"
    }
  }
}
```

**Option 3: Local Development**

```bash
git clone https://github.com/mkellerman/bmad-mcp-server.git
cd bmad-mcp-server
npm install
npm run build
```

```json
{
  "mcpServers": {
    "bmad": {
      "command": "node",
      "args": ["/absolute/path/to/bmad-mcp-server/build/index.js"]
    }
  }
}
```

### Client-Specific Setup

<details>
<summary><b>Claude Desktop</b></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "bmad": {
      "command": "npx",
      "args": ["-y", "bmad-mcp-server"]
    }
  }
}
```

Restart Claude Desktop.

</details>

<details>
<summary><b>VS Code with GitHub Copilot</b></summary>

1. Install the latest GitHub Copilot extension
2. Open Settings (JSON)
3. Add to `github.copilot.chat.mcp.servers`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "bmad": {
      "command": "npx",
      "args": ["-y", "bmad-mcp-server"]
    }
  }
}
```

4. Restart VS Code

</details>

<details>
<summary><b>Cline (VS Code Extension)</b></summary>

1. Open Cline settings
2. Add MCP server:

```json
{
  "mcpServers": {
    "bmad": {
      "command": "npx",
      "args": ["-y", "bmad-mcp-server"]
    }
  }
}
```

</details>

---

## Usage

### Natural Language Examples

Just ask your AI assistant naturally - it handles the MCP tool calls automatically:

**Agent Execution:**

```
You: "Ask Mary to analyze the market opportunity for a SaaS product"
→ AI executes: { operation: "execute", agent: "analyst", message: "..." }
→ Mary (Business Analyst) provides market analysis
```

**Workflow Execution:**

```
You: "Start a PRD workflow for a task management app"
→ AI executes: { operation: "execute", workflow: "prd", message: "..." }
→ John (Product Manager) guides you through PRD creation
```

**Debug Assistance:**

```
You: "Ask Diana to debug this script" (with code attached)
→ AI executes: { operation: "execute", agent: "debug", message: "..." }
→ Diana starts comprehensive debugging workflow
```

**Collaborative Problem Solving:**

```
You: "Start party-mode with the planning team to brainstorm features"
→ AI executes: { operation: "execute", workflow: "party-mode", message: "..." }
→ Multiple agents collaborate on brainstorming session
```

**Architecture Review:**

```
You: "Have Winston review this system design"
→ AI executes: { operation: "execute", agent: "architect", message: "..." }
→ Winston provides architectural guidance
```

### Direct MCP Tool Usage

You can also work with the tool directly (useful for development/testing):

**List available agents:**

```typescript
{
  "operation": "list",
  "query": "agents"
}
```

**Execute an agent:**

```typescript
{
  "operation": "execute",
  "agent": "analyst",
  "message": "Help me analyze the market for a SaaS product"
}
```

**Run a workflow:**

```typescript
{
  "operation": "execute",
  "workflow": "prd",
  "message": "Create PRD for task management app"
}
```

**Read agent details:**

```typescript
{
  "operation": "read",
  "type": "agent",
  "agent": "architect"
}
```

### Advanced Configuration

**Database persistence (recommended):**

Enable document storage, full-text search, and workflow status tracking:

```json
{
  "mcpServers": {
    "bmad": {
      "command": "npx",
      "args": ["-y", "bmad-mcp-server"],
      "env": {
        "BMAD_DB_URL": "sqlite:///home/user/.bmad/bmad.db"
      }
    }
  }
}
```

PostgreSQL also supported:

```json
{
  "mcpServers": {
    "bmad": {
      "command": "npx",
      "args": ["-y", "bmad-mcp-server"],
      "env": {
        "BMAD_DB_URL": "postgresql://user:password@localhost:5432/bmad"
      }
    }
  }
}
```

Without `BMAD_DB_URL` the server runs in read-only mode (agents, workflows, `bmad://` resources still work). DB operations return a clear error if no connection is configured. If `BMAD_DB_URL` is set but the connection fails, the server starts and logs the error — DB operations will fail with a descriptive message until the connection is fixed and the server restarted.

Check DB status at any time via `bmad://_db/status`.

**DB operations available:**

```typescript
// Save a document
{ operation: "db", db: { action: "save", path: "prd/checkout.md", content: "..." } }

// Read a document
{ operation: "db", db: { action: "read", path: "prd/checkout.md" } }

// Full-text search (supports spanish and english)
{ operation: "db", db: { action: "search", query: "payment gateway", language: "spanish" } }

// Save workflow status
{ operation: "db", db: { action: "status-save", status: { step: 3 } }, workflow: "prd" }
```

**Multi-source loading with Git remotes:**

```json
{
  "mcpServers": {
    "bmad": {
      "command": "npx",
      "args": [
        "-y",
        "bmad-mcp-server",
        "git+https://github.com/org/custom-bmad.git#main"
      ]
    }
  }
}
```

**Custom project root:**

```json
{
  "mcpServers": {
    "bmad": {
      "command": "npx",
      "args": ["-y", "bmad-mcp-server"],
      "env": {
        "BMAD_ROOT": "/custom/bmad/location"
      }
    }
  }
}
```

**Local development (from source):**

```json
{
  "mcpServers": {
    "bmad": {
      "command": "node",
      "args": ["/path/to/bmad-mcp-server/build/index.js"],
      "env": {
        "BMAD_DB_URL": "sqlite:///home/user/.bmad/bmad.db"
      }
    }
  }
}
```

**Full configuration (DB + Git remotes + custom root):**

```json
{
  "mcpServers": {
    "bmad": {
      "command": "npx",
      "args": [
        "-y",
        "bmad-mcp-server",
        "git+https://github.com/org/custom-bmad.git#main",
        "git+https://github.com/org/private-tools.git#v2.0.0"
      ],
      "env": {
        "BMAD_DB_URL": "postgresql://user:password@localhost:5432/bmad",
        "BMAD_ROOT": "/home/user/projects/my-app"
      }
    }
  }
}
```

### Resource Discovery Priority

The server searches for BMAD content in this order:

1. **Project-local**: `./bmad/` (highest priority - project customizations)
2. **User-global**: `~/.bmad/` (personal defaults)
3. **Git remotes**: Cloned to `~/.bmad/cache/git/` (shared/team content)
4. **Package defaults**: Built-in BMAD files (always available)

---

## Documentation

- **[Architecture](./docs/architecture.md)** - System design and components
- **[API Contracts](./docs/api-contracts.md)** - MCP tools and TypeScript APIs
- **[Development Guide](./docs/development-guide.md)** - Contributing and testing
- **[Release Process](./.github/RELEASE_PROCESS.md)** - Release workflow for maintainers

---

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/mkellerman/bmad-mcp-server.git
cd bmad-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

### Project Structure

```
src/
├── index.ts              # MCP server entry point
├── cli.ts                # CLI entry point
├── server.ts             # MCP server implementation
├── core/
│   ├── bmad-engine.ts    # Core business logic
│   └── resource-loader.ts # Multi-source content loading
├── tools/
│   ├── bmad-unified.ts   # Unified tool implementation
│   └── operations/       # Operation handlers
├── types/                # TypeScript types
└── utils/                # Utilities
```

### npm Scripts

```bash
npm run build          # Compile TypeScript
npm run dev            # Development mode with auto-restart
npm test               # Run all tests
npm run test:unit      # Unit tests only
npm run test:coverage  # Coverage report
npm run lint           # Check linting
npm run format         # Format code
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode
npm run test:watch
```

---

## Architecture

### High-Level Overview

```
AI Assistant (Claude, Copilot, etc.)
         ↓ MCP Protocol
    MCP Server Layer
         ↓
    BMAD Engine (transport-agnostic)
         ↓
  Resource Loader (multi-source)
         ↓
   BMAD Content (agents, workflows)
```

### Key Components

- **Server**: MCP protocol implementation (tools, resources, prompts)
- **Engine**: Transport-agnostic business logic
- **Loader**: Multi-source content discovery and loading
- **Tools**: Unified `bmad` tool with modular operations

See [Architecture Documentation](./docs/architecture.md) for details.

---

## Contributing

We welcome contributions! Please see our [Development Guide](./docs/development-guide.md) for:

- Development setup
- Code style guidelines
- Testing requirements
- Pull request process

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Run tests: `npm test`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Create a Pull Request

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

ISC © [mkellerman](https://github.com/mkellerman)

---

## Credits

This MCP server is built on the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD). All methodology, agents, workflows, and best practices are credited to the original BMAD Method project.

---

## Links

- **Repository**: https://github.com/mkellerman/bmad-mcp-server
- **Issues**: https://github.com/mkellerman/bmad-mcp-server/issues
- **npm Package**: https://www.npmjs.com/package/bmad-mcp-server
- **BMAD Method**: https://github.com/bmad-code-org/BMAD-METHOD
- **MCP Specification**: https://modelcontextprotocol.io/

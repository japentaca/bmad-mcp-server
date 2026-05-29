# BMAD Document-Project Workflow

Generate comprehensive project documentation by scanning the codebase. Use this when onboarding a new developer, handing off a project, or creating a knowledge base.

## Scan Levels

### Level 1: Quick Overview (15 min)
- Project name, purpose, and elevator pitch
- Technology stack summary
- Entry points: how to run, build, test
- Top-level directory structure with purpose of each

### Level 2: Standard Scan (1-2 hours)
Everything in Level 1, plus:
- Architecture overview with component diagram description
- Data model: key entities and relationships
- API surface: public endpoints and their purpose
- Configuration: env vars, feature flags, settings
- Dependencies: key external services and libraries
- Development workflow: setup, build, test, deploy

### Level 3: Deep Dive (4-6 hours)
Everything in Level 2, plus:
- Source tree: every directory with purpose and key files
- Component deep dives: each module's responsibility, inputs, outputs
- Database schema: full table catalog with relationships
- Integration points: every external service with auth and failure modes
- Deployment architecture: environments, pipelines, monitoring
- Known issues and technical debt register

## Output Format

### Project Overview
```markdown
# Project: [Name]

## Purpose
[2-3 sentences describing what the project does]

## Tech Stack
| Component | Technology |
|-----------|-----------|
| Frontend | [tech] |
| Backend | [tech] |
| Database | [tech] |
| Deployment | [tech] |

## Quick Start
```bash
git clone [repo]
cd [project]
npm install
npm run dev
```

## Directory Structure
```
src/
├── [dir]/   # [purpose]
├── [dir]/   # [purpose]
└── [dir]/   # [purpose]
```

## Key Decisions
1. **[Decision]**: [Why we chose this]

## Known Issues
- [Issue 1]: [impact and workaround]
```

### Scan Report JSON
```json
{
  "level": 2,
  "scanDate": "2026-01-01",
  "components": [
    {
      "name": "auth-service",
      "path": "src/auth/",
      "type": "service",
      "responsibility": "User authentication and authorization",
      "dependencies": ["database", "jwt-library"],
      "entryPoints": ["src/auth/login.ts", "src/auth/register.ts"],
      "tests": "src/auth/__tests__/",
      "health": "good"
    }
  ],
  "dataModel": {
    "entities": ["User", "Session", "Permission"],
    "relationships": "User has many Sessions, User has many Permissions"
  },
  "apis": [
    {
      "method": "POST",
      "path": "/api/auth/login",
      "purpose": "Authenticate user",
      "auth": "none"
    }
  ],
  "risks": [
    {
      "area": "auth-service",
      "risk": "No rate limiting on login endpoint",
      "severity": "medium"
    }
  ]
}
```

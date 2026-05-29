# BMAD Test-Framework Workflow

Set up the testing infrastructure for a project. Use this when starting a new project or adding testing to an existing one.

## Decision Tree

### 1. Choose Test Types

| Test Type | When to Use | Tool (JS/TS) |
|-----------|-------------|--------------|
| **Unit** | Pure functions, business logic | Vitest, Jest |
| **Component** | UI components in isolation | Vitest + Testing Library |
| **Integration** | Multiple modules working together | Vitest, Supertest |
| **E2E** | Full user flows, browser | Playwright, Cypress |
| **API** | REST/GraphQL endpoints | Supertest, Vitest |
| **Visual** | UI regression | Percy, Chromatic |
| **Performance** | Load testing, stress | k6, Artillery |

### 2. Framework Setup

**Vitest (recommended for JS/TS):**
```bash
npm install -D vitest
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

**Playwright (for E2E):**
```bash
npm install -D @playwright/test
npx playwright install
```

### 3. Test Structure Convention

```
src/
├── components/
│   ├── Button.tsx
│   └── __tests__/
│       └── Button.test.tsx     # Component tests
├── services/
│   ├── auth.ts
│   └── __tests__/
│       └── auth.test.ts        # Service tests
├── utils/
│   ├── format.ts
│   └── __tests__/
│       └── format.test.ts      # Utility tests
└── __tests__/
    └── integration/
        └── auth-flow.test.ts   # Integration tests

tests/
└── e2e/
    ├── login.spec.ts            # E2E tests
    └── checkout.spec.ts
```

### 4. Test Data Strategy

- **Factories**: Create test data with sensible defaults
- **Fixtures**: Static test data for common scenarios
- **Mocks**: Stub external dependencies (APIs, DB, file system)
- **In-memory DB**: Use SQLite `:memory:` for database tests

### 5. CI Integration

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm run test -- --coverage

- name: Run E2E
  run: npx playwright test
```

### 6. Output

```json
{
  "framework": "vitest",
  "e2eFramework": "playwright",
  "testTypes": ["unit", "integration", "e2e"],
  "structure": "co-located __tests__/ directories",
  "coverageTargets": {
    "statements": 80,
    "branches": 80,
    "functions": 80,
    "lines": 80
  },
  "ciConfigured": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage"
  }
}
```

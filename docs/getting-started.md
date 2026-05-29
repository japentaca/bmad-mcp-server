# Getting Started — BMAD Development Platform

Guía práctica para instalar y configurar el sistema completo.

---

## Lo que necesitás

- **Node.js 18+**
- **OpenCode** (para modo diálogo con agentes)

---

## 1. Instalar

```bash
git clone https://github.com/japentaca/bmad-mcp-server bmad-platform
cd bmad-platform
npm install && npm run build
```

---

## 2. Configurar el MCP en OpenCode

Agregá a tu `mcp.json`:

```json
{
  "mcpServers": {
    "bmad": {
      "command": "node",
      "args": ["ruta/a/bmad-platform/packages/mcp/build/index.js"],
      "env": {
        "BMAD_SQLITE_PATH": "ruta/a/bmad-platform/bmad.db"
      }
    }
  }
}
```

> **Importante:** Usar rutas absolutas. El MCP auto-copia `vendor/bmad/` en tu proyecto al iniciar.

---

## 3. Configurar la Web App

```bash
cd packages/web
npm run dev
```

Creá `.env` en `packages/web/`:

```env
BMAD_DB_URL=sqlite://../bmad.db
BMAD_ACCESS_TOKEN=changeme
```

> La DB debe ser la misma que usa el MCP (`BMAD_SQLITE_PATH`).

Abrí `http://localhost:4321`. Login: `changeme`.

---

## 4. Flujo de trabajo

### Fase 1: Planificación (OpenCode TUI)

```
> Read vendor/bmad/pm.md y definí épicas para un ecommerce
```

El MCP copió automáticamente los agentes a `vendor/bmad/` en tu proyecto. Leés el agente que necesitás, lo encarnás, y producís PRDs/stories.

Guardá los resultados en la DB:

```
bmad({ operation: "db", db: { action: "save", path: "prd/ecommerce.md", content: "..." } })
```

### Fase 2: Ejecución (Web UI)

1. Creá un proyecto en `http://localhost:4321`
2. Andá al Kanban → las stories aparecen en **Created**
3. Clickeá **[Start Dev]**
4. Pipeline automático: `dev → review → test`
5. Resultado en **Done** o feedback con **[Retry]**

### Fase 3: Monitoreo

- **Kanban:** Estado visual de cada story
- **Activity Console:** Log en tiempo real vía WebSocket
- **Gantt:** Timeline de stories

---

## 5. OpenCode SDK (ejecución real)

```bash
cd packages/web
npm install @opencode-ai/sdk
```

Sin el SDK, `[Start Dev]` funciona en modo simulación.

---

## 6. Customizar agentes

Editá `vendor/bmad/{agente}.md`. Sin build, sin reinicio.

Los agentes son prompts autocontenidos: persona + proceso + formato de output + reglas.

---

## 7. Variables de entorno

| Variable | Propósito | Default |
|----------|-----------|---------|
| `BMAD_DB_URL` | Conexión a DB | `sqlite://./bmad.db` |
| `BMAD_SQLITE_PATH` | SQLite path (MCP) | — |
| `BMAD_ACCESS_TOKEN` | Token del panel web | `changeme` |
| `BMAD_VENDOR_PATH` | Ruta a agentes (web) | `vendor/bmad/` |
| `BMAD_WS_PORT` | Puerto WebSocket | `3001` |

---

## 8. Troubleshooting

**"Start Dev" no ejecuta código real:**
- Instalá `@opencode-ai/sdk` en `packages/web`

**Kanban vacío:**
- Las stories deben guardarse como documentos en la DB
- Usá `bmad({ operation: "db", db: { action: "save", ... } })` desde la TUI

**"Agent not found" en logs:**
- Verificá que `vendor/bmad/` existe en tu proyecto
- El MCP lo copia automáticamente al iniciar. Si no, copialo manualmente desde el monorepo

**Error de DB:**
- El archivo SQLite se crea automáticamente
- Para Postgres, usá `BMAD_DB_URL=postgresql://...`
- MCP y Web deben apuntar a la misma DB

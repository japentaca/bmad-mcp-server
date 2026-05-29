# Getting Started — BMAD Development Platform

Guía práctica para instalar y configurar el sistema completo.

---

## Lo que necesitás

- **Node.js 18+**
- **OpenCode** (para modo diálogo con agentes)
- **Git**

---

## 1. Instalar

```bash
git clone <repo-url> bmad-platform
cd bmad-platform
npm install
npm run build
```

---

## 2. Configurar la Web App

Creá `.env` en `packages/web/`:

```env
BMAD_DB_URL=sqlite://./bmad.db
BMAD_ACCESS_TOKEN=changeme
```

Arrancá:

```bash
cd packages/web
npm run dev
```

Abrí `http://localhost:4321`. Login con token `changeme`.

---

## 3. Flujo de trabajo

### Fase 1: Planificación (OpenCode TUI)

Los agentes BMAD son archivos markdown en `vendor/bmad/`. En OpenCode, los encarnás directamente:

```
> Read vendor/bmad/pm.md y definí épicas para un ecommerce
> Read vendor/bmad/architect.md y diseñá la arquitectura
> Read vendor/bmad/analyst.md e investigá el mercado
```

Guardá los resultados como documentos.

### Fase 2: Ejecución (Web UI)

1. Creá un proyecto en `http://localhost:4321`
2. Andá a la pestaña **Kanban**
3. Las stories aparecen en **Created**
4. Clickeá **[Start Dev]**
5. El pipeline ejecuta 3 stages secuenciales:
   - `dev.md` — implementa la story
   - `reviewer.md` — revisión adversarial
   - `tea.md` — corre tests
6. Si todo pasa → **Done** ✅
7. Si algo falla → feedback + botón **[Retry]**

### Fase 3: Monitoreo

- **Kanban:** Estado visual de cada story
- **Activity Console:** Log en tiempo real vía WebSocket
- **Gantt:** Timeline de stories

---

## 4. OpenCode SDK (ejecución real)

Para que `[Start Dev]` ejecute código real:

```bash
cd packages/web
npm install @opencode-ai/sdk
```

Sin el SDK, el orquestador funciona en modo simulación.

---

## 5. Variables de entorno

| Variable | Propósito | Default |
|----------|-----------|---------|
| `BMAD_DB_URL` | Conexión a DB | `sqlite://./bmad.db` |
| `BMAD_ACCESS_TOKEN` | Token del panel web | `changeme` |
| `BMAD_VENDOR_PATH` | Ruta a agentes | `vendor/bmad/` |
| `BMAD_WS_PORT` | Puerto WebSocket | `3001` |

---

## 6. Customizar agentes

Editá `vendor/bmad/{agente}.md`. El orquestador los lee en runtime. Sin build, sin reinicio.

Cada archivo es un prompt autocontenido: persona + proceso + formato de output + reglas.

---

## 7. Troubleshooting

**"Start Dev" no hace nada:**
- Instalá `@opencode-ai/sdk` en `packages/web`

**"Agent not found" en los logs:**
- Verificá que `vendor/bmad/` existe en la raíz del monorepo
- O setea `BMAD_VENDOR_PATH` a la ruta correcta

**Error de DB:**
- El archivo SQLite se crea automáticamente
- Para Postgres, setea `BMAD_DB_URL=postgresql://...`

**Kanban vacío:**
- Las stories deben guardarse como documentos en la DB
- Creá documentos desde el diálogo con agentes en la TUI

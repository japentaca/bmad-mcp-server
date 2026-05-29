/**
 * Unified BMAD Tool Implementation
 *
 * This is the NEW unified tool that replaces:
 * - Individual agent tools (bmm-analyst, bmm-architect, etc.)
 * - bmad-workflow tool
 * - bmad-resources tool
 *
 * Design Philosophy:
 * - Single tool with rich description for LLM routing
 * - Three core operations: list, read, execute
 * - Optional search operation (toggleable via config)
 * - LLM does intelligence, tool does validation and execution
 * - Modular operation handlers in ./operations/
 *
 * @see test-prompts.json for test specification
 */

/**
 * Configuration for BMAD unified tool
 */
export interface BMADToolConfig {
  /** Enable search operation (default: false) */
  enableSearch?: boolean;
}

import { Tool, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { BMADEngine } from '../core/bmad-engine.js';
import type { AgentMetadata } from '../core/resource-loader.js';
import type { Workflow } from '../types/index.js';

// Import operation handlers
import {
  type ListParams,
  executeListOperation,
  validateListParams,
  getListExamples,
} from './operations/list.js';
import {
  type SearchParams,
  executeSearchOperation,
  validateSearchParams,
  getSearchExamples,
} from './operations/search.js';
import {
  type ReadParams,
  executeReadOperation,
  validateReadParams,
  getReadExamples,
} from './operations/read.js';
import {
  type ExecuteOperationParams,
  executeExecuteOperation,
  validateExecuteParams,
  getExecuteExamples,
} from './operations/execute.js';
import {
  type DBParams,
  executeDBOperation,
  validateDBParams,
  getDBExamples,
} from './operations/db.js';
import { getStorage } from '../storage/index.js';

/**
 * Parameters for the unified BMAD tool
 */
export interface BMADToolParams {
  /** Operation to perform */
  operation: 'list' | 'search' | 'read' | 'execute' | 'db';

  // List operation params
  /** Query for list operation (agents, workflows, modules, resources) */
  query?: string;
  /** Pattern for resource filtering */
  pattern?: string;

  // Search operation params
  /** Search query string */
  searchQuery?: string;
  /** Search type (agents, workflows, all) */
  searchType?: string;

  // Read operation params
  /** Type for read operation (agent, workflow, resource) */
  type?: string;
  /** Resource URI for read operation */
  uri?: string;

  // Execute operation params
  /** User message/context (for execute operation) */
  message?: string;

  // DB operation params (nested sub-object)
  /** DB operation parameters */
  db?: {
    /** DB action: save, read, list, search, status-save, status-read, status-list */
    action?: string;
    /** DB document path */
    path?: string;
    /** DB document content (for save) */
    content?: string;
    /** DB content type (default: markdown) */
    contentType?: string;
    /** DB search query */
    query?: string;
    /** DB search language (default: spanish) */
    language?: string;
    /** DB limit for list/search */
    limit?: number;
    /** DB offset for list/search */
    offset?: number;
    /** DB workflow status payload */
    status?: Record<string, unknown>;
    /** DB project name override */
    projectName?: string;
  };

  // Common params
  /** Optional module filter (core, bmm, cis) */
  module?: string;
  /** Agent name (for read/execute) */
  agent?: string;
  /** Workflow name (for read/execute) */
  workflow?: string;
}

/**
 * Creates the unified BMAD tool definition
 *
 * This function generates a Tool object with:
 * - Comprehensive description including all agents and workflows
 * - Parameter schema for operations (list/read/execute, optionally search)
 * - Examples to guide LLM routing
 *
 * @param agents - Array of agent metadata from manifests
 * @param workflows - Array of workflow metadata from manifests
 * @param config - Optional configuration (e.g., enable search operation)
 * @returns MCP Tool definition
 */
export function createBMADTool(
  agents: AgentMetadata[],
  workflows: Workflow[],
  config?: BMADToolConfig,
): Tool {
  const operations = ['db'];

  const operationDesc =
    'Operation type:\n' +
    '- db: Database persistence - save/read/list/search documents and workflow status';

  return {
    name: 'bmad',
    description:
      'Database persistence for BMAD documents and workflow status. Use this to save, read, list, and search documents and track workflow progress.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: operations,
          description: operationDesc,
        },
        module: {
          type: 'string',
          description:
            'Optional project name override.',
        },
        workflow: {
          type: 'string',
          description:
            'Workflow name for status operations.',
        },
        agent: {
          type: 'string',
          description:
            'Agent name for document tracking.',
        },
        db: {
          type: 'object',
          description: 'DB operation parameters.',
          properties: {
            action: {
              type: 'string',
              enum: ['save', 'read', 'list', 'search', 'status-save', 'status-read', 'status-list'],
              description: 'Action: save, read, list, search, status-save, status-read, status-list',
            },
            path: { type: 'string', description: 'Document path' },
            content: { type: 'string', description: 'Document content' },
            contentType: { type: 'string', description: 'Content type (default: markdown)' },
            query: { type: 'string', description: 'Search query' },
            language: { type: 'string', description: 'Search language' },
            limit: { type: 'number', description: 'Result limit' },
            offset: { type: 'number', description: 'Result offset' },
            status: { type: 'object', description: 'Workflow status payload' },
            projectName: { type: 'string', description: 'Project name' },
          },
        },
      },
      required: ['operation', 'db'],
    },
  };
}

/**
 * Builds comprehensive tool description with all agents and workflows
 *
 * Description format:
 * - Overview of BMAD and operations
 * - Complete agent list (grouped by module) with personas
 * - Complete workflow list with descriptions
 * - Usage examples for common patterns
 *
 * @param agents - Agent metadata
 * @param workflows - Workflow metadata
 * @param enableSearch - Whether to include search operation
 * @returns Formatted tool description
 */
function buildToolDescription(
  agents: AgentMetadata[],
  workflows: Workflow[],
  enableSearch: boolean,
): string {
  const parts: string[] = [];

  // Header
  parts.push(
    'Execute BMAD agents and workflows. Provides access to all BMAD modules.',
  );
  parts.push('');
  parts.push('**Operations:**');
  parts.push('- `list`: Discover available agents/workflows/modules/resources');
  if (enableSearch) {
    parts.push('- `search`: Find agents/workflows by fuzzy search');
  }
  parts.push(
    '- `read`: Inspect agent or workflow details (read-only, no execution)',
  );
  parts.push(
    '- `execute`: Run agent or workflow with user context (performs actions)',
  );
  parts.push('');

  // Agents section (grouped by module)
  parts.push('**Available Agents:**');
  parts.push('');

  const agentsByModule = groupByModule(agents);
  for (const [moduleName, moduleAgents] of Object.entries(agentsByModule)) {
    parts.push(`${moduleName.toUpperCase()} Module:`);
    for (const agent of moduleAgents) {
      const line =
        `  - ${agent.name}` +
        (agent.displayName ? ` (${agent.displayName})` : '') +
        (agent.title ? `: ${agent.title}` : '');
      parts.push(line);
    }
    parts.push('');
  }

  // Workflows section
  parts.push('**Available Workflows:**');
  parts.push('');

  const workflowsByModule = groupWorkflowsByModule(workflows);
  for (const [moduleName, moduleWorkflows] of Object.entries(
    workflowsByModule,
  )) {
    parts.push(`${moduleName.toUpperCase()} Module:`);
    for (const workflow of moduleWorkflows) {
      const line =
        `  - ${workflow.name}` +
        (workflow.description ? `: ${workflow.description}` : '');
      parts.push(line);
    }
    parts.push('');
  }

  // Usage examples
  parts.push('**Usage Guide:**');
  parts.push('');
  parts.push('**When to use each operation:**');
  parts.push(
    '- `list` - User asks "what agents/workflows are available?" or wants to browse options',
  );
  if (enableSearch) {
    parts.push(
      '- `search` - User asks "find agents related to X" or wants fuzzy search',
    );
  }
  parts.push(
    '- `read` - User asks "what does the analyst do?" or wants agent/workflow details',
  );
  parts.push(
    '- `execute` - User wants to actually run an agent or workflow to accomplish a task',
  );
  parts.push('');
  parts.push(
    '**Important:** Use agent/workflow names WITHOUT module prefix (e.g., "analyst" not "bmm-analyst")',
  );
  parts.push('');
  parts.push('**Examples:**');
  parts.push('');
  parts.push('Discovery - List all agents:');
  parts.push('  { operation: "list", query: "agents" }');
  parts.push('');
  parts.push('Discovery - List agents in specific module:');
  parts.push('  { operation: "list", query: "agents", module: "bmm" }');
  parts.push('');
  parts.push('Capability Query - See what an agent can do:');
  parts.push('  { operation: "read", agent: "analyst" }');
  parts.push('');
  parts.push('Direct Intent - Execute agent to accomplish task:');
  parts.push(
    '  { operation: "execute", agent: "analyst", message: "Help me brainstorm a mobile app" }',
  );
  parts.push('');
  parts.push('Explicit Routing - User specifies which agent:');
  parts.push(
    '  { operation: "execute", agent: "architect", message: "Design a scalable architecture" }',
  );
  parts.push('');
  parts.push('Execute workflow:');
  parts.push(
    '  { operation: "execute", workflow: "prd", message: "Create PRD for e-commerce platform" }',
  );
  parts.push('');
  if (enableSearch) {
    parts.push('Search for agents:');
    parts.push('  { operation: "search", query: "debug" }');
    parts.push('');
  }
  parts.push('Disambiguate with module (if name collision):');
  parts.push(
    '  { operation: "execute", agent: "debug", module: "bmm", message: "Fix this bug" }',
  );
  parts.push('');
  parts.push(
    'Use `{ operation: "read", uri: "bmad://_cfg/help.md" }` for setup instructions, database configuration, and customization help.',
  );

  return parts.join('\n');
}

/**
 * Groups agents by module for organized display
 */
function groupByModule(
  agents: AgentMetadata[],
): Record<string, AgentMetadata[]> {
  const grouped: Record<string, AgentMetadata[]> = {};

  for (const agent of agents) {
    const module = agent.module || 'core';
    if (!grouped[module]) {
      grouped[module] = [];
    }
    grouped[module].push(agent);
  }

  return grouped;
}

/**
 * Groups workflows by module for organized display
 */
function groupWorkflowsByModule(
  workflows: Workflow[],
): Record<string, Workflow[]> {
  const grouped: Record<string, Workflow[]> = {};

  for (const workflow of workflows) {
    const module = workflow.module || 'core';
    if (!grouped[module]) {
      grouped[module] = [];
    }
    grouped[module].push(workflow);
  }

  return grouped;
}

/**
 * Handles execution of the unified BMAD tool
 *
 * Routes operation to appropriate handler:
 * - list: Returns manifest data (agents/workflows/modules/resources)
 * - search: Performs fuzzy search across agents and workflows
 * - read: Returns agent/workflow/resource definition
 * - execute: Invokes agent or workflow
 *
 * @param params - Tool parameters
 * @param engine - BMAD Engine instance
 * @returns Tool execution result
 */
export async function handleBMADTool(
  params: BMADToolParams,
  engine: BMADEngine,
): Promise<{ content: TextContent[] }> {
  const { operation } = params;

  if (operation === 'db') {
    return await handleDB(params);
  }

  return {
    content: [
      {
        type: 'text',
        text: `BMAD agents are now in vendor/bmad/ directory. Use 'Read vendor/bmad/{agent}.md' in your TUI, or use db operations for persistence.`,
      },
    ],
  };
}

/**
 * Handles list operation
 */
async function handleList(
  params: BMADToolParams,
  engine: BMADEngine,
): Promise<{ content: TextContent[] }> {
  // Map BMADToolParams to ListParams
  const listParams: ListParams = {
    query: (params.query || 'agents') as
      | 'agents'
      | 'workflows'
      | 'modules'
      | 'resources',
    module: params.module,
    pattern: params.pattern,
  };

  // Validate params
  const validationError = validateListParams(listParams);
  if (validationError) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Validation Error: ${validationError}\n\nExamples:\n${getListExamples().join('\n')}`,
        },
      ],
    };
  }

  // Execute operation
  const result = await executeListOperation(engine, listParams);

  // Return result text, with fallback if data is undefined
  return {
    content: [
      {
        type: 'text',
        text: result.data ? JSON.stringify(result.data, null, 2) : result.text || '',
      },
    ],
  };
}

/**
 * Handles search operation
 */
async function handleSearch(
  params: BMADToolParams,
  engine: BMADEngine,
): Promise<{ content: TextContent[] }> {
  // Map BMADToolParams to SearchParams
  const searchParams: SearchParams = {
    query: params.searchQuery || '',
    type: params.searchType as 'agents' | 'workflows' | 'all',
    module: params.module,
  };

  // Validate params
  const validationError = validateSearchParams(searchParams);
  if (validationError) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Validation Error: ${validationError}\n\nExamples:\n${getSearchExamples().join('\n')}`,
        },
      ],
    };
  }

  // Execute operation
  const result = await executeSearchOperation(engine, searchParams);

  // Return result text, with fallback if data is undefined
  return {
    content: [
      {
        type: 'text',
        text: result.data ? JSON.stringify(result.data, null, 2) : result.text || '',
      },
    ],
  };
}

/**
 * Handles read operation
 */
async function handleRead(
  params: BMADToolParams,
  engine: BMADEngine,
): Promise<{ content: TextContent[] }> {
  // Map BMADToolParams to ReadParams
  const readParams: ReadParams = {
    type: params.type as 'agent' | 'workflow' | 'resource',
    agent: params.agent,
    workflow: params.workflow,
    uri: params.uri,
    module: params.module,
  };

  // Validate params
  const validationError = validateReadParams(readParams);
  if (validationError) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Validation Error: ${validationError}\n\nExamples:\n${getReadExamples().join('\n')}`,
        },
      ],
    };
  }

  // Execute operation
  const result = await executeReadOperation(engine, readParams);

  // Return result text, with fallback if data is undefined
  return {
    content: [
      {
        type: 'text',
        text: result.data ? JSON.stringify(result.data, null, 2) : result.text || '',
      },
    ],
  };
}

/**
 * Handles execute operation
 */
async function handleExecute(
  params: BMADToolParams,
  engine: BMADEngine,
): Promise<{ content: TextContent[] }> {
  // Infer type from parameters
  let type: 'agent' | 'workflow';
  if (params.agent) {
    type = 'agent';
  } else if (params.workflow) {
    type = 'workflow';
  } else {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Validation Error: Must specify either 'agent' or 'workflow' parameter\n\nExamples:\n${getExecuteExamples().join('\n')}`,
        },
      ],
    };
  }

  // Map BMADToolParams to ExecuteOperationParams
  const execParams: ExecuteOperationParams = {
    type,
    agent: params.agent,
    workflow: params.workflow,
    message: params.message || '',
    module: params.module,
  };

  // Validate params
  const validationError = validateExecuteParams(execParams);
  if (validationError) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Validation Error: ${validationError}\n\nExamples:\n${getExecuteExamples().join('\n')}`,
        },
      ],
    };
  }

  // Execute operation
  const result = await executeExecuteOperation(engine, execParams);

  return {
    content: [
      {
        type: 'text',
        text: result.text,
      },
    ],
  };
}

/**
 * Handles DB operation
 */
async function handleDB(
  params: BMADToolParams,
): Promise<{ content: TextContent[] }> {
  const db = params.db || {};
  const dbParams: DBParams = {
    action: db.action as DBParams['action'],
    projectName: db.projectName || params.module,
    path: db.path,
    content: db.content,
    contentType: db.contentType,
    workflow: params.workflow,
    agent: params.agent,
    query: db.query,
    language: db.language,
    limit: db.limit,
    offset: db.offset,
    status: db.status,
  };

  const validationError = validateDBParams(dbParams);
  if (validationError) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Validation Error: ${validationError}\n\nExamples:\n${getDBExamples().join('\n')}`,
        },
      ],
    };
  }

  const storage = getStorage();
  const result = await executeDBOperation(storage, dbParams);

  return {
    content: [
      {
        type: 'text',
        text: result.success
          ? result.text || JSON.stringify(result.data, null, 2)
          : `❌ ${result.error}\n\n${result.text || ''}`,
      },
    ],
  };
}

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';

interface MenuItem {
  code: string;
  description: string;
  skill: string;
  prompt: string;
}

interface CustomizeData {
  icon: string;
  role: string;
  identity: string;
  communication_style: string;
  persistent_facts: string[];
  principles: string[];
  activation_steps_prepend: string[];
  activation_steps_append: string[];
  menu: MenuItem[];
}

const props = defineProps<{
  agentName?: string;
  workflowName?: string;
  module?: string;
  type: 'agent' | 'workflow';
  layer: 'team' | 'user';
}>();

const emit = defineEmits<{
  saved: [];
  cancel: [];
}>();

const data = reactive<CustomizeData>({
  icon: '',
  role: '',
  identity: '',
  communication_style: '',
  persistent_facts: [],
  principles: [],
  activation_steps_prepend: [],
  activation_steps_append: [],
  menu: [],
});

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const success = ref('');
const tomlPreview = ref('');
const activeTab = ref('scalars');

const skillName = props.type === 'agent'
  ? `bmad-agent-${props.agentName}`
  : `bmad-${props.workflowName}`;

const sectionKey = props.type === 'agent' ? 'agent' : 'workflow';

function arrayToString(arr: string[]): string {
  return arr.join('\n');
}

function stringToArray(s: string): string[] {
  return s.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

watch(data, () => {
  tomlPreview.value = generateToml();
});

function generateToml(): string {
  const lines: string[] = [];
  const a = data;

  const hasScalars = a.icon || a.role || a.identity || a.communication_style;
  const hasArrays = a.persistent_facts.length > 0 || a.principles.length > 0 ||
    a.activation_steps_prepend.length > 0 || a.activation_steps_append.length > 0;

  if (hasScalars || hasArrays) {
    lines.push(`[${sectionKey}]`);
  }
  if (a.icon) lines.push(`icon = "${a.icon}"`);
  if (a.role) lines.push(`role = "${a.role}"`);
  if (a.identity) lines.push(`identity = "${a.identity}"`);
  if (a.communication_style) lines.push(`communication_style = "${a.communication_style}"`);

  if (a.persistent_facts.length > 0) {
    if (hasScalars) lines.push('');
    lines.push(`persistent_facts = [`);
    a.persistent_facts.forEach((f) => lines.push(`  "${f}",`));
    lines.push(']');
  }
  if (a.principles.length > 0) {
    lines.push('');
    lines.push(`principles = [`);
    a.principles.forEach((p) => lines.push(`  "${p}",`));
    lines.push(']');
  }
  if (a.activation_steps_prepend.length > 0) {
    lines.push('');
    lines.push(`activation_steps_prepend = [`);
    a.activation_steps_prepend.forEach((s) => lines.push(`  "${s}",`));
    lines.push(']');
  }
  if (a.activation_steps_append.length > 0) {
    lines.push('');
    lines.push(`activation_steps_append = [`);
    a.activation_steps_append.forEach((s) => lines.push(`  "${s}",`));
    lines.push(']');
  }

  if (a.menu.length > 0) {
    lines.push('');
    a.menu.forEach((m) => {
      lines.push(`[[${sectionKey}.menu]]`);
      lines.push(`code = "${m.code}"`);
      lines.push(`description = "${m.description}"`);
      if (m.skill) lines.push(`skill = "${m.skill}"`);
      if (m.prompt) lines.push(`prompt = """${m.prompt}"""`);
      lines.push('');
    });
  }

  return lines.join('\n').trimEnd() + '\n';
}

function parseIncomingToml(content: string) {
  const lines = content.split('\n');
  let inSection = false;
  let currentMenu: Partial<MenuItem> | null = null;
  const sectionHeader = `[${sectionKey}]`;
  const menuHeader = `[[${sectionKey}.menu]]`;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;

    if (line === sectionHeader) { inSection = true; continue; }
    if (line === menuHeader) {
      if (currentMenu && currentMenu.code) data.menu.push(currentMenu as MenuItem);
      currentMenu = { code: '', description: '', skill: '', prompt: '' };
      inSection = false;
      continue;
    }
    if (line.startsWith('[') && line !== sectionHeader) { inSection = false; continue; }

    const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1].trim();
    const rawValue = kvMatch[2].trim();

    if (inSection) {
      switch (key) {
        case 'icon': data.icon = unquote(rawValue); break;
        case 'role': data.role = unquote(rawValue); break;
        case 'identity': data.identity = unquote(rawValue); break;
        case 'communication_style': data.communication_style = unquote(rawValue); break;
        case 'persistent_facts': data.persistent_facts = parseMultiLineArray(lines, i); break;
        case 'principles': data.principles = parseMultiLineArray(lines, i); break;
        case 'activation_steps_prepend': data.activation_steps_prepend = parseMultiLineArray(lines, i); break;
        case 'activation_steps_append': data.activation_steps_append = parseMultiLineArray(lines, i); break;
      }
    } else if (currentMenu) {
      switch (key) {
        case 'code': currentMenu.code = unquote(rawValue); break;
        case 'description': currentMenu.description = unquote(rawValue); break;
        case 'skill': currentMenu.skill = unquote(rawValue); break;
        case 'prompt': currentMenu.prompt = unquote(rawValue); break;
      }
    }
  }
  if (currentMenu && currentMenu.code) data.menu.push(currentMenu as MenuItem);
}

function unquote(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function parseMultiLineArray(lines: string[], startIdx: number): string[] {
  const items: string[] = [];
  for (let j = startIdx + 1; j < lines.length; j++) {
    const l = lines[j].trim();
    if (l === ']') break;
    let item = l.replace(/^"|",?$|"$/g, '').trim();
    if (item.endsWith(',')) item = item.slice(0, -1);
    if (item.startsWith('"') && item.endsWith('"')) item = item.slice(1, -1);
    if (item) items.push(item);
  }
  return items;
}

async function loadCustomization() {
  loading.value = true;
  error.value = '';
  try {
    const apiPath = props.type === 'agent'
      ? `/api/agents/${skillName}/customize?layer=${props.layer}`
      : `/api/workflows/${skillName}/customize?layer=${props.layer}`;
    const resp = await fetch(apiPath);
    if (resp.status === 404) {
      loading.value = false;
      return;
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.content) {
      parseIncomingToml(json.content);
    }
  } catch (e: any) {
    error.value = e.message;
  }
  loading.value = false;
}

async function saveCustomization() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    const content = generateToml();
    const apiPath = props.type === 'agent'
      ? `/api/agents/${skillName}/customize?layer=${props.layer}`
      : `/api/workflows/${skillName}/customize?layer=${props.layer}`;
    const resp = await fetch(apiPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    success.value = props.layer === 'team' ? 'Team customization saved.' : 'Personal customization saved.';
    emit('saved');
  } catch (e: any) {
    error.value = e.message;
  }
  saving.value = false;
}

function addMenuItem() {
  data.menu.push({ code: '', description: '', skill: '', prompt: '' });
}

function removeMenuItem(idx: number) {
  data.menu.splice(idx, 1);
}

onMounted(() => {
  loadCustomization();
});
</script>

<template>
  <div>
    <div v-if="loading" style="text-align: center; padding: 2rem;">
      <p style="color: var(--text-color-secondary);">Loading customization...</p>
    </div>

    <div v-else>
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
        <button
          v-for="tab in ['scalars', 'arrays', 'menu', 'preview']"
          :key="tab"
          @click="activeTab = tab"
          :style="{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            textTransform: 'capitalize',
            background: activeTab === tab ? 'var(--primary-color)' : 'var(--surface-hover)',
            color: activeTab === tab ? 'var(--primary-color-text)' : 'var(--text-color)',
          }"
        >
          {{ tab }}
        </button>
      </div>

      <div v-if="error" style="background: #FEE2E2; color: #991B1B; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; font-size: 0.875rem;">
        {{ error }}
      </div>
      <div v-if="success" style="background: #DCFCE7; color: #166534; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; font-size: 0.875rem;">
        {{ success }}
      </div>

      <div v-if="activeTab === 'scalars'">
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem;">Icon (emoji or CSS class)</label>
          <input v-model="data.icon" type="text" style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; box-sizing: border-box;" placeholder="e.g. 🏥 or pi pi-cog" />
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem;">Role</label>
          <input v-model="data.role" type="text" style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; box-sizing: border-box;" placeholder="Drives product discovery for regulated healthcare" />
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem;">Identity / Persona</label>
          <textarea v-model="data.identity" rows="3" style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; box-sizing: border-box; resize: vertical;" placeholder="Agent's personality, background, and behavioral traits"></textarea>
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem;">Communication Style</label>
          <textarea v-model="data.communication_style" rows="3" style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; box-sizing: border-box; resize: vertical;" placeholder="Precise, regulatory-aware, asks compliance-shaped questions early."></textarea>
        </div>
      </div>

      <div v-if="activeTab === 'arrays'">
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem;">Persistent Facts</h3>
          <p style="font-size: 0.75rem; color: var(--text-color-secondary); margin: 0 0 0.5rem;">
            Static facts the agent keeps in mind. Use <code>file:{'{project-root}/path'}</code> for file references. One per line.
          </p>
          <textarea
            :value="arrayToString(data.persistent_facts)"
            @input="(e) => data.persistent_facts = stringToArray((e.target as HTMLTextAreaElement).value)"
            rows="5"
            style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; box-sizing: border-box; resize: vertical; font-family: monospace; font-size: 0.8rem;"
            placeholder="Our org is AWS-only&#10;file:{project-root}/docs/compliance/hipaa-overview.md"
          ></textarea>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem;">Principles</h3>
          <textarea
            :value="arrayToString(data.principles)"
            @input="(e) => data.principles = stringToArray((e.target as HTMLTextAreaElement).value)"
            rows="4"
            style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; box-sizing: border-box; resize: vertical; font-family: monospace; font-size: 0.8rem;"
            placeholder="Ship nothing that can't pass an FDA audit.&#10;User value first, compliance always."
          ></textarea>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem;">Activation Steps (Prepend)</h3>
          <p style="font-size: 0.75rem; color: var(--text-color-secondary); margin: 0 0 0.5rem;">Runs BEFORE greeting. Use for pre-flight loads.</p>
          <textarea
            :value="arrayToString(data.activation_steps_prepend)"
            @input="(e) => data.activation_steps_prepend = stringToArray((e.target as HTMLTextAreaElement).value)"
            rows="3"
            style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; box-sizing: border-box; resize: vertical; font-family: monospace; font-size: 0.8rem;"
          ></textarea>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem;">Activation Steps (Append)</h3>
          <p style="font-size: 0.75rem; color: var(--text-color-secondary); margin: 0 0 0.5rem;">Runs AFTER greeting, BEFORE menu. Use for heavy setup.</p>
          <textarea
            :value="arrayToString(data.activation_steps_append)"
            @input="(e) => data.activation_steps_append = stringToArray((e.target as HTMLTextAreaElement).value)"
            rows="3"
            style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; box-sizing: border-box; resize: vertical; font-family: monospace; font-size: 0.8rem;"
          ></textarea>
        </div>
      </div>

      <div v-if="activeTab === 'menu'">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 0.875rem; font-weight: 600; margin: 0;">Menu Items</h3>
          <button @click="addMenuItem"
            style="background: var(--primary-color); color: var(--primary-color-text); border: none; border-radius: 0.375rem; padding: 0.375rem 0.75rem; cursor: pointer; font-size: 0.8rem;">
            + Add Item
          </button>
        </div>
        <p style="font-size: 0.75rem; color: var(--text-color-secondary); margin: 0 0 1rem;">
          Each item has a <code>code</code> (merge key), <code>description</code>, and either <code>skill</code> or <code>prompt</code>.
        </p>

        <div v-for="(item, idx) in data.menu" :key="idx" style="border: 1px solid var(--surface-border); border-radius: 0.375rem; padding: 1rem; margin-bottom: 0.75rem; background: var(--surface-ground);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.8rem; font-weight: 600;">Item #{{ idx + 1 }}</span>
            <button @click="removeMenuItem(idx)"
              style="background: #FEE2E2; color: #991B1B; border: none; border-radius: 0.25rem; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.75rem;">
              Remove
            </button>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 0.5rem;">
            <div>
              <label style="font-size: 0.75rem; display: block; margin-bottom: 0.125rem;">Code</label>
              <input v-model="item.code" type="text" style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.25rem; padding: 0.3rem 0.5rem; box-sizing: border-box; font-size: 0.8rem;" placeholder="CE" />
            </div>
            <div>
              <label style="font-size: 0.75rem; display: block; margin-bottom: 0.125rem;">Description</label>
              <input v-model="item.description" type="text" style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.25rem; padding: 0.3rem 0.5rem; box-sizing: border-box; font-size: 0.8rem;" placeholder="Create Epics using our framework" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
            <div>
              <label style="font-size: 0.75rem; display: block; margin-bottom: 0.125rem;">Skill (or leave empty)</label>
              <input v-model="item.skill" type="text" style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.25rem; padding: 0.3rem 0.5rem; box-sizing: border-box; font-size: 0.8rem;" placeholder="custom-create-epics" />
            </div>
            <div>
              <label style="font-size: 0.75rem; display: block; margin-bottom: 0.125rem;">Prompt (or leave empty)</label>
              <input v-model="item.prompt" type="text" style="width: 100%; border: 1px solid var(--surface-border); border-radius: 0.25rem; padding: 0.3rem 0.5rem; box-sizing: border-box; font-size: 0.8rem;" placeholder="Read {project-root}/..." />
            </div>
          </div>
        </div>
        <p v-if="data.menu.length === 0" style="color: var(--text-color-secondary); font-size: 0.8rem;">
          No menu items. Click "Add Item" to customize the menu.
        </p>
      </div>

      <div v-if="activeTab === 'preview'">
        <h3 style="font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem;">Generated TOML</h3>
        <pre style="background: var(--surface-ground); padding: 1rem; border-radius: 0.375rem; font-size: 0.8rem; line-height: 1.5; white-space: pre-wrap; overflow: auto; max-height: 400px;">{{ tomlPreview }}</pre>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--surface-border);">
        <button @click="saveCustomization" :disabled="saving"
          style="background: var(--primary-color); color: var(--primary-color-text); border: none; border-radius: 0.375rem; padding: 0.5rem 1rem; cursor: pointer; font-weight: 500; font-size: 0.875rem;">
          {{ saving ? 'Saving...' : `Save ${props.layer === 'team' ? 'Team' : 'Personal'} Override` }}
        </button>
        <button @click="emit('cancel')"
          style="background: var(--surface-hover); color: var(--text-color); border: none; border-radius: 0.375rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem;">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

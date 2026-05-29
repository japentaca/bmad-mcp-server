<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Paginator from 'primevue/paginator';
import Tag from 'primevue/tag';

interface LogRow {
  id: number;
  timestamp: string;
  level: string;
  category: string;
  action: string;
  entity_type: string | null;
  entity_name: string | null;
  project: string | null;
  module: string | null;
  user_message: string | null;
  request_body: string | null;
  response_summary: string | null;
  response_size: number | null;
  duration_ms: number | null;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
}

interface PageResult {
  rows: LogRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const rows = ref<LogRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(25);
const totalPages = ref(0);
const loading = ref(false);

const search = ref('');
const selectedLevels = ref<string[]>([]);
const selectedCategories = ref<string[]>([]);
const selectedSuccess = ref<string | null>(null);
const sortField = ref('timestamp');
const sortOrder = ref<'asc' | 'desc'>('desc');

const levelOptions = [
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
];

const categoryOptions = [
  { label: 'Tool Call', value: 'tool_call' },
  { label: 'Agent Execution', value: 'agent_execution' },
  { label: 'Workflow Execution', value: 'workflow_execution' },
  { label: 'DB Operation', value: 'db_operation' },
  { label: 'Resource Read', value: 'resource_read' },
  { label: 'Validación', value: 'validation_error' },
  { label: 'Sistema', value: 'system' },
  { label: 'MCP Request', value: 'mcp_request' },
];

const successOptions = [
  { label: 'Todos', value: '' },
  { label: 'Éxito', value: 'true' },
  { label: 'Error', value: 'false' },
];

function levelSeverity(level: string): string {
  switch (level) {
    case 'error': return 'danger';
    case 'warn': return 'warn';
    case 'info': return 'info';
    case 'debug': return 'secondary';
    default: return 'info';
  }
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    tool_call: 'Tool Call',
    agent_execution: 'Agent',
    workflow_execution: 'Workflow',
    db_operation: 'DB Op',
    resource_read: 'Recurso',
    validation_error: 'Validación',
    system: 'Sistema',
    mcp_request: 'MCP Req',
  };
  return map[cat] || cat;
}

function categorySeverity(cat: string): string {
  const map: Record<string, string> = {
    tool_call: 'primary',
    agent_execution: 'success',
    workflow_execution: 'warn',
    db_operation: 'contrast',
    resource_read: 'info',
    validation_error: 'danger',
    system: 'secondary',
  };
  return map[cat] || 'info';
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatTime(ts: string): string {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString('es-ES', { hour12: false });
  } catch {
    return ts;
  }
}

async function fetchLogs() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('page', String(page.value));
    params.set('page_size', String(pageSize.value));
    params.set('sort_field', sortField.value);
    params.set('sort_order', sortOrder.value);
    if (search.value) params.set('search', search.value);
    if (selectedLevels.value.length > 0) params.set('level', selectedLevels.value.join(','));
    if (selectedCategories.value.length > 0) params.set('category', selectedCategories.value.join(','));
    if (selectedSuccess.value) params.set('success', selectedSuccess.value);

    const res = await fetch(`/api/logs?${params.toString()}`);
    const data: PageResult = await res.json();
    rows.value = data.rows;
    total.value = data.total;
    totalPages.value = data.total_pages;
  } catch (err) {
    console.error('Failed to fetch logs:', err);
  } finally {
    loading.value = false;
  }
}

function onPageChange(event: { page: number; rows: number }) {
  page.value = event.page + 1;
  pageSize.value = event.rows;
  fetchLogs();
}

function onSort(event: { sortField: string; sortOrder: number }) {
  sortField.value = event.sortField;
  sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  fetchLogs();
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function onFilterChange() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page.value = 1;
    fetchLogs();
  }, 400);
}

watch([search, selectedLevels, selectedCategories, selectedSuccess], () => {
  onFilterChange();
});

function exportCSV() {
  const headers = ['timestamp', 'level', 'category', 'action', 'entity_type', 'entity_name', 'project', 'duration_ms', 'success', 'error_message'];
  const csvRows = [headers.join(',')];
  for (const r of rows.value) {
    csvRows.push([
      r.timestamp || '',
      r.level, r.category, r.action,
      r.entity_type || '', r.entity_name || '',
      r.project || '', r.duration_ms || '',
      r.success ? 'true' : 'false',
      (r.error_message || '').replace(/"/g, '""'),
    ].map(v => `"${v}"`).join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bmad-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  fetchLogs();
});
</script>

<template>
  <div>
    <!-- Filters -->
    <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center;">
      <InputText
        v-model="search"
        placeholder="Buscar en logs..."
        style="min-width: 220px;"
      />
      <MultiSelect
        v-model="selectedLevels"
        :options="levelOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Nivel"
        style="min-width: 140px;"
        :maxSelectedLabels="2"
      />
      <MultiSelect
        v-model="selectedCategories"
        :options="categoryOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Categoría"
        style="min-width: 160px;"
        :maxSelectedLabels="2"
      />
      <Select
        v-model="selectedSuccess"
        :options="successOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Estado"
        style="min-width: 120px;"
      />
      <Button
        label="Exportar CSV"
        icon="pi pi-download"
        severity="secondary"
        size="small"
        @click="exportCSV"
      />
      <span style="margin-left: auto; font-size: 0.875rem; color: var(--text-color-secondary);">
        {{ total.toLocaleString() }} registros
      </span>
    </div>

    <!-- Table -->
    <div style="background: var(--surface-card); border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <DataTable
        :value="rows"
        :loading="loading"
        :sortField="sortField"
        :sortOrder="sortOrder === 'asc' ? 1 : -1"
        @sort="onSort"
        dataKey="id"
        stripedRows
        size="small"
        scrollable
        paginator
        :rows="pageSize"
        :totalRecords="total"
        :lazy="true"
        @page="onPageChange"
        :rowsPerPageOptions="[10, 25, 50, 100]"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        currentPageReportTemplate="{first} a {last} de {totalRecords}"
      >
        <Column field="timestamp" header="Fecha/Hora" sortable style="min-width: 140px;">
          <template #body="{ data }">
            <span style="font-size: 0.8rem;">{{ formatTime(data.timestamp) }}</span>
          </template>
        </Column>
        <Column field="level" header="Nivel" sortable style="min-width: 80px;">
          <template #body="{ data }">
            <Tag :value="data.level" :severity="levelSeverity(data.level)" />
          </template>
        </Column>
        <Column field="category" header="Categoría" sortable style="min-width: 100px;">
          <template #body="{ data }">
            <Tag :value="categoryLabel(data.category)" :severity="categorySeverity(data.category)" />
          </template>
        </Column>
        <Column field="action" header="Acción" sortable style="min-width: 110px;">
          <template #body="{ data }">
            <span style="font-weight: 500;">{{ data.action }}</span>
          </template>
        </Column>
        <Column field="entity_name" header="Entidad" sortable style="min-width: 130px;">
          <template #body="{ data }">
            <span v-if="data.entity_name">
              <span style="font-size: 0.75rem; color: var(--text-color-secondary);">{{ data.entity_type }}:</span>
              {{ data.entity_name }}
            </span>
            <span v-else style="color: var(--text-color-secondary);">-</span>
          </template>
        </Column>
        <Column field="project" header="Proyecto" sortable style="min-width: 100px;">
          <template #body="{ data }">
            <span v-if="data.project" style="font-size: 0.8rem;">{{ data.project }}</span>
            <span v-else style="color: var(--text-color-secondary);">-</span>
          </template>
        </Column>
        <Column field="duration_ms" header="Duración" sortable style="min-width: 90px;">
          <template #body="{ data }">
            {{ formatDuration(data.duration_ms) }}
          </template>
        </Column>
        <Column field="success" header="Éxito" sortable style="min-width: 70px;">
          <template #body="{ data }">
            <i :class="data.success ? 'pi pi-check-circle' : 'pi pi-times-circle'"
              :style="{ color: data.success ? 'var(--green-500)' : 'var(--red-500)', fontSize: '1.1rem' }" />
          </template>
        </Column>
        <Column header="Detalle" style="min-width: 60px;">
          <template #body="{ data }">
            <Button
              v-if="data.error_message || data.response_summary"
              icon="pi pi-info-circle"
              severity="secondary"
              text
              size="small"
              :title="data.error_message || data.response_summary || ''"
            />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

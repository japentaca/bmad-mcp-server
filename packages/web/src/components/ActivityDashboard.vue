<script setup lang="ts">
import { ref, onMounted } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart, PieChart, HeatmapChart } from 'echarts/charts';
import {
  TitleComponent, TooltipComponent, LegendComponent, GridComponent, ToolboxComponent, VisualMapComponent,
} from 'echarts/components';

use([CanvasRenderer, LineChart, BarChart, PieChart, HeatmapChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, ToolboxComponent, VisualMapComponent]);

interface EntityError {
  entity_name: string;
  entity_type: string;
  error_count: number;
  total_count: number;
  error_rate: number;
}

interface DurationBucket {
  bucket: string;
  min_ms: number;
  max_ms: number | null;
  count: number;
}

interface HourlyCell {
  day: number;
  hour: number;
  count: number;
}

interface ErrorTimelineRow {
  date: string;
  error_count: number;
}

interface ProjectRow {
  project: string;
  count: number;
  error_count: number;
}

interface TopError {
  error_message: string;
  error_code: string | null;
  count: number;
}

interface Stats {
  total_activities: number;
  by_category: Record<string, number>;
  by_level: Record<string, number>;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  daily_timeline: Array<{ date: string; count: number }>;
  top_entities: Array<{ entity_name: string; entity_type: string; count: number }>;
  error_by_entity: EntityError[];
  duration_histogram: DurationBucket[];
  hourly_heatmap: HourlyCell[];
  error_timeline: ErrorTimelineRow[];
  by_project: ProjectRow[];
  top_errors: TopError[];
}

const stats = ref<Stats | null>(null);
const loading = ref(true);

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    tool_call: 'Tool Calls',
    agent_execution: 'Agentes',
    workflow_execution: 'Workflows',
    db_operation: 'DB Ops',
    resource_read: 'Recursos',
    validation_error: 'Validación',
    system: 'Sistema',
    mcp_request: 'MCP Req',
  };
  return map[cat] || cat;
}

const timelineOption = ref({});
const categoryPieOption = ref({});
const successBarOption = ref({});
const topEntitiesOption = ref({});
const levelPieOption = ref({});
const errorByEntityOption = ref({});
const histogramOption = ref({});
const heatmapOption = ref({});
const errorTimelineOption = ref({});
const projectBarOption = ref({});
const topErrorsOption = ref({});

async function fetchStats() {
  loading.value = true;
  try {
    const res = await fetch('/api/logs/stats');
    const data: Stats = await res.json();
    stats.value = data;
    buildCharts(data);
  } catch (err) {
    console.error('Failed to fetch stats:', err);
  } finally {
    loading.value = false;
  }
}

function buildCharts(data: Stats) {
  if (!data) return;

  // 1. Daily activity timeline
  timelineOption.value = {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.daily_timeline.map(d => d.date.slice(5)),
      axisLabel: { fontSize: 10, rotate: 45 },
    },
    yAxis: { type: 'value', name: 'Actividades', minInterval: 1 },
    series: [{
      type: 'line',
      data: data.daily_timeline.map(d => d.count),
      smooth: true,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: '#3B82F6' },
    }],
  };

  // 2. Category donut
  const catEntries = Object.entries(data.by_category).filter(([, c]) => c > 0);
  const catColors: Record<string, string> = {
    tool_call: '#3B82F6', agent_execution: '#22C55E', workflow_execution: '#F59E0B',
    db_operation: '#8B5CF6', resource_read: '#06B6D4', validation_error: '#EF4444',
    system: '#6B7280', mcp_request: '#EC4899',
  };

  categoryPieOption.value = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], label: { show: false },
      data: catEntries.map(([name, value]) => ({
        name: categoryLabel(name), value,
        itemStyle: { color: catColors[name] || '#9CA3AF' },
      })),
    }],
  };

  // 3. Level pie
  const levelColors: Record<string, string> = { error: '#EF4444', warn: '#F59E0B', info: '#3B82F6', debug: '#9CA3AF' };
  levelPieOption.value = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], label: { show: false },
      data: Object.entries(data.by_level).map(([name, value]) => ({
        name: name.toUpperCase(), value,
        itemStyle: { color: levelColors[name] || '#9CA3AF' },
      })),
    }],
  };

  // 4. Success vs Error stacked bar
  const successRate = data.total_activities > 0 ? ((data.success_count / data.total_activities) * 100).toFixed(1) : '0';
  successBarOption.value = {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: ['Resultados'] },
    yAxis: { type: 'value', name: 'Cantidad' },
    series: [
      { name: 'Éxito', type: 'bar', stack: 'total', data: [data.success_count], itemStyle: { color: '#22C55E' } },
      { name: 'Error', type: 'bar', stack: 'total', data: [data.error_count], itemStyle: { color: '#EF4444' } },
    ],
    legend: { bottom: 0 },
    title: {
      text: `${successRate}%`, left: 'center', top: '35%',
      textStyle: { fontSize: 28, fontWeight: 'bold', color: data.error_count === 0 ? '#22C55E' : '#F59E0B' },
    },
  };

  // 5. Top entities
  topEntitiesOption.value = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'value', name: 'Usos' },
    yAxis: {
      type: 'category', inverse: true,
      data: data.top_entities.map(e => `${e.entity_name}`).reverse(),
      axisLabel: { fontSize: 10 },
    },
    series: [{
      type: 'bar',
      data: data.top_entities.map(e => e.count).reverse(),
      itemStyle: { color: '#3B82F6', borderRadius: [0, 4, 4, 0] },
    }],
  };

  // 6. Error rate by entity
  errorByEntityOption.value = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name: string; value: number; seriesName: string; marker: string }>) => {
        if (!params || params.length === 0) return '';
        const p = params[0];
        const entity = data.error_by_entity.find(e => `${e.entity_name}` === p.name);
        if (!entity) return '';
        return `${p.marker} ${p.name}<br/>
          Tasa de error: ${entity.error_rate}%<br/>
          Errores: ${entity.error_count} / ${entity.total_count} total`;
      },
    },
    grid: { left: 120, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'value', name: '% Error', max: 100 },
    yAxis: {
      type: 'category', inverse: true,
      data: data.error_by_entity.slice(0, 10).map(e => `${e.entity_name}`).reverse(),
      axisLabel: { fontSize: 10 },
    },
    series: [{
      type: 'bar',
      data: data.error_by_entity.slice(0, 10).map(e => e.error_rate).reverse(),
      itemStyle: { color: '#F59E0B', borderRadius: [0, 4, 4, 0] },
      markLine: {
        data: [{ type: 'average', name: 'Promedio' }],
        label: { fontSize: 10 },
      },
    }],
  };

  // 7. Duration histogram
  histogramOption.value = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 70, right: 20, top: 10, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.duration_histogram.map(d => d.bucket),
      axisLabel: { fontSize: 9, rotate: 45 },
    },
    yAxis: { type: 'value', name: 'Ops' },
    series: [{
      type: 'bar',
      data: data.duration_histogram.map(d => ({
        value: d.count,
        itemStyle: {
          color: d.max_ms === null ? '#EF4444' :
            d.max_ms > 10000 ? '#F59E0B' :
            d.max_ms > 2000 ? '#FBBF24' :
            d.max_ms > 500 ? '#34D399' : '#22C55E',
        },
      })),
      barWidth: '85%',
    }],
  };

  // 8. Hourly heatmap
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const heatData = data.hourly_heatmap.map(cell => [cell.hour, cell.day, cell.count]);
  const maxCount = heatData.length > 0 ? Math.max(...heatData.map(d => d[2] as number)) : 1;

  heatmapOption.value = {
    tooltip: {
      position: 'top',
      formatter: (params: { value: [number, number, number] }) => {
        const [h, d, c] = params.value;
        return `${days[d]} ${h}:00 — ${c} ops`;
      },
    },
    grid: { left: 50, right: 30, top: 10, bottom: 40 },
    xAxis: {
      type: 'category', data: hours, splitArea: { show: true },
      axisLabel: { fontSize: 9, interval: 2 },
    },
    yAxis: {
      type: 'category', data: days, splitArea: { show: true },
      axisLabel: { fontSize: 10 },
    },
    visualMap: {
      min: 0, max: maxCount,
      calculable: true, orient: 'horizontal',
      left: 'center', bottom: 0,
      inRange: { color: ['#E0E7FF', '#3B82F6', '#1E40AF'] },
      textStyle: { fontSize: 10 },
    },
    series: [{
      type: 'heatmap', data: heatData,
      label: { show: maxCount < 100, fontSize: 9 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
    }],
  };

  // 9. Error timeline
  if (data.error_timeline && data.error_timeline.length > 0) {
    errorTimelineOption.value = {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.error_timeline.map(d => d.date.slice(5)),
        axisLabel: { fontSize: 10, rotate: 45 },
      },
      yAxis: { type: 'value', name: 'Errores', minInterval: 1 },
      series: [{
        type: 'line',
        data: data.error_timeline.map(d => d.error_count),
        smooth: true,
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: '#EF4444' },
        lineStyle: { color: '#EF4444' },
      }],
    };
  } else {
    errorTimelineOption.value = {};
  }

  // 10. Projects bar
  projectBarOption.value = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    grid: { left: 100, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'value', name: 'Actividades' },
    yAxis: {
      type: 'category', inverse: true,
      data: data.by_project.slice(0, 10).map(p => p.project).reverse(),
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: 'Éxito', type: 'bar', stack: 'total',
        data: data.by_project.slice(0, 10).map(p => p.count - p.error_count).reverse(),
        itemStyle: { color: '#22C55E', borderRadius: [0, 0, 0, 0] },
      },
      {
        name: 'Error', type: 'bar', stack: 'total',
        data: data.by_project.slice(0, 10).map(p => p.error_count).reverse(),
        itemStyle: { color: '#EF4444', borderRadius: [0, 4, 4, 0] },
      },
    ],
  };

  // 11. Top errors table
  topErrorsOption.value = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 10, right: 20, top: 10, bottom: 20 },
    xAxis: {
      type: 'category',
      data: data.top_errors.slice(0, 10).map((_, i) => `#${i + 1}`),
      axisLabel: { fontSize: 10 },
    },
    yAxis: { type: 'value', name: 'Ocurrencias' },
    series: [{
      type: 'bar',
      data: data.top_errors.slice(0, 10).map(e => e.count),
      itemStyle: { color: '#EF4444', borderRadius: [4, 4, 0, 0] },
      barWidth: '60%',
    }],
  };
}

onMounted(() => {
  fetchStats();
});
</script>

<template>
  <div v-if="loading" style="text-align: center; padding: 3rem; color: var(--text-color-secondary);">
    <i class="pi pi-spin pi-spinner" style="font-size: 2rem;" />
    <p>Cargando analíticas...</p>
  </div>

  <div v-else-if="stats">
    <!-- Summary Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 0.75rem; color: var(--text-color-secondary); text-transform: uppercase;">Total Actividades</div>
        <div style="font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem;">{{ stats.total_activities.toLocaleString() }}</div>
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 0.75rem; color: var(--text-color-secondary); text-transform: uppercase;">Tasa de Éxito</div>
        <div style="font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; color: var(--green-500);">
          {{ stats.total_activities > 0 ? ((stats.success_count / stats.total_activities) * 100).toFixed(1) : '0' }}%
        </div>
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 0.75rem; color: var(--text-color-secondary); text-transform: uppercase;">Duración Promedio</div>
        <div style="font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem;">{{ stats.avg_duration_ms }} ms</div>
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 0.75rem; color: var(--text-color-secondary); text-transform: uppercase;">Errores</div>
        <div style="font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; color: var(--red-500);">{{ stats.error_count.toLocaleString() }}</div>
      </div>
    </div>

    <!-- Row 1: Timeline + Category donut -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Actividad Diaria</h3>
        <VChart :option="timelineOption" style="height: 280px;" autoresize />
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Distribución por Categoría</h3>
        <VChart :option="categoryPieOption" style="height: 280px;" autoresize />
      </div>
    </div>

    <!-- Row 2: Error timeline + Level pie -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Tendencia de Errores Diarios</h3>
        <VChart :option="errorTimelineOption" style="height: 280px;" autoresize />
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Niveles de Log</h3>
        <VChart :option="levelPieOption" style="height: 280px;" autoresize />
      </div>
    </div>

    <!-- Row 3: Heatmap + Success pie -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Mapa de Calor Horario</h3>
        <VChart :option="heatmapOption" style="height: 320px;" autoresize />
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Éxito vs Error</h3>
        <VChart :option="successBarOption" style="height: 320px;" autoresize />
      </div>
    </div>

    <!-- Row 4: Error rate by entity + Duration histogram -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Tasa de Error por Entidad</h3>
        <VChart :option="errorByEntityOption" style="height: 280px;" autoresize />
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Distribución de Duraciones</h3>
        <VChart :option="histogramOption" style="height: 280px;" autoresize />
      </div>
    </div>

    <!-- Row 5: Top entities + Projects comparison -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Top Entidades Más Usadas</h3>
        <VChart :option="topEntitiesOption" style="height: 280px;" autoresize />
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Actividad por Proyecto</h3>
        <VChart :option="projectBarOption" style="height: 280px;" autoresize />
      </div>
    </div>

    <!-- Row 6: Top errors bar -->
    <div style="background: var(--surface-card); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem;">
      <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 0.5rem;">Errores Más Frecuentes</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <VChart :option="topErrorsOption" style="height: 250px;" autoresize />
        <div style="max-height: 250px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--surface-border); text-align: left; color: var(--text-color-secondary);">
                <th style="padding: 0.4rem;">#</th>
                <th style="padding: 0.4rem;">Mensaje</th>
                <th style="padding: 0.4rem; text-align: right;">Count</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(err, idx) in (stats.top_errors || []).slice(0, 10)" :key="idx" style="border-bottom: 1px solid var(--surface-border);">
                <td style="padding: 0.4rem; color: var(--text-color-secondary);">{{ idx + 1 }}</td>
                <td style="padding: 0.4rem; max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="err.error_message">
                  {{ err.error_message }}
                </td>
                <td style="padding: 0.4rem; text-align: right; font-weight: 600;">{{ err.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

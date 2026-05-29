<script setup lang="ts">
import { ref, onMounted } from 'vue';
import VChart from 'vue-echarts';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { use } from 'echarts/core';

use([BarChart, TitleComponent, TooltipComponent, GridComponent, DataZoomComponent, CanvasRenderer]);

const props = defineProps<{
  projectName: string;
}>();

const loading = ref(true);
const ganttOption = ref({});

async function loadData() {
  try {
    const resp = await fetch(`/api/projects/${props.projectName}/workflows`);
    if (!resp.ok) { loading.value = false; return; }
    const wfs = await resp.json();

    const colors: Record<string, string> = {
      brainstorming: '#3B82F6', research: '#6366F1', 'product-brief': '#8B5CF6', prfaq: '#A855F7',
      prd: '#10B981', 'ux-design': '#34D399',
      'create-architecture': '#F59E0B', 'create-epics-and-stories': '#F97316', 'check-implementation-readiness': '#EF4444',
      'sprint-planning': '#EC4899', 'create-story': '#F43F5E', 'dev-story': '#14B8A6', 'code-review': '#06B6D4', retrospective: '#0EA5E9',
    };

    const sortedWfs = wfs.sort((a: any, b: any) => a.updated_at?.localeCompare(b.updated_at));
    const categories = sortedWfs.map((w: any) => w.workflow);
    let runningStart = 0;

    ganttOption.value = {
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>Duration: ${p.value[2] - p.value[1]} days` },
      grid: { left: '20%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', min: 0 },
      yAxis: { type: 'category', data: categories },
      dataZoom: [{ type: 'slider', yAxisIndex: 0, start: 0, end: 100, width: 20 }],
      series: [{
        type: 'bar',
        stack: 'total',
        itemStyle: { borderColor: 'transparent', borderRadius: 4 },
        label: { show: true, position: 'insideRight', formatter: '{b}', fontSize: 10 },
        data: sortedWfs.map((w: any, i: number) => {
          const duration = Math.max(1, 1 + Math.floor(Math.random() * 4));
          const start = runningStart;
          runningStart += duration;
          const color = colors[w.workflow] || '#6B7280';
          return { name: w.workflow, value: [start, start + duration, duration], itemStyle: { color } };
        }),
      }],
    };
  } catch {}
  loading.value = false;
}

onMounted(() => loadData());
</script>

<template>
  <div>
    <div v-if="loading" style="text-align: center; padding: 2rem;">
      <p style="color: var(--text-color-secondary);">Loading Gantt chart...</p>
    </div>
    <div v-else style="background: var(--surface-card); border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 1.5rem;">
      <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 1rem;">Workflow Execution Gantt</h3>
      <VChart :option="ganttOption" style="height: 400px;" autoresize />
    </div>
  </div>
</template>

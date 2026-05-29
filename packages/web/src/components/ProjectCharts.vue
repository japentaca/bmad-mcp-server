<script setup lang="ts">
import { ref, onMounted } from 'vue';
import VChart from 'vue-echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { use } from 'echarts/core';

use([BarChart, LineChart, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const props = defineProps<{
  projectName: string;
}>();

const loading = ref(true);
const progressOption = ref({});
const docTypeOption = ref({});
const burndownOption = ref({});

async function loadData() {
  const docsResp = await fetch(`/api/projects/${props.projectName}/documents?limit=200`);
  const wfResp = await fetch(`/api/projects/${props.projectName}/workflows`);
  const docs = docsResp.ok ? await docsResp.json() : [];
  const wfs = wfResp.ok ? await wfResp.json() : [];

  const phaseCounts: Record<string, number> = { Analysis: 0, Planning: 0, Solutioning: 0, Implementation: 0 };
  const docTypes: Record<string, number> = {};

  for (const doc of docs) {
    docTypes[doc.content_type] = (docTypes[doc.content_type] || 0) + 1;
    if (doc.workflow) {
      if (['brainstorming', 'research', 'product-brief', 'prfaq'].includes(doc.workflow)) phaseCounts.Analysis++;
      else if (['prd', 'ux-design'].includes(doc.workflow)) phaseCounts.Planning++;
      else if (['create-architecture', 'create-epics-and-stories', 'check-implementation-readiness'].includes(doc.workflow)) phaseCounts.Solutioning++;
      else phaseCounts.Implementation++;
    }
  }

  progressOption.value = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', max: Math.max(...Object.values(phaseCounts), 1) },
    yAxis: { type: 'category', data: Object.keys(phaseCounts) },
    series: [{
      type: 'bar',
      data: Object.values(phaseCounts),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#3B82F6' },
          { offset: 1, color: '#10B981' },
        ]),
        borderRadius: [0, 6, 6, 0],
      },
      label: { show: true, position: 'right' },
    }],
  };

  docTypeOption.value = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      padAngle: 2,
      itemStyle: { borderRadius: 6 },
      label: { show: true, formatter: '{b}: {c}' },
      data: Object.entries(docTypes).map(([k, v]) => ({ name: k, value: v })),
    }],
  };

  const wfDates = wfs.map((w: any) => w.updated_at?.slice(0, 10)).sort();
  const uniqueDates = [...new Set(wfDates)];
  const cumulative = uniqueDates.reduce((acc: number[], date: string, i: number) => {
    acc.push(i + 1);
    return acc;
  }, []);

  burndownOption.value = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Completed Workflows', 'Trend'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: uniqueDates, axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'Completed Workflows', type: 'line', data: cumulative, smooth: true, itemStyle: { color: '#10B981' }, areaStyle: { opacity: 0.15, color: '#10B981' } },
    ],
  };

  loading.value = false;
}

onMounted(() => loadData());
</script>

<template>
  <div>
    <div v-if="loading" style="text-align: center; padding: 2rem;">
      <p style="color: var(--text-color-secondary);">Loading charts...</p>
    </div>
    <div v-else style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
      <div style="background: var(--surface-card); border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 1.5rem;">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 1rem;">Progress by Phase</h3>
        <VChart :option="progressOption" style="height: 250px;" autoresize />
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 1.5rem;">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 1rem;">Documents by Type</h3>
        <VChart :option="docTypeOption" style="height: 250px;" autoresize />
      </div>
      <div style="background: var(--surface-card); border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 1.5rem; grid-column: span 2;">
        <h3 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 1rem;">Workflow Activity Timeline</h3>
        <VChart :option="burndownOption" style="height: 250px;" autoresize />
      </div>
    </div>
  </div>
</template>

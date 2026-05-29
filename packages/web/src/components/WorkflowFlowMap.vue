<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

interface PhaseNode {
  id: string;
  label: string;
  workflows: { id: string; name: string; standalone: boolean }[];
}

const phases: PhaseNode[] = [
  {
    id: 'analysis',
    label: 'Phase 1: Analysis',
    workflows: [
      { id: 'brainstorming', name: 'Brainstorming', standalone: true },
      { id: 'research', name: 'Research', standalone: true },
      { id: 'product-brief', name: 'Product Brief', standalone: true },
      { id: 'prfaq', name: 'PR/FAQ', standalone: true },
    ],
  },
  {
    id: 'planning',
    label: 'Phase 2: Planning',
    workflows: [
      { id: 'prd', name: 'PRD', standalone: true },
      { id: 'ux-design', name: 'UX Design', standalone: true },
    ],
  },
  {
    id: 'solutioning',
    label: 'Phase 3: Solutioning',
    workflows: [
      { id: 'create-architecture', name: 'Architecture', standalone: true },
      { id: 'create-epics-and-stories', name: 'Epics & Stories', standalone: true },
      { id: 'check-implementation-readiness', name: 'Readiness Check', standalone: true },
    ],
  },
  {
    id: 'implementation',
    label: 'Phase 4: Implementation',
    workflows: [
      { id: 'sprint-planning', name: 'Sprint Planning', standalone: true },
      { id: 'create-story', name: 'Create Story', standalone: false },
      { id: 'dev-story', name: 'Dev Story', standalone: false },
      { id: 'code-review', name: 'Code Review', standalone: true },
      { id: 'retrospective', name: 'Retrospective', standalone: true },
    ],
  },
];

const crossCutting = [
  { id: 'quick-dev', name: 'Quick Dev', standalone: true },
  { id: 'correct-course', name: 'Correct Course', standalone: true },
  { id: 'party-mode', name: 'Party Mode', standalone: true },
];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
const PHASE_WIDTH = 300;
const NODE_HEIGHT = 52;
const HEADER_HEIGHT = 50;
const GAP = 12;
const START_X = 40;
const START_Y = 40;

const elements = ref<any[]>([]);

function buildGraph() {
  const nodes: any[] = [];
  const edges: any[] = [];

  phases.forEach((phase, phaseIdx) => {
    const x = START_X + phaseIdx * (PHASE_WIDTH + 40);
    let y = START_Y;

    nodes.push({
      id: `header-${phase.id}`,
      type: 'default',
      position: { x, y },
      data: { label: phase.label },
      style: {
        background: COLORS[phaseIdx],
        color: '#fff',
        border: 'none',
        fontWeight: 700,
        fontSize: '13px',
        width: PHASE_WIDTH,
        height: HEADER_HEIGHT,
        borderRadius: '6px 6px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    });

    y += HEADER_HEIGHT + GAP;

    phase.workflows.forEach((wf, wfIdx) => {
      const nodeId = `wf-${wf.id}`;
      nodes.push({
        id: nodeId,
        type: 'default',
        position: { x, y },
        data: {
          label: `${wf.standalone ? '◆ ' : ''}${wf.name}`,
        },
        style: {
          background: '#fff',
          color: '#1F2937',
          border: `2px solid ${COLORS[phaseIdx]}66`,
          fontWeight: 500,
          fontSize: '12px',
          width: PHASE_WIDTH,
          height: NODE_HEIGHT,
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        },
      });

      if (wfIdx < phase.workflows.length - 1) {
        edges.push({
          id: `e-${wf.id}-next`,
          source: nodeId,
          target: `wf-${phase.workflows[wfIdx + 1].id}`,
          animated: true,
          style: { stroke: COLORS[phaseIdx] + '44' },
          type: 'smoothstep',
        });
      }

      y += NODE_HEIGHT + GAP;
    });

    if (phaseIdx < phases.length - 1) {
      edges.push({
        id: `e-phase-${phaseIdx}-next`,
        source: `wf-${phase.workflows[phase.workflows.length - 1].id}`,
        target: `wf-${phases[phaseIdx + 1].workflows[0].id}`,
        animated: true,
        style: { stroke: '#9CA3AF', strokeWidth: 2, strokeDasharray: '5,5' },
        type: 'smoothstep',
      });
    }
  });

  const crossY = START_Y + HEADER_HEIGHT + GAP + 6 * (NODE_HEIGHT + GAP);
  crossCutting.forEach((cw, idx) => {
    const x = START_X + idx * (PHASE_WIDTH + 40);
    nodes.push({
      id: `cross-${cw.id}`,
      type: 'default',
      position: { x, y: crossY },
      data: { label: `${cw.standalone ? '◆ ' : ''}${cw.name}` },
      style: {
        background: '#F3F4F6',
        color: '#6B7280',
        border: '2px solid #D1D5DB',
        fontWeight: 500,
        fontSize: '11px',
        width: PHASE_WIDTH,
        height: 40,
        borderRadius: '6px',
        cursor: 'pointer',
      },
    });
  });

  elements.value = [...nodes, ...edges];
}

function onNodeClick({ node }: any) {
  const wfId = node.id.replace('wf-', '').replace('cross-', '');
  window.location.href = `/workflows/customize/${wfId}`;
}

onMounted(() => {
  buildGraph();
});
</script>

<template>
  <div style="height: calc(100vh - 120px); background: var(--surface-ground); border-radius: 0.5rem; overflow: hidden;">
    <VueFlow
      :nodes="elements.filter((e: any) => e.type || !e.source)"
      :edges="elements.filter((e: any) => e.source)"
      :default-viewport="{ x: 0, y: 0, zoom: 0.7 }"
      :min-zoom="0.3"
      :max-zoom="1.5"
      @node-click="onNodeClick"
    >
      <Background :gap="20" />
      <Controls />
    </VueFlow>
  </div>
</template>

<style>
.vue-flow__node-default {
  text-align: center;
  transition: box-shadow 0.2s;
}
.vue-flow__node-default:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
</style>

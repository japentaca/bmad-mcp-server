<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface Story {
  id: number;
  path: string;
  status: string;
  workflow: string;
  updated_at: string;
  step?: string;
  executing?: boolean;
  jobId?: string;
  reviewResult?: { approved: boolean; issues: string[]; severity: string };
  testResult?: { allPassing: boolean; totalTests: number; passed: number; failed: number };
}

const props = defineProps<{
  projectName: string;
}>();

const columns = [
  { id: 'created', label: 'Created', color: '#F3F4F6' },
  { id: 'in-progress', label: 'In Progress', color: '#DBEAFE' },
  { id: 'review', label: 'Code Review', color: '#FEF3C7' },
  { id: 'done', label: 'Done', color: '#DCFCE7' },
];

const stories = ref<Record<string, Story[]>>({
  created: [],
  'in-progress': [],
  review: [],
  done: [],
});

const loading = ref(true);
let pollInterval: ReturnType<typeof setInterval> | null = null;

async function loadStories() {
  try {
    const resp = await fetch(`/api/projects/${props.projectName}/documents?contentType=markdown&limit=200`);
    if (!resp.ok) return;
    const docs = await resp.json();

    const grouped: Record<string, Story[]> = {
      created: [],
      'in-progress': [],
      review: [],
      done: [],
    };

    for (const doc of docs) {
      let status = 'created';
      let step: string | undefined;
      let reviewResult: Story['reviewResult'];
      let testResult: Story['testResult'];

      try {
        const statusResp = await fetch(`/api/projects/${props.projectName}/workflows`);
        if (statusResp.ok) {
          const wfStatuses = await statusResp.json();
          const match = wfStatuses.find((w: any) => w.workflow === doc.workflow);
          if (match) {
            const data = typeof match.status === 'string' ? JSON.parse(match.status) : match.status;
            step = data.step;

            if (data.completed) {
              status = 'done';
            } else if (data.inReview) {
              status = 'review';
            } else if (data.started) {
              status = 'in-progress';
            }

            if (data.reviewResult) reviewResult = data.reviewResult as Story['reviewResult'];
            if (data.testResult) testResult = data.testResult as Story['testResult'];
          }
        }
      } catch {}

      if (!grouped[status]) grouped[status] = [];
      grouped[status].push({ ...doc, status, step, reviewResult, testResult });
    }

    stories.value = grouped;
  } catch {}
  loading.value = false;
}

async function startDevelopment(story: Story) {
  story.executing = true;
  try {
    const resp = await fetch('/api/stories/_/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: props.projectName,
        storyId: story.id,
        storyPath: story.path,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      alert(`Error: ${err.error || 'Failed to start'}`);
      story.executing = false;
      return;
    }

    const { jobId } = await resp.json();
    story.jobId = jobId;
    startPolling();
  } catch (err) {
    alert(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    story.executing = false;
  }
}

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    const hasActive = Object.values(stories.value).flat().some((s) => s.executing || s.jobId);
    if (hasActive) {
      await loadStories();
      const stillActive = Object.values(stories.value).flat().some((s) => s.executing);
      if (!stillActive) {
        stopPolling();
      }
    } else {
      stopPolling();
    }
  }, 3000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'done': return '\u2705';
    case 'review': return '\uD83D\uDD0D';
    case 'in-progress': return '\uD83D\uDEA7';
    default: return '\uD83D\uDCCB';
  }
}

function getStepLabel(step: string | undefined): string {
  switch (step) {
    case 'implementing': return '\uD83D\uDCBB Dev';
    case 'reviewing': return '\uD83D\uDD0D Review';
    case 'review_feedback': return '\u26A0\uFE0F Has feedback';
    case 'review_rejected': return '\u274C Rejected';
    case 'testing': return '\uD83E\uDDEA Testing';
    case 'test_failed': return '\u274C Tests failed';
    case 'completed': return '\u2705 Done';
    case 'failed': return '\u274C Failed';
    default: return '';
  }
}

function formatDate(ts: string): string {
  if (!ts) return '';
  try { return ts.slice(0, 10); } catch { return ts; }
}

function canStart(story: Story): boolean {
  return story.status === 'created' || story.status === 'in-progress';
}

function needsRetry(story: Story): boolean {
  return story.step === 'review_feedback'
    || story.step === 'review_rejected'
    || story.step === 'test_failed'
    || story.step === 'failed';
}

onMounted(() => loadStories());
onUnmounted(() => stopPolling());
</script>

<template>
  <div>
    <div v-if="loading" style="text-align: center; padding: 2rem;">
      <p style="color: var(--text-color-secondary);">Loading board...</p>
    </div>
    <div v-else style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; min-height: 300px;">
      <div v-for="col in columns" :key="col.id"
        style="background: var(--surface-ground); border-radius: 0.5rem; padding: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 0.8rem; font-weight: 600; margin: 0; text-transform: uppercase;">{{ col.label }}</h3>
          <span style="font-size: 0.75rem; background: var(--surface-card); padding: 0.125rem 0.5rem; border-radius: 999px; color: var(--text-color-secondary);">
            {{ stories[col.id]?.length || 0 }}
          </span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div v-for="story in stories[col.id]" :key="story.id"
            style="background: var(--surface-card); border-radius: 0.375rem; padding: 0.75rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <p style="font-size: 0.8rem; font-weight: 500; margin: 0 0 0.25rem;">{{ story.path }}</p>

            <div v-if="story.step" style="margin: 0.25rem 0;">
              <span style="font-size: 0.7rem; color: var(--text-color-secondary);">
                {{ getStepLabel(story.step) }}
              </span>
            </div>

            <div v-if="story.reviewResult && story.reviewResult.issues?.length" style="margin: 0.25rem 0;">
              <div v-for="issue in story.reviewResult.issues.slice(0, 2)" :key="issue"
                style="font-size: 0.65rem; color: #dc2626; padding: 0.125rem 0.25rem; background: rgba(220,38,38,0.08); border-radius: 0.125rem; margin-bottom: 0.125rem;">
                {{ issue.slice(0, 80) }}{{ issue.length > 80 ? '...' : '' }}
              </div>
            </div>

            <div v-if="story.testResult && !story.testResult.allPassing" style="margin: 0.25rem 0;">
              <span style="font-size: 0.65rem; color: #dc2626;">
                {{ story.testResult.failed }}/{{ story.testResult.totalTests }} tests failed
              </span>
            </div>

            <div v-if="story.testResult && story.testResult.allPassing" style="margin: 0.25rem 0;">
              <span style="font-size: 0.65rem; color: #16a34a;">
                {{ story.testResult.passed }}/{{ story.testResult.totalTests }} tests passed
              </span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.7rem; color: var(--text-color-secondary);">{{ story.workflow || '-' }}</span>
              <span style="font-size: 0.7rem; color: var(--text-color-secondary);">{{ formatDate(story.updated_at) }}</span>
            </div>

            <div v-if="canStart(story) || needsRetry(story)" style="margin-top: 0.5rem; display: flex; gap: 0.25rem;">
              <button
                v-if="canStart(story)"
                :disabled="story.executing"
                @click="startDevelopment(story)"
                style="
                  flex: 1;
                  padding: 0.25rem 0.5rem;
                  font-size: 0.7rem;
                  border: none;
                  border-radius: 0.25rem;
                  cursor: pointer;
                  background: var(--primary-color);
                  color: white;
                "
                :style="story.executing ? { opacity: 0.6, cursor: 'not-allowed' } : {}"
              >
                {{ story.executing ? 'Starting...' : 'Start Dev' }}
              </button>
              <button
                v-if="needsRetry(story)"
                :disabled="story.executing"
                @click="startDevelopment(story)"
                style="
                  flex: 1;
                  padding: 0.25rem 0.5rem;
                  font-size: 0.7rem;
                  border: 1px solid var(--primary-color);
                  border-radius: 0.25rem;
                  cursor: pointer;
                  background: transparent;
                  color: var(--primary-color);
                "
                :style="story.executing ? { opacity: 0.6, cursor: 'not-allowed' } : {}"
              >
                {{ story.executing ? 'Retrying...' : 'Retry' }}
              </button>
            </div>

            <div v-if="story.executing" style="margin-top: 0.25rem;">
              <span style="font-size: 0.65rem; color: var(--primary-color);">
                Executing...
              </span>
            </div>
          </div>
          <p v-if="!stories[col.id]?.length" style="font-size: 0.75rem; color: var(--text-color-secondary); text-align: center; padding: 1rem 0;">
            No items
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

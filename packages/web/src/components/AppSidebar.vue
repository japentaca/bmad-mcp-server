<script setup lang="ts">
import { ref, onMounted } from 'vue';

const currentPath = ref('/');

onMounted(() => {
  currentPath.value = window.location.pathname;
});

const navItems = [
  { label: 'Dashboard', path: '/', icon: 'pi pi-home' },
  { label: 'Projects', path: '/projects', icon: 'pi pi-folder' },
  { label: 'Agents', path: '/agents', icon: 'pi pi-android' },
  { label: 'Workflows', path: '/workflows', icon: 'pi pi-sitemap' },
  { label: 'Activity Log', path: '/logs', icon: 'pi pi-list' },
  { label: 'Live Console', path: '/console', icon: 'pi pi-terminal' },
  { label: 'Configuration', path: '/config', icon: 'pi pi-cog' },
];
</script>

<template>
  <aside style="width: 240px; background: var(--surface-card); border-right: 1px solid var(--surface-border); min-height: 100vh; display: flex; flex-direction: column;">
    <div style="padding: 1rem; border-bottom: 1px solid var(--surface-border);">
      <h2 style="font-size: 1.125rem; font-weight: 700; margin: 0;">BMAD Manager</h2>
      <p style="font-size: 0.75rem; color: var(--text-color-secondary); margin: 0.25rem 0 0;">Project Administration</p>
    </div>
    <nav style="flex: 1; padding: 0.5rem;">
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li v-for="item in navItems" :key="item.path" style="margin-bottom: 2px;">
          <a
            :href="item.path"
            :style="{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              textDecoration: 'none',
              color: currentPath === item.path ? 'var(--primary-color-text)' : 'var(--text-color)',
              backgroundColor: currentPath === item.path ? 'var(--primary-color)' : 'transparent',
              transition: 'background-color 0.2s',
            }"
          >
            <i :class="item.icon" />
            {{ item.label }}
          </a>
        </li>
      </ul>
    </nav>
    <div style="padding: 0.75rem; border-top: 1px solid var(--surface-border);">
      <a href="/api/auth/logout" style="font-size: 0.75rem; color: var(--text-color-secondary); text-decoration: none;">
        Logout
      </a>
    </div>
  </aside>
</template>

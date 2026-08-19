<template>
  <nav id="app-sidebar" :class="{ open: isOpen }" class="sidebar">
    <div class="sidebar-brand">
      <img :src="logoSrc" alt="MC-Linker" class="sidebar-logo">
      MC-Linker Analytics
      <!-- The drawer covers the topbar's menu button, so it needs its own way out -->
      <button aria-label="Close navigation" class="sidebar-close" type="button" @click="close">
        <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" stroke-linecap="round"
             stroke-width="2" viewBox="0 0 24 24" width="20">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    </div>

    <div class="sidebar-section">
      <label class="sidebar-label">Database</label>
      <select :value="currentDb" class="db-select" @change="switchDb">
        <option v-for="db in databases" :key="db" :value="db">{{ db }}</option>
      </select>
    </div>

    <ul class="sidebar-nav">
      <li>
        <NuxtLink active-class="active" class="sidebar-link" exact to="/">Overview</NuxtLink>
      </li>
      <li>
        <NuxtLink active-class="active" class="sidebar-link" to="/commands">Commands</NuxtLink>
      </li>
      <li>
        <NuxtLink active-class="active" class="sidebar-link" to="/api-calls">API Calls</NuxtLink>
      </li>
      <li>
        <NuxtLink active-class="active" class="sidebar-link" to="/shards">Shards</NuxtLink>
      </li>
      <li>
        <NuxtLink active-class="active" class="sidebar-link" to="/guilds">Guilds</NuxtLink>
      </li>
      <li>
        <NuxtLink active-class="active" class="sidebar-link" to="/server-connections">Server Connections</NuxtLink>
      </li>
      <li>
        <NuxtLink active-class="active" class="sidebar-link" to="/chat-monitor">Chat Monitor</NuxtLink>
      </li>
      <li>
        <NuxtLink active-class="active" class="sidebar-link" to="/errors">Errors</NuxtLink>
      </li>
      <li>
        <NuxtLink active-class="active" class="sidebar-link" to="/logs">Logs</NuxtLink>
      </li>
    </ul>

    <div class="sidebar-footer">
      <button class="btn-logout" @click="logout">Logout</button>
    </div>
  </nav>
</template>

<script lang="ts" setup>
import logoSrc from '~/assets/logo.svg';

const { isOpen, close } = useSidebar();

const { data: dbData } = await useFetch('/api/databases');
const databases = computed(() => dbData.value?.databases ?? []);

const { data: meData } = await useFetch('/api/auth/me');
const currentDb = computed(() => meData.value?.db ?? null);

async function switchDb(e: Event) {
  const db = (e.target as HTMLSelectElement).value;
  await $fetch('/api/auth/switch-db', { method: 'POST', body: { db } });
  await refreshNuxtData();
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' });
  await navigateTo('/login');
}
</script>

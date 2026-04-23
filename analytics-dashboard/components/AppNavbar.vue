<template>
  <nav class="sidebar">
    <div class="sidebar-brand">
      <img alt="MC-Linker" class="sidebar-logo" src="~/assets/logo.svg">
      MC-Linker Analytics
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
const { data: dbData } = await useFetch('/api/databases');
const databases = computed(() => dbData.value?.databases ?? []);

const sessionCookie = useCookie('session');

// Parse the current db from the JWT payload (middle segment, base64)
const currentDb = computed(() => {
  const token = sessionCookie.value;
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.db ?? null;
  }
  catch { return null; }
});

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

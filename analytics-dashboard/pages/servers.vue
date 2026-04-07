<template>
  <div>
    <div class="page-header">
      <h1>Server Connections</h1>
      <div class="search-bar">
        <input
            v-model="searchInput"
            placeholder="Search by Guild ID..."
            type="text"
            @keydown.enter="search = searchInput"
        />
        <button @click="search = searchInput">Search</button>
      </div>
    </div>

    <div v-if="data" class="stats-grid">
      <StatsCard :value="data.total" label="Total Servers"/>
    </div>

    <div v-if="data?.server" class="card server-detail">
      <h2>Server: <code>{{ data.server._id }}</code></h2>
      <pre class="json-block">{{ JSON.stringify(data.server, null, 2) }}</pre>
    </div>

    <div v-if="search && !data?.server" class="empty">No server found for ID "{{ search }}".</div>

    <div v-if="data?.stats" class="charts-grid">
      <div class="chart-card">
        <h2>Feature Adoption</h2>
        <ChartsPieChart :data="featureAdoptionChartData"/>
      </div>
      <div v-if="Object.keys(data.stats.chatTypeBreakdown ?? {}).length" class="chart-card">
        <h2>Chat Event Types</h2>
        <ChartsBarChart :data="chatTypeChartData" :horizontal="true"/>
      </div>
      <div class="chart-card">
        <h2>Stat Channel Types</h2>
        <ChartsBarChart :data="statTypeChartData" :horizontal="true"/>
      </div>
      <div class="chart-card">
        <h2>Role Sync Directions</h2>
        <ChartsBarChart :data="roleDirectionChartData" :horizontal="true"/>
      </div>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <div v-if="!pending && !error && !data?.total" class="empty">No server data available.</div>
  </div>
</template>

<script lang="ts" setup>
const searchInput = ref('');
const search = ref('');

const { data, pending, error } = await useFetch('/api/servers', {
  query: computed(() => {
    const q: Record<string, string> = {};
    if (search.value) q.search = search.value;
    return q;
  }),
  watch: [search],
});

const featureAdoptionChartData = computed(() => {
  const s = data.value?.stats;
  if (!s) return { labels: [], datasets: [] };
  return {
    labels: ['Chat Channels', 'Stat Channels', 'Synced Roles', 'Required Role', 'Floodgate', 'Discord to MC'],
    datasets: [{
      data: [s.chatChannels, s.statChannels, s.syncedRoles, s.requiredRole, s.floodgate, s.discordToMinecraft],
      backgroundColor: ['#5b8dee', '#43c59e', '#e8b84b', '#e06c75', '#c678dd', '#56b6c2'],
    }],
  };
});

const chatTypeChartData = computed(() => {
  const breakdown = data.value?.stats?.chatTypeBreakdown ?? {};
  const entries = Object.entries(breakdown).sort(([, a], [, b]) => (b as number) - (a as number));
  return {
    labels: entries.map(([k]) => k),
    datasets: [{
      label: 'Channels',
      data: entries.map(([, v]) => v),
      backgroundColor: '#5b8dee',
    }],
  };
});

const statTypeChartData = computed(() => {
  const breakdown = data.value?.stats?.statTypeBreakdown ?? {};
  return {
    labels: Object.keys(breakdown),
    datasets: [{
      label: 'Channels',
      data: Object.values(breakdown),
      backgroundColor: '#43c59e',
    }],
  };
});

const roleDirectionChartData = computed(() => {
  const dirs = data.value?.stats?.roleDirections ?? {};
  return {
    labels: Object.keys(dirs),
    datasets: [{
      label: 'Roles',
      data: Object.values(dirs),
      backgroundColor: '#e8b84b',
    }],
  };
});
</script>

<style scoped>
.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-bar input {
  padding: 6px 12px;
  border: 1px solid #3a3f4b;
  border-radius: 6px;
  background: #23272e;
  color: #e0e6ed;
  font-size: 0.9rem;
  width: 260px;
}

.search-bar button {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  background: #5b8dee;
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
}

.search-bar button:hover {
  background: #4a7dde;
}

.server-detail {
  margin-top: 20px;
  margin-bottom: 20px;
}

.json-block {
  background: #1a1d23;
  border: 1px solid #3a3f4b;
  border-radius: 6px;
  padding: 16px;
  color: #e0e6ed;
  font-size: 0.85rem;
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
  white-space: pre;
  line-height: 1.5;
}
</style>

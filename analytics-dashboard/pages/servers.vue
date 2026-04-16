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
      <!-- eslint-disable-next-line vue/no-v-html -->
      <pre class="json-block" v-html="highlightJson(data.server)"></pre>
    </div>

    <div v-if="search && !data?.server" class="empty">No server found for ID "{{ search }}".</div>

    <div v-if="data?.stats" class="charts-grid">
      <div class="chart-card">
        <div class="chart-header">
          <button v-if="drillDown" class="back-btn" @click="drillDown = null">&larr; Back</button>
          <h2>{{ chartTitle }}</h2>
        </div>
        <ChartsPieChart :data="pieChartData" @segment-click="onSegmentClick"/>
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
const drillDown = ref<string | null>(null);

const { data, pending, error } = await useFetch('/api/servers', {
  query: computed(() => {
    const q: Record<string, string> = {};
    if (search.value) q.search = search.value;
    return q;
  }),
  watch: [search],
});

const DRILLABLE: Record<string, string> = {
  'Chat Channels': 'chatChannels',
  'Stat Channels': 'statChannels',
  'Synced Roles': 'syncedRoles',
  'Required Role': 'requiredRole',
};

const COLORS = ['#5b8dee', '#43c59e', '#e8b84b', '#e06c75', '#c678dd'];

const chartTitle = computed(() => {
  if (drillDown.value === 'chatChannels') return 'Chat Event Types';
  if (drillDown.value === 'statChannels') return 'Stat Channel Types';
  if (drillDown.value === 'syncedRoles') return 'Role Sync Directions';
  if (drillDown.value === 'requiredRole') return 'Required Role Types';
  return 'Feature Adoption';
});

const pieChartData = computed(() => {
  const s = data.value?.stats;
  if (!s) return { labels: [], datasets: [] };

  if (drillDown.value === 'chatChannels') {
    const breakdown = s.chatTypeBreakdown ?? {};
    const entries = Object.entries(breakdown).sort(([, a], [, b]) => (b as number) - (a as number));
    return {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: COLORS.slice(0, entries.length).concat(Array(Math.max(0, entries.length - COLORS.length)).fill('#888'))
      }],
    };
  }

  if (drillDown.value === 'statChannels') {
    const breakdown = s.statTypeBreakdown ?? {};
    const entries = Object.entries(breakdown);
    return {
      labels: entries.map(([k]) => k),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: ['#43c59e', '#5b8dee'] }],
    };
  }

  if (drillDown.value === 'syncedRoles') {
    const dirs = s.roleDirections ?? {};
    const entries = Object.entries(dirs);
    return {
      labels: entries.map(([k]) => k),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: ['#e8b84b', '#e06c75', '#c678dd'] }],
    };
  }

  if (drillDown.value === 'requiredRole') {
    const breakdown = s.requiredRoleBreakdown ?? {};
    const entries = Object.entries(breakdown);
    return {
      labels: entries.map(([k]) => k),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: ['#e06c75', '#56b6c2'] }],
    };
  }

  // Main feature adoption view
  return {
    labels: ['Chat Channels', 'Stat Channels', 'Synced Roles', 'Required Role', 'Floodgate'],
    datasets: [{
      data: [s.chatChannels, s.statChannels, s.syncedRoles, s.requiredRole, s.floodgate],
      backgroundColor: COLORS,
    }],
  };
});

function onSegmentClick(index: number, label: string) {
  if (drillDown.value) return; // no nested drill-down
  const key = DRILLABLE[label];
  if (key) drillDown.value = key;
}

function highlightJson(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  // Escape HTML entities first to prevent XSS (preserving " for the regex)
  const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  return escaped.replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      match => {
        if (/^"/.test(match)) {
          const cls = /:$/.test(match) ? 'json-key' : 'json-string';
          return `<span class="${cls}">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="json-boolean">${match}</span>`;
        if (match === 'null') return `<span class="json-null">${match}</span>`;
        return `<span class="json-number">${match}</span>`;
      },
  );
}
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

.json-key {
  color: #56b6c2;
  font-weight: 600;
}

.json-string {
  color: #98c379;
}

.json-number {
  color: #d19a66;
}

.json-boolean {
  color: #c678dd;
}

.json-null {
  color: #888;
}

.chart-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  padding: 4px 12px;
  border: 1px solid #3a3f4b;
  border-radius: 6px;
  background: #23272e;
  color: #b0b8c8;
  cursor: pointer;
  font-size: 0.85rem;
}

.back-btn:hover {
  background: #2c313a;
  color: #e0e6ed;
}
</style>

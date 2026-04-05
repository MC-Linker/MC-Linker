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
      <StatsCard :value="data.stats?.chatChannels" label="With Chat Channels"/>
      <StatsCard :value="data.stats?.statChannels" label="With Stat Channels"/>
      <StatsCard :value="data.stats?.syncedRoles" label="With Synced Roles"/>
      <StatsCard :value="data.stats?.requiredRole" label="With Required Role"/>
      <StatsCard :value="data.stats?.floodgate" label="With Floodgate"/>
      <StatsCard :value="data.stats?.discordToMinecraft" label="Discord to MC Channels"/>
    </div>

    <div v-if="data?.stats" class="charts-grid">
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

    <div v-if="data?.server" class="card server-detail">
      <h2>Server: <code>{{ data.server._id }}</code></h2>

      <div v-if="data.server.chatChannels?.length" class="detail-section">
        <h3>Chat Channels ({{ data.server.chatChannels.length }})</h3>
        <table class="data-table">
          <thead>
          <tr>
            <th>Channel ID</th>
            <th>Types</th>
            <th>Discord to MC</th>
            <th>Webhooks</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="ch in data.server.chatChannels" :key="ch._id">
            <td><code>{{ ch._id }}</code></td>
            <td>{{ (ch.types ?? []).join(', ') || '—' }}</td>
            <td>{{ ch.allowDiscordToMinecraft !== false ? 'Yes' : 'No' }}</td>
            <td>{{ ch.webhooks?.length ?? 0 }}</td>
          </tr>
          </tbody>
        </table>
      </div>

      <div v-if="data.server.statChannels?.length" class="detail-section">
        <h3>Stat Channels ({{ data.server.statChannels.length }})</h3>
        <table class="data-table">
          <thead>
          <tr>
            <th>Channel ID</th>
            <th>Type</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="ch in data.server.statChannels" :key="ch._id">
            <td><code>{{ ch._id }}</code></td>
            <td>{{ ch.type }}</td>
          </tr>
          </tbody>
        </table>
      </div>

      <div v-if="data.server.syncedRoles?.length" class="detail-section">
        <h3>Synced Roles ({{ data.server.syncedRoles.length }})</h3>
        <table class="data-table">
          <thead>
          <tr>
            <th>Role ID</th>
            <th>Name</th>
            <th>Type</th>
            <th>Direction</th>
            <th>Players</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="r in data.server.syncedRoles" :key="r._id">
            <td><code>{{ r._id }}</code></td>
            <td>{{ r.name }}</td>
            <td>{{ r.isGroup ? 'Group' : 'Team' }}</td>
            <td>{{ r.direction ?? 'both' }}</td>
            <td>{{ r.players?.length ?? 0 }}</td>
          </tr>
          </tbody>
        </table>
      </div>

      <div class="detail-section">
        <h3>Settings</h3>
        <table class="data-table">
          <tbody>
          <tr>
            <td>Floodgate Prefix</td>
            <td><code>{{ data.server.floodgatePrefix ?? '—' }}</code></td>
          </tr>
          <tr>
            <td>Required Role to Join</td>
            <td>{{
                data.server.requiredRoleToJoin?.roles?.length ? `${data.server.requiredRoleToJoin.method} of ${data.server.requiredRoleToJoin.roles.length} role(s)` : '—'
              }}
            </td>
          </tr>
          <tr>
            <td>Version</td>
            <td>{{ data.server.version ?? '—' }}</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="search && !data?.server" class="empty">No server found for ID "{{ search }}".</div>

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
}

.detail-section {
  margin-top: 16px;
}

.detail-section h3 {
  margin-bottom: 8px;
  font-size: 1rem;
  color: #b0b8c8;
}
</style>

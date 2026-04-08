<template>
  <div>
    <div class="page-header">
      <h1>Shards</h1>
      <RangePicker v-model:from="from" v-model:to="to"/>
    </div>

    <div v-if="data?.connections" class="stats-grid">
      <StatsCard :value="data.machine?.cpuPercent" format="percent" label="Machine CPU"/>
      <StatsCard :sub="`/ ${data.machine?.memoryTotalMB ?? 0} MB`" :value="data.machine?.memoryUsedMB" format="mb"
                 label="Machine Memory"/>
      <StatsCard :value="data.connections.servers" label="Server Connections"/>
      <StatsCard :value="data.connections.users" label="User Connections"/>
      <StatsCard :value="data.connections.online" label="Online Servers"/>
    </div>

    <div v-if="data?.shards?.length" class="card" style="margin-bottom: 20px;">
      <table class="data-table">
        <thead>
        <tr>
          <th>Shard</th>
          <th>Guilds</th>
          <th>Ping</th>
          <th>Memory</th>
          <th>CPU</th>
          <th>Uptime</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="shard in data.shards" :key="shard.id">
          <td>#{{ shard.id }}</td>
          <td>{{ shard.guilds.toLocaleString() }}</td>
          <td>
                            <span
                                :class="['badge', shard.ping > 200 ? 'badge-danger' : shard.ping > 100 ? 'badge-warn' : 'badge-ok']">
                                {{ shard.ping }}ms
                            </span>
          </td>
          <td>{{ shard.memoryMB.toFixed(1) }} MB</td>
          <td>
                            <span
                                :class="['badge', (shard.cpuPercent ?? 0) > 80 ? 'badge-danger' : (shard.cpuPercent ?? 0) > 40 ? 'badge-warn' : 'badge-ok']">
                                {{ (shard.cpuPercent ?? 0).toFixed(1) }}%
                            </span>
          </td>
          <td>{{ formatUptime(shard.uptime) }}</td>
        </tr>
        </tbody>
      </table>
    </div>

    <div v-if="data?.timeSeries?.length" class="charts-grid">
      <div class="chart-card">
        <h2>Machine CPU (%)</h2>
        <ChartsLineChart :data="machineCpuChartData"/>
      </div>
      <div class="chart-card">
        <h2>Machine Memory (MB)</h2>
        <ChartsLineChart :data="machineMemoryChartData"/>
      </div>
    </div>

    <div v-if="data?.timeSeries?.length" class="charts-grid">
      <div class="chart-card">
        <h2>Memory per Shard (MB)</h2>
        <ChartsLineChart :data="memoryChartData"/>
      </div>
      <div class="chart-card">
        <h2>CPU per Shard (%)</h2>
        <ChartsLineChart :data="cpuChartData"/>
      </div>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <div v-if="!pending && !data?.shards?.length" class="empty">No shard data available.</div>
  </div>
</template>

<script lang="ts" setup>
import { formatTimeLabel } from '~/composables/useTimeLabel';

const SHARD_COLORS = ['#5b8dee', '#43c59e', '#e05252', '#f59e0b', '#a78bfa', '#2dd4bf', '#f472b6', '#84cc16'];

const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));

const { data, pending, error } = await useFetch('/api/shards', {
  query: computed(() => ({ from: from.value, to: to.value })),
  watch: [from, to],
});

function formatUptime(ms: number) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

// Collect all unique shard IDs
const shardIds = computed(() => {
  const ids = new Set<number>();
  for (const snap of data.value?.timeSeries ?? []) {
    for (const sh of snap.shards) ids.add(sh.id);
  }
  return [...ids].sort((a, b) => a - b);
});

const machineCpuChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => formatTimeLabel(p.timestamp, ts.length)),
    datasets: [{
      label: 'CPU %',
      data: ts.map(p => p.machine?.cpuPercent ?? 0),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
    }],
  };
});

const machineMemoryChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => formatTimeLabel(p.timestamp, ts.length)),
    datasets: [
      {
        label: 'Used MB',
        data: ts.map(p => p.machine?.memoryUsedMB ?? 0),
        borderColor: '#e05252',
        backgroundColor: 'rgba(224,82,82,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: 'Total MB',
        data: ts.map(p => p.machine?.memoryTotalMB ?? 0),
        borderColor: '#5b8dee',
        backgroundColor: 'rgba(91,141,238,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderDash: [5, 5],
      },
    ],
  };
});

const memoryChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => formatTimeLabel(p.timestamp, ts.length)),
    datasets: shardIds.value.map(id => ({
      label: `Shard #${id}`,
      data: ts.map(p => p.shards.find(s => s.id === id)?.memoryMB ?? null),
      borderColor: SHARD_COLORS[id % SHARD_COLORS.length],
      tension: 0.3,
      pointRadius: 0,
    })),
  };
});

const cpuChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => formatTimeLabel(p.timestamp, ts.length)),
    datasets: shardIds.value.map(id => ({
      label: `Shard #${id}`,
      data: ts.map(p => p.shards.find(s => s.id === id)?.cpuPercent ?? null),
      borderColor: SHARD_COLORS[id % SHARD_COLORS.length],
      tension: 0.3,
      pointRadius: 0,
    })),
  };
});
</script>

<template>
  <div>
    <div class="page-header">
      <h1>API Calls</h1>
      <RangePicker v-model:from="from" v-model:to="to"/>
    </div>

    <div v-if="data?.timeSeries?.length" class="chart-card">
      <h2>Volume Over Time</h2>
      <ChartsLineChart :data="volumeChartData"/>
    </div>

    <div v-if="data?.rest?.length || data?.ws?.length" class="charts-grid">
      <div v-if="data?.rest?.length" class="chart-card">
        <h2>REST Endpoints</h2>
        <ChartsBarChart :data="restChartData" :horizontal="true"/>
      </div>
      <div v-if="data?.ws?.length" class="chart-card">
        <h2>WebSocket Events</h2>
        <ChartsBarChart :data="wsChartData" :horizontal="true"/>
      </div>
    </div>

    <div v-if="data?.rest?.length" class="card" style="margin-bottom: 20px;">
      <h2 class="table-title">REST Endpoints</h2>
      <table class="data-table">
        <thead>
        <tr>
          <th>Endpoint</th>
          <th>Calls</th>
          <th>Avg Duration</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="r in data.rest" :key="r.name">
          <td><code>{{ r.name }}</code></td>
          <td>{{ r.count.toLocaleString() }}</td>
          <td>{{ r.avgDurationMs }}ms</td>
        </tr>
        </tbody>
      </table>
    </div>

    <div v-if="data?.ws?.length" class="card">
      <h2 class="table-title">WebSocket Events</h2>
      <table class="data-table">
        <thead>
        <tr>
          <th>Event</th>
          <th>Calls</th>
          <th>Errors</th>
          <th>Error Rate</th>
          <th>Avg Duration</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="w in data.ws" :key="w.name">
          <td><code>{{ w.name }}</code></td>
          <td>{{ w.count.toLocaleString() }}</td>
          <td>{{ w.errors.toLocaleString() }}</td>
          <td>
                            <span
                                :class="['badge', w.errorRate > 10 ? 'badge-danger' : w.errorRate > 2 ? 'badge-warn' : 'badge-ok']">
                                {{ w.errorRate }}%
                            </span>
          </td>
          <td>{{ w.avgDurationMs }}ms</td>
        </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<script lang="ts" setup>
const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));

const { data, pending, error } = await useFetch('/api/api-calls', {
  query: computed(() => ({ from: from.value, to: to.value })),
  watch: [from, to],
});

const volumeChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => new Date(p.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'REST',
        data: ts.map(p => p.rest),
        borderColor: '#5b8dee',
        backgroundColor: 'rgba(91,141,238,0.15)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'WebSocket',
        data: ts.map(p => p.ws),
        borderColor: '#43c59e',
        backgroundColor: 'rgba(67,197,158,0.15)',
        fill: true,
        tension: 0.3,
      },
    ],
  };
});

const restChartData = computed(() => ({
  labels: (data.value?.rest ?? []).slice(0, 15).map(r => r.name),
  datasets: [{
    label: 'Calls',
    data: (data.value?.rest ?? []).slice(0, 15).map(r => r.count),
    backgroundColor: '#5b8dee',
  }],
}));

const wsChartData = computed(() => ({
  labels: (data.value?.ws ?? []).slice(0, 15).map(w => w.name),
  datasets: [{
    label: 'Calls',
    data: (data.value?.ws ?? []).slice(0, 15).map(w => w.count),
    backgroundColor: '#43c59e',
  }],
}));
</script>

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
          <th @click="restSort.toggleSort('name')">Endpoint{{ restSort.sortIcon('name') }}</th>
          <th @click="restSort.toggleSort('count')">Calls{{ restSort.sortIcon('count') }}</th>
          <th @click="restSort.toggleSort('avgDurationMs')">Avg Duration{{ restSort.sortIcon('avgDurationMs') }}</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="r in sortedRest" :key="r.name">
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
          <th @click="wsSort.toggleSort('name')">Event{{ wsSort.sortIcon('name') }}</th>
          <th @click="wsSort.toggleSort('count')">Calls{{ wsSort.sortIcon('count') }}</th>
          <th @click="wsSort.toggleSort('errors')">Errors{{ wsSort.sortIcon('errors') }}</th>
          <th @click="wsSort.toggleSort('errorRate')">Error Rate{{ wsSort.sortIcon('errorRate') }}</th>
          <th @click="wsSort.toggleSort('avgDurationMs')">Avg Duration{{ wsSort.sortIcon('avgDurationMs') }}</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="w in sortedWs" :key="w.name">
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
    <div v-if="!pending && !error && !data?.rest?.length && !data?.ws?.length" class="empty">No API call data for this
      period.
    </div>
  </div>
</template>

<script lang="ts" setup>
import { formatTimeLabel } from '~/composables/useTimeLabel';

const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));

const { data, pending, error } = await useFetch('/api/api-calls', {
  query: computed(() => ({ from: from.value, to: to.value })),
  watch: [from, to],
});

const restItems = computed(() => data.value?.rest ?? []);
const wsItems = computed(() => data.value?.ws ?? []);
const restSort = useSortable(restItems, 'count');
const wsSort = useSortable(wsItems, 'count');
const sortedRest = restSort.sorted;
const sortedWs = wsSort.sorted;

const volumeChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => formatTimeLabel(p.timestamp, ts.length)),
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

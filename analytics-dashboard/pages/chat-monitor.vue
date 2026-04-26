<template>
  <div>
    <div class="page-header">
      <h1>Chat Monitor</h1>
      <RangePicker v-model:from="from" v-model:to="to"/>
    </div>

    <div v-if="data?.latest" class="stats-grid">
      <StatsCard :value="data.latest.incoming" label="Incoming (last)"/>
      <StatsCard :value="data.latest.processed" label="Processed (last)"/>
      <StatsCard :value="data.latest.queueItems" label="Queue Items"/>
      <StatsCard :value="data.latest.queueDestinations" label="Queue Destinations"/>
      <StatsCard :value="data.totals?.rateLimits" label="Rate Limits (total)"/>
      <StatsCard :value="data.totals?.failures" label="Failures (total)"/>
    </div>

    <div v-if="data?.timeSeries?.length" class="charts-grid">
      <div class="chart-card">
        <h2>Throughput</h2>
        <ChartsLineChart :data="throughputChartData"/>
      </div>
      <div class="chart-card">
        <h2>Queue Depth</h2>
        <ChartsLineChart :data="queueChartData"/>
      </div>
    </div>

    <div v-if="data?.timeSeries?.length" class="charts-grid">
      <div class="chart-card">
        <h2>Rate Limits &amp; Failures</h2>
        <ChartsLineChart :data="issuesChartData"/>
      </div>
      <div v-if="rlChartData.labels.length" class="chart-card">
        <h2>Rate Limits by Category</h2>
        <ChartsBarChart :data="rlChartData" :horizontal="true"/>
      </div>
    </div>

    <div v-if="data?.operations?.length" class="card" style="margin-top: 20px;">
      <h2 class="table-title">Operations</h2>
      <table class="data-table">
        <thead>
        <tr>
          <th @click="toggleSort('name')">Name{{ sortIcon('name') }}</th>
          <th @click="toggleSort('count')">Count{{ sortIcon('count') }}</th>
          <th @click="toggleSort('rateLimits')">Rate Limits{{ sortIcon('rateLimits') }}</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="op in sortedOps" :key="op.name">
          <td><code>{{ op.name }}</code></td>
          <td>{{ op.count.toLocaleString() }}</td>
          <td>
            <span :class="['badge', op.rateLimits > 0 ? 'badge-warn' : 'badge-ok']">
              {{ op.rateLimits.toLocaleString() }}
            </span>
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pending" class="loading">Loading...</div>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <div v-if="!pending && !error && !data?.timeSeries?.length" class="empty">No chat monitor data for this period.
    </div>
  </div>
</template>

<script lang="ts" setup>
import { formatTimeLabel } from '~/composables/useTimeLabel';

const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));

const { data, pending, error } = await useFetch('/api/chat-monitor', {
  query: computed(() => ({ from: from.value, to: to.value })),
  watch: [from, to],
});

const opItems = computed(() => data.value?.operations ?? []);
const { toggleSort, sortIcon, sorted: sortedOps } = useSortable(opItems, 'count');

const throughputChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => formatTimeLabel(p.timestamp, ts.length)),
    datasets: [
      {
        label: 'Incoming',
        data: ts.map(p => p.incoming),
        borderColor: '#5b8dee',
        backgroundColor: 'rgba(91,141,238,0.15)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Enqueued',
        data: ts.map(p => p.enqueued),
        borderColor: '#e8b84b',
        tension: 0.3,
      },
      {
        label: 'Processed',
        data: ts.map(p => p.processed),
        borderColor: '#43c59e',
        tension: 0.3,
      },
    ],
  };
});

const queueChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => formatTimeLabel(p.timestamp, ts.length)),
    datasets: [
      {
        label: 'Queue Items',
        data: ts.map(p => p.queueItems),
        borderColor: '#c678dd',
        backgroundColor: 'rgba(198,120,221,0.15)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Destinations',
        data: ts.map(p => p.queueDestinations),
        borderColor: '#56b6c2',
        tension: 0.3,
      },
    ],
  };
});

const issuesChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => formatTimeLabel(p.timestamp, ts.length)),
    datasets: [
      {
        label: 'Rate Limits',
        data: ts.map(p => p.rateLimits),
        borderColor: '#e8b84b',
        backgroundColor: 'rgba(232,184,75,0.15)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Failures',
        data: ts.map(p => p.failures),
        borderColor: '#e05252',
        backgroundColor: 'rgba(224,82,82,0.15)',
        fill: true,
        tension: 0.3,
      },
    ],
  };
});

const rlChartData = computed(() => {
  const cats = data.value?.totals?.rateLimitsByCategory ?? {};
  const entries = Object.entries(cats).sort(([, a], [, b]) => (b as number) - (a as number));
  return {
    labels: entries.map(([k]) => k),
    datasets: [{
      label: 'Rate Limits',
      data: entries.map(([, v]) => v),
      backgroundColor: '#e8b84b',
    }],
  };
});
</script>

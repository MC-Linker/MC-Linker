<template>
  <div>
    <div class="page-header">
      <h1>Commands</h1>
      <RangePicker v-model:from="from" v-model:to="to"/>
    </div>

    <div v-if="data?.commands?.length" class="charts-grid">
      <div class="chart-card">
        <h2>Top Commands by Usage</h2>
        <ChartsBarChart :data="usageChartData" :horizontal="true"/>
      </div>
      <div class="chart-card">
        <h2>Avg Duration (ms)</h2>
        <ChartsBarChart :data="durationChartData" :horizontal="true"/>
      </div>
    </div>

    <div v-if="data?.commands?.length" class="card">
      <table class="data-table">
        <thead>
        <tr>
          <th>Command</th>
          <th>Uses</th>
          <th>Errors</th>
          <th>Error Rate</th>
          <th>Avg Duration</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="cmd in data.commands" :key="cmd.name">
          <td><code>{{ cmd.name }}</code></td>
          <td>{{ cmd.count.toLocaleString() }}</td>
          <td>{{ cmd.errors.toLocaleString() }}</td>
          <td>
                            <span
                                :class="['badge', cmd.errorRate > 10 ? 'badge-danger' : cmd.errorRate > 2 ? 'badge-warn' : 'badge-ok']">
                                {{ cmd.errorRate }}%
                            </span>
          </td>
          <td>{{ cmd.avgDurationMs }}ms</td>
        </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <div v-if="!pending && !error && !data?.commands?.length" class="empty">No command data for this period.</div>
  </div>
</template>

<script lang="ts" setup>
const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));

const { data, pending, error } = await useFetch('/api/commands', {
  query: computed(() => ({ from: from.value, to: to.value, limit: 25 })),
  watch: [from, to],
});

const top15 = computed(() => (data.value?.commands ?? []).slice(0, 15));

const usageChartData = computed(() => ({
  labels: top15.value.map(c => c.name),
  datasets: [{
    label: 'Uses',
    data: top15.value.map(c => c.count),
    backgroundColor: '#5b8dee',
  }],
}));

const durationChartData = computed(() => ({
  labels: top15.value.map(c => c.name),
  datasets: [{
    label: 'Avg Duration (ms)',
    data: top15.value.map(c => c.avgDurationMs),
    backgroundColor: '#43c59e',
  }],
}));
</script>

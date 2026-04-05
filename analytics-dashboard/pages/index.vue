<template>
  <div>
    <div class="page-header">
      <h1>Overview</h1>
      <RangePicker v-model:from="from" v-model:to="to"/>
    </div>

    <div v-if="data" class="stats-grid">
      <StatsCard :value="data.latest?.guilds?.total" label="Guilds"/>
      <StatsCard :value="data.latest?.users?.approximate" label="Approx. Users"/>
      <StatsCard :value="data.totals?.commands" label="Commands (range)"/>
      <StatsCard :value="errorRate" format="percent" label="Error Rate"/>
      <StatsCard :value="data.latest?.connections?.servers" label="Connections (servers)"/>
      <StatsCard :value="data.latest?.connections?.users" label="Connections (users)"/>
      <StatsCard :value="data.latest?.connections?.online" label="Online Servers"/>
      <StatsCard :value="data.latest?.shardCount" label="Shards"/>
    </div>

    <div v-if="data?.timeSeries?.length" class="charts-grid">
      <div class="chart-card">
        <h2>Guild Count</h2>
        <ChartsLineChart :data="guildChartData"/>
      </div>
      <div class="chart-card">
        <h2>Command Volume</h2>
        <ChartsLineChart :data="commandChartData"/>
      </div>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<script lang="ts" setup>
const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));

const { data, pending, error } = await useFetch('/api/overview', {
  query: computed(() => ({ from: from.value, to: to.value })),
  watch: [from, to],
});

const errorRate = computed(() => {
  const totals = data.value?.totals;
  if (!totals?.commands) return 0;
  return (totals.errors / totals.commands) * 100;
});

const guildChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => new Date(p.timestamp).toLocaleDateString()),
    datasets: [{
      label: 'Guilds',
      data: ts.map(p => p.guilds),
      borderColor: '#5b8dee',
      backgroundColor: 'rgba(91,141,238,0.15)',
      fill: true,
      tension: 0.3,
    }],
  };
});

const commandChartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => new Date(p.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'Commands',
        data: ts.map(p => p.commands),
        borderColor: '#43c59e',
        backgroundColor: 'rgba(67,197,158,0.15)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Errors',
        data: ts.map(p => p.errors),
        borderColor: '#e05252',
        backgroundColor: 'rgba(224,82,82,0.15)',
        fill: true,
        tension: 0.3,
      },
    ],
  };
});
</script>

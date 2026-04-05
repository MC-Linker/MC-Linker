<template>
  <div>
    <div class="page-header">
      <h1>Guilds</h1>
      <RangePicker v-model:from="from" v-model:to="to"/>
    </div>

    <div v-if="data?.latest" class="stats-grid">
      <StatsCard :value="data.latest.total" label="Total Guilds"/>
      <StatsCard :value="totalJoined" label="Joined (range)"/>
      <StatsCard :value="totalLeft" label="Left (range)"/>
      <StatsCard :value="totalJoined - totalLeft" label="Net Change"/>
    </div>

    <div v-if="data?.timeSeries?.length" class="chart-card">
      <h2>Guild Growth</h2>
      <ChartsLineChart :data="chartData"/>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<script lang="ts" setup>
const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));

const { data, pending, error } = await useFetch('/api/guilds', {
  query: computed(() => ({ from: from.value, to: to.value })),
  watch: [from, to],
});

const totalJoined = computed(() => (data.value?.timeSeries ?? []).reduce((sum, p) => sum + p.joined, 0));
const totalLeft = computed(() => (data.value?.timeSeries ?? []).reduce((sum, p) => sum + p.left, 0));

const chartData = computed(() => {
  const ts = data.value?.timeSeries ?? [];
  return {
    labels: ts.map(p => new Date(p.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'Total',
        data: ts.map(p => p.total),
        borderColor: '#5b8dee',
        backgroundColor: 'rgba(91,141,238,0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Joined',
        data: ts.map(p => p.joined),
        borderColor: '#43c59e',
        tension: 0.3,
      },
      {
        label: 'Left',
        data: ts.map(p => p.left),
        borderColor: '#e05252',
        tension: 0.3,
      },
    ],
  };
});
</script>

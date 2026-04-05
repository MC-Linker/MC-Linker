<template>
  <div class="chart-container">
    <Doughnut :data="data" :options="mergedOptions"/>
  </div>
</template>

<script lang="ts" setup>
import { Doughnut } from 'vue-chartjs';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps<{
  data: object;
  options?: object;
}>();

const mergedOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right' as const, labels: { color: '#b0b8c8', padding: 12 } },
    tooltip: { intersect: true },
  },
  ...props.options,
}));
</script>

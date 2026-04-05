<template>
  <div class="chart-container">
    <Bar :data="data" :options="mergedOptions"/>
  </div>
</template>

<script lang="ts" setup>
import { Bar } from 'vue-chartjs';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip, } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const props = defineProps<{
  data: object;
  options?: object;
  horizontal?: boolean;
}>();

const mergedOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: props.horizontal ? 'y' as const : 'x' as const,
  plugins: {
    legend: { labels: { color: '#b0b8c8', usePointStyle: true, pointStyle: 'line' } },
    tooltip: { mode: 'index' as const, intersect: false },
  },
  scales: {
    x: { ticks: { color: '#b0b8c8' }, grid: { color: '#2a2f3a' } },
    y: { ticks: { color: '#b0b8c8' }, grid: { color: '#2a2f3a' }, beginAtZero: true },
  },
  ...props.options,
}));
</script>

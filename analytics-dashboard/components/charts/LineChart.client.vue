<template>
  <div class="chart-container">
    <Line :data="data" :options="mergedOptions"/>
  </div>
</template>

<script lang="ts" setup>
import { Line } from 'vue-chartjs';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const props = defineProps<{
  data: object;
  options?: object;
}>();

const mergedOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
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

<template>
  <div class="chart-container">
    <Doughnut ref="chartRef" :data="chartData" :options="mergedOptions" @click="handleClick"/>
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

const emit = defineEmits<{
  segmentClick: [index: number, label: string];
}>();

const chartRef = ref<InstanceType<typeof Doughnut> | null>(null);

const chartData = computed(() => {
  const source = props.data as any;
  const datasets = Array.isArray(source?.datasets)
      ? source.datasets.map((dataset: any) => {
        const backgroundColor = dataset.backgroundColor;
        const borderColor = Array.isArray(backgroundColor)
            ? [...backgroundColor]
            : backgroundColor;

        return {
          ...dataset,
          borderColor,
        };
      })
      : [];

  return {
    ...source,
    datasets,
  };
});

function handleClick(event: MouseEvent) {
  const chart = chartRef.value?.chart;
  if (!chart) return;
  const elements = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
  if (elements.length > 0) {
    const idx = elements[0].index;
    const label = (props.data as any).labels?.[idx] ?? '';
    emit('segmentClick', idx, label);
  }
}

const mergedOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: { color: '#b0b8c8', padding: 12, usePointStyle: true, pointStyle: 'line' }
    },
    tooltip: { intersect: true },
  },
  ...props.options,
}));
</script>

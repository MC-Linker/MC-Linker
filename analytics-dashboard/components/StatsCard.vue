<template>
  <div class="stats-card">
    <div class="stats-card-label">{{ label }}</div>
    <div class="stats-card-value">{{ formattedValue }}</div>
    <div v-if="sub" class="stats-card-sub">{{ sub }}</div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  label: string;
  value: number | string | null | undefined;
  format?: 'number' | 'percent' | 'ms' | 'mb' | 'raw';
  sub?: string;
}>();

const formattedValue = computed(() => {
  if (props.value == null) return '—';
  if (props.format === 'raw' || typeof props.value === 'string') return props.value;
  const n = Number(props.value);
  if (isNaN(n)) return '—';
  switch (props.format) {
    case 'percent':
      return `${n.toFixed(1)}%`;
    case 'ms':
      return `${n.toLocaleString()}ms`;
    case 'mb':
      return `${n.toFixed(1)} MB`;
    default:
      return n.toLocaleString();
  }
});
</script>

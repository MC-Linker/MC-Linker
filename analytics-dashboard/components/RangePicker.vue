<template>
  <div class="range-picker">
    <button v-for="preset in presets" :key="preset.label" :class="{ active: activePreset === preset.label }"
            class="btn-preset" @click="applyPreset(preset)">
      {{ preset.label }}
    </button>
    <input :value="from" class="form-control date-input" type="date" @change="onFrom"/>
    <span class="range-sep">–</span>
    <input :value="to" class="form-control date-input" type="date" @change="onTo"/>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{ from: string; to: string }>();
const emit = defineEmits<{ 'update:from': [string]; 'update:to': [string] }>();

const presets = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
];

const activePreset = ref('7d');

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function applyPreset(preset: { label: string; days: number }) {
  activePreset.value = preset.label;
  emit('update:from', isoDate(new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000)));
  emit('update:to', isoDate(new Date()));
}

function onFrom(e: Event) {
  activePreset.value = '';
  emit('update:from', (e.target as HTMLInputElement).value);
}

function onTo(e: Event) {
  activePreset.value = '';
  emit('update:to', (e.target as HTMLInputElement).value);
}
</script>

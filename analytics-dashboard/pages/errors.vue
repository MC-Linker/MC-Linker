<template>
  <div>
    <div class="page-header">
      <h1>Errors</h1>
      <div class="page-header-controls">
        <select v-model="typeFilter" class="form-control">
          <option value="">All types</option>
          <option value="command">command</option>
          <option value="component">component</option>
          <option value="api_rest">api_rest</option>
          <option value="api_ws">api_ws</option>
          <option value="unhandled">unhandled</option>
        </select>
        <RangePicker v-model:from="from" v-model:to="to" :min-date="minDates.errors"/>
        <button class="btn-ghost" type="button" @click="exportErrors">Export</button>
        <button class="btn-ghost" type="button" @click="clearConfirming = true">Clear</button>

        <Teleport to="body">
          <div v-if="clearConfirming" class="modal-backdrop" @click.self="clearConfirming = false">
            <div class="modal">
              <h3 class="modal-title">Clear errors?</h3>
              <p class="modal-body">This will permanently delete all matching errors. Make sure to export first — this
                cannot be undone.</p>
              <div v-if="clearError" class="error-msg modal-error">{{ clearError }}</div>
              <div class="modal-actions">
                <button class="btn-ghost" type="button" @click="clearConfirming = false">Cancel</button>
                <button :disabled="clearing" class="btn-clear" type="button" @click="confirmClear">
                  {{ clearing ? 'Clearing\u2026' : 'Confirm Clear' }}
                </button>
              </div>
            </div>
          </div>
        </Teleport>
      </div>
    </div>

    <div v-if="data?.groups?.length" class="card">
      <table class="data-table">
        <thead>
        <tr>
          <th></th>
          <th @click="toggleSort('type')">Type{{ sortIcon('type') }}</th>
          <th @click="toggleSort('name')">Name{{ sortIcon('name') }}</th>
          <th>Message</th>
          <th @click="toggleSort('count')">Occurrences{{ sortIcon('count') }}</th>
          <th @click="toggleSort('lastSeen')">Last Seen{{ sortIcon('lastSeen') }}</th>
        </tr>
        </thead>
        <tbody>
        <template v-for="(grp, idx) in sortedGroups" :key="idx">
          <tr :class="{ expanded: expanded.has(idx) }" class="error-row" @click="toggle(idx)">
            <td class="expand-cell">{{ expanded.has(idx) ? '▾' : '▸' }}</td>
            <td><span class="badge badge-danger">{{ grp.type ?? '—' }}</span></td>
            <td><code>{{ grp.name ?? '—' }}</code></td>
            <td class="error-message">{{ grp.message ?? '—' }}</td>
            <td>{{ grp.count.toLocaleString() }}</td>
            <td class="nowrap">{{ grp.lastSeen ? new Date(grp.lastSeen).toLocaleString() : '—' }}</td>
          </tr>
          <tr v-if="expanded.has(idx)" class="stack-row">
            <td colspan="6">
              <div class="group-expand">
                <pre class="stack-trace">{{ grp.stack ?? 'No stack trace available.' }}</pre>
                <table class="occurrence-table">
                  <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Guild ID</th>
                    <th>User ID</th>
                    <th>Shard</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="(occ, oi) in grp.occurrences" :key="oi">
                    <td class="nowrap">{{ new Date(occ.timestamp).toLocaleString() }}</td>
                    <td class="mono">{{ occ.guildId ?? '—' }}</td>
                    <td class="mono">{{ occ.userId ?? '—' }}</td>
                    <td>{{ occ.shardId ?? '—' }}</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        </template>
        </tbody>
      </table>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-if="fetchError" class="error-msg">{{ fetchError }}</div>
    <div v-if="clearError && !clearConfirming" class="error-msg">{{ clearError }}</div>
    <div v-if="!pending && !fetchError && !data?.groups?.length" class="empty">No errors in this range.</div>
  </div>
</template>

<script lang="ts" setup>
interface Occurrence {
  timestamp: string;
  guildId?: string;
  userId?: string;
  shardId?: number;
}

interface ErrorGroup {
  type?: string;
  name?: string;
  message?: string;
  count: number;
  lastSeen: string;
  stack?: string;
  occurrences: Occurrence[];
}

const minDates = useMinDates();

const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));
const typeFilter = ref('');
const expanded = ref(new Set<number>());
const clearConfirming = ref(false);
const clearing = ref(false);
const clearError = ref('');

watch([from, to, typeFilter], () => {
  clearConfirming.value = false;
});

function toggle(idx: number) {
  if (expanded.value.has(idx)) expanded.value.delete(idx);
  else expanded.value.add(idx);
  expanded.value = new Set(expanded.value);
}

const filterQuery = computed(() => ({
  from: from.value,
  to: to.value,
  ...(typeFilter.value ? { type: typeFilter.value } : {}),
}));

const { data, pending, error: fetchError, refresh } = await useFetch('/api/errors', {
  query: filterQuery,
  watch: [filterQuery],
});

const groupItems = computed(() => (data.value?.groups ?? []) as ErrorGroup[]);
const { toggleSort, sortIcon, sorted: sortedGroups } = useSortable(groupItems, 'count');

function exportErrors() {
  const params = new URLSearchParams(filterQuery.value as Record<string, string>);
  const a = document.createElement('a');
  a.href = `/api/errors/export?${params.toString()}`;
  a.download = `errors-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

async function confirmClear() {
  clearing.value = true;
  clearError.value = '';
  try {
    await $fetch('/api/errors', { method: 'DELETE', query: filterQuery.value });
    clearConfirming.value = false;
    expanded.value = new Set();
    await refresh();
  }
  catch (err: any) {
    clearError.value = err?.data?.message ?? err?.message ?? 'Failed to clear errors';
  }
  finally {
    clearing.value = false;
  }
}
</script>

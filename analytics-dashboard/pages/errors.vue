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
        <RangePicker v-model:from="from" v-model:to="to"/>
      </div>
    </div>

    <div v-if="data?.errors?.length" class="card">
      <table class="data-table">
        <thead>
        <tr>
          <th></th>
          <th @click="toggleSort('timestamp')">Timestamp{{ sortIcon('timestamp') }}</th>
          <th @click="toggleSort('type')">Type{{ sortIcon('type') }}</th>
          <th @click="toggleSort('name')">Name{{ sortIcon('name') }}</th>
          <th @click="toggleSort('guildId')">Guild{{ sortIcon('guildId') }}</th>
          <th @click="toggleSort('shardId')">Shard{{ sortIcon('shardId') }}</th>
          <th>Message</th>
        </tr>
        </thead>
        <tbody>
        <template v-for="err in sortedErrors" :key="err._id">
          <tr :class="{ expanded: expanded.has(err._id) }" class="error-row" @click="toggle(err._id)">
            <td class="expand-cell">{{ expanded.has(err._id) ? '▾' : '▸' }}</td>
            <td class="nowrap">{{ new Date(err.timestamp).toLocaleString() }}</td>
            <td><span class="badge badge-danger">{{ err.type }}</span></td>
            <td><code>{{ err.name ?? '—' }}</code></td>
            <td class="mono">{{ err.guildId ?? '—' }}</td>
            <td>{{ err.shardId ?? '—' }}</td>
            <td>{{ err.error?.message ?? '—' }}</td>
          </tr>
          <tr v-if="expanded.has(err._id)" class="stack-row">
            <td colspan="7">
              <pre class="stack-trace">{{ err.error?.stack ?? 'No stack trace available.' }}</pre>
            </td>
          </tr>
        </template>
        </tbody>
      </table>
    </div>

    <div v-if="data?.pagination" class="pagination">
      <button :disabled="page <= 1" class="btn-page" @click="page--">&#8592; Prev</button>
      <span>Page {{ page }} / {{ data.pagination.pages || 1 }}</span>
      <button :disabled="page >= (data.pagination.pages || 1)" class="btn-page" @click="page++">Next &#8594;</button>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <div v-if="!pending && !data?.errors?.length" class="empty">No errors in this range.</div>
  </div>
</template>

<script lang="ts" setup>
const from = ref(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const to = ref(new Date().toISOString().slice(0, 10));
const typeFilter = ref('');
const page = ref(1);
const expanded = ref(new Set<string>());

watch([from, to, typeFilter], () => {
  page.value = 1;
});

function toggle(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id);
  else expanded.value.add(id);
  expanded.value = new Set(expanded.value); // trigger reactivity
}

const { data, pending, error } = await useFetch('/api/errors', {
  query: computed(() => ({
    from: from.value,
    to: to.value,
    page: page.value,
    limit: 50,
    ...(typeFilter.value ? { type: typeFilter.value } : {}),
  })),
  watch: [from, to, typeFilter, page],
});

const errorItems = computed(() => data.value?.errors ?? []);
const { toggleSort, sortIcon, sorted: sortedErrors } = useSortable(errorItems);
</script>

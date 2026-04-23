<template>
  <div>
    <div class="page-header logs-header">
      <h1>Logs</h1>
      <div class="log-header-actions">
        <button
            :class="['btn-ghost', { 'btn-live-active': live } ]"
            type="button"
            @click="toggleLive"
        >
          <span v-if="live" class="live-indicator"></span>
          {{ live ? 'Stop Live Tail' : 'Start Live Tail' }}
        </button>
      </div>
    </div>

    <div class="card log-controls">
      <div class="log-controls-grid">
        <label class="form-group">
          <span>File</span>
          <select v-model="selectedFile" class="form-control">
            <option v-for="file in files" :key="file.file" :value="file.file">{{ file.file }}</option>
          </select>
        </label>

        <label class="form-group">
          <span>Levels (CSV)</span>
          <input v-model="levelsText" class="form-control" placeholder="error,warn,info">
        </label>

        <label class="form-group">
          <span>Feature Prefix</span>
          <input v-model="feature" class="form-control" placeholder="api.events">
        </label>

        <label class="form-group">
          <span>Guild ID</span>
          <input v-model="guildId" class="form-control" placeholder="1234567890">
        </label>

        <label class="form-group">
          <span>User ID</span>
          <input v-model="userId" class="form-control" placeholder="1234567890">
        </label>

        <label class="form-group">
          <span>Shard ID</span>
          <input v-model="shardId" class="form-control" placeholder="0">
        </label>

        <label class="form-group log-controls-search">
          <span>Search</span>
          <input v-model="search" class="form-control" placeholder="Message text or JSON field">
        </label>
      </div>

      <div class="log-controls-actions">
        <button class="btn-primary" type="button" @click="reload">Apply Filters</button>
        <button class="btn-ghost" type="button" @click="toggleView">
          {{ rawView ? 'Pretty View' : 'Raw JSON View' }}
        </button>
      </div>
    </div>

    <div class="card log-card">
      <div class="log-meta-row">
        <div class="log-meta-item">Entries: {{ entries.length }}</div>
        <div class="log-meta-item">File: {{ selectedFile || '—' }}</div>
      </div>

      <div ref="logsContainer" class="log-list" @scroll="onScroll">
        <div v-if="pending && entries.length === 0" class="loading">Loading logs…</div>
        <div v-else-if="entries.length === 0" class="empty">No log entries match the current filters.</div>

        <template v-for="entry in entries" :key="entry.id">
          <article class="log-entry" @click="toggleExpand(entry.id)">
            <header class="log-entry-head">
              <span class="timestamp">{{ formatTimestamp(entry.data.time ?? entry.data.timestamp) }}</span>
              <span :class="['badge', levelClass(entry.level)]">{{ entry.level }}</span>
              <span class="log-pretty-prefix">{{ prettyPrefix(entry.data) }}</span>
            </header>

            <pre v-if="rawView" class="log-line log-raw">{{ formatRaw(entry.data) }}</pre>
            <pre v-else class="log-line log-pretty">{{ prettyLine(entry.data) }}</pre>
          </article>

          <div v-if="expanded.has(entry.id)" class="log-expand">
            <div class="log-expand-meta">
              <span class="log-chip">guild: {{ displayField(entry.data.guildId) }}</span>
              <span class="log-chip">user: {{ displayField(entry.data.userId) }}</span>
              <span class="log-chip">shard: {{ displayField(entry.data.shardId) }}</span>
              <span class="log-chip">feature: {{ displayField(entry.data.feature) }}</span>
            </div>
            <pre class="log-json" v-html="highlightJson(entry.data)"></pre>
          </div>
        </template>
      </div>

      <div class="log-footer-actions">
        <button :disabled="pending || !selectedFile" class="btn-page" type="button" @click="reload">
          Refresh
        </button>
      </div>
    </div>

    <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>
  </div>
</template>

<script lang="ts" setup>
interface LogFileItem {
  file: string;
  size: number;
  mtime: string;
}

interface LogData {
  time?: string;
  timestamp?: string;
  level?: number | string;
  msg?: string;
  message?: string;
  feature?: string;
  shardId?: number;
  guildId?: string;
  userId?: string;

  [key: string]: unknown;
}

interface LogEntryView {
  id: string;
  level: string;
  data: LogData;
}

const files = ref<LogFileItem[]>([]);
const selectedFile = ref('');
const levelsText = ref('');
const feature = ref('');
const guildId = ref('');
const userId = ref('');
const shardId = ref('');
const search = ref('');
const rawView = ref(false);
const live = ref(false);
const entries = ref<LogEntryView[]>([]);
const expanded = ref(new Set<string>());
const pending = ref(false);
const errorMessage = ref('');
const logsContainer = ref<HTMLElement | null>(null);
const autoScroll = ref(true);

let eventSource: EventSource | null = null;

function normalizeLevel(level: number | string | undefined): string {
  if (typeof level === 'string') return level.toLowerCase();
  if (level === 10) return 'trace';
  if (level === 20) return 'debug';
  if (level === 30) return 'info';
  if (level === 40) return 'warn';
  if (level === 50) return 'error';
  if (level === 60) return 'fatal';
  return String(level ?? 'info');
}

function toEntry(log: LogData): LogEntryView {
  const ts = String(log.time ?? log.timestamp ?? Date.now());
  const msg = String(log.msg ?? log.message ?? '');
  const level = normalizeLevel(log.level);
  const id = `${ts}-${level}-${msg.slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    level,
    data: log,
  };
}

async function loadFiles() {
  const result = await $fetch<{ files: LogFileItem[] }>('/api/logs/files');
  files.value = result.files;
  if (!selectedFile.value && files.value.length > 0) {
    selectedFile.value = files.value[0].file;
  }
}

function queryParams() {
  return {
    file: selectedFile.value,
    direction: 'backward',
    limit: 500,
    ...(levelsText.value.trim() ? { level: levelsText.value.trim() } : {}),
    ...(feature.value.trim() ? { feature: feature.value.trim() } : {}),
    ...(guildId.value.trim() ? { guildId: guildId.value.trim() } : {}),
    ...(userId.value.trim() ? { userId: userId.value.trim() } : {}),
    ...(shardId.value.trim() ? { shardId: shardId.value.trim() } : {}),
    ...(search.value.trim() ? { search: search.value.trim() } : {}),
  };
}

async function reload() {
  if (!selectedFile.value) return;

  pending.value = true;
  errorMessage.value = '';

  try {
    const result = await $fetch<{ lines: LogData[] }>('/api/logs/content', {
      query: queryParams(),
    });

    entries.value = result.lines.map(toEntry);
    expanded.value = new Set<string>();
    await nextTick();
    scrollToBottom();
  }
  catch (err: any) {
    errorMessage.value = err?.data?.message ?? err?.message ?? 'Failed to load logs';
  }
  finally {
    pending.value = false;
  }
}

function levelClass(level: string): string {
  return `badge-${level}`;
}

function prettyPrefix(log: LogData): string {
  const parts: string[] = [];
  const featureValue = typeof log.feature === 'string' ? log.feature : '';

  if (featureValue) {
    const featurePrefix = featureValue
        .split('.')
        .map(part => `[${part.charAt(0).toUpperCase()}${part.slice(1)}]`)
        .join('');
    parts.push(featurePrefix);
  }

  if (log.shardId !== undefined && log.shardId !== null) {
    parts.push(`[${log.shardId}]`);
  }

  return parts.join(' ');
}

function prettyLine(log: LogData): string {
  const prefix = prettyPrefix(log);
  const msg = String(log.msg ?? log.message ?? '(no message)');
  return prefix ? `${prefix} ${msg}` : msg;
}

function formatRaw(log: LogData): string {
  return JSON.stringify(log, null, 2);
}

function formatTimestamp(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function displayField(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function toggleView() {
  rawView.value = !rawView.value;
}

function toggleExpand(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id);
  else expanded.value.add(id);
  expanded.value = new Set(expanded.value);
}

function escapeHtml(input: string): string {
  return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
}

function highlightJson(obj: unknown): string {
  const json = escapeHtml(JSON.stringify(obj, null, 2));
  return json
      .replace(/&quot;([^&]+?)&quot;:/g, '<span class="json-key">"$1"</span>:')
      .replace(/: &quot;(.+?)&quot;/g, ': <span class="json-string">"$1"</span>')
      .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/: (\d+(?:\.\d+)?)/g, ': <span class="json-number">$1</span>');
}

function stopLive() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  live.value = false;
}

function startLive() {
  if (!selectedFile.value) return;

  stopLive();
  const query = new URLSearchParams({
    file: selectedFile.value,
    ...(levelsText.value.trim() ? { level: levelsText.value.trim() } : {}),
    ...(feature.value.trim() ? { feature: feature.value.trim() } : {}),
    ...(guildId.value.trim() ? { guildId: guildId.value.trim() } : {}),
    ...(userId.value.trim() ? { userId: userId.value.trim() } : {}),
    ...(shardId.value.trim() ? { shardId: shardId.value.trim() } : {}),
    ...(search.value.trim() ? { search: search.value.trim() } : {}),
  });

  eventSource = new EventSource(`/api/logs/stream?${query.toString()}`);
  eventSource.addEventListener('log', event => {
    const payload = JSON.parse((event as MessageEvent).data) as { file: string; entry: LogData };
    if (payload.file !== selectedFile.value) {
      selectedFile.value = payload.file;
      entries.value = [];
    }

    entries.value.push(toEntry(payload.entry));
    if (entries.value.length > 1000) {
      entries.value = entries.value.slice(entries.value.length - 1000);
    }

    if (autoScroll.value) {
      nextTick().then(scrollToBottom);
    }
  });

  eventSource.addEventListener('meta', event => {
    const payload = JSON.parse((event as MessageEvent).data) as { file?: string };
    if (payload.file && payload.file !== selectedFile.value) {
      selectedFile.value = payload.file;
      entries.value = [];
    }
  });

  eventSource.onerror = () => {
    errorMessage.value = 'Live stream disconnected';
    stopLive();
  };

  live.value = true;
}

function toggleLive() {
  if (live.value) {
    stopLive();
    return;
  }
  startLive();
}

function scrollToBottom() {
  const node = logsContainer.value;
  if (!node) return;
  node.scrollTop = node.scrollHeight;
}

function onScroll() {
  const node = logsContainer.value;
  if (!node) return;
  const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
  autoScroll.value = distanceToBottom < 16;
}

watch(selectedFile, async () => {
  stopLive();
  await reload();
});

watch([levelsText, feature, guildId, userId, shardId, search], () => {
  if (live.value) {
    startLive();
  }
});

onMounted(async () => {
  await loadFiles();
  await reload();

  window.addEventListener('keydown', onKeyDown);
});

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    stopLive();
  }
}

onBeforeUnmount(() => {
  stopLive();
  window.removeEventListener('keydown', onKeyDown);
});
</script>

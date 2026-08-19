<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">MC-Linker Analytics</h1>

      <form @submit.prevent="submit">
        <div class="form-group">
          <label>Database</label>
          <select v-model="selectedDb" class="form-control" required>
            <option v-for="db in databases" :key="db" :value="db">{{ db }}</option>
            <option v-if="!databases.length" disabled value="">Loading...</option>
          </select>
        </div>

        <div class="form-group">
          <label>Password</label>
          <input v-model="password" autocomplete="current-password" class="form-control"
                 placeholder="Dashboard password" required
                 type="password"/>
        </div>

        <p v-if="error" class="login-error">{{ error }}</p>

        <button :disabled="loading" class="btn-primary" type="submit">
          {{ loading ? 'Logging in…' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ layout: false });

const { data: dbData } = await useFetch('/api/databases');
const databases = computed(() => dbData.value?.databases ?? []);

const selectedDb = ref(databases.value[0] ?? '');
const password = ref('');
const error = ref('');
const loading = ref(false);

watch(databases, dbs => {
  if (!selectedDb.value && dbs.length) selectedDb.value = dbs[0];
});

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { password: password.value, db: selectedDb.value },
    });

    // The login can succeed while the browser drops the cookie (e.g. Secure on a plain-HTTP origin)
    if (!document.cookie.split('; ').some(c => c.startsWith('session='))) {
      error.value = 'Login succeeded, but your browser did not store the session cookie. '
          + 'Check that cookies are enabled for this site.';
      return;
    }

    await navigateTo('/');
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message ?? 'Login failed';
  }
  finally {
    loading.value = false;
  }
}
</script>

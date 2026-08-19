<template>
  <div :class="{ 'sidebar-open': isOpen }" class="app-layout">
    <header class="mobile-topbar">
      <button aria-controls="app-sidebar" :aria-expanded="isOpen" aria-label="Toggle navigation"
              class="menu-toggle" type="button" @click="toggle">
        <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" stroke-linecap="round"
             stroke-width="2" viewBox="0 0 24 24" width="22">
          <path d="M3 6h18M3 12h18M3 18h18"/>
        </svg>
      </button>
      <span class="mobile-topbar-title">MC-Linker Analytics</span>
    </header>

    <div class="sidebar-backdrop" @click="close"/>

    <AppNavbar/>

    <main class="main-content">
      <slot/>
    </main>
  </div>
</template>

<script lang="ts" setup>
const { isOpen, close, toggle } = useSidebar();
const route = useRoute();

watch(() => route.fullPath, close);

// Stop the page behind the drawer from scrolling while it is open
watch(isOpen, open => document.body.classList.toggle('no-scroll', open));

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

onMounted(() => window.addEventListener('keydown', onKeydown));

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.classList.remove('no-scroll');
});
</script>

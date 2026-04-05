export default defineNuxtConfig({
    ssr: true,
    runtimeConfig: {
        // Server-only (not exposed to browser).
        // NUXT_DATABASE_URL / NUXT_DASHBOARD_PASSWORD / NUXT_SESSION_SECRET override at runtime.
        databaseUrl: '',
        dashboardPassword: '',
        sessionSecret: '',
    },
    app: {
        head: {
            title: 'MC-Linker Analytics',
            meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
        },
    },
    css: ['~/assets/css/main.css'],
});

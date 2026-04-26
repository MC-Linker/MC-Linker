export default defineNuxtRouteMiddleware(to => {
    if (to.path === '/login') return;
    const token = useCookie('session');
    if (!token.value) return navigateTo('/login');
});

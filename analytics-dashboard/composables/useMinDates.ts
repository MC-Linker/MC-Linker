export function useMinDates() {
    const { data } = useFetch('/api/min-dates', {
        default: () => ({ snapshots: null as string | null, errors: null as string | null }),
    });

    const snapshots = computed(() => data.value?.snapshots ?? null);
    const errors = computed(() => data.value?.errors ?? null);

    return { snapshots, errors };
}

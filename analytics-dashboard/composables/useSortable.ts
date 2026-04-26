export function useSortable<T extends Record<string, any>>(
    items: Ref<T[]> | ComputedRef<T[]>,
    defaultKey?: string,
    defaultDir: 'asc' | 'desc' = 'desc',
) {
    const sortKey = ref<string | null>(defaultKey ?? null);
    const sortDir = ref<'asc' | 'desc'>(defaultDir);

    function toggleSort(key: string) {
        if (sortKey.value === key) {
            sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
        }
        else {
            sortKey.value = key;
            sortDir.value = 'desc';
        }
    }

    function sortIcon(key: string): string {
        if (sortKey.value !== key) return '';
        return sortDir.value === 'asc' ? ' ▲' : ' ▼';
    }

    const sorted = computed(() => {
        const arr = unref(items);
        if (!arr?.length || !sortKey.value) return arr ?? [];
        const key = sortKey.value;
        return [...arr].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortDir.value === 'asc' ? cmp : -cmp;
        });
    });

    return { sortKey, sortDir, toggleSort, sortIcon, sorted };
}

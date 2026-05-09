export function useMinDates() {
    const { data } = useFetch('/api/min-dates', {
        default: () => ({ snapshots: null as string | null, errors: null as string | null }),
    });

    return data;
}

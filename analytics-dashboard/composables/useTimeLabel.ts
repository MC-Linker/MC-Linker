/**
 * Returns a label formatter for time-series charts.
 * ≤ 72 data points (≤ 3 days of hourly data): "Jan 4 14:00"
 * > 72 data points: "Jan 4"
 */
export function formatTimeLabel(timestamp: string | Date, totalPoints: number): string {
    const d = new Date(timestamp);
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (totalPoints <= 72) {
        const h = d.getHours().toString().padStart(2, '0');
        return `${date} ${h}:00`;
    }
    return date;
}

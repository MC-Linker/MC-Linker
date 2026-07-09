import fs from 'fs-extra';
import path from 'path';
import v8 from 'v8';
import rootLogger from '../utilities/logger/Logger.js';
import features from '../utilities/logger/features.js';

const logger = rootLogger.child({ feature: features.structures.heapMonitor });

/**
 * Per-shard heap memory monitor that captures snapshots when OOM spikes are imminent.
 */
export default class HeapMonitor {

    static THROTTLE_SNAPSHOT_MS = 21600000; // 6 hours

    /**
     * @param {number} [heapPressureThresholdPercent=85] - Trigger snapshot when heap reaches this %
     * @param {string} [snapshotDir='./heaps'] - Directory to store heap snapshots
     */
    constructor(heapPressureThresholdPercent = 85, snapshotDir = './heaps') {
        this._thresholdPercent = heapPressureThresholdPercent;
        this._snapshotDir = snapshotDir;
        this._lastSnapshotMs = 0; // Initialize to 0 so first snapshot captures immediately
        this._monitorInterval = null;

        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        const heapPressure = (memUsage.heapUsed / heapStats.heap_size_limit) * 100;

        logger.info(
            {
                heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
                heapPressurePercent: Math.round(heapPressure * 10) / 10,
            },
            'Initializing HeapMonitor'
        );

        // Hook memory warning (fires when heap reaches ~90%)
        if(v8.writeHeapSnapshot) {
            process.on('warning', warning => {
                if(warning.name === 'MaxListenersExceededWarning') return;
                logger.warn({ warning: warning.message }, 'Process warning');
            });
        }

        // Check heap pressure periodically
        this._monitorInterval = setInterval(() => this._checkHeapPressure(), 5000);
        this._monitorInterval.unref();
    }

    /**
     * Capture a heap snapshot to disk (file named by timestamp).
     * @returns {string|null} - Path to snapshot file, or null on error
     */
    captureSnapshot() {
        if(!v8.writeHeapSnapshot) {
            logger.error('v8.writeHeapSnapshot not available');
            return null;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const snapshotPath = path.join(this._snapshotDir, `heap-${timestamp}.heapsnapshot`);
            const file = fs.createWriteStream(snapshotPath);
            v8.writeHeapSnapshot(file);
            logger.info({ path: snapshotPath }, 'Captured heap snapshot');
            return snapshotPath;
        }
        catch(err) {
            logger.error(err, 'Failed to capture heap snapshot');
            return null;
        }
    }

    /**
     * Check heap pressure and capture snapshot if threshold exceeded.
     * First capture is immediate; subsequent captures throttled to one per 6 hours.
     * @private
     */
    _checkHeapPressure() {
        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        const heapPressure = (memUsage.heapUsed / heapStats.heap_size_limit) * 100;
        const now = Date.now();

        if(heapPressure > this._thresholdPercent) {
            const timeSinceLastSnapshot = now - this._lastSnapshotMs;
            if(timeSinceLastSnapshot > HeapMonitor.THROTTLE_SNAPSHOT_MS) {
                logger.warn(
                    {
                        heapPressurePercent: Math.round(heapPressure * 10) / 10,
                        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                        heapLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
                    },
                    'High heap pressure—capturing snapshot'
                );
                this.captureSnapshot();
                this._lastSnapshotMs = now;
            }
        }
    }

    /**
     * Clean up the monitor interval. Call during shutdown.
     */
    destroy() {
        clearInterval(this._monitorInterval);
    }
}

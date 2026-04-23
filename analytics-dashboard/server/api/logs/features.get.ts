import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { verifySession } from '../../utils/auth';

function flattenFeatures(obj: Record<string, unknown>, prefix = ''): string[] {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);
        if (value !== null && typeof value === 'object') {
            paths.push(...flattenFeatures(value as Record<string, unknown>, path));
        }
    }
    return paths;
}

export default defineEventHandler(async event => {
    await verifySession(event);

    const config = useRuntimeConfig();
    const featuresPath = resolve(config.logFeaturesPath || './logFeatures.json');

    try {
        const raw = await readFile(featuresPath, 'utf-8');
        const json = JSON.parse(raw) as Record<string, unknown>;
        return { features: flattenFeatures(json) };
    }
    catch {
        return { features: [] };
    }
});

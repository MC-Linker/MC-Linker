import featuresJson from '../../resources/logFeatures.json' with { type: 'json' };

const pathSymbol = Symbol('feature path');

function createFeatureProxy(paths) {
    let features = getFeatureFromPath(paths);
    if(features === undefined) features = null; // treat missing keys as leaf nodes
    if(typeof features !== 'object') return features;

    return new Proxy(features !== null ? features : {}, {
        get(target, key) {
            if(key === pathSymbol) return paths;
            if(key === Symbol.toPrimitive || key === 'toString' || key === 'valueOf') {
                return () => paths.join('.');
            }

            return createFeatureProxy([...paths, key]);
        },
    });
}

function getFeatureFromPath(paths) {
    let key = featuresJson;
    for(const path of paths) key = key[path];
    return key;
}

/**
 * Hierarchical feature name registry backed by resources/logFeatures.json.
 * Access any path to get its dotted string: features.api.socketio.chat → 'api.socketio.chat'.
 * Used as the `feature` binding when creating pino child loggers.
 * @example
 * const logger = rootLogger.child({ feature: features.api.socketio.chat });
 */
const features = createFeatureProxy([]);

export default features;

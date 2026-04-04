import dotenv from 'dotenv';
import mongoose, { Schema } from 'mongoose';
import Schemas from '../resources/schemas.js';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs-extra';

dotenv.config();

const COLLECTIONS = {
    snapshots: 'AnalyticsSnapshot',
    errors: 'AnalyticsError',
};

async function connectDB() {
    const mongo = await mongoose.connect(process.env.DATABASE_URL);
    for(const [name, schema] of Object.entries(Schemas))
        mongo.model(name, new Schema(schema));
    return mongo;
}

async function stats() {
    const mongo = await connectDB();

    for(const [alias, modelName] of Object.entries(COLLECTIONS)) {
        const model = mongo.models[modelName];
        const count = await model.countDocuments();
        const stats = await model.collection.stats().catch(() => null);
        const sizeMB = stats ? (stats.size / 1024 / 1024).toFixed(2) : 'N/A';
        const indexSizeMB = stats ? (stats.totalIndexSize / 1024 / 1024).toFixed(2) : 'N/A';
        console.log(`\n${alias} (${modelName}):`);
        console.log(`  Documents: ${count}`);
        console.log(`  Data size: ${sizeMB} MB`);
        console.log(`  Index size: ${indexSizeMB} MB`);

        if(modelName === 'AnalyticsSnapshot' && count > 0) {
            const oldest = await model.findOne().sort({ timestamp: 1 }).select('timestamp').lean();
            const newest = await model.findOne().sort({ timestamp: -1 }).select('timestamp').lean();
            console.log(`  Oldest: ${oldest?.timestamp?.toISOString() ?? 'N/A'}`);
            console.log(`  Newest: ${newest?.timestamp?.toISOString() ?? 'N/A'}`);
        }
    }

    await mongoose.disconnect();
}

async function exportData(argv) {
    const modelName = COLLECTIONS[argv.collection];
    if(!modelName) {
        console.error(`Unknown collection: ${argv.collection}. Use: ${Object.keys(COLLECTIONS).join(', ')}`);
        process.exit(1);
    }

    const mongo = await connectDB();
    const model = mongo.models[modelName];

    const query = {};
    if(argv.from || argv.to) {
        query.timestamp = {};
        if(argv.from) query.timestamp.$gte = new Date(argv.from);
        if(argv.to) query.timestamp.$lte = new Date(argv.to);
    }

    const docs = await model.find(query).sort({ timestamp: -1 }).lean();
    console.log(`Found ${docs.length} documents`);

    const output = argv.out;
    await fs.outputJson(output, docs, { spaces: 2 });
    console.log(`Exported to ${output}`);

    await mongoose.disconnect();
}

async function clearData(argv) {
    const modelName = COLLECTIONS[argv.collection];
    if(!modelName) {
        console.error(`Unknown collection: ${argv.collection}. Use: ${Object.keys(COLLECTIONS).join(', ')}`);
        process.exit(1);
    }

    const mongo = await connectDB();
    const model = mongo.models[modelName];

    const query = {};
    if(argv.before) {
        query.timestamp = { $lt: new Date(argv.before) };
    }

    const count = await model.countDocuments(query);
    const description = argv.before ? `before ${argv.before}` : 'ALL';

    if(!argv.confirm) {
        console.log(`\nDry run — would delete ${count} documents from ${argv.collection} (${description})`);
        console.log('Rerun with --confirm to execute the deletion.');
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Deleting ${count} documents from ${argv.collection} (${description})...`);
    const result = await model.deleteMany(query);
    console.log(`Deleted ${result.deletedCount} documents.`);

    await mongoose.disconnect();
}

await yargs(hideBin(process.argv))
    .command({
        command: 'stats',
        describe: 'Show document counts and storage sizes for analytics collections.',
        handler: () => stats(),
    })
    .command({
        command: 'export',
        describe: 'Export analytics data to a JSON file.',
        builder: {
            collection: {
                type: 'string',
                alias: 'c',
                demandOption: true,
                choices: Object.keys(COLLECTIONS),
                description: 'Collection to export.',
            },
            out: {
                type: 'string',
                alias: 'o',
                demandOption: true,
                description: 'Output file path.',
            },
            from: {
                type: 'string',
                description: 'Start date filter (ISO format).',
            },
            to: {
                type: 'string',
                description: 'End date filter (ISO format).',
            },
        },
        handler: argv => exportData(argv),
    })
    .command({
        command: 'clear',
        describe: 'Delete analytics data. Requires --confirm to execute.',
        builder: {
            collection: {
                type: 'string',
                alias: 'c',
                demandOption: true,
                choices: Object.keys(COLLECTIONS),
                description: 'Collection to clear.',
            },
            before: {
                type: 'string',
                description: 'Only delete documents before this date (ISO format). Deletes all if omitted.',
            },
            confirm: {
                type: 'boolean',
                default: false,
                description: 'Actually perform the deletion (without this flag, only a dry run is shown).',
            },
        },
        handler: argv => clearData(argv),
    })
    .demandCommand(1, 'Please specify a command: stats, export, or clear')
    .strict()
    .help()
    .parse();

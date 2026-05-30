/**
 * One-shot migration: convert the legacy globally-keyed UserConnection collection to the new
 * composite-keyed model with `scope` ('global' | <serverId>) and `premium` boolean.
 *
 * - Documents whose stored uuid matches createUUIDv3(username) are legacy offline-v3 rows that
 *   were never globally-unique-safe → delete. Affected users will simply re-verify.
 * - Surviving rows are rewritten with `_id = "${discordId}:global"`, `discordId`, `scope='global'`,
 *   `premium=true` (Mojang and Floodgate UUIDs both qualify as authoritative globally-unique).
 * - The legacy unique index on `uuid` is dropped and replaced with a compound unique index on
 *   `{ scope, uuid }`.
 *
 * Run with:
 *   node scripts/migrateUserConnections.js
 *
 * Reads DATABASE_URL and DATABASE_NAME from the environment (same as the bot).
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';

function addHyphen(uuid) {
    if(uuid.length !== 32) return uuid;
    const arr = [...uuid];
    for(let i = 8; i <= 23; i += 5) arr.splice(i, 0, '-');
    return arr.join('');
}

function createUUIDv3(username) {
    const hash = crypto.createHash('md5');
    hash.update(`OfflinePlayer:${username}`);
    const digest = hash.digest();
    digest[6] = digest[6] & 0x0f | 0x30;
    digest[8] = digest[8] & 0x3f | 0x80;
    return addHyphen(digest.toString('hex'));
}

async function main() {
    const url = process.env.DATABASE_URL;
    const dbName = process.env.DATABASE_NAME;
    if(!url || !dbName) {
        console.error('DATABASE_URL and DATABASE_NAME must be set.');
        process.exit(1);
    }

    const connection = await mongoose.connect(`${url}/${dbName}`);
    const collection = connection.connection.db.collection('userconnections');

    const docs = await collection.find({}).toArray();
    console.log(`Found ${docs.length} UserConnection docs.`);

    let deleted = 0;
    let migrated = 0;
    let skipped = 0;

    for(const doc of docs) {
        // Already migrated rows have `discordId` + `scope` set.
        if(doc.discordId && doc.scope) {
            skipped++;
            continue;
        }
        if(!doc.username || !doc.uuid) {
            skipped++;
            continue;
        }

        const expectedV3 = createUUIDv3(doc.username);
        if(doc.uuid === expectedV3) {
            await collection.deleteOne({ _id: doc._id });
            deleted++;
            continue;
        }

        const discordId = doc._id;
        const newId = `${discordId}:global`;

        // If a composite-id row for this user already exists (e.g. the bot started up with the new code at some point
        // and created the global link via /account connect), don't try to insert a duplicate — just remove the legacy
        // row and treat it as migrated. The existing composite row takes precedence.
        const existing = await collection.findOne({ _id: newId });
        if(existing) {
            await collection.deleteOne({ _id: discordId });
            migrated++;
            continue;
        }

        await collection.deleteOne({ _id: discordId });
        await collection.insertOne({
            _id: newId,
            discordId,
            scope: 'global',
            uuid: doc.uuid,
            username: doc.username,
            premium: true,
            ...(doc.userSettings ? { userSettings: doc.userSettings } : {}),
            ...(doc.customBot ? { customBot: doc.customBot } : {}),
        });
        migrated++;
    }

    console.log(`Migration complete: ${migrated} migrated, ${deleted} deleted (legacy offline), ${skipped} skipped.`);

    // Drop legacy unique index on uuid (if present), create new compound index.
    try {
        await collection.dropIndex('uuid_1');
        console.log('Dropped legacy uuid_1 unique index.');
    }
    catch(err) {
        if(err.codeName !== 'IndexNotFound') console.warn('Could not drop uuid_1:', err.message);
    }

    await collection.createIndex({ scope: 1, uuid: 1 }, { unique: true });
    await collection.createIndex({ discordId: 1 });
    console.log('Created compound unique { scope, uuid } and { discordId } indexes.');

    await connection.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

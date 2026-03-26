import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();


const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const WEBHOOK_COUNT = Number(process.env.WEBHOOK_COUNT ?? 1);
const MESSAGE_COUNT = Number(process.env.MESSAGE_COUNT ?? 100);
const SEND_RATE = Number(process.env.SEND_RATE ?? 0);

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    rest: {
        rejectOnRateLimit: info => console.log(`rejectOnRateLimit: ${info}`),
    },
});

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function getOrCreateWebhooks(channel, count) {

    const existing = await channel.fetchWebhooks();
    const usable = [];

    for(const [, webhook] of existing) {
        if(webhook.token) usable.push(webhook);
    }

    while(usable.length < count) {
        const webhook = await channel.createWebhook({
            name: `benchmark-${usable.length + 1}`,
        });

        usable.push(webhook);
    }

    return usable.slice(0, count);
}

async function runBenchmark(webhooks) {
    const latencies = [];

    const startTotal = performance.now();

    console.log(`\n=== BENCHMARK START ===`);
    console.log(`messages: ${MESSAGE_COUNT}`);
    console.log(`webhooks: ${webhooks.length}`);
    console.log(`rate: ${SEND_RATE === 0 ? 'unlimited' : SEND_RATE + '/sec'}`);
    console.log('');

    const delay = SEND_RATE > 0 ? 1000 / SEND_RATE : 0;

    for(let i = 0; i < MESSAGE_COUNT; i++) {

        if(delay > 0) {
            await sleep(delay);
        }

        const webhook = webhooks[i % webhooks.length];

        await (async () => {

            const start = performance.now();

            await webhook.send({
                content: `benchmark ${i}`,
            });

            const end = performance.now();
            const latency = end - start;

            latencies.push(latency);

            console.log(`sent ${i} (${latency}ms)`);
        })();
    }

    const totalTime = performance.now() - startTotal;

    const avg =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;

    const min = Math.min(...latencies);
    const max = Math.max(...latencies);

    console.log(`\n=== RESULTS ===`);

    console.log(`total messages: ${latencies.length}`);
    console.log(`total time: ${(totalTime / 1000).toFixed(2)} s`);
    console.log(`throughput: ${(latencies.length / (totalTime / 1000)).toFixed(2)} msg/sec`);

    console.log(`avg latency: ${avg.toFixed(2)} ms`);
    console.log(`min latency: ${min.toFixed(2)} ms`);
    console.log(`max latency: ${max.toFixed(2)} ms`);
}

client.rest.on('rateLimited', info => {
    console.log(`\n⚠️ RATE LIMIT HIT`);
    console.log(`timeout: ${info.retryAfter} ms`);
    console.log(`limit: ${info.limit}`);
    console.log(`method: ${info.method}`);
    console.log(`route: ${info.route}`);
    console.log(`global: ${info.global}`);
});

client.rest.on('response', (req, res) => {
    console.log('Request finished', req, res);
});

client.rest.on('restDebug', info => {
    console.log('REST Debug', info);
});

client.once('ready', async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const channel = await client.channels.fetch(CHANNEL_ID);

    if(!channel?.isTextBased()) {
        console.error('Channel not text based');
        process.exit(1);
    }

    const webhooks = await getOrCreateWebhooks(channel, WEBHOOK_COUNT);

    console.log(`Using ${webhooks.length} webhooks`);

    await runBenchmark(webhooks);

    process.exit(0);
});

void client.login(TOKEN);
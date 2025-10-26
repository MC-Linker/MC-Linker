import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';
import os from 'node:os';
import { getReplyOptions, ph } from '../utilities/messages.js';
import Discord from 'discord.js';
import { durationString } from '../utilities/utils.js';
import fs from 'fs-extra';
import logger from '../utilities/logger.js';

export default class SystemStats extends Command {

    gigabyte = 1024 * 1024 * 1024; // 1073741824

    constructor() {
        super({
            name: 'systemstats',
            ownerOnly: true,
            allowPrefix: true,
            requiresConnectedServer: false,
            allowUser: true,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const stats = await interaction.replyTl(keys.commands.systemstats.step.measuring);

        for(const [key, value] of Object.entries(process.memoryUsage())) {
            logger.info(`Memory usage by ${key}, ${value / 1000000}MB`);
        }

        const memoryUsage = ((os.totalmem() - os.freemem()) / this.gigabyte).toFixed(2);
        const maxMemory = (os.totalmem() / this.gigabyte).toFixed(2);
        const storage = await new Promise((resolve, _) => fs.statfs(process.platform === 'win32' ? 'C:/' : '/', (err, stats) => {
            if(err) return resolve(null);
            return resolve({
                used: stats.blocks * stats.bsize - stats.bfree * stats.bsize,
                max: stats.blocks * stats.bsize,
            });
        }));

        return await stats.edit(getReplyOptions(keys.commands.systemstats.success, {
            platform: `${os.platform()} ${os.release()}`,
            os_uptime: `${durationString(os.uptime() * 1000)}`,
            bot_uptime: `${durationString(client.uptime)}`,
            cpu: `${os.cpus()[0].model}`,
            cpu_usage_percent: (await this.getCPUUsage() * 100).toFixed(2),
            memory_usage: memoryUsage,
            max_memory: maxMemory,
            memory_usage_percent: (memoryUsage / maxMemory * 100).toFixed(2),
            library: `discord.js ${Discord.version}`,
            node_version: process.version,
            storage_usage: `${storage?.used ? (storage.used / this.gigabyte).toFixed(2) : 'N/A'}`,
            max_storage: `${storage?.max ? (storage.max / this.gigabyte).toFixed(2) : 'N/A'}`,
            storage_usage_percent: `${storage?.used ? (storage.used / storage.max * 100).toFixed(2) : 'N/A'}`,
        }, ph.colors()));
    }

    getCPUUsage() {
        const start = this.getCPUInfo();
        return new Promise(resolve => setTimeout(() => {
            const end = this.getCPUInfo();
            resolve(1 - (end.idle - start.idle) / (end.total - start.total));
        }, 1000));
    }

    getCPUInfo() {
        let total = 0;
        let idle = 0;
        const cpus = os.cpus();
        for(const cpu of cpus) {
            total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq;
            idle += cpu.times.idle;
        }
        return { idle, total: total + idle };
    }
}

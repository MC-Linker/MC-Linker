import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';
import os from 'node:os';
import { getReplyOptions, ph } from '../utilities/messages.js';
import Discord from 'discord.js';
import { durationString } from '../utilities/utils.js';

export default class SystemStats extends Command {

    gigabyte = 1024 * 1024 * 1024; // 1073741824

    constructor() {
        super({
            name: 'systemstats',
            ownerOnly: true,
            allowPrefix: true,
            requiresConnectedServer: false,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const stats = await interaction.replyTl(keys.commands.systemstats.step.measuring);

        for(const [key, value] of Object.entries(process.memoryUsage())) {
            console.log(`Memory usage by ${key}, ${value / 1000000}MB`);
        }

        const memoryUsage = ((os.totalmem() - os.freemem()) / this.gigabyte).toFixed(2);
        const maxMemory = (os.totalmem() / this.gigabyte).toFixed(2);
        return await stats.edit(getReplyOptions(keys.commands.systemstats.success, {
            platform: `${os.platform()} ${os.release()}`,
            os_uptime: `${durationString(os.uptime() * 1000)}`,
            bot_uptime: `${durationString(client.uptime)}`,
            cpu: `${os.cpus()[0].model}`,
            cpu_usage_percent: `${(await this.getCPUUsage() * 100).toFixed(2)}%`,
            memory_usage: memoryUsage,
            max_memory: maxMemory,
            memory_usage_percent: `${(memoryUsage / maxMemory * 100).toFixed(2)}%`,
            library: `discord.js ${Discord.version}`,
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

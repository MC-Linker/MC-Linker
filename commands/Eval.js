// noinspection JSVoidFunctionReturnValueUsed

import Discord from 'discord.js';
// noinspection ES6CheckImport
import { Console } from 'console';
import { Duplex } from 'stream';
import { ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import Command from '../structures/Command.js';
import { MaxEmbedFieldValueLength } from '../utilities/utils.js';

// noinspection FunctionNamingConventionJS
class ConsoleOutput extends Duplex {

    // noinspection JSCheckFunctionSignatures
    constructor(...args) {
        // noinspection JSCheckFunctionSignatures
        super(...args);
        this.output = '';
    }

    // noinspection JSCheckFunctionSignatures
    _write(str) {
        this.output += str;
    }

    _read(ignored) {
        // noinspection JSValidateTypes
        return this.output;
    }
}

export default class Eval extends Command {

    constructor() {
        super({
            name: 'eval',
            requiresConnectedServer: false,
            ownerOnly: true,
            allowPrefix: true,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const command = args?.join(' ')?.replace(/^```(js|javascript)?|```$/g, '')?.trim();
        if(!command) {
            return interaction.replyTl(keys.api.command.warnings.no_argument, { argument: 'command' });
        }

        const evalOut = new ConsoleOutput();
        evalOut.setEncoding('utf8');
        const outputConsole = new Console({ stdout: evalOut });

        let out = '';
        try {
            //Console for eval logs
            // noinspection JSUnusedLocalSymbols
            const console = {
                log(...args) {
                    // noinspection JSVoidFunctionReturnValueUsed
                    for(const [i, arg] of args.entries()) {
                        const evalOut2 = new ConsoleOutput();
                        const console2 = new Console({ stdout: evalOut2 });

                        console2.log(arg);

                        if(i > 0) out = `${out.slice(0, -1)} ${evalOut2._read()}`;
                        else out += evalOut2._read();
                    }
                },
            };

            outputConsole.log(
                await eval(`(async () => {
                    try {
                        return await (async () => {
                            ${command.includes('return') || command.includes('console.log') ? command : `return ${command}`};
                        })();
                    }
                    catch(err) {
                        return err;
                    }
                })()`),
            );

            //Auto-add return if no console.log or return present
            if(command.includes('return') || !command.includes('console.log')) out += evalOut._read();

            //Redact tokens
            const tokens = [process.env.TOKEN, process.env.CLIENT_SECRET, process.env.COOKIE_SECRET, process.env.MICROSOFT_EMAIL, process.env.MICROSOFT_PASSWORD];
            if(process.env.TOPGG_TOKEN) tokens.push(process.env.TOPGG_TOKEN);
            for(const token of tokens) {
                out = out.replace(new RegExp(token, 'g'), 'REDACTED');
            }

            //If it's too long, send an attachment
            if(out.length > MaxEmbedFieldValueLength) {
                const attachment = new Discord.AttachmentBuilder(Buffer.from(out, 'utf8'), { name: 'Eval.js' });
                return interaction.replyOptions({ files: [attachment] });
            }
            else {
                return interaction.replyTl(keys.commands.eval.success, { 'output': Discord.codeBlock('js', out.substring(0, MaxEmbedFieldValueLength)) });
            }
        }
        catch(err) {
            return interaction.replyTl(keys.commands.eval.errors.unknown_error, { 'output_error': Discord.codeBlock('js', err.message.substring(0, MaxEmbedFieldValueLength)) }, ph.error(err));
        }
    }
}

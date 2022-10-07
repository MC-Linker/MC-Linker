// noinspection JSVoidFunctionReturnValueUsed

const Discord = require('discord.js');
const { Console } = require('console');
const { Duplex } = require('stream');
const { keys, ph } = require('../api/messages');
const { token: botToken, topggToken } = require('../config.json');
const Command = require('../structures/Command');

// noinspection FunctionNamingConventionJS
class ConsoleOutput extends Duplex {
    constructor(...args) {
        super(...args);
        this.output = '';
    }

    _write(str) {
        this.output += str;
    }

    _read(ignored) {
        return this.output;
    }
}

const maxCharLength = 4086;

class Eval extends Command {

    constructor() {
        super({
            name: 'eval',
            requiresConnectedServer: false,
            ownerOnly: true,
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
                    for(const [i, arg] of args.entries()) {
                        const evalOut2 = new ConsoleOutput();
                        const console2 = new Console({ stdout: evalOut2 });

                        console2.log(arg);

                        if(i > 0) out = out.slice(0, -1) + ' ' + evalOut2._read();
                        else out += evalOut2._read();
                    }
                },
            };

            outputConsole.log(
                await eval(`(async () => {
                try {
                    ${command.includes('return') || command.includes('console.log') ? command : `return ${command}`};
                }
                catch(err) {
                    return err;
                }
            })()`),
            );

            //Auto-add return if no console.log or return present
            if(command.includes('return') || !command.includes('console.log')) out += evalOut._read();

            //Redact tokens
            const tokenArray = topggToken ? [botToken, topggToken] : [botToken];
            for(const token of [botToken, tokenArray]) {
                out = out.replace(new RegExp(token, 'g'), 'TOKEN_REDACTED');
            }

            //If it's too long, send an attachment
            if(out.length > maxCharLength) {
                const attachment = new Discord.AttachmentBuilder(Buffer.from(out, 'utf8'), { name: 'Eval.js' });
                return interaction.replyOptions({ files: [attachment] });
            }
            else {
                return interaction.replyTl(keys.commands.eval.success, { 'output': Discord.codeBlock('js', out.substring(0, maxCharLength)) });
            }
        }
        catch(err) {
            return interaction.replyTl(keys.commands.eval.errors.unknown_error, { 'output_error': Discord.codeBlock('js', err.message.substring(0, maxCharLength)) }, ph.error(err));
        }
    }

}

module.exports = Eval;

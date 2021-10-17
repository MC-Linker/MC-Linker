
const utils = require('../../utils.js');
const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'connect',
    aliases: ['connectuser', 'userconnect'],
    usage: 'connect <minecraft-username>',
    example: '/connect Lianecx',
    description: "Connect your minecraft account with your discord account.",
    data: new SlashCommandBuilder()
            .setName('connect')
            .setDescription('Connect your minecraft account with your discord account.')
            .addStringOption(option =>
                option.setName('username')
                .setDescription('Set your minecraft-username.')
                .setRequired(true)
            ),
    async execute(message, args){
        const ingameName = (args[0]);

        if(!ingameName) {
            console.log(message.member.user.tag + ' executed /connect without args in ' + message.guild.name);
            message.reply(':warning: Please specify your minecraft-name.');
            return;
        } else if(message.mentions.users.size) {
            console.log(message.member.user.tag + ' executed connect with ping in ' + message.guild.name);
            message.reply(`<:Error:849215023264169985> Don't ping someone. Use your **minecraftname** as argument.`);
            return;
        }

        console.log(message.member.user.tag + ' executed /connect ' + ingameName + ' in ' + message.guild.name);

        let uuidv4 = await utils.getUUIDv4(ingameName, message);
        if(!uuidv4) return;

        uuidv4 = uuidv4.split('');
        for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');                       
        uuidv4 = uuidv4.join("");

        const connectionJson = {
            'id': uuidv4,
            'name': ingameName
        }

        const connectionString = JSON.stringify(connectionJson, null, 2);

        fs.writeFile('./connections/' + message.member.user.id + '.json', connectionString, err => {
            if (err) {
                message.reply('<:Error:849215023264169985> Error trying to connect.');
                console.log('Error writing conectionFile', err);
                return;
            } else {
                message.reply(`<:Checkmark:849224496232660992> Connected with Minecraft-username: **${ingameName}** and UUID: **${uuidv4}**`);
                console.log('Successfully wrote connectionfile with id ' + uuidv4 + ' and name: ' + ingameName);
            }
        })
    }
}
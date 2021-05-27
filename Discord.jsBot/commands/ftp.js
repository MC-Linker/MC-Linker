module.exports = {
    name: 'ftp',
    description: "Connect your minecraft Server with the bot. Can only be used by Admins. \n USAGE: ftp <host> <username> <password> <port (default 21)> <path to world folder. Default Path: minecraft/WORLDNAME>",
    execute(message, args){
        let host = (args[0]);
        let user = (args[1]);
        let password = (args[2]);
        let port = parseInt(args[3]);
        let path = (args[4])

        if (!message.member.hasPermission('ADMINISTRATOR')) {
            message.reply("You are not an Admin!")
            console.log(message.member.user.tag + ' executed ^ftp without admin!')
            return;
        }

        console.log(message.member.user.tag + ' executed ^ftp in Server: ' + message.guild.name)

        if(!port) {
            port = 21
        }

        const jsonFtp = {
            "host": host,
            "user": user,
            "password": password,
            "port": port,
            "path": path
        }

        const ftpString = JSON.stringify(jsonFtp, null, 2);

        fs.writeFile('./ftp/' + message.guild.name + '.json', ftpString, err => {
            if (err) {
                console.log('Error writing file', err)
            } else {
                console.log('Successfully wrote file')
                message.reply('Succesfully connected with server.')
            }
        })
    }
}
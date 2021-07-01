module.exports = {
    name: 'ftp',
    description: "Connect your minecraft Server with the bot. Can only be used by Admins. \n USAGE: ftp <host> <username> <password> <port (default 21)> <path to world folder. Default Path: minecraft/WORLDNAME> <minecraft-version the minecraft-server is on>",
    execute(message, args){

        const fs = require("fs")

        let host = (args[0]);
        let user = (args[1]);
        let password = (args[2]);
        let port = parseInt(args[3]);
        let path = (args[4])
        let version = (args[5])

        if (!message.member.hasPermission('ADMINISTRATOR')) {
            message.reply(':warning: ' + "You are not an Admin!")
            console.log(message.member.user.tag + ' executed ^ftp without admin in ' + message.guild.name)
            return;
        } else if(version === '1.11' || version === '1.10' || version === '1.9' || version === '1.8' || version === '1.7') {
            message.reply(':warning: The advancement command might not work because advancements dont exist in your Minecraft version yet.')
        } else if(version !== '1.13' && version !== '1.14' && version !== '1.15' && version !== '1.16' && version !== '1.17') {
            message.reply(':warning: The stat and advancement commands might not work because your version isnt compatible with it.')
        }

        console.log(message.member.user.tag + ` executed ^ftp ${host} ${user} ${password} ${port} ${path} ${version} in Server: ` + message.guild.name)

        const jsonFtp = {
            "host": host,
            "user": user,
            "password": password,
            "port": port,
            "path": path,
            "version": version
        }

        const ftpString = JSON.stringify(jsonFtp, null, 2);

        fs.writeFile('./ftp/' + message.guild.id + '.json', ftpString, err => {
            if (err) {
                console.log('Error writing file', err)
            } else {
                console.log('Successfully wrote file')
                message.reply('<:Checkmark:849224496232660992> Succesfully connected with server.')
            }
        })
    }
}
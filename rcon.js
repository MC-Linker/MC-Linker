module.exports = {
	execute: async function (ip, port, pass, command, message) {
		const rcon = require('rcon');

		const rconCLient = new rcon(ip, port, pass, {
			tcp: true,
			challenge: false
		});
		
		rconCLient.connect();

		// @ts-ignore
		rconCLient.on('auth', () => {
			rconCLient.send(command);
			rconCLient.disconnect();

		}).on('response', (response) => {
			console.log(response);
			message.reply('<:Checkmark:849224496232660992> ' + response);

		}).on('error', (err) => {
			console.log('Error trying to execute Command: ' + command , err);
			message.reply('<:Error:849215023264169985> Error trying to execute command. Please check if rcon is enabled in the `server.properties` file.');
		});

	}
}
module.exports = {
	execute: function (ip, port, pass, command, message) {
		return new Promise(async (resolve, reject) => {
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
			}).on('response', response => {
				console.log(response);
				resolve(response);
			}).on('error', err => {
				console.log('Error trying to execute Command: ' + command , err);
				message.reply('<:Error:849215023264169985> Error trying to execute command. Please check if rcon is enabled in the `server.properties` file.');
				resolve();
			});
		})
	},

	executeGetCredentials: function (command, message) {
		const fs = require('fs');

		return new Promise(async (resolve, reject) => {
			const rcon = require('rcon');

			fs.readFile(`./rcon/${message.guild.id}.json`, (err, rconJson) => {
				if(err) {
					console.log('Error reading rcon File');
					message.reply('<:Error:849215023264169985> Could not find rcon credentials. Please use `^rcon connect`.');
					resolve();
				} else {
					// @ts-ignore
					const rconData = JSON.parse(rconJson);
					const ip = rconData.ip;
					const port = rconData.port;
					const pass = rconData.password;

					const rconCLient = new rcon(ip, port, pass, {
						tcp: true,
						challenge: false
					});

					rconCLient.connect();

					// @ts-ignore
					rconCLient.on('auth', () => {
						rconCLient.send(command);
						rconCLient.disconnect();
					}).on('response', response => {
						console.log(response);
						resolve(response);
					}).on('error', err => {
						console.log('Error trying to execute Command: ' + command , err);
						message.reply('<:Error:849215023264169985> Error trying to execute command. Please check if rcon is enabled in the `server.properties` file.');
						resolve();
					});
				}
			})
		})
	}
}
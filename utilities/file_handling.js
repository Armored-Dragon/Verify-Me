const fs = require('graceful-fs');
const dir = __dirname.replace('/utilities', '');
const log = require('../utilities/logger').log;

module.exports = { readBotSettingsForServers, writeBotSettingsForServers, createBotSettingsForNewServer };

/**
 * Read the bot settings for its servers
 */
async function readBotSettingsForServers() {
	return JSON.parse(await _readFile('/data/server_settings.json'));
}

/**
 * Write the supplied Object to the save file for the bot settings.
 * @param {Object} settings Object containing the entire list of settings for each server.
 */
async function writeBotSettingsForServers(settings) {
	return await _writeFile('/data/server_settings.json', JSON.stringify(settings, null, 2));
}

async function createBotSettingsForNewServer(settings, guild_id) {
	const default_settings = {
		"categories": {
			"verification": ""
		},
		"channels": {
			"server_logs": "",
			"server_settings": ""
		},
		"roles": {
			"verified": "",
			"mod": ""
		},
		"settings": {
			"kick_on_join": false,
			"require_verification": false
		},
		"messages": {
			"server_settings": ""
		},
		"data": {
			"join_message": "Welcome to $servername, $user!"
		}
	};
	settings[guild_id] = default_settings;
	writeBotSettingsForServers(settings);
}

function _readFile(directory) {
	return new Promise((resolve, reject) => {
		fs.readFile(dir + directory, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
}

function _writeFile(directory, data) {
	return new Promise((resolve, reject) => {
		fs.writeFile(dir + directory, data, (err, data) => {
			if (err) reject(err);
			else resolve();
		});
	});
}
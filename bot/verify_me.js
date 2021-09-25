const discord = require(`discord.js`);
const discord_client = new discord.Client({ intents: [discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MEMBERS, discord.Intents.FLAGS.GUILD_MESSAGES, discord.Intents.FLAGS.GUILD_BANS] });
const discord_lib = new (require('../bot/discord')).discord(discord, discord_client);
const log = new (require('../utilities/logger')).log(true);
const fs = require('../utilities/file_handling');
const utilities = require('../utilities/utils');
const bot_data = require('../data/private_bot_data.json');

let settings;

discord_client.login(bot_data.token);

discord_client.on('ready', signedIntoDiscord);
discord_client.on('messageCreate', newGuildMessage);
discord_client.on('guildCreate', guildUpdate);
discord_client.on('guildMemberAdd', guildMemberAdd);
discord_client.on('guildMemberRemove', guildMemberRemove);
discord_client.on('interactionCreate', handleInteraction);


async function signedIntoDiscord() {
	log.info(`Signed into ${discord_client.user.tag}`);
	await updateSettings();
	catchUpOnWork();
}

// Catch up on work that needs to be done
async function catchUpOnWork() {
	const all_servers = await discord_client.guilds.fetch();
	all_servers.forEach((guild) => checkServer(guild.id));

	async function checkServer(guild_id) {
		log.debugs(`Checking server ${guild_id}`);
		if (!settings[guild_id]) return addedToNewGuild(guild_id);
		if (!discord_lib.guildIsSetup(guild_id)) return log.debugs(`${guild_id} is not set up, skipping.`);

		const guild = discord_client.guilds.cache.get(guild_id);
		const guild_members = await guild.members.fetch();
		const guild_verified_role = settings[guild_id].roles.verified;

		guild_members.forEach(checkVerificationStatus);
		discord_lib.newSettingsPanel(guild);

		// TODO: Skip ourselves
		function checkVerificationStatus(guild_member) {
			if (!guild_member.roles.cache.has(guild_verified_role)) guildMemberAdd(guild_member);
		}
	}
}

function guildUpdate(guild) {
	addedToNewGuild(guild.id);
}

function addedToNewGuild(guild_id) {
	fs.createBotSettingsForNewServer(settings, guild_id);
	updateSettings();
}

// Update the cached settings.
async function updateSettings() {
	settings = await fs.readBotSettingsForServers();
	discord_lib.updateSettings(settings);
}

function guildMemberAdd(member) {
	const server_settings = settings[member.guild.id].settings;

	discord_lib.logAdminAction(member.guild, null, `${member.user.username} joined`);
	if (server_settings.kick_on_join) return discord_lib.kickUserFromGuild(member, `${member.guild.name} is currently under a lockdown.\nYou were automatically kicked.\nPlease try again later!`);
	if (server_settings.require_verification) return discord_lib.createVerificationChannel(member);
	else discord_lib.verifyUserFromVerificationChannel(member);
}

function guildMemberRemove(member) {
	discord_lib.deleteVerificationChannel(member);

	// Log user departure
	discord_lib.logAdminAction(member.guild, null, `${member.user.username} left`);
}

async function handleInteraction(interaction) {
	const interaction_author = await interaction.guild.members.fetch(interaction.user.id);

	if (!interaction.isButton()) return;
	if (!interaction_author.roles.cache.has(settings[interaction.guild.id].roles.mod) && interaction.guild.ownerId !== interaction.user.id) return;
	if (interaction.customId === 'kick_on_join') changeSetting('kick_on_join', interaction.guildId);
	if (interaction.customId === 'require_verification') changeSetting('require_verification', interaction.guildId);

	const settings_channel = await interaction.guild.channels.fetch(settings[interaction.guildId].channels.server_settings);

	const embed = discord_lib.serverSettingsEmbed(interaction.guild);
	interaction.message.delete();
	settings_channel.send({ embeds: [embed.embed], components: [embed.buttons] });

	function changeSetting(name) {
		settings[interaction.guildId].settings[name] = !settings[interaction.guildId].settings[name];
		fs.writeBotSettingsForServers(settings);
		discord_lib.updateSettings(settings);
	}
}

async function newGuildMessage(message) {
	// Is this a message aimed at us?
	if (message.content.substring(0, 3) !== 'vm.') return;

	// Only allow mods and the server owner to use chat commands	
	const message_author = await message.guild.members.fetch(message.author.id);
	if (!message_author.roles.cache.has(settings[message.guild.id].roles.mod) && message.guild.ownerId !== message.author.id) return;

	// Verify a user in a verification channel 
	if (message.channel.name.includes('verify-')) {
		const member_id = message.channel.name.replace('verify-', '');
		const member = await message.guild.members.fetch(member_id);

		if (message.content.substring(0, 9) === 'vm.verify') return discord_lib.verifyUserFromVerificationChannel(member, message.author);
		if (message.content.substring(0, 7) === 'vm.deny') return discord_lib.denyUserFromVerificationChannel(member, 'KICK', message);
		if (message.content.substring(0, 6) === 'vm.ban') return discord_lib.denyUserFromVerificationChannel(member, 'BAN', message);
	}



	// Server settings
	if (message.content.substring(0, 23) === 'vm.verificationcategory') serverSetup('categories', 'verification', message);
	if (message.content.substring(0, 13) === 'vm.serverlogs') serverSetup('channels', 'server_logs', message);
	if (message.content.substring(0, 17) === 'vm.serversettings') serverSetup('channels', 'server_settings', message);
	if (message.content.substring(0, 15) === 'vm.verifiedrole') serverSetup('roles', 'verified', message);
	if (message.content.substring(0, 10) === 'vm.modrole') serverSetup('roles', 'mod', message);
	if (message.content.substring(0, 14) === 'vm.joinmessage') serverSetup('data', 'join_message', message, 'vm.joinmessage');


	function serverSetup(category, setting, message, command) {
		let data;
		let item_id = /[0-9]{18}/.exec(message.content);
		if (command) formatted_message = message.content.replace(command, '').trim();

		if (!item_id) data = formatted_message;
		else data = item_id[0];

		settings[message.guild.id][category][setting] = data;
		fs.writeBotSettingsForServers(settings);
	}
}

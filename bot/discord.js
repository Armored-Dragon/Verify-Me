
// TODO: Server panel embed creator
// TODO: Server panel embed updater


class discord {
	constructor(discord, discord_client, settings) {
		this.discord = discord;
		this.discord_client = discord_client;
		this.settings = settings;
	}

	/**
	 * Set the settings to use. This settings object must contain all of the individual servers.
	 * @param {Object} settings The full settings object to use.
	 */
	updateSettings(settings) {
		this.settings = settings;
	}

	/**
	 * Create a verification channel for a user in a verification category.
	 * @param {Object} member The member object.
	 */
	async createVerificationChannel(member) {
		const verification_category = this.settings[member.guild.id].categories.verification;
		const everyone_role = member.guild.roles.cache.find((roles) => roles.name === `@everyone`).id;
		const formatted_message = this.settings[member.guild.id].data.join_message.replace('$user', `<@${member.id}>`).replace('$servername', member.guild.name) || '';

		if (member.guild.channels.cache.find((channel) => channel.name === `verify-${member.id}`)) return;

		// Build the permissions for the verification channel
		const user_permissions = [`VIEW_CHANNEL`, `SEND_MESSAGES`, `READ_MESSAGE_HISTORY`];
		const permissions = [
			{ id: everyone_role, deny: user_permissions },																		// Everyone by default can not see this channel
			{ id: this.discord_client.user.id, allow: user_permissions },														// The bot can see the channel
			{ id: this.settings[member.guild.id].roles.mod, allow: user_permissions },		// Mods can see the channel
			{ id: member.id, allow: user_permissions }																					// The targeted user can view this channel
		];

		const channel = await member.guild.channels.create(`verify-${member.id}`, { parent: verification_category, type: `text`, permissionOverwrites: permissions });
		channel.send(formatted_message);
	}

	/**
	 * Verify a user and cleanup any lingering verification channels
	 * @param {Object} member The target member object.
	 * @param {Object} acting_admin The admin user who allowed the user to become verified.
	 */
	async verifyUserFromVerificationChannel(member, acting_admin) {
		member.roles.add(this.settings[member.guild.id].roles.verified);
		this.deleteVerificationChannel(member);
		this.logAdminAction(member.guild, acting_admin, `${member.user.username} was verified`, 'Verification');
	}

	/**
	 * Deny the user access to the guild from a verification channel.
	 * @param {Object} member The member object to act upon.
	 * @param {String} action The action to preform on the user (KICK / BAN).
	 * @param {String} action_message The message you would like to give to the user and log into the server log.
	 */
	async denyUserFromVerificationChannel(member, action, action_message) {
		const message = action_message.content.replace('vm.verify', '').replace('vm.deny', '').replace('vm.ban', '');

		if (action === 'KICK') this.kickUserFromGuild(member, action_message, message);
		if (action === 'BAN') this.banUserFromGuild(member, action_message, message);

		this.deleteVerificationChannel(member);
		this.logAdminAction(member.guild, action_message.author, `${member.user.username} was denied verification`, 'Verification');
	}

	async deleteVerificationChannel(member) {
		const verification_channel = member.guild.channels.cache.find((channel) => channel.name === `verify-${member.id}`);
		if (verification_channel) verification_channel.delete();
	}

	/**
	 * Kick a user from a target guild with a supplied message.
	 * @param {Object} member The member object to act upon.
	 * @param {String} guild_id The target guild id.
	 * @param {String} message The text message you want to log into the server and the message you want to privately message to the affected user.
	 */
	async kickUserFromGuild(member, message, formatted_message) {
		if (message) await member.send(`You were kicked from ${message.guild.name}\n\n${formatted_message}`);
		member.kick(`formatted_message`);
		this.logAdminAction(member.guild, this.discord_client.user, formatted_message);
	}

	/**
	 * Ban a user from a target guild with a supplied message.
	 * @param {Object} member The member object to act upon.
	 * @param {Sting} guild_id The target guild id.
	 * @param {String} message The text message you want to log into the server and the message you want to privately message to the affected user.
	 */
	async banUserFromGuild(member, message, formatted_message) {
		if (message) await member.send(`You were banned from ${message.guild.name}\n\n${formatted_message}`);
		member.ban({ reason: formatted_message });
		this.logAdminAction(member.guild, this.discord_client.user, formatted_message);
	}

	/**
	 * Logs an administrator action into the logging channel in a discord server.
	 * @param {Object} guild The guild to log into.
	 * @param {Object} acting_member The admin / moderator who created the action.
	 * @param {String} message The message to display in the generated embed.
	 */
	async logAdminAction(guild, acting_member, message, title = 'Action') {
		const logging_channel = await guild.channels.fetch(this.settings[guild.id].channels.server_logs);
		if (!acting_member) acting_member = this.discord_client.user;

		let embed = new this.discord.MessageEmbed()
			.setColor('#ff0000')
			.setTitle(title)
			.setDescription(message)
			.setAuthor(acting_member.username, acting_member.avatarURL())
			.setTimestamp();

		logging_channel.send({ embeds: [embed] });
	}

	async newSettingsPanel(guild) {
		const settings_channel = await guild.channels.fetch(this.settings[guild.id].channels.server_settings);
		const embed_settings = await this.serverSettingsEmbed(guild);
		settings_channel.bulkDelete(await settings_channel.messages.fetch()); //Delete all of the messages in the settings channel 


		settings_channel.send({ embeds: [embed_settings.embed], components: [embed_settings.buttons] });
	}

	serverSettingsEmbed(guild) {
		const server_settings = this.settings[guild.id].settings;
		let embed = new this.discord.MessageEmbed();

		embed.setColor('#ff0000');
		embed.setTitle('Server Settings');
		embed.addFields({ name: 'Kick on Join', value: `${server_settings.kick_on_join ? ':green_circle: true' : ':red_circle: false'}`, inline: true }, { name: '\u200B', value: '\u200B', inline: true }, { name: 'Verify Users', value: `${server_settings.require_verification ? ':green_circle: true' : ':red_circle: false'}`, inline: true });
		embed.setTimestamp();

		const embed_buttons = new this.discord.MessageActionRow()
			.addComponents([
				new this.discord.MessageButton()
					.setCustomId('kick_on_join')
					.setLabel('Kick on join')
					.setStyle('SECONDARY'),

				new this.discord.MessageButton()
					.setCustomId('require_verification')
					.setLabel('Require verification')
					.setStyle('SECONDARY')]
			);

		return { embed: embed, buttons: embed_buttons };
	}

	guildIsSetup(guild_id) {
		const { categories, channels, roles } = this.settings[guild_id];
		if (!categories.verification) return false;
		if (!channels.server_logs || !channels.server_settings) return false;
		if (!roles.verified || !roles.mod) return false;
		return true;
	}

}

module.exports = { discord };;

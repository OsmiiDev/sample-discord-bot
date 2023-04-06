import {ChannelType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import ReactRoles from '../../modules/reaction/ReactRoles';
/**
 * @description - /reactroles command
 */
export default class ReactRolesCommand {
  /**
   * @description - Gets the data for the command
   * @return {SlashCommandBuilder} - The data for the command
   */
  static get() {
    return new SlashCommandBuilder()
      .setName('reactroles')
      .setDescription('Configures reaction roles for the server.')
      .setDMPermission(false)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Adds a reaction role to the server.')
          .addStringOption((option) => option.setName('message').setDescription('A link to the message to add the reaction role to.').setRequired(true))
          .addStringOption((option) => option.setName('emoji').setDescription('The emoji to add to the message.').setRequired(true))
          .addRoleOption((option) => option.setName('role').setDescription('The role to give to the user when they react.').setRequired(true)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('remove')
          .setDescription('Removes a reaction role from the server.')
          .addStringOption((option) => option.setName('message').setDescription('The message ID of the message to remove the reaction role from.').setRequired(true))
          .addStringOption((option) => option.setName('emoji').setDescription('The emoji to remove from the message.').setRequired(true))
          .addRoleOption((option) => option.setName('role').setDescription('The role to remove from the user when they react.').setRequired(true)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('Lists all reaction roles for the server.'),
      );
  }

  /**
   * @description - Executes the command
   * @param {ChatInputCommandInteraction} interaction - The interaction that triggered the command
   */
  static async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    if (!(member instanceof GuildMember)) throw new Error('Member is not a guild member.');
    // const targetMember = await (interaction.guild!.members.fetch(targetUser.id).catch(() => null));

    // Check if the user has permission to run this command
    if (member.guild.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> You do not have permission to perform this action.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'add') {
      const _message = interaction.options.getString('message', true);
      const emoji = interaction.options.getString('emoji', true).replace(/\s/g, '');
      const role = interaction.options.getRole('role', true);

      if (role.managed) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> You cannot add a reaction role for a managed role.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }
      const [channelId, messageId] = _message.split('/').filter((value) => value !== '').slice(-2);
      const channel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.type === ChannelType.GuildCategory || channel.type === ChannelType.GuildStageVoice) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> The message link provided is invalid.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }
      const message = await channel.messages?.fetch(messageId).catch(() => null);
      if (!message) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> The message link provided is invalid.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }

      console.log(emoji);
      ReactRoles.register(message, emoji, role.id);

      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Success:1000468117878747267> Successfully added the reaction role.')
            .setColor('#10b981'),
        ],
      }).catch(() => null);

      const reaction = await message.react(emoji).catch(() => null);
      if (!reaction) {
        await interaction.followUp({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Warn:1087961063468834816> I couldn\'t add the reaction to the message. Double check that it\'s a valid emoji and I have permission to add reactions to the message.')
              .setColor('#f59e0b'),
          ],
        });
        return;
      }
    }
    if (subcommand === 'remove') {
      const _message = interaction.options.getString('message', true);
      const emoji = interaction.options.getString('emoji', true).replace(/\s/g, '');
      const role = interaction.options.getRole('role', true);

      const [channelId, messageId] = _message.split('/').filter((value) => value !== '').slice(-2);
      const channel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.type === ChannelType.GuildCategory || channel.type === ChannelType.GuildStageVoice) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> The message link provided is invalid.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }
      const message = await channel.messages?.fetch(messageId).catch(() => null);
      if (!message) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> The message link provided is invalid.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }

      ReactRoles.unregister(message, emoji, role.id, false);

      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Success:1000468117878747267> Successfully removed the reaction role.')
            .setColor('#10b981'),
        ],
      }).catch(() => null);
    }
    if (subcommand === 'list') {
      // const reactionRoles = await ReactRoles.get(interaction.guild!.id);
      // const embed = new EmbedBuilder()
      //   .setTitle('Reaction Roles')
      //   .setColor('#0099ff');

      // if (reactionRoles.length === 0) {
      //   embed.setDescription('There are no reaction roles for this server.');
      // } else {
      //   embed.setDescription('Here are all the reaction roles for this server.');
      //   for (const reactionRole of reactionRoles) {
      //     const role = await interaction.guild!.roles.fetch(reactionRole.roleId).catch(() => null);
      //     if (!role) continue;
      //     embed.addField(`${reactionRole.emoji} - ${role.name}`, `Message: [Jump to Message](${reactionRole.messageLink})`);
      //   }
      // }

      // await interaction.reply({
      //   content: '',
      //   embeds: [embed],
      // });
    }
  }
}

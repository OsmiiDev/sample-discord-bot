import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import Kick from '../../modules/moderation/Kick';

/**
 * @description - /kick command
 */
export default class KickCommand {
  /**
   * @description - Gets the data for the command
   * @return {SlashCommandBuilder} - The data for the command
   */
  static get(): Omit<SlashCommandBuilder, string> {
    return new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a user from the server.')
      .setDMPermission(false)
      .addUserOption((option) => option.setName('user').setDescription('The user to kick.').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('The reason for the kick.').setRequired(false));
  }

  /**
   * @description - Executes the command
   * @param {ChatInputCommandInteraction} interaction - The interaction that triggered the command
   */
  static async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    if (!(member instanceof GuildMember)) throw new Error('Member is not a guild member.');
    const targetMember = await (interaction.guild!.members.fetch(targetUser.id).catch(() => null));

    if (!targetMember) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> This user is not in the server.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }

    // Check if the user is trying to act on themself
    if (member.id === targetUser.id) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> You cannot kick yourself.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }
    // Check if the user has permission to kick members
    if (member.guild.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.KickMembers)) {
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
    // Check if the user has a higher role than the target
    if (member.guild.ownerId !== member.id && member.roles.highest.position <= targetMember.roles.highest.position) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> You cannot kick a user with a higher or equal role.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }
    // Check if target is the guild owner
    if (targetUser.id === member.guild.ownerId) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> You cannot kick the guild owner.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }
    // Check if the bot has permission to ban members
    if (!targetMember?.kickable) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> This user cannot be kicked.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const reason = interaction.options.getString('reason') || 'No reason provided';

    const result = await Kick.createKick(targetMember, member, reason);

    // eslint-disable-next-line max-len
    const resultText = result.map((item) => `<:Blank:1087904249721143297><:ListItem:1000047329879015525>${item.success ? '<:Success:1087892239449075712>' : '<:Failure:1087891244874748067>'} ${item.message}`).join('\n');

    if (interaction.deferred && interaction.isRepliable()) {
      await interaction.editReply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle('<:Kick:1087962888276295720> Kick results')
            .setDescription(resultText)
            .setColor('#6366f1'),
        ],
      }).catch(() => null);
    }
  }
}

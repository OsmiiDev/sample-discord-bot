import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import Ban from '../../modules/moderation/Ban';

/**
 * @description - /unban command
 */
export default class unbanCommand {
  /**
   * @description - Gets the data for the command
   * @return {SlashCommandBuilder} - The data for the command
   */
  static get(): Omit<SlashCommandBuilder, string> {
    return new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Unbans a user from the server.')
      .setDMPermission(false)
      .addUserOption((option) => option.setName('user').setDescription('The user to unban').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('The reason for the unban').setRequired(false));
  }

  /**
   * @description - Executes the command
   * @param {ChatInputCommandInteraction} interaction - The interaction that triggered the command
   */
  static async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    if (!(member instanceof GuildMember)) throw new Error('Member is not a guild member.');

    // Check if the user is trying to act on themself
    if (member.id === targetUser.id) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> You cannot unban yourself.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }
    // Check if the user has permission to ban members
    if (member.guild.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.BanMembers)) {
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

    const reason = interaction.options.getString('reason') || 'No reason provided';

    await interaction.deferReply();

    const result = await Ban.createUnban(targetUser, member, reason);
    // eslint-disable-next-line max-len
    const resultText = result.map((item) => `<:Blank:1087904249721143297><:ListItem:1000047329879015525>${item.success ? '<:Success:1087892239449075712>' : '<:Failure:1087891244874748067>'} ${item.message}`).join('\n');

    if (interaction.deferred && interaction.isRepliable()) {
      await interaction.editReply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle('<:Ban:1087961794649264178> Unban results')
            .setDescription(resultText)
            .setColor('#6366f1'),
        ],
      });
    }
  }
}

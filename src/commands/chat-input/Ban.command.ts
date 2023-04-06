import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import Ban from '../../modules/moderation/Ban';

/**
 * @description - /ban command
 */
export default class BanCommand {
  /**
   * @description - Gets the data for the command
   * @return {SlashCommandBuilder} - The data for the command
   */
  static get() {
    return new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bans a user from the server.')
      .setDMPermission(false)
      .addUserOption((option) => option.setName('user').setDescription('The user to ban').setRequired(true))
      .addStringOption((option) => option.setName('duration').setDescription('The duration of the ban').setRequired(false))
      .addStringOption((option) => option.setName('reason').setDescription('The reason for the ban').setRequired(false));
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

    // Check if the user is trying to act on themself
    if (member.id === targetUser.id) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> You cannot ban yourself.')
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
    // Check if the user has a higher role than the target
    if (targetMember && member.guild.ownerId !== member.id && member.roles.highest.position <= targetMember.roles.highest.position) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> You cannot ban a user with a higher or equal role.')
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
            .setDescription('<:Failure:1000494098635034674> You cannot ban the guild owner.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }
    // Check if the bot has permission to ban members
    if (targetMember && !targetMember?.bannable) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> This user cannot be banned.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }


    const reason = interaction.options.getString('reason') || 'No reason provided';
    let duration = -1;

    if (interaction.options.getString('duration') !== null && interaction.options.getString('duration')!.toLowerCase() !== 'permanent') {
      const durationRegex = /^((\d+)\s?(years?|y))?[,\s]*((\d+)\s?(months?|mo))?[,\s]*((\d+)\s?(days?|d))?[,\s]*((\d+)\s?(hours?|h))?[,\s]*((\d+)\s?(minutes?|m))?[,\s]*((\d+)\s?(seconds?|s))?$/gi;
      const durationMatch = durationRegex.exec(interaction.options.getString('duration', true));
      if (!durationMatch) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> Invalid duration.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }

      const y = durationMatch[2] ? parseInt(durationMatch[2]) : 0;
      const mo = durationMatch[5] ? parseInt(durationMatch[5]) : 0;
      const d = durationMatch[8] ? parseInt(durationMatch[8]) : 0;
      const h = durationMatch[11] ? parseInt(durationMatch[11]) : 0;
      const m = durationMatch[14] ? parseInt(durationMatch[14]) : 0;
      const s = durationMatch[17] ? parseInt(durationMatch[17]) : 0;

      duration = (y * 60 * 0 * 24 * 30 * 365.25) + (mo * 60 * 60 * 24 * 30.4375) + (d * 60 * 60 * 24) + (h * 60 * 60) + (m * 60) + s;
    }
    if (duration === 0 || isNaN(duration)) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> Invalid duration.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply();

    const result = await Ban.createBan(targetUser, member, reason, duration);
    // eslint-disable-next-line max-len
    const resultText = result.map((item) => `<:Blank:1087904249721143297><:ListItem:1000047329879015525>${item.success ? '<:Success:1087892239449075712>' : '<:Failure:1087891244874748067>'} ${item.message}`).join('\n');

    if (interaction.deferred && interaction.isRepliable()) {
      await interaction.editReply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle('<:Ban:1087961794649264178> Ban results')
            .setDescription(resultText)
            .setColor('#6366f1'),
        ],
      });
    }
  }
}

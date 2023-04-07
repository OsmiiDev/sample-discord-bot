import {ActionRowBuilder, ContextMenuCommandBuilder, EmbedBuilder, GuildMember, MessageContextMenuCommandInteraction, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, TextInputBuilder,
  TextInputStyle} from 'discord.js';
import {randomBytes} from 'crypto';
import Ban from '../../modules/moderation/Ban';

/**
 * @description - [Ban] message context command
 */
export default class BanCommand {
  /**
   * @description - Gets the data for the command
   * @return {SlashCommandBuilder} - The data for the command
   */
  static get(): Omit<ContextMenuCommandBuilder, string> {
    return new ContextMenuCommandBuilder()
      .setName('Ban')
      .setDMPermission(false)
      .setType(3);
  }

  /**
   * @description - Executes the command
   * @param {MessageContextMenuCommandInteraction} interaction - The interaction that triggered the command
   */
  static async execute(interaction: MessageContextMenuCommandInteraction) {
    const id = randomBytes(32).toString('hex');
    const username = interaction.targetMessage.author.username;

    const member = interaction.member;
    const targetUser = interaction.targetMessage.author;
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

    const modal = new ModalBuilder()
      .setCustomId(`ban-${id}`)
      .setTitle(`Ban ${username.length > 16 ? username.substring(0, 16) + '…' : username}#${targetUser.discriminator}`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('ban-duration')
            .setLabel('Duration of ban')
            .setPlaceholder('"1y 1mo 1d 1h 1m 1s" or "Permanent", or "Unban" to unban')
            .setRequired(true)
            .setStyle(TextInputStyle.Short),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('ban-reason')
            .setLabel('Reason')
            .setPlaceholder('Enter a reason for the ban')
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph),
        ),
      );

    interaction.showModal(modal);

    const submit: ModalSubmitInteraction | null = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === `ban-${id}`,
      time: 15000,
    }).catch(() => null);
    if (!submit) return;
    await submit.deferReply().catch(() => null);

    const reason = submit.fields.getTextInputValue('ban-reason') || 'No reason provided';
    let duration = -1;

    if (submit.fields.getTextInputValue('ban-duration')?.toLowerCase() === 'unban') {
      const result = await Ban.createUnban(targetUser, member, reason);
      // eslint-disable-next-line max-len
      const resultText = result.map((item) => `<:Blank:1087904249721143297><:ListItem:1000047329879015525>${item.success ? '<:Success:1087892239449075712>' : '<:Failure:1087891244874748067>'} ${item.message}`).join('\n');

      await submit.followUp({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle('<:Ban:1087961794649264178> Ban results')
            .setDescription(resultText)
            .setColor('#6366f1'),
        ],
      }).catch(() => null);

      return;
    }

    if (submit.fields.getTextInputValue('ban-duration')?.toLowerCase() !== 'permanent') {
      const durationRegex = /^((\d+)\s?(years?|y))?[,\s]*((\d+)\s?(months?|mo))?[,\s]*((\d+)\s?(days?|d))?[,\s]*((\d+)\s?(hours?|h))?[,\s]*((\d+)\s?(minutes?|m))?[,\s]*((\d+)\s?(seconds?|s))?$/gi;
      const durationMatch = durationRegex.exec(submit.fields.getTextInputValue('ban-duration')!);
      if (!durationMatch) {
        await submit.followUp({
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
      await submit.followUp({
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

    const result = await Ban.createBan(targetUser, member, reason, duration);
    // eslint-disable-next-line max-len
    const resultText = result.map((item) => `<:Blank:1087904249721143297><:ListItem:1000047329879015525>${item.success ? '<:Success:1087892239449075712>' : '<:Failure:1087891244874748067>'} ${item.message}`).join('\n');

    await submit.followUp({
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle('<:Ban:1087961794649264178> Ban results')
          .setDescription(resultText)
          .setColor('#6366f1'),
      ],
    }).catch(() => null);
  }
}

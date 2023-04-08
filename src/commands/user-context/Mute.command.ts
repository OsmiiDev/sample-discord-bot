import {ActionRowBuilder, ContextMenuCommandBuilder, EmbedBuilder, GuildMember, UserContextMenuCommandInteraction, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, TextInputBuilder,
  TextInputStyle} from 'discord.js';
import {randomBytes} from 'crypto';
import Mute from '../../modules/moderation/Mute';

/**
 * @description - [Mute] message context command
 */
export default class MuteCommand {
  /**
   * @description - Gets the data for the command
   * @return {SlashCommandBuilder} - The data for the command
   */
  static get(): Omit<ContextMenuCommandBuilder, string> {
    return new ContextMenuCommandBuilder()
      .setName('Mute')
      .setDMPermission(false)
      .setType(2);
  }

  /**
   * @description - Executes the command
   * @param {UserContextMenuCommandInteraction} interaction - The interaction that triggered the command
   */
  static async execute(interaction: UserContextMenuCommandInteraction) {
    const id = randomBytes(32).toString('hex');
    const username = interaction.targetUser.username;

    const member = interaction.member;
    const targetUser = interaction.targetUser;
    if (!(member instanceof GuildMember)) throw new Error('Member is not a guild member.');
    const targetMember = await (interaction.guild!.members.fetch(targetUser.id).catch(() => console.log(`Failed to fetch member - ${__filename}`)));

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
    // Check if the user has permission to mute members
    if (member.guild.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.MuteMembers)) {
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
            .setDescription('<:Failure:1000494098635034674> You cannot mute a user with a higher or equal role.')
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
            .setDescription('<:Failure:1000494098635034674> You cannot mute the guild owner.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }
    // Check if the bot has permission to mute members
    if (!targetMember?.moderatable) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> This user cannot be muted.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`mute-${id}`)
      .setTitle(`Mute ${username.length > 16 ? username.substring(0, 16) + '…' : username}#${targetUser.discriminator}`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('mute-duration')
            .setLabel('Duration of mute')
            .setPlaceholder('"1y 1mo 1d 1h 1m 1s" or "Permanent", or "Unmute" to unmute')
            .setRequired(true)
            .setStyle(TextInputStyle.Short),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('mute-reason')
            .setLabel('Reason')
            .setPlaceholder('Enter a reason for the mute')
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph),
        ),
      );

    interaction.showModal(modal);

    const submit: ModalSubmitInteraction | void = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === `mute-${id}`,
      time: 15000,
    }).catch(() => console.log(`Failed to follow up - ${__filename}`));
    if (!submit) return;
    await submit.deferReply().catch(() => console.log(`Failed to defer reply - ${__filename}`));

    const reason = submit.fields.getTextInputValue('mute-reason') || 'No reason provided';
    let duration = -1;

    if (submit.fields.getTextInputValue('mute-duration')?.toLowerCase() === 'unmute') {
      const result = await Mute.createUnmute(targetMember, member, reason);
      // eslint-disable-next-line max-len
      const resultText = result.map((item) => `<:Blank:1087904249721143297><:ListItem:1000047329879015525>${item.success ? '<:Success:1087892239449075712>' : '<:Failure:1087891244874748067>'} ${item.message}`).join('\n');

      await submit.followUp({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle('<:Mute:1087890259477536939> Unmute results')
            .setDescription(resultText)
            .setColor('#6366f1'),
        ],
      }).catch(() => console.log(`Failed to follow up - ${__filename}`));

      return;
    }

    if (submit.fields.getTextInputValue('mute-duration')?.toLowerCase() !== 'permanent') {
      const durationRegex = /^((\d+)\s?(years?|y))?[,\s]*((\d+)\s?(months?|mo))?[,\s]*((\d+)\s?(days?|d))?[,\s]*((\d+)\s?(hours?|h))?[,\s]*((\d+)\s?(minutes?|m))?[,\s]*((\d+)\s?(seconds?|s))?$/gi;
      const durationMatch = durationRegex.exec(submit.fields.getTextInputValue('mute-duration')!);
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

    const result = await Mute.createMute(targetMember, member, reason, duration);
    // eslint-disable-next-line max-len
    const resultText = result.map((item) => `<:Blank:1087904249721143297><:ListItem:1000047329879015525>${item.success ? '<:Success:1087892239449075712>' : '<:Failure:1087891244874748067>'} ${item.message}`).join('\n');

    await submit.followUp({
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle('<:Mute:1087890259477536939> Mute results')
          .setDescription(resultText)
          .setColor('#6366f1'),
      ],
    }).catch(() => console.log(`Failed to follow up - ${__filename}`));
  }
}

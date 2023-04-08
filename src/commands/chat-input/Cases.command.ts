import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, GuildMember, InteractionCollector, PermissionFlagsBits, SlashCommandBuilder,
  User} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';
/**
 * @description - /cases command
 */
export default class CasesCommand {
  /**
   * @description - Gets the data for the command
   * @return {SlashCommandBuilder} - The data for the command
   */
  static get(): Omit<SlashCommandBuilder, string> {
    return new SlashCommandBuilder()
      .setName('cases')
      .setDescription('Get a list of logs for a user.')
      .setDMPermission(false)
      .addUserOption((option) => option.setName('user').setDescription('The user to get logs for.').setRequired(true));
  }

  /**
   * @description - Executes the command
   * @param {ChatInputCommandInteraction} interaction - The interaction that triggered the command
   */
  static async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    if (!(member instanceof GuildMember)) throw new Error('Member is not a guild member.');
    // const targetMember = await (interaction.guild!.members.fetch(targetUser.id).catch(() => null));

    // Check if the user has permission to run this command
    if (member.guild.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
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

    await interaction.deferReply().catch(() => console.log(`Failed to defer reply - ${__filename}`));

    const embeds = await CasesCommand.createEmbeds(targetUser);
    let totalPages = embeds.total;
    let pageNum = 0;

    interaction.editReply({
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents([
          new ButtonBuilder()
            .setCustomId('cases_previous')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('cases_page')
            .setLabel(`Page 1/${Math.ceil(embeds.total / 10)}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true), // @TODO add arbitrary pagination
          new ButtonBuilder()
            .setCustomId('cases_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary),
        ]),
      ],
      content: '',
      embeds: embeds.embeds,
    });

    const pageCollector = new InteractionCollector(interaction.client, {
      filter: (i) => i.customId === 'cases_previous' || i.customId === 'cases_next' && i.isButton(),
      time: 1000 * 60 * 10,
    });

    pageCollector.on('collect', async (buttonInteraction) => {
      const press = buttonInteraction as ButtonInteraction;

      if (press.user.id !== interaction.user.id) {
        await press.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> This isn\'t for you!')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });

        return;
      }

      if (press.customId === 'cases_previous') {
        pageNum--;
        if (pageNum < 0) pageNum = 0;
        const embeds = await CasesCommand.createEmbeds(targetUser, pageNum);
        totalPages = embeds.total;
        await press.update({
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents([
              new ButtonBuilder()
                .setCustomId('cases_previous')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('cases_page')
                .setLabel(`Page ${pageNum + 1}/${Math.ceil(embeds.total / 10)}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('cases_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary),
            ]),
          ],
          embeds: embeds.embeds,
        }).catch(() => console.log(`Failed to update reply - ${__filename}`));
      } else if (press.customId === 'cases_next') {
        pageNum++;
        if (pageNum >= totalPages) pageNum = totalPages - 1;
        const embeds = await CasesCommand.createEmbeds(targetUser, pageNum);
        totalPages = embeds.total;
        await press.update({
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents([
              new ButtonBuilder()
                .setCustomId('cases_previous')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('cases_page')
                .setLabel(`Page ${pageNum + 1}/${Math.ceil(embeds.total / 10)}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('cases_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary),
            ]),
          ],
          embeds: embeds.embeds,
        }).catch(() => console.log(`Failed to update reply - ${__filename}`));
      }
    });

    pageCollector.on('end', async () => {
      await interaction.editReply({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
              .setCustomId('cases_previous')
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('cases_page')
              .setLabel(`Page ${pageNum + 1}/${Math.ceil(embeds.total / 10)}`)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('cases_next')
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          ]),
        ],
      }).catch(() => console.log(`Failed to edit reply - ${__filename}`));
    });
  }

  /**
   * @description - Creates an embed for a page of cases
   * @param {User} user - The user to get cases for
   * @param {number=} page - The page number
   * @return {Promise<{embeds: EmbedBuilder[], total: number}>} - The embeds for the page, and total number of cases
   */
  static async createEmbeds(user: User, page = 0): Promise<{embeds: EmbedBuilder[], total: number}> {
    const cases = await DataUtils.db.prepare('SELECT * FROM cases WHERE user_id = ?').catch(() => null);
    if (!cases) throw new Error('Failed to get cases from database.');
    const casesData = await cases.all(user.id).catch(() => []);

    const embeds: EmbedBuilder[] = [];

    const parseDuration = ((duration: number): string => {// Parse the time in seconds to a human readable format
      const parsedDuration: string[] = [];
      if (duration !== -1) {
        let seconds = duration;
        const y = Math.floor(seconds / 60 / 60 / 24 / 365.25);
        seconds %= 60 * 60 * 24 * 365.25;
        const mo = Math.floor(seconds / 60 / 60 / 24 / 30.4375);
        seconds %= 60 * 60 * 24 * 30.4375;
        const d = Math.floor(seconds / 60 / 60 / 24);
        seconds %= 60 * 60 * 24;
        const h = Math.floor(seconds / 60 / 60);
        seconds %= 60 * 60;
        const m = Math.floor(seconds / 60);
        seconds %= 60;
        const s = seconds;

        if (y > 0) parsedDuration.push(`${y} year${y > 1 ? 's' : ''}`);
        if (mo > 0) parsedDuration.push(`${mo} month${mo > 1 ? 's' : ''}`);
        if (d > 0) parsedDuration.push(`${d} day${d > 1 ? 's' : ''}`);
        if (h > 0) parsedDuration.push(`${h} hour${h > 1 ? 's' : ''}`);
        if (m > 0) parsedDuration.push(`${m} minute${m > 1 ? 's' : ''}`);
        if (s > 0) parsedDuration.push(`${s} second${s > 1 ? 's' : ''}`);
      } else parsedDuration.push('Permanent');
      return parsedDuration.join(', ');
    });

    // Sort by case number and create embeds
    casesData.sort((a, b) => b.case_number - a.case_number).slice(page * 10, page * 10 + 10)
      .forEach((caseData) => {
        if (caseData.type === 'ban') {
          const embed = new EmbedBuilder()
            .setTitle(`<:Ban:1087961794649264178> Case #${caseData.case_number} \\|\\| Ban${!caseData.active && ' \\|\\| Expired'}`)
            .setDescription(caseData.reason)
            .addFields([
              {
                inline: true,
                name: 'Moderator',
                value: `<@${caseData.issuer_id}>`,
              },
              {
                inline: true,
                name: 'User',
                value: `<@${caseData.user_id}>`,
              },
              {
                inline: true,
                name: 'Length',
                value: `${parseDuration(caseData.duration)}`,
              },
              {
                inline: true,
                name: '\u200b',
                value: `[Jump](${caseData.link})`,
              },
              {
                inline: true,
                name: 'Date',
                value: `<t:${Math.floor(caseData.timestamp / 1000)}:F> (<t:${Math.floor(caseData.timestamp / 1000)}:R>)`,
              },
            ])
            .setColor(caseData.active ? '#ef4444' : '#111111')
            .setFooter({text: `${caseData.case_id}`})
            .setTimestamp(caseData.timestamp);
          embeds.push(embed);
        }
        if (caseData.type === 'kick') {
          const embed = new EmbedBuilder()
            .setTitle(`<:Kick:1087962888276295720> Case #${caseData.case_number} \\|\\| Kick`)
            .setDescription(caseData.reason)
            .addFields([
              {
                inline: true,
                name: 'Moderator',
                value: `<@${caseData.issuer_id}>`,
              },
              {
                inline: true,
                name: 'User',
                value: `<@${caseData.user_id}>`,
              },
              {
                inline: true,
                name: '\u200b',
                value: `[Jump](${caseData.link})`,
              },
              {
                inline: false,
                name: 'Date',
                value: `<t:${Math.floor(caseData.timestamp / 1000)}:F> (<t:${Math.floor(caseData.timestamp / 1000)}:R>)`,
              },
            ])
            .setColor('#ef4444')
            .setFooter({text: `${caseData.case_id}`})
            .setTimestamp(caseData.timestamp);
          embeds.push(embed);
        }
        if (caseData.type === 'mute') {
          const embed = new EmbedBuilder()
            .setTitle(`<:Mute:1087890259477536939> Case #${caseData.case_number} \\|\\| Mute${!caseData.active && ' \\|\\| Expired'}`)
            .setDescription(caseData.reason)
            .addFields([
              {
                inline: true,
                name: 'Moderator',
                value: `<@${caseData.issuer_id}>`,
              },
              {
                inline: true,
                name: 'User',
                value: `<@${caseData.user_id}>`,
              },
              {
                inline: true,
                name: 'Length',
                value: `${parseDuration(caseData.duration)}`,
              },
              {
                inline: true,
                name: '\u200b',
                value: `[Jump](${caseData.link})`,
              },
              {
                inline: true,
                name: 'Date',
                value: `<t:${Math.floor(caseData.timestamp / 1000)}:F> (<t:${Math.floor(caseData.timestamp / 1000)}:R>)`,
              },
            ])
            .setColor(caseData.active ? '#6366f1' : '#111111')
            .setFooter({text: `${caseData.case_id}`})
            .setTimestamp(caseData.timestamp);
          embeds.push(embed);
        }
        if (caseData.type === 'warn') {
          const embed = new EmbedBuilder()
            .setTitle(`<:Warn:1087961063468834816> Case #${caseData.case_number} \\|\\| Warn`)
            .setDescription(caseData.reason)
            .addFields([
              {
                inline: true,
                name: 'Moderator',
                value: `<@${caseData.issuer_id}>`,
              },
              {
                inline: true,
                name: 'User',
                value: `<@${caseData.user_id}>`,
              },
              {
                inline: true,
                name: '\u200b',
                value: `[Jump](${caseData.link})`,
              },
              {
                inline: false,
                name: 'Date',
                value: `<t:${Math.floor(caseData.timestamp / 1000)}:F> (<t:${Math.floor(caseData.timestamp / 1000)}:R>)`,
              },
            ])
            .setColor('#f59e0b')
            .setFooter({text: `${caseData.case_id}`})
            .setTimestamp(caseData.timestamp);
          embeds.push(embed);
        }
        if (caseData.type === 'unban') {
          const embed = new EmbedBuilder()
            .setTitle(`<:Ban:1087961794649264178> Case #${caseData.case_number} \\|\\| Unban`)
            .setDescription(caseData.reason)
            .addFields([
              {
                inline: true,
                name: 'Moderator',
                value: `<@${caseData.issuer_id}>`,
              },
              {
                inline: true,
                name: 'User',
                value: `<@${caseData.user_id}>`,
              },
              {
                inline: true,
                name: '\u200b',
                value: `[Jump](${caseData.link})`,
              },
              {
                inline: false,
                name: 'Date',
                value: `<t:${Math.floor(caseData.timestamp / 1000)}:F> (<t:${Math.floor(caseData.timestamp / 1000)}:R>)`,
              },
            ])
            .setColor('#ef4444')
            .setFooter({text: `${caseData.case_id}`})
            .setTimestamp(caseData.timestamp);
          embeds.push(embed);
        }
        if (caseData.type === 'unmute') {
          const embed = new EmbedBuilder()
            .setTitle(`<:Mute:1087890259477536939> Case #${caseData.case_number} \\|\\| Unmute`)
            .setDescription(caseData.reason)
            .addFields([
              {
                inline: true,
                name: 'Moderator',
                value: `<@${caseData.issuer_id}>`,
              },
              {
                inline: true,
                name: 'User',
                value: `<@${caseData.user_id}>`,
              },
              {
                inline: true,
                name: '\u200b',
                value: `[Jump](${caseData.link})`,
              },
              {
                inline: false,
                name: 'Date',
                value: `<t:${Math.floor(caseData.timestamp / 1000)}:F> (<t:${Math.floor(caseData.timestamp / 1000)}:R>)`,
              },
            ])
            .setColor('#6366f1')
            .setFooter({text: `${caseData.case_id}`})
            .setTimestamp(caseData.timestamp);
          embeds.push(embed);
        }
      });

    return {
      embeds,
      total: casesData.length,
    };
  }
}

import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, GuildBasedChannel, ModalBuilder, TextInputBuilder, TextInputStyle} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';
import {randomUUID} from 'crypto';
import VerificationManager from './VerificationManager';
import {listener} from '../../utils/ModuleUtils';
import {client} from '../..';
import TicketManager from '../ticketing/TicketManager';
import WelcomeAndGoodbye from '../messages/WelcomeAndGoodbye';

/**
 * @description - Manages verification flow
 */
export default class Verification {
  /**
   * @description - Creates a new verification application
   * @param {ButtonInteraction} interaction - The interaction that triggered the verification
   */
  @listener('interactionCreate')
  static async create(interaction: ButtonInteraction) {
    if (!interaction.guild || !interaction.isButton() || interaction.customId !== 'verification_begin') return;

    console.log('Reached this point!!');
    const questions = DataUtils.config.verification_questions;
    const id = randomUUID();

    // Send DMs
    const dm = await interaction.user.createDM().catch(() => null);
    if (!dm) return;
    const message = await dm?.send({
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents([
            new ButtonBuilder()
              .setCustomId(`verification_continue_${id}`)
              .setLabel('Continue')
              .setStyle(ButtonStyle.Success),
          ]),
      ],
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle(`Verifying for ${interaction.guild.name}`)
          // eslint-disable-next-line max-len
          .setDescription('To begin verification, press the button below. This process should take around ten minutes. The bot will message you a series of questions. Please answer them to the best of your abilities, and avoid one word or extremely vague responses.\n\n*More detailed responses will be processed faster.*')
          .setTimestamp()
          .setAuthor({
            iconURL: interaction.user.avatarURL() ?? undefined,
            name: interaction.user.tag,
          }),
      ],
    }).catch(() => null);

    if (!message) {
      interaction.reply({
        content: 'I was unable to send you a DM. Please make sure you have DMs enabled and try again.',
        ephemeral: true,
      });
      return;
    } else {
      interaction.reply({
        content: 'Check your DMs!',
        ephemeral: true,
      });
    }

    const collector = dm?.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.customId === `verification_continue_${id}`,
      time: 1000 * 60 * 10,
    });

    collector?.on('collect', async (interaction) => {
      const query = await DataUtils.db.prepare('SELECT * FROM tickets WHERE user_id = ? AND closed = ?').catch(() => null);
      const data = await query?.get(interaction.user.id, 0).catch(() => null);
      if (data && data.ticket_id) {
        TicketManager.close(data.ticket_id, client.user!, 'Verification application submitted');
      }

      interaction.update({});
      let question = 0;
      const responses: string[] = [];

      const dmCollector = dm?.createMessageCollector({
        filter: (m) => m.author.id === interaction.user.id,
        max: questions.length,
        time: 1000 * 60 * 60,
      });

      dm?.send({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle(`Question ${question + 1}`)
            .setDescription(questions[question])
            .setTimestamp()
            .setAuthor({
              iconURL: interaction.user.avatarURL() ?? undefined,
              name: interaction.user.tag,
            }),
        ],
      }).catch(() => null);

      dmCollector?.on('collect', async (message) => {
        question ++;
        responses.push(message.content);

        if (question >= questions.length) {
          VerificationManager.create(
            interaction.user,
            undefined,
            responses.map((r, i) => {
              return {
                answer: r,
                question: questions[i],
              };
            }));
        } else {
          dm?.send({
            content: '',
            embeds: [
              new EmbedBuilder()
                .setTitle(`Question ${question + 1}`)
                .setDescription(questions[question])
                .setTimestamp()
                .setAuthor({
                  iconURL: interaction.user.avatarURL() ?? undefined,
                  name: interaction.user.tag,
                }),
            ],
          }).catch(() => null);
        }
      });
    });

    collector?.on('end', () => {
      if (message && message.editable) {
        message.edit({
          components: [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents([
                new ButtonBuilder()
                  .setCustomId(`verification_continue_${id}`)
                  .setLabel('Continue')
                  .setStyle(ButtonStyle.Success),
              ]),
          ],
        });
      }
    });
  }

  /**
   * @description - Approves a verification application
   * @param {ButtonInteraction} interaction - The interaction that triggered the verification
   */
  @listener('interactionCreate')
  static async approve(interaction: ButtonInteraction) {
    if (!interaction.guild || !interaction.isButton() || !interaction.customId.startsWith('verification_accept_')) return;

    const id = interaction.customId.split('_')[2];
    const embed = interaction.message.embeds[0];
    if (!embed) return;

    const builder = new EmbedBuilder(embed.data);
    builder.setColor('#10b981');
    builder.setTitle(`${builder.data.title} - Accepted`);
    builder.setDescription(`*Accepted by <@${interaction.user.id}>*\n${builder.data.description ?? ''}`);

    await interaction.deferReply().catch(() => null);

    await interaction.message.edit({
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents([
            new ButtonBuilder()
              .setCustomId(`verification_accept_${id}`)
              .setLabel('Accept')
              .setEmoji('<:Success:1000468117878747267>')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`verification_deny_${id}`)
              .setLabel('Deny')
              .setEmoji('<:Failure:1000494098635034674>')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          ]),
      ],
      content: '',
      embeds: [builder],
    }).catch(() => null);

    const user = await VerificationManager.close(id, interaction.guild.members.me!.user, true, 'Application accepted').catch(() => null);
    if (!user) return;

    const role = await interaction.guild.roles.fetch(DataUtils.config.verification_verifiedRole).catch(() => null);
    if (!role) return;

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    await member.roles.add(role).catch(() => null);

    const channel: GuildBasedChannel | null = await interaction.guild.channels.fetch(DataUtils.config.verification_welcomeChannel).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.isThread()) return;
    await WelcomeAndGoodbye.sendWelcome(channel, member.user).catch(() => null);

    await interaction.deleteReply().catch(() => null);
  }

  /**
   * @description - Denies a verification application
   * @param {ButtonInteraction} interaction - The interaction that triggered the verification
   */
  @listener('interactionCreate')
  static async deny(interaction: ButtonInteraction) {
    if (!interaction.guild || !interaction.isButton() || !interaction.customId.startsWith('verification_deny_')) return;

    const modal = new ModalBuilder()
      .setTitle('Deny Verification')
      .setCustomId(`verification_deny_${interaction.customId.split('_')[2]}`)
      .setComponents([
        new ActionRowBuilder<TextInputBuilder>()
          .setComponents([
            new TextInputBuilder()
              .setCustomId('reason')
              .setPlaceholder('Enter a reason for denying this application')
              .setLabel('Reason')
              .setRequired(false)
              .setMaxLength(1000)
              .setStyle(TextInputStyle.Paragraph),
          ]),
      ]);

    await interaction.showModal(modal).catch(() => null);
    const reason = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === modal.data.custom_id,
      time: 1000 * 60 * 10,
    }).catch(() => null);
    if (!reason) return;

    await reason.deferReply().catch(() => null);
    await reason.deleteReply().catch(() => null);

    const id = interaction.customId.split('_')[2];
    const embed = interaction.message.embeds[0];
    if (!embed) return;

    const builder = new EmbedBuilder(embed.data);
    builder.setColor('#ef4444');
    builder.setTitle(`${builder.data.title} - Denied`);
    builder.setDescription(`**Denied by:** <@${interaction.user.id}>\n**Reason:** ${reason.fields.getTextInputValue('reason') ?? 'No reason provided'}`);

    await interaction.message.edit({
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents([
            new ButtonBuilder()
              .setCustomId(`verification_accept_${id}`)
              .setLabel('Accept')
              .setEmoji('<:Success:1000468117878747267>')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`verification_deny_${id}`)
              .setLabel('Deny')
              .setEmoji('<:Failure:1000494098635034674>')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          ]),
      ],
      content: '',
      embeds: [builder],
    }).catch(() => null);

    VerificationManager.close(id, interaction.guild.members.me!.user, false, reason.fields.getTextInputValue('reason') ?? 'No reason provided');
  }
}

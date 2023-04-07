import {ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  DMChannel,
  EmbedBuilder,
  Message,
  MessageComponentInteraction,
  MessageCreateOptions,
  MessagePayload,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
  WebhookMessageCreateOptions} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';
import {listener} from '../../utils/ModuleUtils';
import {client} from '../..';
import TicketManager from './TicketManager';
import {randomBytes} from 'crypto';

/**
 * @description - Handles relaying messages to tickets
 */
export default class RelayHandler {
  /**
   * @description - DM handling
   * @param {Message} message - The message
   */
  @listener('messageCreate')
  static async handleDM(message: Message) {
    if (!message.channel.isDMBased() || message.author.bot) return;

    // If user has a ticket, send message to that ticket
    const ticket = await DataUtils.db.prepare('SELECT * FROM tickets WHERE user_id = ? AND closed = ?').catch(() => null);
    const ticketData = await ticket?.get(message.author.id, 0).catch(() => null);

    if (ticketData) {
      const guild = await client.guilds.fetch(process.env.guild!).catch(() => null);

      const webhooks = await guild?.fetchWebhooks().catch(() => null);
      if (!webhooks) return;
      let webhook = webhooks?.find((webhook) => webhook.channelId === ticketData.channel_id);

      console.log(ticketData.channel_id);
      if (!webhook) {
        const channel = await guild?.channels.fetch(ticketData.channel_id);
        console.log(channel);
        if (channel && channel.isTextBased() && !channel.isThread() && !channel.isVoiceBased()) {
          console.log('here');
          const hook = await channel?.createWebhook({
            avatar: client.user?.avatarURL() ?? undefined,
            name: 'Modmail',
            reason: 'Modmail ticketing',
          });
          webhook = hook ?? undefined;
        }
      }

      const body: MessagePayload | WebhookMessageCreateOptions = {
        avatarURL: message.author.avatarURL() ?? undefined,
        content: message.content,
        embeds: message.embeds,
        files: [...message.attachments.values()],
        threadId: ticketData.thread_id,
        username: message.author.tag.replace(/(c)(lyde)/gi, '$1\u400a$2'),
      };

      const msg = await webhook?.send(body).catch(() => null);
      if (!msg) return;

      await message.react('<:Success:1000468117878747267>').catch(() => null);
    } else {
      if (message.content.toLowerCase().includes('create ticket')) {
        const msg = await message.reply({
          components: [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents([
                new ButtonBuilder()
                  .setCustomId('ticket_create')
                  .setLabel('Yes, create a ticket')
                  .setEmoji('<:Success:1000468117878747267>')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('ticket_cancel')
                  .setLabel('No, nevermind')
                  .setEmoji('<:Failure:1000494098635034674>')
                  .setStyle(ButtonStyle.Secondary),
              ]),
          ],
          content: '',
          embeds: [
            new EmbedBuilder()
              .setTitle('Create ticket?')
            // eslint-disable-next-line max-len
              .setDescription('Are you sure you would like to open a modmail ticket? If you do so, a new thread will be created that allows you to chat one-on-one with the staff. Messages you send to this channel while your ticket is open will be visible to all staff members.')
              .setColor('#6366f1')
              .setAuthor({
                iconURL: message.author.avatarURL() ?? undefined,
                name: message.author.tag,
              })
              .setFooter({text: 'This interaction times out in 30 seconds'})
              .setTimestamp(),
          ],
        }).catch(() => null);
        if (!msg) return;

        const collector = message.channel.createMessageComponentCollector({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === message.author.id && i.message.id === msg?.id,
          max: 1,
          time: 30000,
        });

        collector.on('collect', async (i: MessageComponentInteraction) => {
          if (i.customId === 'ticket_create') {
            await i.deferReply().catch(() => null);
            TicketManager.create(i.user, undefined);
            await i.deleteReply().catch(() => null);
          } else if (i.customId === 'ticket_cancel') {
            await i.reply({
              content: '',
              embeds: [
                new EmbedBuilder()
                  .setDescription('<:Failure:1000494098635034674> Cancelled ticket creation')
                  .setColor('#ef4444'),
              ],
              ephemeral: true,
            }).catch(() => null);
            return;
          }
        });

        collector.on('end', async (collected) => {
          if (!(msg && msg.editable)) return;
          msg?.edit({
            components: [
              new ActionRowBuilder<ButtonBuilder>()
                .addComponents([
                  new ButtonBuilder()
                    .setCustomId('ticket_create')
                    .setLabel('Yes, create a ticket')
                    .setEmoji('<:Success:1000468117878747267>')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                  new ButtonBuilder()
                    .setCustomId('ticket_cancel')
                    .setLabel('No, nevermind')
                    .setEmoji('<:Failure:1000494098635034674>')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                ]),
            ],
          }).catch(() => null);
        });
      }
    }
  }

  /**
   * @description - Thread handling
   * @param {Message} message - The message
   */
  @listener('messageCreate')
  static async handleThread(message: Message) {
    if (!(message.channel instanceof ThreadChannel) || message.author.bot) return;
    if (message.content && message.content.startsWith('>')) return;

    // If user has a ticket, send message to that ticket
    const ticket = await DataUtils.db.prepare('SELECT * FROM tickets WHERE thread_id = ? AND closed = ?').catch(() => null);
    const ticketData = await ticket?.get(message.channel.id, 0).catch(() => null);
    if (!ticketData) return;

    const dmUser = await client.users.fetch(ticketData.user_id).catch(() => null);
    const dm = await dmUser?.createDM().catch(() => null);
    if (!dmUser || !dm) return;

    const body: MessagePayload | MessageCreateOptions = {
      content: message.content,
      embeds: message.embeds,
      files: [...message.attachments.values()],
    };

    const msg = await dm?.send(body).catch(() => null);
    if (!msg) return;

    await message.react('<:Success:1000468117878747267>').catch(() => null);
  }

  /**
   * @description - Close ticket handling
   * @param {ButtonInteraction} interaction - The interaction
   */
  @listener('interactionCreate')
  static async handleClose(interaction: ButtonInteraction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('ticket_close_')) return;
    if (interaction.channel instanceof DMChannel) {
      await interaction.deferReply().catch(() => null);
      TicketManager.close(interaction.customId.split('_')[2], interaction.user, 'Closed by user');
      await interaction.deleteReply().catch(() => null);
    } else {
      const id = randomBytes(32).toString('hex');

      const modal = new ModalBuilder()
        .setCustomId(id)
        .setTitle('Close ticket')
        .setComponents([
          new ActionRowBuilder<TextInputBuilder>()
            .addComponents(
              new TextInputBuilder()
                .setLabel('Reason')
                .setStyle(TextInputStyle.Short)
                .setCustomId('reason')
                .setPlaceholder('Enter a reason for closing this ticket'),
            ),
        ]);

      await interaction.showModal(modal).catch(() => null);
      const collector = await interaction.awaitModalSubmit({
        filter: (i) => i.user.id === interaction.user.id && i.customId === id,
        time: 60000,
      }).catch(() => null);

      await collector?.deferReply().catch(() => null);
      await collector?.deleteReply().catch(() => null);
      TicketManager.close(interaction.customId.split('_')[2], interaction.user, collector?.fields.getTextInputValue('reason') ?? 'No reason provided');
    }
  }
}

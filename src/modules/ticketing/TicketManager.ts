import {ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ForumChannel, ThreadAutoArchiveDuration, ThreadChannel, User} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';
import {randomUUID} from 'crypto';
import {client} from '../..';

/**
 * @description - Manages all ticket related actions
 */
export default class TicketManager {
  /**
   * @description Checks and reopens automatically archived tickets
   */
  constructor() {
    setInterval(async () => {
      const query = await DataUtils.db.prepare('SELECT * FROM tickets WHERE closed = 0').catch(() => null);
      const tickets = await query?.all().catch(() => null);

      tickets?.forEach(async (ticket) => {
        const channel = await client.channels.fetch(ticket.thread_id).catch(() => null);
        if (!channel || !(channel instanceof ThreadChannel)) return;

        if (channel.archived) {
          await channel.setArchived(false).catch(() => null);
        }
      });
    });
  }

  /**
   * @description - Creates a new ticket
   * @param {User} user - The user who created the ticket
   * @param {string=} channelId - The channel to send the ticket to
   */
  static async create(user: User, channelId: string | undefined) {
    const id = randomUUID();

    const guild = await client.guilds.fetch(process.env.guild!).catch(() => null);
    const channel = await guild?.channels.fetch(channelId ?? DataUtils.config.tickets_ticketChannel).catch(() => null);
    if (!channel || !(channel instanceof ForumChannel)) return;

    const thread = await channel.threads.create({
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      message: {
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents([
              new ButtonBuilder()
                .setCustomId(`ticket_close_${id}`)
                .setLabel('Close Ticket')
                .setEmoji('<:Lock:1088533060011704423>')
                .setStyle(ButtonStyle.Secondary),
            ]),
        ],
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle('Modmail Ticket created')
            .setDescription('Close this ticket at any time by pressing the Close Ticket button below. To send a message to this channel only (not visible to the user), prepend > to it.')
            .setAuthor({
              iconURL: user.avatarURL() ?? undefined,
              name: user.tag,
            })
            .addFields([
              {
                inline: true,
                name: 'User',
                value: `<@${user.id}>`,
              },
              {
                inline: true,
                name: 'ID',
                value: `\`${id}\``,
              },
            ])
            .setTimestamp(),
        ],
      },
      name: `${user.tag}'s ticket`,
    }).catch(() => null);

    await user.send({
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents([
            new ButtonBuilder()
              .setCustomId(`ticket_close_${id}`)
              .setLabel('Close Ticket')
              .setEmoji('<:Lock:1088533060011704423>')
              .setStyle(ButtonStyle.Secondary),
          ]),
      ],
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle('Modmail Ticket created')
          .setDescription('Any messages, images, videos, or other files you send here will be visible to staff. To close this ticket, press the `Close Ticket` button below.')
          .setAuthor({
            iconURL: user.avatarURL() ?? undefined,
            name: user.tag,
          })
          .addFields([
            {
              inline: true,
              name: 'User',
              value: `<@${user.id}>`,
            },
            {
              inline: true,
              name: 'ID',
              value: `\`${id}\``,
            },
          ])
          .setTimestamp(),
      ],
    }).catch(() => null);
    if (!thread) return;

    const statement = await DataUtils.db.prepare('INSERT INTO tickets (ticket_id, user_id, thread_id, channel_id, closed_reason, closed) VALUES (?, ?, ?, ?, ?, ?)');
    await statement.run(id, user.id, thread.id, channelId ?? DataUtils.config.tickets_ticketChannel, null, 0);

    return thread;
  }

  /**
   * @description - Closes a ticket
   * @param {string} id - The ticket ID
   * @param {User} actor - The user who closed the ticket
   * @param {string=} reason - The reason for closing the ticket
   */
  static async close(id: string, actor: User, reason?: string) {
    const ticket = await DataUtils.db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').catch(() => null);
    const ticketData = await ticket?.get(id).catch(() => null);
    if (!ticketData) return;

    const guild = await client.guilds.fetch(process.env.guild!).catch(() => null);
    const thread = await guild?.channels.fetch(ticketData.thread_id).catch(() => null);
    if (!thread || !(thread instanceof ThreadChannel)) return;

    const statement = await DataUtils.db.prepare('UPDATE tickets SET closed_reason = ?, closed = ? WHERE ticket_id = ?');
    await statement.run(reason ?? null, 1, id);

    thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('<:Lock:1088533060011704423> Ticket Closed')
          .setColor('#6366f1')
          .setDescription('This ticket was marked as resolved. Messages will no longer be sent or received between this channel and the user.')
          .addFields([
            {
              inline: true,
              name: 'Closed by',
              value: `<@${actor.id}>`,
            },
            {
              inline: true,
              name: 'Reason',
              value: reason ?? 'No reason provided',
            },
          ])
          .setAuthor({
            iconURL: actor.avatarURL() ?? undefined,
            name: actor.tag,
          })
          .setTimestamp(),
      ],
    });
    await thread.setName(`[Closed] ${thread.name}`).catch(() => null);
    await thread.setArchived(true, 'Ticket closed').catch(() => null);

    const user = await client.users.fetch(ticketData.user_id).catch(() => null);
    if (!user) return;

    await user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('<:Lock:1088533060011704423> Ticket Closed')
          .setColor('#6366f1')
          // eslint-disable-next-line max-len
          .setDescription('Your ticket has been closed by a moderator. If you require any further assistance, please open a new ticket. Messages sent here will no longer be shared in the thread channel.')
          .addFields([
            {
              name: 'Reason',
              value: reason ?? 'No reason provided',
            },
          ])
          .setTimestamp(),
      ],
    }).catch(() => null);
  }
}

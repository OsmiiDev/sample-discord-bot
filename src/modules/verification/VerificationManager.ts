import {ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel, ThreadAutoArchiveDuration, ThreadChannel, User} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';
import {randomUUID} from 'crypto';
import {client} from '../..';
import TicketManager from '../ticketing/TicketManager';
import WelcomeAndGoodbye from '../messages/WelcomeAndGoodbye';

/**
 * @description - Manages all verification related actions
 */
export default class VerificationManager {
  /**
   * @description - Creates a new verification application
   * @param {User} user - The user who created the application
   * @param {string=} channelId - The channel to send the application to
   * @param {{question: string, answer: string}[]} questions - The responses provided by the user
   */
  static async create(user: User, channelId: string | undefined, questions: {question: string, answer: string}[]) {
    const id = randomUUID();

    const guild = await client.guilds.fetch(process.env.guild!).catch(() => null);
    const channel = await guild?.channels.fetch(DataUtils.config.verification_verificationChannel).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) return;
    console.log(questions);
    const startMessage = await channel.send({
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents([
            new ButtonBuilder()
              .setCustomId(`verification_accept_${id}`)
              .setLabel('Accept')
              .setEmoji('<:Success:1000468117878747267>')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`verification_deny_${id}`)
              .setLabel('Deny')
              .setEmoji('<:Failure:1000494098635034674>')
              .setStyle(ButtonStyle.Secondary),
          ]),
      ],
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle(`${user.tag}'s verification application`)
          .setAuthor({
            iconURL: user.avatarURL() ?? undefined,
            name: user.tag,
          })
          .setThumbnail(user.avatarURL())
          .addFields([
            {
              inline: true,
              name: 'User',
              value: `<@${user.id}>`,
            },
            {
              inline: true,
              name: 'Account Created',
              value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
            },
            {
              inline: true,
              name: 'Joined Server',
              value: `<t:${Math.floor((guild?.members.cache.get(user.id)?.joinedTimestamp ?? 0) / 1000)}:R>`,
            },
            {
              inline: false,
              name: '\u200b',
              value: '\u200b',
            },
            ...questions.map((question) => ({
              inline: true,
              name: question.question,
              value: question.answer,
            })),
          ]),
      ],
    });
    if (!startMessage) return;

    const thread = await channel.threads.create({
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      name: `${user.tag}'s verification application`,
      startMessage: startMessage,
    }).catch(() => null);

    await user.send({
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle('Verification Application Submitted!')
          // eslint-disable-next-line max-len
          .setDescription('All done! Your verification application has been placed in a queue and will be reviewed by staff. You will be automatically notified once this is finished. If staff wish to ask you questions about your verification, you can communicate with them privately here.')
          .setAuthor({
            iconURL: user.avatarURL() ?? undefined,
            name: user.tag,
          })
          .setThumbnail(user.avatarURL())
          .setTimestamp(),
      ],
    }).catch(() => null);
    if (!thread) return;

    const query = await DataUtils.db.prepare('SELECT * FROM tickets WHERE user_id = ? AND closed = ?').catch(() => null);
    const data = await query?.get(user.id, 0).catch(() => null);
    if (data && data.ticket_id) {
      TicketManager.close(data.ticket_id, client.user!, 'Verification application submitted');
    }

    const statement = await DataUtils.db.prepare('INSERT INTO tickets (ticket_id, user_id, channel_id, thread_id, closed_reason, closed) VALUES (?, ?, ?, ?, ?, ?)').catch(() => null);
    await statement?.run(id, user.id, channelId ?? DataUtils.config.verification_verificationChannel, thread.id, null, 0).catch(() => null);

    const app = await DataUtils.db.prepare('INSERT INTO applications (application_id, user_id, type, answers, result) VALUES (?, ?, ?, ?, ?)').catch(() => null);
    await app?.run(id, user.id, 'verification', JSON.stringify(questions), 0).catch(() => null);

    return thread;
  }

  /**
   * @description - Closes a ticket
   * @param {string} id - The ticket ID
   * @param {User} actor - The user who closed the ticket
   * @param {bool} approved - Whether or not the ticket was approved
   * @param {string=} reason - The reason for closing the ticket
   */
  static async close(id: string, actor: User, approved: boolean, reason?: string) {
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
              name: 'Closed by',
              value: `<@${actor.id}>`,
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

    if (!approved) {
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('<:Lock:1088533060011704423> Verification Closed')
            .setColor('#6366f1')
          // eslint-disable-next-line max-len
            .setDescription('Your verification application was denied.')
            .addFields([
              {
                name: 'Reason',
                value: reason ?? 'No reason provided',
              },
            ])
            .setTimestamp(),
        ],
      }).catch(() => null);
    } else {
      const message = WelcomeAndGoodbye.replaceVariables(DataUtils.config.welcome_message, [
        {
          from: 'servername',
          to: guild?.name ?? 'Server',
        },
        {
          from: 'user',
          to: user.username,
        },
        {
          from: 'usermention',
          to: `<@${user.id}>`,
        },
        {
          from: 'membercount',
          to: guild?.memberCount.toString() ?? '0',
        },
      ]);

      await user.send(message).catch(() => null);
    }

    const query = await DataUtils.db.prepare('UPDATE applications SET result = ? WHERE application_id = ?').catch(() => null);
    if (!query) return;
    query.run(approved ? 1 : 2, id).catch(() => null);

    return user;
  }
}

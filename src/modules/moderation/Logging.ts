import {APIEmbedField, CategoryChannel, EmbedBuilder, GuildMember, Message, User} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';
import {client} from '../..';

export interface PunishmentResult {
  success: boolean;
  message: string;
}

/**
 * @description - Class for managing punishment logs
 */
export default class PunishmentLogger {
  /**
   * @description - Creates a new case
   * @param {string} id - The ID of the case
   * @param {User} user - The user who was punished
   * @param {GuildMember} moderator - The moderator who punished the user
   * @param {string} type - The type of punishment
   * @param {string} reason - The reason for the punishment
   * @param {number?} duration - The duration of the punishment in seconds (-1 for permanent)
   * @return {Promise<string|null>} - The case ID
   */
  static async createCase(id: string, user: User, moderator: GuildMember, type: string, reason: string, duration: number | undefined): Promise<string|null> {
    const query = await DataUtils.db.prepare('SELECT * FROM cases').catch(() => null);
    const cases = await query?.all().catch(() => null);

    const num = cases?.length || 0;
    // eslint-disable-next-line max-len
    const statement = await DataUtils.db.prepare('INSERT INTO cases (case_id, case_number, user_id, issuer_id, reason, timestamp, type, duration, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').catch(() => null);
    await statement?.run(id, num + 1, user.id, moderator.id, reason, Date.now(), type, duration, null);

    let parsedDuration: string[] | string = [];
    if (duration && duration !== -1) {
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
    }
    parsedDuration = parsedDuration.join(', ');

    const fields: APIEmbedField[] = [
      {
        inline: true,
        name: 'User',
        value: `<@${user.id}>`,
      },
      {
        inline: true,
        name: 'Moderator',
        value: `<@${moderator.id}>`,
      },
      duration && parsedDuration ? {
        inline: true,
        name: 'Length',
        value: duration === -1 ? 'Permanent' : parsedDuration,
      } : null,
      duration && parsedDuration ? {
        inline: true,
        name: 'Expires',
        value: duration === -1 ? 'Never' : `<t:${Math.floor(Date.now() / 1000) + duration}:R>`,
      } : null,
      {
        inline: false,
        name: 'Reason',
        value: reason,
      },
    ].filter((f) => f !== null) as APIEmbedField[];

    const types: {[key: string] : string} = {
      ban: 'Ban',
      kick: 'Kick',
      mute: 'Mute',
      unban: 'Unban',
      unmute: 'Unmute',
      warn: 'Warn',
    };

    const embed = new EmbedBuilder()
      .setAuthor({
        iconURL: user.displayAvatarURL()!,
        name: `Case #${cases?.length ? cases.length + 1 : 1} \\|\\| ${types[type] ?? type} \\|\\| ${user.tag}`,
      })
      .addFields(fields)
      .setFooter({text: `Case ID: ${id}`})
      .setTimestamp()
      .setColor({
        ban: 0xf43f5e,
        kick: 0xef4444,
        mute: 0xf43f5e,
        unban: 0x0d9488,
        unmute: 0x0d9488,
        warn: 0xeab308,
      }[type] || 0x000000);

    const guild = await client.guilds.fetch(process.env.guild!).catch(() => null);
    const channel = await guild?.channels.fetch(DataUtils.config.moderation_modlogChannel).catch(() => null);

    if (channel && !(channel instanceof CategoryChannel)) {
      const message = await (channel as Message['channel']).send({embeds: [embed]}).catch(() => null);
      if (message) {
        const statement = await DataUtils.db.prepare('UPDATE cases SET link = ? WHERE case_id = ?').catch(() => null);
        await statement?.run(message.url, id);
      }
    }

    return null;
  }
}


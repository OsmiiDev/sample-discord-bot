import {EmbedBuilder, GuildMember, Message, User} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';
import {randomUUID} from 'crypto';
import {logger} from '../../utils/LoggingUtils';
import PunishmentLogger from './Logging';

export interface PunishmentResult {
  success: boolean;
  message: string;
}

/**
 * @description - Class for managing bans
 */
export default class Ban {
  /**
   * @description - Creates a new ban
   * @param {User} user - The user to ban
   * @param {GuildMember} moderator - The moderator who banned the user
   * @param {string} reason - The reason for the ban
   * @param {number} duration - The duration of the ban in seconds (-1 for permanent)
   * @return {Promise<PunishmentResult[]>} - Results of the ban
   */
  static async createBan(user: User, moderator: GuildMember, reason: string, duration: number): Promise<PunishmentResult[]> {
    const id = randomUUID();

    const stepBan = {
      message: 'Failed to ban the user',
      success: false,
    };
    const stepDM = {
      message: '*I couldn\'t DM the user*',
      success: false,
    };

    try {
      const permanent = duration === -1;

      // Parse the time in seconds to a human readable format
      let parsedDuration: string[] | string = [];
      if (!permanent) {
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

      // Query to insert the ban into the database
      const statement = await DataUtils.db.prepare(
        'INSERT INTO bans (ban_id, user_id, issuer_id, reason, timestamp, duration, end, permanent, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).catch(() => null);
      await statement?.run(id, user.id, moderator.id, reason, Date.now(), duration, Date.now() + duration * 1000, permanent, true).catch(() => null);

      stepBan.message = `User \`${user.tag}\` was banned${permanent ? ' permanently' : ` for \`${parsedDuration}\``} with reason ${reason}`;
      stepBan.success = true;

      // DM the user
      const dm = await user.createDM().catch(() => null);
      if (dm) {
        const message = await dm.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`<:Ban:1087961794649264178> You have been banned from ${moderator.guild.name}`)
              .addFields([
                {
                  inline: true,
                  name: 'Reason',
                  value: reason,
                },
                {
                  inline: true,
                  name: 'Ban expires',
                  value: permanent ? 'Never' : `<t:${Math.floor(new Date(Date.now() + duration * 1000).getTime() / 1000)}:R>`,
                },
              ])
              .setColor('#6366f1')
              .setTimestamp(new Date().getTime())
              .setAuthor({
                iconURL: moderator.guild.iconURL() ?? undefined,
                name: moderator.guild.name,
              }),
          ],
        }).catch(() => null);

        if (message instanceof Message) {
          stepDM.message = 'Sent a DM to the user';
          stepDM.success = true;
        }
      }

      // Ban the user
      if ((await moderator.guild.members.fetchMe()).permissions.has('BanMembers')) {
        const member: GuildMember | null = await moderator.guild.members.fetch(user).catch(() => null);
        if (member) {
          if (member.bannable) await member.ban({reason: reason.slice(0, 500)}).catch(() => null);
          else {
            stepBan.message = 'I don\'t have permission to ban this user';
            stepBan.success = false;
          }
        } else await moderator.guild.bans.create(user, {reason: reason.slice(0, 500)}).catch(() => null);
      } else {
        stepBan.message = 'I don\'t have permission to ban users';
        stepBan.success = false;
      }

      // @TODO Implement logging
    } catch (e) {
      logger.error(e);
    }

    PunishmentLogger.createCase(randomUUID(), user, moderator, 'unban', reason, duration);

    return [stepBan, stepDM];
  }

  /**
   * @description - Unbans a user
   * @param {User} user - The user to unban
   * @param {GuildMember} moderator - The moderator who unbanned the user
   * @param {string} reason - The reason for the unban
   * @return {Promise<PunishmentResult[]>} - Results of the unban
   */
  static async createUnban(user: User, moderator: GuildMember, reason: string): Promise<PunishmentResult[]> {
    const stepUnban = {
      message: 'Failed to create an unban',
      success: false,
    };
    const stepDM = {
      message: '*I couldn\'t DM the user*',
      success: false,
    };

    try {
      // Get if the user has an active ban
      const statement = await DataUtils.db.prepare('SELECT * FROM bans WHERE user_id = ? AND active = ?').catch(() => null);
      const result = statement?.get(user.id, true);

      // If the user has an active ban, update the database
      if (result) {
        const statement = await DataUtils.db.prepare('UPDATE bans SET active = ? WHERE user_id = ? AND active = ?').catch(() => null);
        await statement?.run(false, user.id, true);
      }

      stepUnban.message = `User \`${user.tag}\` was unbanned with reason ${reason}`;
      stepUnban.success = true;

      // DM the user
      const dm = await user.createDM().catch(() => null);
      if (dm) {
        const message = await dm.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`<:Ban:1087961794649264178> You have been unbanned from ${moderator.guild.name}`)
              .addFields([
                {
                  inline: true,
                  name: 'Reason',
                  value: reason,
                },
              ])
              .setColor('#6366f1')
              .setTimestamp(new Date().getTime())
              .setAuthor({
                iconURL: moderator.guild.iconURL()?.toString() ?? undefined,
                name: moderator.guild.name,
              }),
          ],
        }).catch(() => null);

        if (message instanceof Message) {
          stepDM.message = 'Sent a DM to the user';
          stepDM.success = true;
        }
      }

      // Unban the user
      if ((await moderator.guild.members.fetchMe()).permissions.has('BanMembers')) {
        await moderator.guild.bans.remove(user, reason.slice(0, 500)).catch(() => null);
      } else {
        stepUnban.message = 'I don\'t have permission to unban users';
        stepUnban.success = false;
      }
    } catch (e) {
      logger.error(e);
    }

    PunishmentLogger.createCase(randomUUID(), user, moderator, 'unban', reason, undefined);

    return [stepUnban, stepDM];
  }
}

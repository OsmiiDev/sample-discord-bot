import {EmbedBuilder, GuildMember, Message} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';
import {randomUUID} from 'crypto';
import {logger} from '../../utils/LoggingUtils';
import PunishmentLogger from './Logging';

export interface PunishmentResult {
  success: boolean;
  message: string;
}

/**
 * @description - Class for managing mutes
 */
export default class Mute {
  /**
   * @description - Creates a new mute
   * @param {GuildMember} member - The user to mute
   * @param {GuildMember} moderator - The moderator who muted the user
   * @param {string} reason - The reason for the mute
   * @param {number} duration - The duration of the mute in seconds (-1 for permanent)
   * @return {Promise<PunishmentResult[]>} - Results of the mute
   */
  static async createMute(member: GuildMember, moderator: GuildMember, reason: string, duration: number): Promise<PunishmentResult[]> {
    const id = randomUUID();

    const stepMute = {
      message: 'Failed to create a mute',
      success: false,
    };
    const stepAddRole = {
      message: 'Failed to add the muted role',
      success: false,
    };
    const stepAddTimeout = {
      message: 'Failed to time the user out',
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

      // Query to insert the mute into the database
      const statement = await DataUtils.db.prepare(
        'INSERT INTO mutes (mute_id, user_id, issuer_id, reason, timestamp, duration, end, permanent, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).catch(() => null);
      await statement?.run(id, member.id, moderator.id, reason, Date.now(), duration, Date.now() + duration * 1000, permanent, true).catch(() => null);

      stepMute.message = `User \`${member.user.tag}\` was muted${permanent ? ' permanently' : ` for \`${parsedDuration}\``} with reason ${reason}`;
      stepMute.success = true;

      // Add the muted role to the user
      const mutedRole = DataUtils.config.moderation_mutedRole;
      const role = await member.guild.roles.fetch(mutedRole).catch(() => null);
      if (role) {
        await member.roles.add(role).catch(() => null);
        stepAddRole.message = `Added role <@&${role.id}> to user`;
        stepAddRole.success = true;
      } else stepAddRole.message = 'Failed to add role: Role not found';

      // Add a timeout to the user
      if (member.moderatable && !permanent) {
        stepAddTimeout.success = true;
        if (member.isCommunicationDisabled()) stepAddTimeout.message = 'Updated already existing timeout for user';
        else stepAddTimeout.message = 'Added timeout to user';
        member.timeout(Math.min(duration, 60 * 60 * 24 * 14) * 1000, reason.slice(0, 500)).catch(() => null);
      } else if (permanent) stepAddTimeout.message = 'Failed to add timeout: Mute is permanent';
      else stepAddTimeout.message = 'Failed to add timeout: User is not moderatable';

      // DM the user
      const dm = await member.user.createDM().catch(() => null);
      if (dm) {
        const message = await dm.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`<:Mute:1087890259477536939> You have been muted in ${moderator.guild.name}`)
              .addFields([
                {
                  inline: true,
                  name: 'Reason',
                  value: reason,
                },
                {
                  inline: true,
                  name: 'Mute expires',
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

      // @TODO Implement logging
    } catch (e) {
      logger.error(e);
    }

    PunishmentLogger.createCase(id, member.user, moderator, 'mute', reason, duration);

    return [stepMute, stepAddRole, stepAddTimeout, stepDM];
  }

  /**
   * @description - Unmutes a user
   * @param {GuildMember} member - The user to unmute
   * @param {GuildMember} moderator - The moderator who unmuted the user
   * @param {string} reason - The reason for the unmute
   * @return {Promise<PunishmentResult[]>} - Results of the unmute
   */
  static async createUnmute(member: GuildMember, moderator: GuildMember, reason: string): Promise<PunishmentResult[]> {
    const stepUnmute = {
      message: 'Failed to create an unmute',
      success: false,
    };
    const stepRemoveRole = {
      message: 'Failed to remove the muted role',
      success: false,
    };
    const stepRemoveTimeout = {
      message: 'Failed to remove the timeout',
      success: false,
    };
    const stepDM = {
      message: '*I couldn\'t DM the user*',
      success: false,
    };

    try {
      // Get if the user has an active mute
      const statement = await DataUtils.db.prepare('SELECT * FROM mutes WHERE user_id = ? AND active = ?').catch(() => null);
      const result = statement?.get(member.id, true);

      // If the user has an active mute, update the database
      if (result) {
        const statement = await DataUtils.db.prepare('UPDATE mutes SET active = ? WHERE user_id = ? AND active = ?').catch(() => null);
        await statement?.run(false, member.id, true);
      }

      stepUnmute.message = `User \`${member.user.tag}\` was unmuted with reason ${reason}`;
      stepUnmute.success = true;

      // Remove the muted role from the user
      const mutedRole = DataUtils.config.moderation_mutedRole;
      const role = await member.guild.roles.fetch(mutedRole).catch(() => null);
      if (role) {
        await member.roles.remove(role).catch(() => null);
        stepRemoveRole.message = `Removed role <@&${role.id}> from user`;
        stepRemoveRole.success = true;
      } else stepRemoveRole.message = 'Failed to remove role: Role not found';

      // Remove the timeout from the user
      if (member.moderatable) {
        stepRemoveTimeout.success = true;
        if (member.isCommunicationDisabled()) stepRemoveTimeout.message = 'Removed timeout from user';
        else stepRemoveTimeout.message = 'User does not have a timeout';
        member.timeout(null, reason.slice(0, 500)).catch(() => null);
      } else stepRemoveTimeout.message = 'Failed to remove timeout: User is not moderatable';

      // DM the user
      const dm = await member.user.createDM().catch(() => null);
      if (dm) {
        const message = await dm.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`<:Mute:1087890259477536939> You have been unmuted in ${moderator.guild.name}`)
              .addFields([
                {
                  inline: true,
                  name: 'Reason',
                  value: reason,
                },
              ])
              .setColor('#00ff33')
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
    } catch (e) {
      logger.error(e);
    }

    PunishmentLogger.createCase(randomUUID(), member.user, moderator, 'unmute', reason, undefined);

    return [stepUnmute, stepRemoveRole, stepRemoveTimeout, stepDM];
  }
}

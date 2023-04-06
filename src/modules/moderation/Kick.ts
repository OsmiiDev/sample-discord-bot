import {EmbedBuilder, GuildMember, Message} from 'discord.js';
import {logger} from '../../utils/LoggingUtils';
import {randomUUID} from 'crypto';
import PunishmentLogger from './Logging';

export interface PunishmentResult {
  success: boolean;
  message: string;
}

/**
 * @description - Class for managing kicks
 */
export default class Kick {
  /**
   * @description - Kicks a user
   * @param {GuildMember} member - The user to kick
   * @param {GuildMember} moderator - The moderator who kicked the user
   * @param {string} reason - The reason for the kick
   * @return {Promise<PunishmentResult[]>} - Result of the kick
   */
  static async createKick(member: GuildMember, moderator: GuildMember, reason: string): Promise<PunishmentResult[]> {
    const stepKick = {
      message: 'Failed to kick the user',
      success: false,
    };
    const stepDM = {
      message: 'I couldn\'t DM the user',
      success: false,
    };

    try {
      // DM the user
      const dm = await member.user.createDM().catch(() => null);
      if (dm) {
        const message = await dm.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`<:Kick:1087962888276295720> You have been kicked from ${moderator.guild.name}`)
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

      if (member && member.kickable) {
        await member.kick(reason);
        stepKick.message = `Kicked \`${member.user.tag}\` with reason ${reason}`;
        stepKick.success = true;
      }

      // @TODO Implement logging
    } catch (e) {
      logger.error(e);
    }

    PunishmentLogger.createCase(randomUUID(), member.user, moderator, 'kick', reason, undefined);

    return [stepKick, stepDM];
  }
}

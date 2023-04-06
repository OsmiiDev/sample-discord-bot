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
 * @description - Class for managing warnings
 */
export default class Warn {
  /**
   * @description - Creates a new warning
   * @param {User} user - The user to warn
   * @param {GuildMember} moderator - The moderator who warned the user
   * @param {string} reason - The reason for the warning
   * @return {Promise<PunishmentResult[]>} - Result of the warning
   */
  static async createWarn(user: User, moderator: GuildMember, reason: string): Promise<PunishmentResult[]> {
    const id = randomUUID();

    const stepWarn = {
      message: 'Failed to add a warning',
      success: false,
    };
    const stepDM = {
      message: 'I couldn\'t DM the user',
      success: false,
    };

    try {
      const statement = await DataUtils.db.prepare('INSERT INTO warns (warn_id, user_id, issuer_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)').catch(() => null);
      await statement?.run(id, user.id, moderator.id, reason, Date.now());

      stepWarn.message = `Warning added for \`${user.tag}\` with reason ${reason}`;
      stepWarn.success = true;

      // DM the user
      const dm = await user.createDM().catch(() => null);
      if (dm) {
        const message = await dm.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`<:Warn:1087961063468834816> You have been warned in ${moderator.guild.name}`)
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

      // @TODO Implement logging
    } catch (e) {
      logger.error(e);
    }

    PunishmentLogger.createCase(id, user, moderator, 'warn', reason, undefined);
    return [stepWarn, stepDM];
  }
}

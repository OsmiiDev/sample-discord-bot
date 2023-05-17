import Ban from './Ban';
import {DataUtils} from '../../utils/DataUtils';
import {GuildMember} from 'discord.js';
import Mute from './Mute';
import {client} from '../..';
import {listener} from '../../utils/ModuleUtils';
import {logger} from '../../utils/LoggingUtils';

/**
 * @description - Continously checks for expired cases
 */
export default class UpdateCase {
  /**
   * @description - Runs the update case loop
   */
  static async run() {
    const guild = await client.guilds.fetch(process.env.guild!).catch(() => null);
    logger.info('Updating cases...');

    // Update bans
    const bans = await DataUtils.db.prepare('SELECT * FROM bans WHERE active = ?').catch(() => null);
    const banData = await bans?.all(true).catch(() => null);

    if (banData) {
      for (const ban of banData) {
        if (ban.duration !== -1 && ban.end && ban.end < Date.now()) {
          const statement = await DataUtils.db.prepare('UPDATE bans SET active = ? WHERE ban_id = ? AND active = ?').catch(() => null);
          await statement?.run(false, ban.mute_id, true);

          if (guild) {
            const user = await client.users.fetch(ban.user_id).catch(() => null);
            if (user) Ban.createUnban(user, await guild?.members.fetchMe(), 'Auto - Expired');
          }
        }
      }
    }

    // Update mutes
    const mutes = await DataUtils.db.prepare('SELECT * FROM mutes WHERE active = ?').catch(() => null);
    const muteData = await mutes?.all(true).catch(() => null);

    if (muteData) {
      for (const mute of muteData) {
        if (mute.duration !== -1 && mute.end && mute.end < Date.now()) {
          const statement = await DataUtils.db.prepare('UPDATE mutes SET active = ? WHERE mute_id = ? AND active = ?').catch(() => null);
          await statement?.run(false, mute.mute_id, true);

          if (guild) {
            const member = await guild?.members.fetch(mute.user_id).catch(() => null);
            if (member) Mute.createUnmute(member, await guild?.members.fetchMe(), 'Auto - Expired');
          }
        } else {
          const member = await guild?.members.fetch(mute.user_id).catch(() => null);

          if (!member?.isCommunicationDisabled() && member?.moderatable) {
            const remaining = mute.end ? mute.end - Date.now() : 0;
            member.timeout(Math.min(remaining, 60 * 60 * 24 * 7 * 2), 'Auto - Mute').catch(() => null);
          }
        }
      }
    }
  }

  /**
   * @description - Listens for new users joining the server to reapply mutes
   * @param {GuildMember} member - The member who joined the server
   */
  @listener('guildMemberAdd')
  static async onGuildMemberAdd(member: GuildMember) {
    const statement = await DataUtils.db.prepare('SELECT * FROM mutes WHERE user_id = ? AND active = ?').catch(() => null);
    const result = await statement?.get(member.id, true).catch(() => null);

    if (result) {
      const role = await member.guild.roles.fetch(DataUtils.config.moderation_mutedRole).catch(() => null);
      if (role) member.roles.add(role).catch(() => null);
    }
  }
}

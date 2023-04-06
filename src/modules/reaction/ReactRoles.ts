import {Message, MessageReaction, User} from 'discord.js';
import {listener} from '../../utils/ModuleUtils';
import {DataUtils} from '../../utils/DataUtils';

/**
 * @description - Reaction roles
 */
export default class ReactRoles {
  /**
   * @description - Handle reaction add
   * @param {MessageReaction} reaction - The reaction
   * @param {User} user - The user who reacted
   */
  @listener('messageReactionAdd')
  static async add(reaction: MessageReaction, user: User) {
    if (user.bot) return;
    const message = reaction.message;
    const member = await message.guild?.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const roles = await DataUtils.db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?').catch(() => null);
    const roleData = await roles?.get(message.id, reaction.emoji.toString()).catch(() => null);

    const max = await DataUtils.db.prepare('SELECT * FROM reaction_roles WHERE message_id = ?').catch(() => null);
    const maxData = await max?.get(message.id).catch(() => null);

    if (maxData && maxData.roles) {
      let roles = maxData.roles.split(';');
      roles = roles.filter((role: string) => member.roles.cache.has(role));
      if (roles.length >= maxData.max) {
        await reaction.remove().catch(() => null);
        return;
      }
    }

    if (roleData) {
      const role = await message.guild?.roles.fetch(roleData.role_id).catch(() => null);
      if (role) member.roles.add(role).catch(() => null);
    }
  }

  /**
   * @description - Handle reaction remove
   * @param {MessageReaction} reaction - The reaction
   * @param {User} user - The user who reacted
   */
  @listener('messageReactionRemove')
  static async remove(reaction: MessageReaction, user: User) {
    if (user.bot) return;
    const message = reaction.message;
    const member = await message.guild?.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const roles = await DataUtils.db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?').catch(() => null);
    const roleData = await roles?.get(message.id, reaction.emoji.toString()).catch(() => null);

    if (roleData) {
      const role = await message.guild?.roles.fetch(roleData.role_id).catch(() => null);
      if (role) member.roles.remove(role).catch(() => null);
    }
  }

  /**
   * @description - Register a reaction role
   * @param {Message} message - The message
   * @param {string} emoji - The emoji
   * @param {string} role - The role
   */
  static async register(message: Message, emoji: string, role: string) {
    const roleData = await DataUtils.db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?').catch(() => null);
    const data = await roleData?.get(message.id, emoji).catch(() => null);
    if (data) return false;

    const statement = await DataUtils.db.prepare('INSERT INTO reaction_roles (channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?)').catch(() => null);
    await statement?.run(message.channel.id, message.id, emoji, role).catch(() => null);

    return true;
  }

  /**
   * @description - Unregister a reaction role
   * @param {Message} message - The message
   * @param {string} emoji - The emoji
   * @param {string} role - The role
   * @param {boolean} all - Unregister all roles
   */
  static async unregister(message: Message, emoji: string, role: string, all: boolean) {
    if (all) {
      const statement = await DataUtils.db.prepare('DELETE FROM reaction_roles WHERE message_id = ?').catch(() => null);
      await statement?.run(message.id).catch(() => null);
    } else {
      const statement = await DataUtils.db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND emoji = ? AND role_id = ?').catch(() => null);
      await statement?.run(message.id, emoji, role).catch(() => null);
    }
  }
}

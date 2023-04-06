import {GuildChannel, GuildMember, User} from 'discord.js';
import {listener} from '../../utils/ModuleUtils';
import {DataUtils} from '../../utils/DataUtils';
import {client} from '../..';

/**
 * @description - Welcome and farewell messages
 */
export default class WelcomeAndGoodbye {
  /**
   * @description - Handle welcome
   * @param {GuildMember} member - The member who joined
   */
  @listener('guildMemberAdd')
  static async join(member: GuildMember) {
    const message = WelcomeAndGoodbye.replaceVariables(DataUtils.config.welcome_message, [
      {
        from: 'servername',
        to: member.guild.name,
      },
      {
        from: 'user',
        to: member.user.username,
      },
      {
        from: 'usermention',
        to: `<@${member.id}>`,
      },
      {
        from: 'membercount',
        to: member.guild.memberCount.toString(),
      },
    ]);

    const channel = await client.channels.fetch(DataUtils.config.welcome_channel).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    channel.send(message).catch(() => null);
  }

  /**
   * @description - Handle goodbye
   * @param {GuildMember} member - The member who left
   */
  @listener('guildMemberRemove')
  static async leave(member: GuildMember) {
    const message = WelcomeAndGoodbye.replaceVariables(DataUtils.config.goodbye_message, [
      {
        from: 'servername',
        to: member.guild.name,
      },
      {
        from: 'user',
        to: member.user.username,
      },
      {
        from: 'usermention',
        to: `<@${member.id}>`,
      },
      {
        from: 'membercount',
        to: member.guild.memberCount.toString(),
      },
    ]);

    const channel = await client.channels.fetch(DataUtils.config.goodbye_channel).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.send(message).catch(() => null);
  }

  /**
   * @description - Sends welcome messages after verification
   * @param {GuildChannel} channel - The channel to send the message in
   * @param {User} user - The user the message is about
   */
  static async sendWelcome(channel: GuildChannel, user: User) {
    if (!channel.isTextBased()) return;

    const message = WelcomeAndGoodbye.replaceVariables(DataUtils.config.verification_welcomeMessage, [
      {
        from: 'servername',
        to: channel.guild.name,
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
        to: channel.guild.memberCount.toString(),
      },
    ]);

    await channel.send(message).catch(() => null);
  }
  /**
   * @description - Recursively replaces all variables in an object
   * @param {object} obj - The object to replace variables in
   * @param {{from: string, to: string}[]} vars - The context to replace
   * @return {object} - The object with all keys replaced
   */
  static replaceVariables(obj: {[key: string]: unknown} | string, vars: {from: string, to: string}[]) {
    if (typeof obj === 'string') {
      vars.forEach(({
        from, to,
      }) => {
        const regex = new RegExp(`\\\${${from}}`, 'g');
        obj = (obj.replaceAll as (a: RegExp, b: string) => string)(regex, to);
      });
    } else if (typeof obj === 'object') {
      for (const key in obj) {
        // Skip if prototype
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        obj[key] = WelcomeAndGoodbye.replaceVariables(obj[key] as {[key: string]: unknown}, vars);
      }
    }
    return obj;
  }
}

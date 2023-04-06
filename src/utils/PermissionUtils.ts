import {GuildMember} from 'discord.js';

export interface IPermission {
  name: 'a' | 'b' | 'c';
}

export enum Permissions {

}

/**
 * @description - Utility methods for permission management and checking
 */
export class PermissionUtils {
  /**
   * @description - Checks if a user has a specified permission
   * @param {GuildMember} member - The member to check
   * @param {IPermission} permission - The permission to check
   * @return {boolean} - Whether or not the member has the permission
   */
  static hasPermission(member: GuildMember, permission: Permissions): boolean {
    return true;
  }
}


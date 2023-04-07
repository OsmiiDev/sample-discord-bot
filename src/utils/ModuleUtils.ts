
import {ApplicationCommandData, ChatInputCommandInteraction, ClientEvents, Collection, EmbedBuilder, Events, Guild, MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  UserContextMenuCommandInteraction} from 'discord.js';
import {readdirSync, statSync} from 'fs';
import {join} from 'path';
import {client} from '..';
import {logger} from './LoggingUtils';

export interface ICommand {
  get: () => ApplicationCommandData;
  execute: (interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction) => void;
}

export interface IFilter {
  (args: unknown[]): FilterResult;
}

export enum FilterResult {
  PASS='pass',
  FAIL='fail',
  SKIP='skip',
  ERR='err',
}

export const listener = (event: keyof ClientEvents, ...eventFilters: IFilter[]) => {
  return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
    client.on(event, (...args: unknown[]) => {
      for (const filter of eventFilters) {
        const result = filter(args);
        if (result === FilterResult.FAIL) return;
        if (result === FilterResult.ERR) return logger.error(`Error in filter for event ${event}`);
      }

      logger.log(event);
      // console.log(args);

      descriptor.value(...args);
    });
  };
};

/**
 * @description - Utility methods for managing modules
 */
export class ModuleUtils {
  static _commands: Collection<string, ICommand> = new Collection();

  /**
   * @description - Loads all modules in the modules directory
   * @param {string} path - The path of the directory to load modules from
   */
  static async loadAll(path = join(process.cwd(), 'build', 'modules')) {
    const modules = readdirSync(path);
    for (const moduleFile of modules) {
      if (statSync(join(path, moduleFile)).isDirectory()) this.loadAll(join(path, moduleFile));
      else if (!moduleFile.startsWith('.') && !moduleFile.endsWith('.data.js') && moduleFile.endsWith('.js')) {
        logger.info(`Loading module ${moduleFile}`);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ModuleClass = (await import(join(path, moduleFile))).default;
        new ModuleClass();
      }
    }
  }

  /**
   * @description - Loads all commands in the commands directory
   * @param {string} path - The path of the directory to load commands from
   */
  static loadCommands(path = join(process.cwd(), 'build', 'commands')): void {
    const commands = readdirSync(path);
    for (const command of commands) {
      if (statSync(join(path, command)).isDirectory()) this.loadCommands(join(path, command));
      else if (!command.startsWith('.') && command.endsWith('.command.js')) {
        logger.info(`Loading command ${command}`);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const CommandClass = require(join(path, command)).default;
        const commandData: ApplicationCommandData = CommandClass.get();
        const commandType = commandData instanceof SlashCommandBuilder ? 'CHAT_INPUT' : commandData.type === 2 ? 'USER_CONTEXT' : 'MESSAGE_CONTEXT';

        ModuleUtils._commands.set(`${commandType}_${commandData.name}`, CommandClass);
        logger.info(`Loaded command ${commandType}_${commandData.name}`);
      }
    }


    if (process.env.env === 'DEV') {
      client.guilds.fetch(process.env.guild!).then((guild: Guild) => {
        guild.commands.set(Array.from(ModuleUtils._commands.values()).map((command: ICommand): ApplicationCommandData => command.get()));
      });
    } else {
      client.guilds.fetch(process.env.guild!).then((guild: Guild) => {
        guild.commands.set([]);
      });
      client.application?.commands.set(Array.from(ModuleUtils._commands.values()).map((command: ICommand): ApplicationCommandData => command.get()));
    }
  }

  /**
   * @description - Handles all slash command interactions
   * @param {ChatInputCommandInteraction} interaction - The interaction to handle
   */
  @listener(Events.InteractionCreate)
  static async onChatInputCreate(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(`/${interaction.commandName} run by ${interaction.user.tag}`);

    const command: ICommand | undefined = <ICommand | undefined> ModuleUtils._commands.get(`CHAT_INPUT_${interaction.commandName}`);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(error);
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> An unexpected error occured while running this command.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
    }
  }

  /**
   * @description - Handles all message context menu interactions
   * @param {UserContextMenuCommandInteraction} interaction - The interaction to handle
   */
  @listener(Events.InteractionCreate)
  static async onUserContextMenuCreate(interaction: UserContextMenuCommandInteraction) {
    if (!interaction.isUserContextMenuCommand()) return;
    logger.info(`[${interaction.commandName}] run by ${interaction.user.tag}`);

    const command: ICommand | undefined = <ICommand | undefined> ModuleUtils._commands.get(`USER_CONTEXT_${interaction.commandName}`);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(error);
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> An unexpected error occured while running this command.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
    }
  }

  /**
   * @description - Handles all message context menu interactions
   * @param {MessageContextMenuCommandInteraction} interaction - The interaction to handle
   */
  @listener(Events.InteractionCreate)
  static async onMessageContextMenuCreate(interaction: MessageContextMenuCommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return;
    logger.info(`[${interaction.commandName}] run by ${interaction.user.tag}`);

    const command: ICommand | undefined = <ICommand | undefined> ModuleUtils._commands.get(`MESSAGE_CONTEXT_${interaction.commandName}`);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(error);
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> An unexpected error occured while running this command.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
    }
  }
}

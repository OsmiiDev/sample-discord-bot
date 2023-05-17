import {ActionRowBuilder, ButtonBuilder, Client, EmbedBuilder, Partials} from 'discord.js';

import {DataUtils} from './utils/DataUtils.js';
import {ModuleUtils} from './utils/ModuleUtils.js';
import UpdateCase from './modules/moderation/UpdateCase.js';
import {config} from 'dotenv';
import {logger} from './utils/LoggingUtils.js';

config();

DataUtils.init();

export const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'MessageContent', 'DirectMessages', 'DirectMessageReactions', 'GuildMessageReactions', 'GuildMembers'],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User],
});


client.once('ready', () => {
  logger.info(`Logged in as ${client.user?.tag}`);
  ModuleUtils.loadAll();
  ModuleUtils.loadCommands();
  logger.info('All modules and commands loaded');

  setInterval(() => {
    UpdateCase.run(); // Start the update case loop
  }, 1000 * 10);
});

client.on('messageCreate', (message) => {
  if (message.content === 'give me a button' && message.author.id === '328984108271140864') {
    message.channel.send({
      components: [{
        components: [{
          custom_id: 'verification_begin',
          label: 'Begin verification',
          style: 1,
          type: 2,
        }],
        type: 1,
      }],
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle('Verification')
          .setDescription('Click the button below to begin the verification process.'),
      ],
    });
  }

  if (message.content === 'give me another button' && message.author.id === '328984108271140864') {
    message.channel.send({
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('staff_application'),
          ),
      ],
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle('Verification')
          .setDescription('Click the button below to begin the verification process.'),
      ],
    });
  }
});

process.on('unhandledRejection', (error) => {
  logger.error(error);
});

process.on('uncaughtException', (error) => {
  logger.error(error);
});

client.login(process.env.token);


/* eslint-disable max-len */
import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import {DataUtils} from '../../utils/DataUtils';

export interface IMessageEntry {
  name: string;
  json: string;
}

/**
 * @description - /embed command
 */
export default class EmbedCommand {
  /**
   * @description - Gets the data for the command
   * @return {SlashCommandBuilder} - The data for the command
   */
  static get(): Omit<SlashCommandBuilder, string> {
    return new SlashCommandBuilder()
      .setName('embed')
      .setDescription('Create a custom message')
      .setDMPermission(false)
      .addSubcommand((subcommand) => subcommand
        .setName('help')
        .setDescription('Get help with the message command'),
      )
      .addSubcommand((subcommand) => subcommand
        .setName('create')
        .setDescription('Create a custom message')
        .addStringOption((option) => option.setName('name').setDescription('The name of the message').setRequired(true))
        .addStringOption((option) => option.setName('json').setDescription('The JSON of the message [View help for more information]').setRequired(true)),
      )
      .addSubcommand((subcommand) => subcommand
        .setName('delete')
        .setDescription('Delete a custom message')
        .addStringOption((option) => option.setName('name').setDescription('The name of the message').setRequired(true)),
      )
      .addSubcommand((subcommand) => subcommand
        .setName('preview')
        .setDescription('Preview a custom message')
        .addStringOption((option) => option.setName('name').setDescription('The name of the message').setRequired(true)),
      )
      .addSubcommand((subcommand) => subcommand
        .setName('list')
        .setDescription('List all custom message'),
      )
      .addSubcommand((subcommand) => subcommand
        .setName('send')
        .setDescription('Send a custom message')
        .addStringOption((option) => option.setName('name').setDescription('The name of the message').setRequired(true))
        .addChannelOption((option) => option.setName('channel').setDescription('The channel to send the message to').setRequired(true)),
      );
  }

  /**
   * @description - Executes the command
   * @param {ChatInputCommandInteraction} interaction - The interaction that triggered the command
   */
  static async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    if (!(member instanceof GuildMember)) throw new Error('Member is not a guild member.');
    // const targetMember = await (interaction.guild!.members.fetch(targetUser.id).catch(() => null));

    // Check if the user has permission to run this command
    if (member.guild.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Failure:1000494098635034674> You do not have permission to perform this action.')
            .setColor('#ff0033'),
        ],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'help') {
      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle('Embed Command Help')
            .setDescription('The embed command allows you to create custom messages that can be sent with the `/embed` command.')
            .addFields([
              {
                name: 'Creating a message',
                value: 'To create a message, use the `/embed create` command. This command takes two arguments: `name` and `json`.\n\nThe `name` argument is the name of the message. This is what you will use when sending it. The `json` argument is the JSON of the message. You can use [this website](https://embed.dan.onl/) to create the embed. Once you are satisfied with the result, scroll down on the right, switch discord.js to JSON representation, and copy the data.',
              },
              {
                name: 'Previewing a message',
                value: 'To preview a message, use the `/embed preview` command. This command takes one argument: `name`.\n\nThe `name` argument is the name of the message. This command will send a preview of the message in the current channel.',
              },
              {
                name: 'Sending a message',
                value: 'To send a message, use the `/embed send` command. This command takes two arguments: `name` and `channel`.\n\nThe `name` argument is the name of the message. This is what you will use when sending the message. The `channel` argument is the channel to send the message to.',
              },
              {
                name: 'Deleting a message',
                value: 'To delete a message, use the `/embed delete` command. This command takes one argument: `name`.\n\nThe `name` argument is the name of the message. This command will delete the message.',
              },
              {
                name: 'Listing all messages',
                value: 'To list all messages, use the `/embed list` command. This command takes no arguments.\n\nThis command will list all messages in the current channel.',
              },
            ]),
        ],
        ephemeral: true,
      }).catch(() => null);
    }
    if (subcommand === 'create') {
      const name = interaction.options.getString('name', true);
      const json = interaction.options.getString('json', true);

      try {
        const data = JSON.parse(json);
        const text = JSON.stringify(data);

        const statement = await DataUtils.db.prepare('INSERT INTO messages (name, json) VALUES (?, ?)').catch(() => null);

        const result = await statement?.run(name, text).catch(() => null);
        if (!result) {
          await interaction.reply({
            content: '',
            embeds: [
              new EmbedBuilder()
                .setDescription('<:Failure:1000494098635034674> That custom message already exists.')
                .setColor('#ff0033'),
            ],
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription(`<:Success:1000468117878747267> Successfully added the custom message. You can preview it with \`/embed preview ${name}\``)
              .setColor('#10b981'),
          ],
        }).catch(() => null);
      } catch (e) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> That is not valid JSON.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }
    }
    if (subcommand === 'delete') {
      const messages = await DataUtils.db.all('SELECT * FROM messages').catch(() => null);
      const name = interaction.options.getString('name', true);
      const message = messages?.find((m: IMessageEntry) => m.name === name);
      if (!message) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> That custom message does not exist.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }

      const statement = await DataUtils.db.prepare('DELETE FROM messages WHERE name = ?').catch(() => null);
      await statement?.run(name).catch(() => null);

      await interaction.reply({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setDescription('<:Success:1000468117878747267> Successfully deleted the custom message.')
            .setColor('#10b981'),
        ],
      }).catch(() => null);
    }
    if (subcommand === 'preview') {
      const messages = await DataUtils.db.all('SELECT * FROM messages').catch(() => null);
      const name = interaction.options.getString('name', true);
      const message = messages?.find((m: IMessageEntry) => m.name === name);
      if (!message) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> That custom message does not exist.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }

      try {
        const data = JSON.parse(message.json);
        const embed = new EmbedBuilder(data);

        // Fix color and timestamp
        if (data.color) embed.setColor(data.color);
        if (data.timestamp) embed.setTimestamp(data.timestamp);

        await interaction.reply({
          content: '',
          embeds: [embed],
          ephemeral: true,
        });
      } catch (e) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> That custom message is invalid. Make sure your JSON data is correct.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }
    }
    if (subcommand === 'list') {
      const messages = await DataUtils.db.all('SELECT * FROM messages').catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle('Custom Messages')
        .setDescription(messages?.map((m: IMessageEntry) => `\`${m.name}\``).join(' ') || 'No custom messages found.')
        .setColor('#7289da');

      await interaction.reply({
        content: '',
        embeds: [embed],
      }).catch(() => null);
    }
    if (subcommand === 'send') {
      const messages = await DataUtils.db.all('SELECT * FROM messages').catch(() => null);
      const name = interaction.options.getString('name', true);
      const message = messages?.find((m: IMessageEntry) => m.name === name);
      if (!message) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> That custom message does not exist.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }

      const _channel = interaction.options.getChannel('channel', true);
      const channel = await interaction.guild?.channels.fetch(_channel.id).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> That is not a valid channel.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }

      try {
        const data = JSON.parse(message.json);
        const embed = new EmbedBuilder(data);

        // Fix color and timestamp
        if (data.color) embed.setColor(data.color);
        if (data.timestamp) embed.setTimestamp(data.timestamp);

        const msg = await channel.send({
          content: '',
          embeds: [embed],
        }).catch(() => null);
        if (msg) {
          await interaction.reply({
            content: '',
            embeds: [
              new EmbedBuilder()
                .setDescription('<:Success:1000468117878747267> Successfully sent the custom message.')
                .setColor('#10b981'),
            ],
          }).catch(() => null);
        } else {
          await interaction.reply({
            content: '',
            embeds: [
              new EmbedBuilder()
                .setDescription('<:Failure:1000494098635034674> Failed to send the custom message.')
                .setColor('#ff0033'),
            ],
            ephemeral: true,
          });
        }
      } catch {
        await interaction.reply({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setDescription('<:Failure:1000494098635034674> That custom message is invalid. Make sure your JSON data is correct.')
              .setColor('#ff0033'),
          ],
          ephemeral: true,
        });
        return;
      }
    }
  }
}

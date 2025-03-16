const channelSchema = require('../../schemas/channel');
const logger = require('./../../logger');

module.exports = {
  name: 'guildAvailable',
  async execute(guild) {
    try {
      // Pobieramy wszystkie kanały z serwera (tekstowe, głosowe itd.)
      const allChannels = guild.channels.cache;

      for (const channel of allChannels.values()) {

        // Sprawdzamy, czy kanał już istnieje w bazie danych
        const existingChannel = await channelSchema.findOne({ channel_id: channel.id });

        if (!existingChannel) {
          // Jeśli kanał nie istnieje, zapisujemy go
          const newChannel = new channelSchema({
            guild_id: guild.id,
            channel_id: channel.id,
            channel_name: channel.name,
            channel_type: channel.type, // Dodajemy typ kanału
          });

          await newChannel.save();
        } else {
          // Jeśli kanał już istnieje, możemy go zaktualizować
          existingChannel.channel_name = channel.name;
          existingChannel.channel_type = channel.type; // Zaktualizowanie typu kanału
          await existingChannel.save();
        }
      }
    } catch (error) {
      logger.error(`Błąd zapisu kanałów: ${error}`);
    }
  },

  // Usuwanie kanału
  async deleteChannel(channelId) {
    try {
      const channel = await channelSchema.findOne({ channel_id: channelId });
      if (channel) {
        await channelSchema.deleteOne({ channel_id: channelId });
      } else {
      }
    } catch (error) {
    }
  },

  // Aktualizacja nazwy kanału
  async updateChannelName(channelId, newName) {
    try {
      const channel = await channelSchema.findOne({ channel_id: channelId });
      if (channel) {
        channel.channel_name = newName;
        await channel.save();
      } else {
      }
    } catch (error) {
      logger.error(`Błąd aktualizacji nazwy kanału: ${error}`);
    }
  },
};

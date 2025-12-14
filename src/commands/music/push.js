const { SlashCommandBuilder } = require("discord.js");
const path = require("path");
const fs = require("fs");
const logger = require("../../logger");
const {
  saveQueue,
  playNext,
  playersStop,
  setLoopSong,
} = require("../../functions/handlers/handleMusic");

const PUSH_FILE = "push.mp3";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("push")
    .setDescription("PUSH PUSH PUSH!"),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "❌ You need to be in a voice channel to use push!",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    let selectedFile = null;
    if (path.isAbsolute(PUSH_FILE)) {
      selectedFile = PUSH_FILE;
    } else {
      selectedFile = path.join(__dirname, PUSH_FILE);
    }

    if (!selectedFile || !fs.existsSync(selectedFile)) {
      return interaction.editReply({
        content: `❌ File not found: ${selectedFile}`,
        ephemeral: true,
      });
    }

    try {
      await saveQueue(guildId, [selectedFile]);
      setLoopSong(guildId, selectedFile);

      try {
        playersStop(guildId);
      } catch (e) {}

      await playNext(guildId, interaction);

      const songName = path.basename(selectedFile, ".mp3").replace(/_/g, " ");
      await interaction.editReply({
        content: `🔁 Push started. Playing **${songName}** on loop. Use /queue stop to stop.`,
      });
    } catch (err) {
      logger.error(`❌ Error starting push: ${err}`);
      interaction.editReply({
        content: `❌ Error starting push: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

const { SlashCommandBuilder } = require("discord.js");
const logger = require("../../logger");
const {
  listPlaylists,
  getAutoPlaylists,
  clearAutoPlaylists,
  toggleAutoPlaylist,
  selectAllAutoPlaylists,
} = require("../../functions/handlers/handleMusic");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Manage playlists used by queue auto")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Choose playlist action")
        .setRequired(true)
        .addChoices(
          { name: "add/remove", value: "add_remove" },
          { name: "show", value: "show" },
          { name: "clear", value: "clear" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("playlist")
        .setDescription("Playlist name or 'every' to select all")
        .setRequired(false)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused();
      const focusedName = interaction.options.getFocused(true).name;
      const action = interaction.options.getString("action");

      if (focusedName !== "playlist" || action !== "add_remove") {
        return interaction.respond([]);
      }

      const lists = ["every", ...listPlaylists()]
        .filter((name, index, arr) => arr.indexOf(name) === index)
        .filter((name) =>
          name.toLowerCase().includes((focused || "").toLowerCase()),
        )
        .slice(0, 25);

      return interaction.respond(lists.map((name) => ({ name, value: name })));
    } catch (err) {
      logger.error(`playlist autocomplete error: ${err}`);
    }
  },

  async execute(interaction) {
    const action = interaction.options.getString("action");
    const playlist = interaction.options.getString("playlist");
    const guildId = interaction.guild.id;

    try {
      if (action === "show") {
        const selected = getAutoPlaylists(guildId);
        if (!selected.length) {
          return interaction.reply({
            content:
              "📂 Auto playlist selection: **none selected** (queue auto plays from everything).",
            ephemeral: true,
          });
        }

        return interaction.reply({
          content: `📂 Selected playlists for auto queue:\n- ${selected.join("\n- ")}`,
          ephemeral: true,
        });
      }

      if (action === "clear") {
        clearAutoPlaylists(guildId);
        return interaction.reply({
          content:
            "🧹 Cleared selected playlists. Queue auto will now play from everything.",
          ephemeral: true,
        });
      }

      if (action === "add_remove") {
        if (!playlist) {
          return interaction.reply({
            content: "❌ Provide a playlist name (or `every`).",
            ephemeral: true,
          });
        }

        if (playlist.toLowerCase() === "every") {
          const selectedAll = selectAllAutoPlaylists(guildId);
          if (!selectedAll.length) {
            return interaction.reply({
              content: "❌ No playlists found to add.",
              ephemeral: true,
            });
          }

          return interaction.reply({
            content: `✅ Added all playlists (${selectedAll.length}) to auto queue selection.`,
            ephemeral: true,
          });
        }

        const result = toggleAutoPlaylist(guildId, playlist);
        if (!result.ok || !result.exists) {
          return interaction.reply({
            content: `❌ Playlist not found: **${playlist}**`,
            ephemeral: true,
          });
        }

        const selected = getAutoPlaylists(guildId);
        const stateMessage = selected.length
          ? `\n📂 Current selection:\n- ${selected.join("\n- ")}`
          : "\n📂 Current selection is empty (auto queue uses everything).";

        return interaction.reply({
          content: result.added
            ? `✅ Added playlist: **${result.playlist}**${stateMessage}`
            : `➖ Removed playlist: **${result.playlist}**${stateMessage}`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: "❌ Unsupported action.",
        ephemeral: true,
      });
    } catch (err) {
      logger.error(`Error in /playlist: ${err}`);
      return interaction.reply({
        content: `❌ Error: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

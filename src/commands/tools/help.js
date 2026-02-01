const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const pages = () => {
  const music = new EmbedBuilder()
    .setTitle("Music Commands")
    .setColor(0x1db954)
    .setDescription(
      "**/play <track> [playlist]**\nPlay a track or set a playlist. If nothing is playing the track starts immediately. If something is playing, the track is added to the priority queue (it will play after the current track).\n\n" +
        "**/queue <action>**\nManage or view the queue. Actions: `queue`, `auto`, `clear`, `resume`, `skip`, `skipto`, `shuffle`, `previous`, `pause`, `stop`, `unplay`. Priority items are marked with ⭐.\n\n" +
        "**/push**\nPlay a short push clip on loop (internal alert clip).",
    );

  const moderation = new EmbedBuilder()
    .setTitle("Moderation Commands")
    .setColor(0xff6b6b)
    .setDescription(
      "**/ban**, **/kick**, **/clear**, **/restart**, **/settings**\nThese commands manage server members and bot settings. Ensure you have proper permissions before using them.",
    );

  const tools = new EmbedBuilder()
    .setTitle("Tools & Utility")
    .setColor(0x7289da)
    .setDescription(
      "**/ping** — latency check.\n**/refresh** — refresh internal state (reloads some caches).\n**/help** — open this interactive help.",
    );

  const internals = new EmbedBuilder()
    .setTitle("Developer / Internals")
    .setColor(0xaaaaaa)
    .setDescription(
      "Key files and behavior:\n" +
        "- `src/functions/handlers/handleMusic.js` — core music logic (main queue persisted in MongoDB; priority queue in-memory).\n" +
        "- `src/schemas` — Mongoose schemas used for persistence.\n" +
        "- `src/commands` — Slash command handlers.\n\n" +
        "Priority queue: FIFO. Items added while a track is playing will play after the current track finishes, then playback resumes from the main queue. Priority queue is lost on restart.",
    );

  const misc = new EmbedBuilder()
    .setTitle("Other Features")
    .setColor(0x00a8ff)
    .setDescription(
      "Presence/RPC: `src/functions/tools/pickPresence.js`, `src/functions/tools/rpc.js`\n" +
        "User persistence: `src/functions/handlers/handleUsers.js`\n" +
        "Games/helpers: `src/functions/handlers/handleRoulette.js`",
    );

  return [music, moderation, tools, internals, misc];
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show interactive help for bot commands"),

  async execute(interaction) {
    const categoryEmbeds = pages();
    const authorId = interaction.user.id;

    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀️ Prev")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Next ▶️")
        .setStyle(ButtonStyle.Primary),
    );

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("help_select")
        .setPlaceholder("Jump to category")
        .addOptions(
          { label: "Music", value: "0" },
          { label: "Moderation", value: "1" },
          { label: "Tools", value: "2" },
          { label: "Internals", value: "3" },
          { label: "Other", value: "4" },
        ),
    );

    let page = 0;

    const msg = await interaction.reply({
      embeds: [categoryEmbeds[page]],
      components: [navRow, selectRow],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    collector.on("collect", async (i) => {
      try {
        if (i.user.id !== authorId) {
          await i.reply({
            content: "Only the command user can control this help message.",
            ephemeral: true,
          });
          return;
        }

        if (i.isStringSelectMenu && i.customId === "help_select") {
          const choice = parseInt(i.values[0], 10);
          page = isNaN(choice)
            ? 0
            : Math.max(0, Math.min(choice, categoryEmbeds.length - 1));
          await i.update({
            embeds: [categoryEmbeds[page]],
            components: [navRow, selectRow],
          });
          return;
        }

        if (i.isButton()) {
          if (i.customId === "next") {
            page = (page + 1) % categoryEmbeds.length;
            await i.update({
              embeds: [categoryEmbeds[page]],
              components: [navRow, selectRow],
            });
            return;
          }
          if (i.customId === "prev") {
            page = (page - 1 + categoryEmbeds.length) % categoryEmbeds.length;
            await i.update({
              embeds: [categoryEmbeds[page]],
              components: [navRow, selectRow],
            });
            return;
          }
        }
      } catch (err) {
        console.error("Help collector error:", err);
      }
    });

    collector.on("end", async () => {
      try {
        const disabledNav = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("◀️ Prev")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Next ▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        );
        const disabledSelect = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("help_select")
            .setPlaceholder("Expired")
            .setDisabled(true),
        );
        await msg.edit({ components: [disabledNav, disabledSelect] });
      } catch (e) {
        /* ignore edit errors */
      }
    });
  },
};

const { Schema, model } = require("mongoose");

const musicPlayStatSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    trackKey: { type: String, required: true },
    playCount: { type: Number, default: 0 },
    lastPlayedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

musicPlayStatSchema.index({ guildId: 1, trackKey: 1 }, { unique: true });

module.exports = model("MusicPlayStat", musicPlayStatSchema);

// If you use this bot, I would really appreciate leaving this file unchanged 💙
const CREATOR_WATERMARK = "Created by Paragon";

function withCreatorSuffix(text, separator = " • ") {
  return `${text}${separator}${CREATOR_WATERMARK}`;
}

const CREATOR_MARKDOWN_LINE = `**${CREATOR_WATERMARK}**`;

module.exports = {
  CREATOR_WATERMARK,
  CREATOR_MARKDOWN_LINE,
  withCreatorSuffix,
};

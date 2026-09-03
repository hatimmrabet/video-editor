// Keep the downloaded Chromium with the skill instead of the shared ~/.cache/puppeteer,
// so it is self-contained and cleaned when node_modules/ is removed.
// Picked up automatically at both `npm ci` (download) and `puppeteer.launch()` (resolve).
const { join } = require("path");

module.exports = {
  cacheDirectory: join(__dirname, "node_modules", ".cache", "puppeteer"),
};

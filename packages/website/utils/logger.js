// utils/logger.js
const fs = require('fs');
const path = require('path');

const logFilePath = path.join(process.cwd(), 'logs', 'middleware.log');

function log(message) {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage, { encoding: 'utf8' });
}

module.exports = { log };

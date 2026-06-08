// Track active users (same Map instance used across socket + routes)
const activeUsers = new Map();

module.exports = activeUsers;

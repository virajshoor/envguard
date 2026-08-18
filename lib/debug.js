function debugCaught(error) {
  if (process.env.DEBUG) {
    console.error(error);
  }
}

module.exports = {
  debugCaught
};

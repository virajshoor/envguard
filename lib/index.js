const parser = require('./parser');
const presets = require('./presets');
const reporter = require('./reporter');
const secrets = require('./secrets');
const validator = require('./validator');

module.exports = {
  ...parser,
  ...presets,
  ...reporter,
  ...secrets,
  ...validator
};

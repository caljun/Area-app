// metro.config.js
const { createMetroConfiguration } = require('@expo/metro-config');

const config = createMetroConfiguration(__dirname);

config.resolver.platforms = ['ios', 'android', 'native', 'web'];
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

module.exports = config;
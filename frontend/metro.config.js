// metro.config.js
const { createMetroConfiguration } = require('@expo/metro-config');

const config = createMetroConfiguration(__dirname);

// 必要に応じてカスタマイズ
config.resolver.platforms = ['ios', 'android', 'native', 'web'];
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

module.exports = config;
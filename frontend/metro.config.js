// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 安定版用の最適化設定
config.resolver.platforms = ['ios', 'android', 'native', 'web'];
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// ReactCommonモジュールの重複問題を解決
config.resolver.alias = {
  'react-native': 'react-native',
};

config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: { keep_fnames: true },
};

// メモリ使用量の最適化
config.maxWorkers = 2;

module.exports = config;
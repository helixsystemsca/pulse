/** @type {import('@babel/core').ConfigFunction} */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 delegates to react-native-worklets; must stay last.
    plugins: ["react-native-reanimated/plugin"],
  };
};

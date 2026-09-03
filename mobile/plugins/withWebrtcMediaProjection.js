// react-native-webrtc gates its screen-capture foreground service behind
// WebRTCModuleOptions.enableMediaProjectionService, which defaults to false
// and is never set by @config-plugins/react-native-webrtc. Without it, the
// MediaProjectionService foreground service never starts, and on Android
// 10+ (strictly enforced since Android 14) starting screen capture without
// an active foreground service of type mediaProjection throws a
// SecurityException on a background thread — an uncaught native crash,
// not a JS promise rejection. This plugin flips that flag on in
// MainApplication so getDisplayMedia() actually works instead of crashing
// the app the moment a screen share starts.
const { withMainApplication } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

function withWebrtcMediaProjection(config) {
  return withMainApplication(config, (config) => {
    const isKotlin = config.modResults.language === 'kt';

    config.modResults.contents = mergeContents({
      tag: 'webrtc-media-projection-import',
      src: config.modResults.contents,
      newSrc: isKotlin
        ? 'import com.oney.WebRTCModule.WebRTCModuleOptions'
        : 'import com.oney.WebRTCModule.WebRTCModuleOptions;',
      anchor: /^package .*/,
      offset: 1,
      comment: '//',
    }).contents;

    config.modResults.contents = mergeContents({
      tag: 'webrtc-media-projection-enable',
      src: config.modResults.contents,
      newSrc: isKotlin
        ? '    WebRTCModuleOptions.getInstance().enableMediaProjectionService = true'
        : '    WebRTCModuleOptions.getInstance().enableMediaProjectionService = true;',
      anchor: /super\.onCreate\(\)/,
      offset: 1,
      comment: '//',
    }).contents;

    return config;
  });
}

module.exports = withWebrtcMediaProjection;

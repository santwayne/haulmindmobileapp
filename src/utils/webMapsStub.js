// Web stub for react-native-maps - prevents import errors on web platform
// This file is only used when bundling for web

// Export all the components as null/functions to prevent errors
const WebMapsStub = () => null;

// Create stub components that don't crash
const createStubComponent = (name) => {
  return () => null;
};

module.exports = WebMapsStub;
module.exports.default = WebMapsStub;
module.exports.Marker = createStubComponent('Marker');
module.exports.Polyline = createStubComponent('Polyline');
module.exports.PROVIDER_GOOGLE = null;
module.exports.PROVIDER_DEFAULT = null;
module.exports.Callout = createStubComponent('Callout');
module.exports.Circle = createStubComponent('Circle');
module.exports.Polygon = createStubComponent('Polygon');
module.exports.UrlTile = createStubComponent('UrlTile');
module.exports.WMSTile = createStubComponent('WMSTile');
module.exports.LocalTile = createStubComponent('LocalTile');
module.exports.Overlay = createStubComponent('Overlay');
module.exports.Heatmap = createStubComponent('Heatmap');
module.exports.MapView = WebMapsStub;
module.exports.MapMarkerNativeComponent = createStubComponent('MapMarkerNativeComponent');


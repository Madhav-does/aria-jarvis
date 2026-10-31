// Capacitor Web Bridge Fallback
window.Capacitor = window.Capacitor || {
  isNativePlatform: function() { return false; },
  getPlatform: function() { return 'web'; }
};

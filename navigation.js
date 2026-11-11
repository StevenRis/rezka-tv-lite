(function (root) {
  'use strict';
  var defaults = {37:'left',38:'up',39:'right',40:'down',13:'ok',8:'back',27:'back',461:'back',10009:'back',415:'play',19:'pause',413:'stop'};
  root.TVNav = {
    action: function (code, custom) { return (custom && custom[code]) || defaults[code] || ''; },
    next: function (index, action, length, columns) {
      var delta = action === 'left' ? -1 : action === 'right' ? 1 : action === 'up' ? -columns : action === 'down' ? columns : 0;
      return Math.max(0, Math.min(length - 1, index + delta));
    }
  };
}(typeof window !== 'undefined' ? window : this));

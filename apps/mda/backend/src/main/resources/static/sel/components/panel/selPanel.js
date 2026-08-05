(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-sel-panel]').forEach(function (panel) {
      panel.classList.add('sel-panel');
    });
  });
})();

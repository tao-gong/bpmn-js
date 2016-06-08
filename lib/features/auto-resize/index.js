module.exports = {
  __init__: [ 'autoResizeProvider' ],
  __depends__: [
    require('diagram-js/lib/features/auto-resize')
  ],
  autoResizeProvider: [ 'type', require('./AutoResizeProvider') ]
};

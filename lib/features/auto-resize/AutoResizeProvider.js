'use strict';

var is = require('../../util/ModelUtil').is;

var forEach = require('lodash/collection/forEach');

/**
 * This module is a provider for automatically resizing parent elements
 */
function AutoResizeProvider(autoResize, modeling) {

  this._autoResize = autoResize;
  this._modeling = modeling;

  this.options = {
    offset: { top: 60, bottom: 60, left: 100, right: 100 },
    padding: { top: 2, bottom: 2, left: 15, right: 15 }
  };

  this.register();
}

AutoResizeProvider.$inject = [ 'autoResize', 'modeling' ];


AutoResizeProvider.prototype.register = function() {
  this._autoResize.registerProvider(this);
};


/**
 * Check if the given target can be expanded
 *
 * @param  {Array<djs.model.Shape>} elements
 * @param  {djs.model.Shape} target
 *
 * @return {boolean}
 */
AutoResizeProvider.prototype.canResize = function(elements, target) {

  if (!is(target, 'bpmn:Participant') && !is(target, 'bpmn:Lane') && !(is(target, 'bpmn:SubProcess'))) {
    return false;
  }

  var canResize = true;

  forEach(elements, function(element) {

    if (is(element, 'bpmn:Lane') || element.labelTarget) {
      canResize = false;
      return;
    }
  });

  return canResize;

};


/**
 * Resize the target to the given newBounds
 *
 * @param  {djs.model.Shape} target
 * @param  {object} newBounds
 * @param  {Number} newBounds.x
 * @param  {Number} newBounds.y
 * @param  {Number} newBounds.width
 * @param  {Number} newBounds.height
 */
AutoResizeProvider.prototype.resize = function(target, newBounds) {
  if (is(target, 'bpmn:Participant')) {
    this._modeling.resizeLane(target, newBounds);
  } else {
    this._modeling.resizeShape(target, newBounds);
  }
};

module.exports = AutoResizeProvider;

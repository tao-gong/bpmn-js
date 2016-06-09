'use strict';

var assign = require('lodash/object/assign'),
    map = require('lodash/collection/map'),
    reduce = require('lodash/collection/reduce'),
    forEach = require('lodash/collection/forEach');

var is = require('./ModelUtil').is;

var GeometricUtil = require('./GeometricUtil');

var DEFAULT_LABEL_SIZE = module.exports.DEFAULT_LABEL_SIZE = {
  width: 90,
  height: 20
};

var FLOW_LABEL_INDENT = module.exports.FLOW_LABEL_INDENT = 15;

var DISTANCE_THRESHOLD = 100;

/**
 * Returns true if the given semantic has an external label
 *
 * @param {BpmnElement} semantic
 * @return {Boolean} true if has label
 */
module.exports.hasExternalLabel = function(semantic) {
  return is(semantic, 'bpmn:Event') ||
         is(semantic, 'bpmn:Gateway') ||
         is(semantic, 'bpmn:DataStoreReference') ||
         is(semantic, 'bpmn:DataObjectReference') ||
         is(semantic, 'bpmn:SequenceFlow') ||
         is(semantic, 'bpmn:MessageFlow');
};


function getMinDistanceLineIndex(label, waypoints) {

  var minimum = null,
      newMinimum = null,
      minimumIndex = null;

  for (var i=0; i<waypoints.length-1; i++) {

    var p1 = waypoints[i],
        p2 = waypoints[i+1];

    var distance = GeometricUtil.getDistancePointLine(label, [ p1, p2 ]);

    if (!minimum) {
      minimum = distance;
      minimumIndex = i;
    }

    newMinimum = distance;

    if (newMinimum < minimum) {
      minimum = newMinimum;
      minimumIndex = i;
    }
  }

  return minimumIndex;
}

function diff(a, b) {
  var result = [];
  var i = 0;
  for (; i<a.length; i++) {

    var isDiff = true;

    for (var j=0; j<b.length; j++) {

      var p1 = a[i].original || a[i];
      var p2 = b[j].original || b[j];

      if (p1.x === p2.x && p1.y === p2.y) {
        isDiff = false;
      }
    }

    if (isDiff) {
      result.push(i);
    }
  }
  return result;
}

function bounds(point, line) {

  var first = line[0],
      second = line[1];

  var angle = Math.atan( (second.y - first.y) / (second.x - first.x) );
  var distance = GeometricUtil.getDistancePointLine(point, line);


  if ( Math.abs(angle) < Math.PI / 4 || Math.abs(angle) > Math.PI / 4 + Math.PI / 2 ) {

    var x1 = ( first.x < second.x ) ? first.x : second.x;
    var x2 = ( first.x < second.x ) ? second.x : first.x;

    return x1 < point.x && point.x < x2 && distance < DISTANCE_THRESHOLD

  } else {

    var y1 = ( first.y < second.y ) ? first.y : second.y;
    var y2 = ( first.y < second.y ) ? second.y : first.y;

    return y1 < point.y && point.y < y2 && distance < DISTANCE_THRESHOLD
  }
}

function findNewLabelLineStartIndex(oldWaypoints, newWaypoints, index, hints) {

  var offset = newWaypoints.length - oldWaypoints.length;

  var diffIndexes = offset < 0 ? diff(oldWaypoints, newWaypoints) : diff(newWaypoints, oldWaypoints);

  // segment move happend
  if (hints.segmentMove) {

    var oldSegmentStartIndex = hints.segmentMove.segmentStartIndex,
        newSegmentStartIndex = hints.segmentMove.newSegmentStartIndex;

    if (index === oldSegmentStartIndex) return newSegmentStartIndex;
    if (oldSegmentStartIndex < index) return index+offset;
  }

  // label line still same
  if (offset === 0) return index;

  if (Math.abs(offset) === 1 ) {

    // start/end changed
    if (hints.startChanged) {
      if (index === 0) return 0;
      else return null;
    }

    if (hints.endChanged) {
      if (index === oldWaypoints.length - 2) return newWaypoints.length - 2;
      else return null;
    }

    // waypoint remove/add
    var diffIndex = diffIndexes[0];

    if (offset < 0) {
      if (diffIndex === index || diffIndex-1 === index) return diffIndex-1;
    } else {
      if (diffIndex-1 === index) return diffIndex-1;
    }
  }

  return null;
}

function getOptiomalLabelPosition(label, newWaypoints, oldWaypoints, hints) {

  var labelPosition = getExternalLabelMid(label);

  var oldLabelLineIndex = getMinDistanceLineIndex(labelPosition, oldWaypoints),
      oldLabelLineStart = oldWaypoints[oldLabelLineIndex].original || oldWaypoints[oldLabelLineIndex],
      oldLabelLineEnd = oldWaypoints[oldLabelLineIndex+1].original || oldWaypoints[oldLabelLineIndex+1],
      oldLabelLine = [ oldLabelLineStart, oldLabelLineEnd ],
      oldLabelLineDistance = GeometricUtil.getDistancePointPoint(oldLabelLineStart, oldLabelLineEnd);


  var newLabelLineIndex = findNewLabelLineStartIndex(oldWaypoints, newWaypoints, oldLabelLineIndex, hints);

  var x = 0, y = 0;

  console.log('newLabelLineIndex', newLabelLineIndex);

  if(newLabelLineIndex !== null) {

    var newLabelLineStart = newWaypoints[newLabelLineIndex].original || newWaypoints[newLabelLineIndex],
        newLabelLineEnd = newWaypoints[newLabelLineIndex+1].original || newWaypoints[newLabelLineIndex+1],
        newLabelLine = [ newLabelLineStart, newLabelLineEnd ];

    var oldFoot = GeometricUtil.perpendicularFoot(labelPosition, oldLabelLine),
        newFoot = GeometricUtil.perpendicularFoot(labelPosition, newLabelLine);

    x = newFoot.x - oldFoot.x;
    y = newFoot.y - oldFoot.y;
  }

  return { x: x, y: y };
}

module.exports.getOptiomalLabelPosition = getOptiomalLabelPosition;


function getNewFlowLabelPosition(label, newWaypoints, oldWaypoints, hints) {

  var labelPosition = getExternalLabelMid(label);

  // the first index of the line which the label is nearest
  var oldLabelLineIndex = getMinDistanceLineIndex(labelPosition, oldWaypoints);

  var oldLabelLine = [ oldWaypoints[oldLabelLineIndex], oldWaypoints[oldLabelLineIndex+1] ],
      pfPoint = GeometricUtil.perpendicularFoot(labelPosition, oldLabelLine),
      distance = GeometricUtil.getDistancePointPoint(labelPosition, pfPoint);

  var x = 0, y = 0;

  // if a segment got moved
  // TODO(@janstuemmel): distance threshold
  if (hints.segmentMove) {

    var oldSegmentStartIndex = hints.segmentMove.segmentStartIndex,
        newSegmentStartIndex = hints.segmentMove.newSegmentStartIndex;

    console.log('oldSegStart', oldSegmentStartIndex);
    console.log('newSegStart', newSegmentStartIndex);

    if (oldSegmentStartIndex <= oldLabelLineIndex) {
      console.log('offset:', newSegmentStartIndex-oldSegmentStartIndex);
    }

    var oldSegmentStart = oldWaypoints[oldSegmentStartIndex],
        newSegmentStart = newWaypoints[newSegmentStartIndex];

    var newSegmentOriginalStart = (newSegmentStart.original) ? newSegmentStart.original : newSegmentStart,
        oldSegmentOriginalStart = (oldSegmentStart.original) ? oldSegmentStart.original : oldSegmentStart;

    // if segment got moved with label on it
    if (oldLabelLineIndex == oldSegmentStartIndex) {
      y = newSegmentOriginalStart.y - oldSegmentOriginalStart.y;
      x = newSegmentOriginalStart.x - oldSegmentOriginalStart.x;
    }
  }

  return { y: y, x: x };
}

module.exports.getNewFlowLabelPosition = getNewFlowLabelPosition;

/**
 * Get the position for sequence flow labels
 *
 * @param  {Array<Point>} waypoints
 * @return {Point} the label position
 */
function getFlowLabelPosition(waypoints) {

  // get the waypoints mid
  var mid = waypoints.length / 2 - 1;

  var first = waypoints[Math.floor(mid)];
  var second = waypoints[Math.ceil(mid + 0.01)];

  // get position
  var position = getWaypointsMid(waypoints);

  // calculate angle
  var angle = Math.atan( (second.y - first.y) / (second.x - first.x) );

  var x = position.x,
      y = position.y;

  if ( Math.abs(angle) < Math.PI / 2 ) {
    y -= FLOW_LABEL_INDENT;
  } else {
    x += FLOW_LABEL_INDENT;
  }

  return { x: x, y: y };
}

module.exports.getFlowLabelPosition = getFlowLabelPosition;

/**
 * Get the middle of a number of waypoints
 *
 * @param  {Array<Point>} waypoints
 * @return {Point} the mid point
 */
function getWaypointsMid(waypoints) {

  var mid = waypoints.length / 2 - 1;

  var first = waypoints[Math.floor(mid)];
  var second = waypoints[Math.ceil(mid + 0.01)];

  return {
    x: first.x + (second.x - first.x) / 2,
    y: first.y + (second.y - first.y) / 2
  };
}

module.exports.getWaypointsMid = getWaypointsMid;


function getExternalLabelMid(element) {

  if (element.waypoints) {
    return getFlowLabelPosition(element.waypoints);
  } else {
    return {
      x: element.x + element.width / 2,
      y: element.y + element.height + DEFAULT_LABEL_SIZE.height / 2
    };
  }
}

module.exports.getExternalLabelMid = getExternalLabelMid;


/**
 * Returns the bounds of an elements label, parsed from the elements DI or
 * generated from its bounds.
 *
 * @param {BpmnElement} semantic
 * @param {djs.model.Base} element
 */
module.exports.getExternalLabelBounds = function(semantic, element) {

  var mid,
      size,
      bounds,
      di = semantic.di,
      label = di.label;

  if (label && label.bounds) {
    bounds = label.bounds;

    size = {
      width: Math.max(DEFAULT_LABEL_SIZE.width, bounds.width),
      height: bounds.height
    };

    mid = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  } else {

    mid = getExternalLabelMid(element);

    size = DEFAULT_LABEL_SIZE;
  }

  return assign({
    x: mid.x - size.width / 2,
    y: mid.y - size.height / 2
  }, size);
};

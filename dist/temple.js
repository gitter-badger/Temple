/*
 * Temple
 * (c) 2014-2015 Beneath the Ink, Inc.
 * Copyright (C) 2011--2015 Meteor Development Group
 * MIT License
 * Version 0.5.0
 */

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Temple = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//////////////////////////////////////////////////
// This is a heavily modified version of Meteor's DOMRange //
// Last merge: https://github.com/meteor/meteor/blob/405009a2c3dcd3c1fe780adb2867d38a6a42fff1/packages/blaze/domrange.js //
//////////////////////////////////////////////////

var _ = require("underscore"),
	Events = require("./events"),
	util = require("./util");

function isArrayLike(a) {
	return a != null && typeof a.length === "number";
}

// `[new] Blaze._DOMRange([nodeAndRangeArray])`
//
// A DOMRange consists of an array of consecutive nodes and DOMRanges,
// which may be replaced at any time with a new array.  If the DOMRange
// has been attached to the DOM at some location, then updating
// the array will cause the DOM to be updated at that location.
function DOMRange(nodeAndRangeArray) {
	// called without `new`
	if (!(this instanceof DOMRange)) {
		return new DOMRange(nodeAndRangeArray);
	}

	var members = (nodeAndRangeArray || []);
	if (!isArrayLike(members)) throw new Error("Expected array");

	for (var i = 0; i < members.length; i++) {
		this._memberIn(members[i]);
	}

	this.members = members;
	this.placeholder = null;
	this.attached = false;
	this.parentElement = null;
	this.parentRange = null;
};

module.exports = DOMRange;
DOMRange.extend = util.subclass;

// finds the DOMRange the element is a part of
DOMRange.forElement = function (elem) {
	if (elem.nodeType !== 1) throw new Error("Expected element, found: " + elem);
	
	var range = null;
	
	while (elem && !range) {
		range = (elem.$domrange || null);
		elem = elem.parentNode;
	}

	return range;
};

_.extend(DOMRange.prototype, Events, {

	// This method is called to insert the DOMRange into the DOM for
	// the first time, but it's also used internally when
	// updating the DOM.
	// If _isMove is true, move this attached range to a different
	// location under the same parentElement.
	attach: function(parentElement, nextNode, _isMove, _isReplace) {
		if (typeof parentElement === "string") parentElement = document.querySelector(parentElement);
		if (typeof nextNode === "string") nextNode = parent.querySelector(nextNode);
		if (parentElement == null) throw new Error("Expecting a valid DOM element to attach in.");

		if ((_isMove || _isReplace) && !(this.parentElement === parentElement && this.attached)) {
			throw new Error("Can only move or replace an attached DOMRange, and only under the same parent element");
		}

		var members = this.members;
		if (members.length) {
			this.placeholder = null;
			for (var i = 0; i < members.length; i++) {
				insertIntoDOM(members[i], parentElement, nextNode, _isMove);
			}
		} else {
			var placeholder = placeholderNode();
			this.placeholder = placeholder;
			parentElement.insertBefore(placeholder, nextNode);
		}

		this.attached = true;
		this.parentElement = parentElement;

		// trigger events only on fresh attachments
		if (!(_isMove || _isReplace)) this.trigger("attach", parentElement);

		return this;
	},

	detach: function(_isReplace) {
		if (!this.attached) return this;

		var oldParentElement = this.parentElement;
		var members = this.members;
		if (members.length) {
			for (var i = 0; i < members.length; i++) {
				removeFromDOM(members[i]);
			}
		} else {
			var placeholder = this.placeholder;
			this.parentElement.removeChild(placeholder);
			this.placeholder = null;
		}

		if (!_isReplace) {
			this.attached = false;
			this.parentElement = null;
			this.trigger("detach", oldParentElement);
		}
	},

	firstNode: function() {
		if (!this.attached) throw new Error("Must be attached");
		if (!this.members.length) return this.placeholder;
		var m = this.members[0];
		return (m instanceof DOMRange) ? m.firstNode() : m;
	},

	lastNode: function() {
		if (!this.attached) throw new Error("Must be attached");
		if (!this.members.length) return this.placeholder;
		var m = this.members[this.members.length - 1];
		return (m instanceof DOMRange) ? m.lastNode() : m;
	},

	getMember: function(atIndex) {
		var members = this.members;
		if (!(atIndex >= 0 && atIndex < members.length)) {
			throw new Error("Bad index in range.getMember: " + atIndex);
		}
		return this.members[atIndex];
	},

	// resets the DOMRange with new content
	setMembers: function(newNodeAndRangeArray) {
		var newMembers = newNodeAndRangeArray;
		if (!isArrayLike(newMembers)) throw new Error("Expected array");
		var oldMembers = this.members;
		var _isReplace = this.attached && (newMembers.length || oldMembers.length);

		// dereference old members
		for (var i = 0; i < oldMembers.length; i++) this._memberOut(oldMembers[i], false, _isReplace);

		// reference new members
		for (var i = 0; i < newMembers.length; i++) this._memberIn(newMembers[i]);

		if (_isReplace) {
			// detach the old members and insert the new members
			var nextNode = this.lastNode().nextSibling;
			var parentElement = this.parentElement;
			// Use detach/attach, but don't trigger events
			this.detach(true /*_isReplace*/);
			this.members = newMembers;
			this.attach(parentElement, nextNode, false, true /*_isReplace*/);
		} else {
			// don't do anything if we're going from empty to empty
			this.members = newMembers;
		}

		return this;
	},

	addMember: function(newMember, atIndex, _isMove) {
		var members = this.members;
		
		// validate the index
		if (typeof atIndex !== "number" || isNaN(atIndex) ||
			atIndex < 0 || atIndex > members.length) {
			atIndex = members.length;
		}

		// add references to the new member
		if (!_isMove) this._memberIn(newMember);

		// currently detached; just updated members
		if (!this.attached) {
			members.splice(atIndex, 0, newMember);
		}

		// empty; use the empty-to-nonempty handling of setMembers
		else if (members.length === 0) {
			this.setMembers([ newMember ]);
		}

		// otherwise add at location
		else {
			var nextNode;
			if (atIndex === members.length) {
				// insert at end
				nextNode = this.lastNode().nextSibling;
			} else {
				var m = members[atIndex];
				nextNode = (m instanceof DOMRange) ? m.firstNode() : m;
			}

			members.splice(atIndex, 0, newMember);
			insertIntoDOM(newMember, this.parentElement, nextNode, _isMove);
		}

		return this;
	},

	removeMember: function(atIndex, _isMove) {
		var members = this.members;
		
		// also accepts the member to remove
		if (typeof atIndex !== "number" || isNaN(atIndex)) {
			atIndex = this.indexOf(atIndex);
		}

		// validate the index
		if (atIndex < 0 || atIndex >= members.length) {
			throw new Error("Bad index in range.removeMember: " + atIndex);
		}

		if (_isMove) {
			members.splice(atIndex, 1);
		} else {
			var oldMember = members[atIndex];

			if (members.length === 1) {
				// becoming empty; use the logic in setMembers
				this.setMembers([]);
			} else {
				this._memberOut(oldMember);
				members.splice(atIndex, 1);
				if (this.attached) removeFromDOM(oldMember);
			}
		}

		return this;
	},

	moveMember: function(oldIndex, newIndex) {
		var member = this.members[oldIndex];
		this.removeMember(oldIndex, true /*_isMove*/);
		this.addMember(member, newIndex, true /*_isMove*/);
		return this;
	},

	indexOf: function(member) {
		return this.members.indexOf(member);
	},

	contains: function(member) {
		return this.indexOf(member) > -1;
	},

	_memberIn: function(m) {
		if (m instanceof DOMRange) {
			m.parentRange = this;
		} else if (m.nodeType === 1) { // DOM Element
			m.$domrange = this;
		}
	},

	_memberOut: function (m, _skipNodes, _isReplace) {
		if (m instanceof DOMRange) {
			if (_isReplace) m.destroyMembers(_skipNodes, _isReplace);
			else m.destroy(_skipNodes);
		}

		else if (!_skipNodes && m.nodeType === 1 && m.$domrange) {
			m.$domrange = null;
		}
	},

	// Tear down, but don't remove, the members.  Used when chunks
	// of DOM are being torn down or replaced.
	destroyMembers: function(_skipNodes, _isReplace) {
		var members = this.members;
		for (var i = 0; i < members.length; i++) {
			this._memberOut(members[i], _skipNodes, _isReplace);
		}
		return this;
	},

	destroy: function(_skipNodes) {
		this.detach();
		this.trigger("destroy", _skipNodes);
		this.destroyMembers(_skipNodes);
		this.members = [];
		return this;
	},

	containsElement: function(elem) {
		if (!this.attached) throw new Error("Must be attached");

		// An element is contained in this DOMRange if it's possible to
		// reach it by walking parent pointers, first through the DOM and
		// then parentRange pointers.  In other words, the element or some
		// ancestor of it is at our level of the DOM (a child of our
		// parentElement), and this element is one of our members or
		// is a member of a descendant Range.

		// First check that elem is a descendant of this.parentElement,
		// according to the DOM.
		if (!elementContains(this.parentElement, elem)) return false;

		// If elem is not an immediate child of this.parentElement,
		// walk up to its ancestor that is.
		while (elem.parentNode !== this.parentElement) elem = elem.parentNode;

		var range = elem.$domrange;
		while (range && range !== this) {
			range = range.parentRange;
		}

		return range === this;
	},

	containsRange: function(range) {
		if (!this.attached) throw new Error("Must be attached");
		if (!range.attached) return false;

		// A DOMRange is contained in this DOMRange if it's possible
		// to reach this range by following parent pointers.  If the
		// DOMRange has the same parentElement, then it should be
		// a member, or a member of a member etc.  Otherwise, we must
		// contain its parentElement.

		if (range.parentElement !== this.parentElement) {
			return this.containsElement(range.parentElement);
		}

		// don't contain self
		if (range === this) return false;

		while (range && range !== this) {
			range = range.parentRange;
		}

		return range === this;
	},

	findAll: function(selector) {
		var matches = [],
			el;

		for (var i in this.members) {
			el = this.members[i];
			if (el instanceof DOMRange) {
				matches.push.apply(matches, el.findAll(selector));
			} else if (typeof el.querySelectorAll === "function") {
				if (el.nodeType === 1 && util.matchesSelector(el, selector)) matches.push(el);
				matches.push.apply(matches, el.querySelectorAll(selector));
			}
		}

		return matches
	},

	find: function(selector) {
		var el, res;

		for (var i in this.members) {
			el = this.members[i];
			if (el instanceof DOMRange) {
				res = el.find(selector);
			} else if (el.nodeType === 1 && util.matchesSelector(el, selector)) {
				res = el;
			} else if (typeof el.querySelector === "function") {
				res = el.querySelector(selector);
			}

			if (res != null) return res;
		}

		return null;
	}

});

// Returns true if element a contains node b and is not node b.
//
// The restriction that `a` be an element (not a document fragment,
// say) is based on what's easy to implement cross-browser.
function elementContains(a, b) {
	if (a.nodeType !== 1) return false;
	if (a === b) return false;

	if (a.compareDocumentPosition) {
		return a.compareDocumentPosition(b) & 0x10;
	} else {
		// Should be only old IE and maybe other old browsers here.
		// Modern Safari has both functions but seems to get contains() wrong.
		// IE can't handle b being a text node.  We work around this
		// by doing a direct parent test now.
		b = b.parentNode;
		if (!(b && b.nodeType === 1)) // ELEMENT
			return false;
		if (a === b)
			return true;

		return a.contains(b);
	}
};

// In IE 8, don't use empty text nodes as placeholders
// in empty DOMRanges, use comment nodes instead.  Using
// empty text nodes in modern browsers is great because
// it doesn't clutter the web inspector.  In IE 8, however,
// it seems to lead in some roundabout way to the OAuth
// pop-up crashing the browser completely.  In the past,
// we didn't use empty text nodes on IE 8 because they
// don't accept JS properties, so just use the same logic
// even though we don't need to set properties on the
// placeholder anymore.
var USE_COMMENT_PLACEHOLDERS = (function () {
	var result = false;
	var textNode = document.createTextNode("");
	try {
		textNode.someProp = true;
	} catch (e) {
		// IE 8
		result = true;
	}
	return result;
})();

function placeholderNode() {
	return USE_COMMENT_PLACEHOLDERS ?
		document.createComment("") :
		document.createTextNode("");
}

// private methods
function insertIntoDOM(rangeOrNode, parentElement, nextNode, _isMove) {
	var m = rangeOrNode;
	if (m instanceof DOMRange) {
		m.attach(parentElement, nextNode, _isMove);
	} else {
		if (_isMove) {
			moveNodeWithHooks(m, parentElement, nextNode);
		} else {
			insertNodeWithHooks(m, parentElement, nextNode);
		}
	}
};

function removeFromDOM(rangeOrNode) {
	var m = rangeOrNode;
	if (m instanceof DOMRange) {
		m.detach();
	} else {
		removeNodeWithHooks(m);
	}
};

function removeNodeWithHooks(n) {
	if (!n.parentNode) return;
	if (n.nodeType === 1 && n.parentNode._uihooks && n.parentNode._uihooks.removeElement) {
		n.parentNode._uihooks.removeElement(n);
	} else {
		n.parentNode.removeChild(n);
	}
};

function insertNodeWithHooks(n, parent, next) {
	// `|| null` because IE throws an error if 'next' is undefined
	next = next || null;
	if (n.nodeType === 1 && parent._uihooks && parent._uihooks.insertElement) {
		parent._uihooks.insertElement(n, next);
	} else {
		parent.insertBefore(n, next);
	}
};

function moveNodeWithHooks(n, parent, next) {
	if (n.parentNode !== parent)
		return;
	// `|| null` because IE throws an error if 'next' is undefined
	next = next || null;
	if (n.nodeType === 1 && parent._uihooks && parent._uihooks.moveElement) {
		parent._uihooks.moveElement(n, next);
	} else {
		parent.insertBefore(n, next);
	}
};
},{"./events":2,"./util":13,"underscore":17}],2:[function(require,module,exports){
var _ = require("underscore");

// Backbone.Events
// ---------------

// A module that can be mixed in to *any object* in order to provide it with
// custom events. You may bind with `on` or remove with `off` callback
// functions to an event; `trigger`-ing an event fires all callbacks in
// succession.
//
//     var object = {};
//     _.extend(object, Backbone.Events);
//     object.on('expand', function(){ alert('expanded'); });
//     object.trigger('expand');
//
var Events = module.exports = {

	// Bind an event to a `callback` function. Passing `"all"` will bind
	// the callback to all events fired.
	on: function(name, callback, context) {
		if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
		this._events || (this._events = {});
		var events = this._events[name] || (this._events[name] = []);
		events.push({callback: callback, context: context, ctx: context || this});
		return this;
	},

	// Bind an event to only be triggered a single time. After the first time
	// the callback is invoked, it will be removed.
	once: function(name, callback, context) {
		if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
		var self = this;
		var fn = once(function() {
			self.off(name, fn);
			callback.apply(this, arguments);
		});
		fn._callback = callback;
		return this.on(name, fn, context);
	},

	// Remove one or many callbacks. If `context` is null, removes all
	// callbacks with that function. If `callback` is null, removes all
	// callbacks for the event. If `name` is null, removes all bound
	// callbacks for all events.
	off: function(name, callback, context) {
		var retain, ev, events, names, i, l, j, k;
		if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
		if (!name && !callback && !context) {
			this._events = void 0;
			return this;
		}
		names = name ? [name] : Object.keys(this._events);
		for (i = 0, l = names.length; i < l; i++) {
			name = names[i];
			if (events = this._events[name]) {
				this._events[name] = retain = [];
				if (callback || context) {
					for (j = 0, k = events.length; j < k; j++) {
						ev = events[j];
						if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
								(context && context !== ev.context)) {
							retain.push(ev);
						}
					}
				}
				if (!retain.length) delete this._events[name];
			}
		}

		return this;
	},

	// Trigger one or many events, firing all bound callbacks. Callbacks are
	// passed the same arguments as `trigger` is, apart from the event name
	// (unless you're listening on `"all"`, which will cause your callback to
	// receive the true name of the event as the first argument).
	trigger: function(name) {
		if (!this._events) return this;
		var args = Array.prototype.slice.call(arguments, 1);
		if (!eventsApi(this, 'trigger', name, args)) return this;
		var events = this._events[name];
		var allEvents = this._events.all;
		if (events) triggerEvents(events, args);
		if (allEvents) triggerEvents(allEvents, arguments);
		return this;
	},

	// Tell this object to stop listening to either specific events ... or
	// to every object it's currently listening to.
	stopListening: function(obj, name, callback) {
		var listeningTo = this._listeningTo;
		if (!listeningTo) return this;
		var remove = !name && !callback;
		if (!callback && typeof name === 'object') callback = this;
		if (obj) (listeningTo = {})[obj._listenId] = obj;
		for (var id in listeningTo) {
			obj = listeningTo[id];
			obj.off(name, callback, this);
			if (remove || isEmpty(obj._events)) delete this._listeningTo[id];
		}
		return this;
	}

};

// Regular expression used to split event strings.
var eventSplitter = /\s+/;

// Implement fancy features of the Events API such as multiple event
// names `"change blur"` and jQuery-style event maps `{change: action}`
// in terms of the existing API.
var eventsApi = function(obj, action, name, rest) {
	if (!name) return true;

	// Handle event maps.
	if (typeof name === 'object') {
		for (var key in name) {
			obj[action].apply(obj, [key, name[key]].concat(rest));
		}
		return false;
	}

	// Handle space separated event names.
	if (eventSplitter.test(name)) {
		var names = name.split(eventSplitter);
		for (var i = 0, l = names.length; i < l; i++) {
			obj[action].apply(obj, [names[i]].concat(rest));
		}
		return false;
	}

	return true;
};

// A difficult-to-believe, but optimized internal dispatch function for
// triggering events. Tries to keep the usual cases speedy (most internal
// Backbone events have 3 arguments).
var triggerEvents = function(events, args) {
	var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
	switch (args.length) {
		case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
		case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
		case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
		case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
		default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
	}
};

var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

// Inversion-of-control versions of `on` and `once`. Tell *this* object to
// listen to an event in another object ... keeping track of what it's
// listening to.
_.each(listenMethods, function(implementation, method) {
	Events[method] = function(obj, name, callback) {
		var listeningTo = this._listeningTo || (this._listeningTo = {});
		var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
		listeningTo[id] = obj;
		if (!callback && typeof name === 'object') callback = this;
		obj[implementation](name, callback, this);
		return this;
	};
});

// Aliases for backwards compatibility.
Events.bind   = Events.on;
Events.unbind = Events.off;

function isEmpty(obj) {
	if (obj == null) return true;
	if (Array.isArray(obj) || typeof obj === "string") return obj.length === 0;
	for (var key in obj) if (_.has(obj, key)) return false;
	return true;
}

function once(func) {
	var ran = false, memo;
	return function() {
		if (ran) return memo;
		ran = true;
		memo = func.apply(this, arguments);
		func = null;
		return memo;
	}
}
},{"underscore":17}],3:[function(require,module,exports){
var _ = require("underscore"),
	Trackr = require("trackr"),
	parse = require("./m+xml").parse,
	NODE_TYPE = require("./types"),
	track = require("./track");

// properties that Node.js and the browser can handle
var Temple = module.exports = _.defaults({
	VERSION: "0.5.0",
	NODE_TYPE: NODE_TYPE,

	// other parts
	util: require("./util"),
	Events: require("./events"),
	Model: require("./model"),

	// trackr short pointers
	Trackr: Trackr,
	Dependency: Trackr.Dependency,
	autorun: Trackr.autorun,

	// all the parsers, declared here for easier access
	parse: parse,
	parsePath: function(s, opts) {
		return parse(s, _.extend({}, opts, { startRule: "path" }));
	},
	parsePathQuery: function(s, opts) {
		return parse(s, _.extend({}, opts, { startRule: "pathQuery" }));
	},
	parseAttributeValue: function(s, opts) {
		return parse(s, _.extend({}, opts, { startRule: "attrValue" }));
	},
	parseArguments: function(s, opts) {
		return parse(s, _.extend({}, opts, { startRule: "attrArguments" }));
	},

	// converts raw html str to template tree
	parseHTML: function(str) {
		return {
			type: NODE_TYPE.ROOT,
			children: [ {
				type: NODE_TYPE.HTML,
				value: str
			} ],
			version: Temple.VERSION
		};
	}
}, track);

// no need for node js to hurt itself on any hard edges
if (typeof document === "undefined") return;

// load the real class for the browser
Temple = module.exports = _.extend(require("./mustache"), module.exports);

// load the plugin API
_.extend(Temple, require("./plugins"));

// and attach the rest of the parts that Node can't use
Temple.DOMRange = require("./domrange");
Temple.View = require("./view");
Temple.Section = require("./section");
},{"./domrange":1,"./events":2,"./m+xml":4,"./model":5,"./mustache":6,"./plugins":8,"./section":10,"./track":11,"./types":12,"./util":13,"./view":14,"trackr":16,"underscore":17}],4:[function(require,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleFunctions = { start: peg$parsestart, attrValue: peg$parseattrValue, attrArguments: peg$parseattrArguments, pathQuery: peg$parsepathQuery, path: peg$parsepath },
        peg$startRuleFunction  = peg$parsestart,

        peg$c0 = function(html) {
        	return {
        		type: NODE_TYPE.ROOT,
        		children: html,
        		version: Mustache.VERSION
        	}
        },
        peg$c1 = [],
        peg$c2 = function(nodes) { return _.compact(nodes); },
        peg$c3 = peg$FAILED,
        peg$c4 = /^[^<{]/,
        peg$c5 = { type: "class", value: "[^<{]", description: "[^<{]" },
        peg$c6 = function(text) { return { type: NODE_TYPE.TEXT, value: text.join("") }; },
        peg$c7 = "<!--",
        peg$c8 = { type: "literal", value: "<!--", description: "\"<!--\"" },
        peg$c9 = "-->",
        peg$c10 = { type: "literal", value: "-->", description: "\"-->\"" },
        peg$c11 = function(v) {
        		return { type: NODE_TYPE.XCOMMENT, value: v.trim() };
        	},
        peg$c12 = void 0,
        peg$c13 = { type: "any", description: "any character" },
        peg$c14 = null,
        peg$c15 = function(l, r) { return l + (r != null ? r : ""); },
        peg$c16 = function(start, nodes, end) {
        		if (start.name.toLowerCase() !== end.toLowerCase()) {
        			throw new Error("Element tag mismatch: " + start.name + " !== " + end);
        		}

        		start.type = NODE_TYPE.ELEMENT;
        		start.children = nodes;
        		return start;
        	},
        peg$c17 = "<",
        peg$c18 = { type: "literal", value: "<", description: "\"<\"" },
        peg$c19 = "/>",
        peg$c20 = { type: "literal", value: "/>", description: "\"/>\"" },
        peg$c21 = function(tagname, attributes) {
        		return {
        			name: tagname,
        			type: NODE_TYPE.ELEMENT,
        			attributes: attributes,
        			children: []
        		}
        	},
        peg$c22 = ">",
        peg$c23 = { type: "literal", value: ">", description: "\">\"" },
        peg$c24 = function(tagname, attributes) {
        		return { name: tagname, attributes: attributes };
        	},
        peg$c25 = "</",
        peg$c26 = { type: "literal", value: "</", description: "\"</\"" },
        peg$c27 = function(tagname) { return tagname; },
        peg$c28 = "=",
        peg$c29 = { type: "literal", value: "=", description: "\"=\"" },
        peg$c30 = function(key, value) {
        		value = value != null ? value[2] : "";
        		
        		return {
        			type: NODE_TYPE.ATTRIBUTE,
        			name: key,
        			value: value,
        			children: parse(value, _.extend({}, options, { startRule: "attrValue" })),
        			arguments: parse(value,  _.extend({}, options, { startRule: "attrArguments" }))
        		}
        	},
        peg$c31 = ",",
        peg$c32 = { type: "literal", value: ",", description: "\",\"" },
        peg$c33 = function(l, r) { return r != null && r[1] != null ? [l].concat(r[1]) : [l]; },
        peg$c34 = function(v) { return v; },
        peg$c35 = /^[^,]/,
        peg$c36 = { type: "class", value: "[^,]", description: "[^,]" },
        peg$c37 = function(v) { return v.trim(); },
        peg$c38 = function(val) {
        		if (_.isObject(val)) return val;
        		else return { type: NODE_TYPE.LITERAL, value: val };
        	},
        peg$c39 = /^[,]/,
        peg$c40 = { type: "class", value: "[,]", description: "[,]" },
        peg$c41 = function(start, nodes, end) {
        		if (options.strict && !_.isEqual(start.value.raw, end)) {
        			throw new Error("Section tag mismatch: " + start.value.raw + " !== " + end);
        		}

        		start.value = start.value.result;
        		start.children = nodes;
        		return start;
        	},
        peg$c42 = "{{",
        peg$c43 = { type: "literal", value: "{{", description: "\"{{\"" },
        peg$c44 = /^[#\^]/,
        peg$c45 = { type: "class", value: "[#\\^]", description: "[#\\^]" },
        peg$c46 = "}}",
        peg$c47 = { type: "literal", value: "}}", description: "\"}}\"" },
        peg$c48 = function(type, value) {
        		return {
        			type: NODE_TYPE[type === "#" ? "SECTION" : "INVERTED"],
        			value: value
        		}
        	},
        peg$c49 = "{{/",
        peg$c50 = { type: "literal", value: "{{/", description: "\"{{/\"" },
        peg$c51 = /^[^}]/,
        peg$c52 = { type: "class", value: "[^}]", description: "[^}]" },
        peg$c53 = function(value) { return value.join(""); },
        peg$c54 = "{{{",
        peg$c55 = { type: "literal", value: "{{{", description: "\"{{{\"" },
        peg$c56 = "}}}",
        peg$c57 = { type: "literal", value: "}}}", description: "\"}}}\"" },
        peg$c58 = function(value) {
        		return {
        			type: NODE_TYPE.INTERPOLATOR,
        			value: value[1]
        		}
        	},
        peg$c59 = /^[\/#{!>\^]/,
        peg$c60 = { type: "class", value: "[\\/#{!>\\^]", description: "[\\/#{!>\\^]" },
        peg$c61 = "&",
        peg$c62 = { type: "literal", value: "&", description: "\"&\"" },
        peg$c63 = function(m, value) {
        		return {
        			type: m ? NODE_TYPE.TRIPLE : NODE_TYPE.INTERPOLATOR,
        			value: value
        		}
        	},
        peg$c64 = function(value) {
        		return {
        			type: NODE_TYPE.TRIPLE,
        			value: value
        		}
        	},
        peg$c65 = /^[!>]/,
        peg$c66 = { type: "class", value: "[!>]", description: "[!>]" },
        peg$c67 = function(m, value) {
        		return {
        			type: m === ">" ? NODE_TYPE.PARTIAL : NODE_TYPE.MCOMMENT,
        			value: value.join("").trim()
        		}
        	},
        peg$c68 = "|",
        peg$c69 = { type: "literal", value: "|", description: "\"|\"" },
        peg$c70 = function(m) { return { raw: text(), result: m } },
        peg$c71 = function(p, c) {
        		if (p == null) p = { type: "all" };
        		p.parts = c;
        		return p;
        	},
        peg$c72 = function(p) { p.parts = []; return p; },
        peg$c73 = "../",
        peg$c74 = { type: "literal", value: "../", description: "\"../\"" },
        peg$c75 = function(d) { return { type: "parent", distance: d.length }; },
        peg$c76 = "./",
        peg$c77 = { type: "literal", value: "./", description: "\"./\"" },
        peg$c78 = function() { return { type: "local" }; },
        peg$c79 = ".",
        peg$c80 = { type: "literal", value: ".", description: "\".\"" },
        peg$c81 = "/",
        peg$c82 = { type: "literal", value: "/", description: "\"/\"" },
        peg$c83 = function() { return { type: "root" }; },
        peg$c84 = /^[a-z0-9$_]/i,
        peg$c85 = { type: "class", value: "[a-z0-9$_]i", description: "[a-z0-9$_]i" },
        peg$c86 = /^[a-z0-9:\-_$]/i,
        peg$c87 = { type: "class", value: "[a-z0-9:\\-_$]i", description: "[a-z0-9:\\-_$]i" },
        peg$c88 = function(k, c) { return { key: k, children: c } },
        peg$c89 = "[",
        peg$c90 = { type: "literal", value: "[", description: "\"[\"" },
        peg$c91 = "]",
        peg$c92 = { type: "literal", value: "]", description: "\"]\"" },
        peg$c93 = function(c) { return c; },
        peg$c94 = "true",
        peg$c95 = { type: "literal", value: "true", description: "\"true\"" },
        peg$c96 = function() { return true; },
        peg$c97 = "false",
        peg$c98 = { type: "literal", value: "false", description: "\"false\"" },
        peg$c99 = function() { return false; },
        peg$c100 = "-",
        peg$c101 = { type: "literal", value: "-", description: "\"-\"" },
        peg$c102 = /^[0-9]/,
        peg$c103 = { type: "class", value: "[0-9]", description: "[0-9]" },
        peg$c104 = function() { return parseFloat(text(), 10); },
        peg$c105 = function() { return parseInt(text(), 10); },
        peg$c106 = "\"",
        peg$c107 = { type: "literal", value: "\"", description: "\"\\\"\"" },
        peg$c108 = /^[^"]/,
        peg$c109 = { type: "class", value: "[^\"]", description: "[^\"]" },
        peg$c110 = function(v) { return v.join(""); },
        peg$c111 = "'",
        peg$c112 = { type: "literal", value: "'", description: "\"'\"" },
        peg$c113 = /^[^']/,
        peg$c114 = { type: "class", value: "[^']", description: "[^']" },
        peg$c115 = "null",
        peg$c116 = { type: "literal", value: "null", description: "\"null\"" },
        peg$c117 = function() { return null; },
        peg$c118 = "undefined",
        peg$c119 = { type: "literal", value: "undefined", description: "\"undefined\"" },
        peg$c120 = "void",
        peg$c121 = { type: "literal", value: "void", description: "\"void\"" },
        peg$c122 = /^[,; \t\n\r]/,
        peg$c123 = { type: "class", value: "[,; \\t\\n\\r]", description: "[,; \\t\\n\\r]" },
        peg$c124 = function() { return void 0; },
        peg$c125 = /^[a-z0-9_\-]/i,
        peg$c126 = { type: "class", value: "[a-z0-9_\\-]i", description: "[a-z0-9_\\-]i" },
        peg$c127 = function(k) { return k; },
        peg$c128 = { type: "other", description: "whitespace" },
        peg$c129 = /^[ \t\n\r]/,
        peg$c130 = { type: "class", value: "[ \\t\\n\\r]", description: "[ \\t\\n\\r]" },
        peg$c131 = "\\",
        peg$c132 = { type: "literal", value: "\\", description: "\"\\\\\"" },
        peg$c133 = function(char) { return char; },

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$parsestart() {
      var s0, s1;

      s0 = peg$currPos;
      s1 = peg$parsehtml();
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c0(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsehtml() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parsesection();
      if (s2 === peg$FAILED) {
        s2 = peg$parseextraStache();
        if (s2 === peg$FAILED) {
          s2 = peg$parsedoubleStache();
          if (s2 === peg$FAILED) {
            s2 = peg$parsetripleStache();
            if (s2 === peg$FAILED) {
              s2 = peg$parsecommentNode();
              if (s2 === peg$FAILED) {
                s2 = peg$parseelementNode();
                if (s2 === peg$FAILED) {
                  s2 = peg$parsetextNode();
                }
              }
            }
          }
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsesection();
        if (s2 === peg$FAILED) {
          s2 = peg$parseextraStache();
          if (s2 === peg$FAILED) {
            s2 = peg$parsedoubleStache();
            if (s2 === peg$FAILED) {
              s2 = peg$parsetripleStache();
              if (s2 === peg$FAILED) {
                s2 = peg$parsecommentNode();
                if (s2 === peg$FAILED) {
                  s2 = peg$parseelementNode();
                  if (s2 === peg$FAILED) {
                    s2 = peg$parsetextNode();
                  }
                }
              }
            }
          }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c2(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsetextNode() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c4.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c5); }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (peg$c4.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c5); }
          }
        }
      } else {
        s1 = peg$c3;
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c6(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsecommentNode() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c7) {
        s1 = peg$c7;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c8); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsecommentValue();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c9) {
            s3 = peg$c9;
            peg$currPos += 3;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c10); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c11(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsecommentValue() {
      var s0, s1, s2;

      s0 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 3) === peg$c9) {
        s1 = peg$c9;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c10); }
      }
      peg$silentFails--;
      if (s1 !== peg$FAILED) {
        peg$currPos = s0;
        s0 = peg$c12;
      } else {
        s0 = peg$c3;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.length > peg$currPos) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c13); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parsecommentValue();
          if (s2 === peg$FAILED) {
            s2 = peg$c14;
          }
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c15(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      }

      return s0;
    }

    function peg$parseelementNode() {
      var s0, s1, s2, s3;

      s0 = peg$parseelementSelfClosed();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseelementStart();
        if (s1 !== peg$FAILED) {
          s2 = peg$parsehtml();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseelementEnd();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c16(s1, s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      }

      return s0;
    }

    function peg$parseelementSelfClosed() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 60) {
        s1 = peg$c17;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c18); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsekey();
        if (s2 !== peg$FAILED) {
          s3 = [];
          s4 = peg$parseattribute();
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseattribute();
          }
          if (s3 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c19) {
              s4 = peg$c19;
              peg$currPos += 2;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c20); }
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c21(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parseelementStart() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 60) {
        s1 = peg$c17;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c18); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsekey();
        if (s2 !== peg$FAILED) {
          s3 = [];
          s4 = peg$parseattribute();
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseattribute();
          }
          if (s3 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 62) {
              s4 = peg$c22;
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c23); }
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c24(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parseelementEnd() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c25) {
        s1 = peg$c25;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c26); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsekey();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 62) {
            s3 = peg$c22;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c23); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c27(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parseattribute() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parsekey();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 61) {
          s3 = peg$c28;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c29); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsews();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsestrict_string();
            if (s5 !== peg$FAILED) {
              s6 = peg$parsews();
              if (s6 !== peg$FAILED) {
                s3 = [s3, s4, s5, s6];
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$c3;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$c3;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c3;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c3;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c14;
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c30(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parseattrValue() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parsesection();
      if (s2 === peg$FAILED) {
        s2 = peg$parseextraStache();
        if (s2 === peg$FAILED) {
          s2 = peg$parsedoubleStache();
          if (s2 === peg$FAILED) {
            s2 = peg$parsetripleStache();
            if (s2 === peg$FAILED) {
              s2 = peg$parsetextNode();
            }
          }
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsesection();
        if (s2 === peg$FAILED) {
          s2 = peg$parseextraStache();
          if (s2 === peg$FAILED) {
            s2 = peg$parsedoubleStache();
            if (s2 === peg$FAILED) {
              s2 = peg$parsetripleStache();
              if (s2 === peg$FAILED) {
                s2 = peg$parsetextNode();
              }
            }
          }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c2(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parseattrArguments() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = peg$parseattrArgValue();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 44) {
          s3 = peg$c31;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c32); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseattrArguments();
          if (s4 !== peg$FAILED) {
            s3 = [s3, s4];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$c3;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c3;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c14;
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c33(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parseattrArgValue() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$parsews();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsestache();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsews();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseattrArgNotEnd();
            if (s5 !== peg$FAILED) {
              peg$reportedPos = s1;
              s2 = peg$c34(s3);
              s1 = s2;
            } else {
              peg$currPos = s1;
              s1 = peg$c3;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$c3;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c3;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$c3;
      }
      if (s1 === peg$FAILED) {
        s1 = peg$currPos;
        s2 = peg$parsews();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsestring();
          if (s3 !== peg$FAILED) {
            s4 = peg$parsews();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseattrArgNotEnd();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s1;
                s2 = peg$c34(s3);
                s1 = s2;
              } else {
                peg$currPos = s1;
                s1 = peg$c3;
              }
            } else {
              peg$currPos = s1;
              s1 = peg$c3;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$c3;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c3;
        }
        if (s1 === peg$FAILED) {
          s1 = peg$currPos;
          s2 = peg$parsews();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseboolean();
            if (s3 !== peg$FAILED) {
              s4 = peg$parsews();
              if (s4 !== peg$FAILED) {
                s5 = peg$parseattrArgNotEnd();
                if (s5 !== peg$FAILED) {
                  peg$reportedPos = s1;
                  s2 = peg$c34(s3);
                  s1 = s2;
                } else {
                  peg$currPos = s1;
                  s1 = peg$c3;
                }
              } else {
                peg$currPos = s1;
                s1 = peg$c3;
              }
            } else {
              peg$currPos = s1;
              s1 = peg$c3;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$c3;
          }
          if (s1 === peg$FAILED) {
            s1 = peg$currPos;
            s2 = peg$parsews();
            if (s2 !== peg$FAILED) {
              s3 = peg$parsenumber();
              if (s3 !== peg$FAILED) {
                s4 = peg$parsews();
                if (s4 !== peg$FAILED) {
                  s5 = peg$parseattrArgNotEnd();
                  if (s5 !== peg$FAILED) {
                    peg$reportedPos = s1;
                    s2 = peg$c34(s3);
                    s1 = s2;
                  } else {
                    peg$currPos = s1;
                    s1 = peg$c3;
                  }
                } else {
                  peg$currPos = s1;
                  s1 = peg$c3;
                }
              } else {
                peg$currPos = s1;
                s1 = peg$c3;
              }
            } else {
              peg$currPos = s1;
              s1 = peg$c3;
            }
            if (s1 === peg$FAILED) {
              s1 = peg$currPos;
              s2 = peg$parsews();
              if (s2 !== peg$FAILED) {
                s3 = peg$parsenull();
                if (s3 !== peg$FAILED) {
                  s4 = peg$parsews();
                  if (s4 !== peg$FAILED) {
                    s5 = peg$parseattrArgNotEnd();
                    if (s5 !== peg$FAILED) {
                      peg$reportedPos = s1;
                      s2 = peg$c34(s3);
                      s1 = s2;
                    } else {
                      peg$currPos = s1;
                      s1 = peg$c3;
                    }
                  } else {
                    peg$currPos = s1;
                    s1 = peg$c3;
                  }
                } else {
                  peg$currPos = s1;
                  s1 = peg$c3;
                }
              } else {
                peg$currPos = s1;
                s1 = peg$c3;
              }
              if (s1 === peg$FAILED) {
                s1 = peg$currPos;
                s2 = peg$parsews();
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseundefined();
                  if (s3 !== peg$FAILED) {
                    s4 = peg$parsews();
                    if (s4 !== peg$FAILED) {
                      s5 = peg$parseattrArgNotEnd();
                      if (s5 !== peg$FAILED) {
                        peg$reportedPos = s1;
                        s2 = peg$c34(s3);
                        s1 = s2;
                      } else {
                        peg$currPos = s1;
                        s1 = peg$c3;
                      }
                    } else {
                      peg$currPos = s1;
                      s1 = peg$c3;
                    }
                  } else {
                    peg$currPos = s1;
                    s1 = peg$c3;
                  }
                } else {
                  peg$currPos = s1;
                  s1 = peg$c3;
                }
                if (s1 === peg$FAILED) {
                  s1 = peg$currPos;
                  s2 = peg$currPos;
                  s3 = [];
                  if (peg$c35.test(input.charAt(peg$currPos))) {
                    s4 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s4 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c36); }
                  }
                  while (s4 !== peg$FAILED) {
                    s3.push(s4);
                    if (peg$c35.test(input.charAt(peg$currPos))) {
                      s4 = input.charAt(peg$currPos);
                      peg$currPos++;
                    } else {
                      s4 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c36); }
                    }
                  }
                  if (s3 !== peg$FAILED) {
                    s3 = input.substring(s2, peg$currPos);
                  }
                  s2 = s3;
                  if (s2 !== peg$FAILED) {
                    peg$reportedPos = s1;
                    s2 = peg$c37(s2);
                  }
                  s1 = s2;
                }
              }
            }
          }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c38(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parseattrArgNotEnd() {
      var s0, s1, s2;

      s0 = peg$currPos;
      peg$silentFails++;
      if (peg$c39.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c40); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$currPos;
        peg$silentFails++;
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c13); }
        }
        peg$silentFails--;
        if (s2 === peg$FAILED) {
          s1 = peg$c12;
        } else {
          peg$currPos = s1;
          s1 = peg$c3;
        }
      }
      peg$silentFails--;
      if (s1 !== peg$FAILED) {
        peg$currPos = s0;
        s0 = peg$c12;
      } else {
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsesection() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parsesectionStart();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsehtml();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsesectionEnd();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c41(s1, s2, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsesectionStart() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c42) {
        s1 = peg$c42;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c43); }
      }
      if (s1 !== peg$FAILED) {
        if (peg$c44.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c45); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parsepathQueryWithRaw();
          if (s3 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c46) {
              s4 = peg$c46;
              peg$currPos += 2;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c47); }
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c48(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsesectionEnd() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c49) {
        s1 = peg$c49;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c50); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseescape();
        if (s3 === peg$FAILED) {
          if (peg$c51.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c52); }
          }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseescape();
          if (s3 === peg$FAILED) {
            if (peg$c51.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c52); }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c46) {
            s3 = peg$c46;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c47); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c53(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsestache() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c54) {
        s2 = peg$c54;
        peg$currPos += 3;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c55); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsepathQuery();
        if (s3 !== peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c56) {
            s4 = peg$c56;
            peg$currPos += 3;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c57); }
          }
          if (s4 !== peg$FAILED) {
            s2 = [s2, s3, s4];
            s1 = s2;
          } else {
            peg$currPos = s1;
            s1 = peg$c3;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c3;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$c3;
      }
      if (s1 === peg$FAILED) {
        s1 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c42) {
          s2 = peg$c42;
          peg$currPos += 2;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c43); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parsepathQuery();
          if (s3 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c46) {
              s4 = peg$c46;
              peg$currPos += 2;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c47); }
            }
            if (s4 !== peg$FAILED) {
              s2 = [s2, s3, s4];
              s1 = s2;
            } else {
              peg$currPos = s1;
              s1 = peg$c3;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$c3;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c3;
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c58(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsedoubleStache() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c42) {
        s1 = peg$c42;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c43); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        peg$silentFails++;
        if (peg$c59.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c60); }
        }
        peg$silentFails--;
        if (s3 === peg$FAILED) {
          s2 = peg$c12;
        } else {
          peg$currPos = s2;
          s2 = peg$c3;
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 38) {
            s3 = peg$c61;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c62); }
          }
          if (s3 === peg$FAILED) {
            s3 = peg$c14;
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parsepathQuery();
            if (s4 !== peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c46) {
                s5 = peg$c46;
                peg$currPos += 2;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c47); }
              }
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c63(s3, s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c3;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsetripleStache() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c54) {
        s1 = peg$c54;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c55); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsepathQuery();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c56) {
            s3 = peg$c56;
            peg$currPos += 3;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c57); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c64(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parseextraStache() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c42) {
        s1 = peg$c42;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c43); }
      }
      if (s1 !== peg$FAILED) {
        if (peg$c65.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c66); }
        }
        if (s2 !== peg$FAILED) {
          s3 = [];
          s4 = peg$parseescape();
          if (s4 === peg$FAILED) {
            if (peg$c51.test(input.charAt(peg$currPos))) {
              s4 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c52); }
            }
          }
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseescape();
            if (s4 === peg$FAILED) {
              if (peg$c51.test(input.charAt(peg$currPos))) {
                s4 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c52); }
              }
            }
          }
          if (s3 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c46) {
              s4 = peg$c46;
              peg$currPos += 2;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c47); }
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c67(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsepathQuery() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = peg$parsepath();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 124) {
          s3 = peg$c68;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c69); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsepathQuery();
          if (s4 !== peg$FAILED) {
            s3 = [s3, s4];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$c3;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c3;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c14;
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c33(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsepathQueryWithRaw() {
      var s0, s1;

      s0 = peg$currPos;
      s1 = peg$parsepathQuery();
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c70(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsepath() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = peg$parsews();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsepathPrefix();
        if (s2 === peg$FAILED) {
          s2 = peg$c14;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parsepathCore();
          if (s3 !== peg$FAILED) {
            s4 = peg$parsews();
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c71(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parsews();
        if (s1 !== peg$FAILED) {
          s2 = peg$parsepathPrefix();
          if (s2 !== peg$FAILED) {
            s3 = peg$parsews();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c72(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      }

      return s0;
    }

    function peg$parsepathPrefix() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (input.substr(peg$currPos, 3) === peg$c73) {
        s2 = peg$c73;
        peg$currPos += 3;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (input.substr(peg$currPos, 3) === peg$c73) {
            s2 = peg$c73;
            peg$currPos += 3;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c74); }
          }
        }
      } else {
        s1 = peg$c3;
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c75(s1);
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c76) {
          s1 = peg$c76;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c77); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c78();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 46) {
            s1 = peg$c79;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c80); }
          }
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c78();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 47) {
              s1 = peg$c81;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c82); }
            }
            if (s1 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c83();
            }
            s0 = s1;
          }
        }
      }

      return s0;
    }

    function peg$parsepathCore() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = peg$parsepathPart();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 46) {
          s3 = peg$c79;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c80); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsepathCore();
          if (s4 !== peg$FAILED) {
            s3 = [s3, s4];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$c3;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c3;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c14;
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c33(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsepathPart() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$currPos;
      if (peg$c84.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c85); }
      }
      if (s3 !== peg$FAILED) {
        s4 = [];
        if (peg$c86.test(input.charAt(peg$currPos))) {
          s5 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c87); }
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          if (peg$c86.test(input.charAt(peg$currPos))) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c87); }
          }
        }
        if (s4 !== peg$FAILED) {
          s3 = [s3, s4];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$c3;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$c3;
      }
      if (s2 !== peg$FAILED) {
        s2 = input.substring(s1, peg$currPos);
      }
      s1 = s2;
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parsepathDynamic();
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parsepathDynamic();
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c88(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsepathDynamic() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 91) {
        s1 = peg$c89;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c90); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsews();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseinteger();
          if (s3 === peg$FAILED) {
            s3 = peg$parsestring();
            if (s3 === peg$FAILED) {
              s3 = peg$parsepath();
            }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parsews();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 93) {
                s5 = peg$c91;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c92); }
              }
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c93(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c3;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parseboolean() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c94) {
        s1 = peg$c94;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c95); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c96();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c97) {
          s1 = peg$c97;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c98); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c99();
        }
        s0 = s1;
      }

      return s0;
    }

    function peg$parsenumber() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 45) {
        s1 = peg$c100;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c101); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$c14;
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c102.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c103); }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$c102.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c103); }
            }
          }
        } else {
          s2 = peg$c3;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 46) {
            s4 = peg$c79;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c80); }
          }
          if (s4 !== peg$FAILED) {
            s5 = [];
            if (peg$c102.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c103); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c102.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c103); }
                }
              }
            } else {
              s5 = peg$c3;
            }
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$c3;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c3;
          }
          if (s3 === peg$FAILED) {
            s3 = peg$c14;
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c104();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parseinteger() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c102.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c103); }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (peg$c102.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c103); }
          }
        }
      } else {
        s1 = peg$c3;
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c105();
      }
      s0 = s1;

      return s0;
    }

    function peg$parsestring() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 34) {
        s1 = peg$c106;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c107); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseescape();
        if (s3 === peg$FAILED) {
          if (peg$c108.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c109); }
          }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseescape();
          if (s3 === peg$FAILED) {
            if (peg$c108.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c109); }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 34) {
            s3 = peg$c106;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c107); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c110(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s1 = peg$c111;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c112); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parseescape();
          if (s3 === peg$FAILED) {
            if (peg$c113.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c114); }
            }
          }
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseescape();
            if (s3 === peg$FAILED) {
              if (peg$c113.test(input.charAt(peg$currPos))) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c114); }
              }
            }
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s3 = peg$c111;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c112); }
            }
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c110(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      }

      return s0;
    }

    function peg$parsestrict_string() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 34) {
        s1 = peg$c106;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c107); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        if (peg$c108.test(input.charAt(peg$currPos))) {
          s4 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c109); }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          if (peg$c108.test(input.charAt(peg$currPos))) {
            s4 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c109); }
          }
        }
        if (s3 !== peg$FAILED) {
          s3 = input.substring(s2, peg$currPos);
        }
        s2 = s3;
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 34) {
            s3 = peg$c106;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c107); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c34(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s1 = peg$c111;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c112); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$currPos;
          s3 = [];
          if (peg$c113.test(input.charAt(peg$currPos))) {
            s4 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c114); }
          }
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            if (peg$c113.test(input.charAt(peg$currPos))) {
              s4 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c114); }
            }
          }
          if (s3 !== peg$FAILED) {
            s3 = input.substring(s2, peg$currPos);
          }
          s2 = s3;
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s3 = peg$c111;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c112); }
            }
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c34(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c3;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      }

      return s0;
    }

    function peg$parsenull() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c115) {
        s1 = peg$c115;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c116); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c117();
      }
      s0 = s1;

      return s0;
    }

    function peg$parseundefined() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 9) === peg$c118) {
        s1 = peg$c118;
        peg$currPos += 9;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c119); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$currPos;
        if (input.substr(peg$currPos, 4) === peg$c120) {
          s2 = peg$c120;
          peg$currPos += 4;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c121); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            peg$silentFails++;
            s5 = [];
            if (peg$c122.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c123); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c122.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c123); }
                }
              }
            } else {
              s5 = peg$c3;
            }
            peg$silentFails--;
            if (s5 === peg$FAILED) {
              s4 = peg$c12;
            } else {
              peg$currPos = s4;
              s4 = peg$c3;
            }
            if (s4 !== peg$FAILED) {
              s2 = [s2, s3, s4];
              s1 = s2;
            } else {
              peg$currPos = s1;
              s1 = peg$c3;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$c3;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c3;
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c124();
      }
      s0 = s1;

      return s0;
    }

    function peg$parsekey() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = peg$parsews();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        if (peg$c125.test(input.charAt(peg$currPos))) {
          s4 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c126); }
        }
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            if (peg$c125.test(input.charAt(peg$currPos))) {
              s4 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c126); }
            }
          }
        } else {
          s3 = peg$c3;
        }
        if (s3 !== peg$FAILED) {
          s3 = input.substring(s2, peg$currPos);
        }
        s2 = s3;
        if (s2 !== peg$FAILED) {
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c127(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c3;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }

    function peg$parsews() {
      var s0, s1, s2;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      if (peg$c129.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c130); }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c129.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c130); }
        }
      }
      if (s1 !== peg$FAILED) {
        s1 = input.substring(s0, peg$currPos);
      }
      s0 = s1;
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c128); }
      }

      return s0;
    }

    function peg$parseescape() {
      var s0, s1, s2;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c131;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c132); }
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c13); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c133(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c3;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c3;
      }

      return s0;
    }


    	var _ = require("underscore"),
    		NODE_TYPE = require("./types"),
    		Mustache = require("./");

    	options = _.defaults(options || {}, {
    		strict: true
    	});


    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();
},{"./":3,"./types":12,"underscore":17}],5:[function(require,module,exports){
var Trackr = require("trackr"),
	_ = require("underscore"),
	util = require("./util"),
	parse = require("./m+xml").parse,
	$track = require("./track").track;

var Model =
module.exports = function Model(data, parent, options) {
	this.proxies = [];
	this._dep = new Trackr.Dependency();
	if (Model.isModel(parent)) this.parent = parent;
	this.set(data, options && options.track);
}

Model.isModel = function(o) {
	return o instanceof Model;
}

Model.extend = util.subclass;

Model._defaultProxies = [ {
	isList:  true,
	match:   function(arr)    { return _.isArray(arr); },
	get:     function(arr, k) { return k === "length" ? this.length(arr) : arr[k]; },
	length:  function(arr)    { var len; return typeof(len = arr.$length) === "number" ? len : arr.length; },
	keys:    function(arr)    { return _.range(this.length(arr)); },
	isEmpty: function(arr)    { return !!this.length(arr); }
}, {
	match: function()     { return true; },
	get:   function(t, k) { if (t != null) return t[k]; }
} ];

Model.callProxyMethod = function(proxy, target, method, args, ctx) {
	var args = _.isArray(args) ? _.clone(args) : [];
	args.unshift(proxy, method, target);
	args.push(ctx);
	return util.result.apply(null, args);
}

_.extend(Model.prototype, {

	// sets the data on the model
	set: function(data, track) {
		if (track !== false) data = $track(data, track);
		this.data = data;
		this._dep.changed();
		return this;
	},

	// an array of models in the current stack, with the root as the first
	getAllModels: function() {
		var models = [ this ],
			model = this;

		while (model.parent) {
			models.unshift(model = model.parent);
		}

		return models
	},

	// gets the model in the stack at the index
	// negative values start at root
	getModelAtOffset: function(index) {
		if (!_.isNumber(index) || isNaN(index)) index = 0;
		if (index < 0) return this.getAllModels()[~index];

		var model = this;
		
		while (index && model) {
			model = model.parent;
			index--;
		}
		
		return model;
	},

	// gets the last model in the stack
	getRootModel: function() {
		var model = this;
		while (model.parent != null) model = model.parent;
		return model;
	},

	// returns the first model which passes the function
	findModel: function(fn) {
		var index = 0,
			model = this;

		while (model != null) {
			if (fn.call(this, model, index++)) return model;
			model = model.parent;
		}
	},

	// returns the value at path, but only looks in the data on this model
	getLocal: function(path) {
		if (typeof path === "string") path = parse(path, { startRule: "path" });
		if (path == null) path = { parts: [] };
		if (!_.isObject(path)) throw new Error("Expecting string or object for path.");
		
		var self = this;
		this._dep.depend();

		return _.reduce(path.parts, function(target, part) {
			target = self._get(target, part.key);

			_.each(part.children, function(k) {
				if (_.isObject(k)) k = self.get(k);
				target = self._get(target, k);
			});

			return target;
		}, this.data);
	},

	// retrieves value with path query
	get: function(paths) {
		var self = this;

		if (typeof paths === "string") paths = parse(paths, { startRule: "pathQuery" });
		if (!_.isArray(paths)) paths = paths != null ? [ paths ] : [];
		
		if (!paths.length) {
			var model = this.findModel(function(m) { return !_.isUndefined(m.data); });
			if (model == null) return;
			var val = model.data;
			if (_.isFunction(val)) val = val.call(this, null);
			return val;
		}

		return _.reduce(paths, function(result, path, index) {
			var model = self,
				scope = true,
				val;

			if (path.type === "root") {
				model = self.getRootModel();
			} else if (path.type === "parent") {
				model = self.getModelAtOffset(path.distance);
				scope = false;
			} else if (path.type === "all") {
				scope = false;
			}

			if (model == null) return;

			while (_.isUndefined(val) && model != null) {
				val = model.getLocal(path);
				model = model.parent;
				if (scope) break;
			}

			if (_.isFunction(val)) {
				val = val.call(self, index === 0 ? null : result);
			}

			return val;
		}, void 0);
	},

	_get: function(target, key) {
		return this.callProxyMethod(this.getProxyByValue(target), target, "get", key);
	},

	proxy: function(key) {
		var proxy = this.getProxyByValue(this.data);
		if (key == null) return proxy;
		var args = _.toArray(arguments);
		args.unshift(proxy, this.data);
		return this.callProxyMethod.apply(this, args);
	},

	callProxyMethod: function(proxy, target, method) {
		return Model.callProxyMethod(proxy, target, method, Array.prototype.slice.call(arguments, 3), this);
	},

	getAllProxies: function() {
		var proxies = [],
			model = this;

		while (model != null) {
			proxies.push.apply(proxies, model.proxies);
			model = model.parent;
		}

		return proxies;
	},

	registerProxy: function(proxy) {
		if (typeof proxy !== "object" || proxy == null) throw new Error("Expecting object for proxy.");
		if (typeof proxy.match !== "function") throw new Error("Layer missing required match method.");
		if (typeof proxy.get !== "function") throw new Error("Layer missing required get method.");
		this.proxies.unshift(proxy);
		return this;
	},

	getProxyByValue: function(target) {
		var proxy;
		
		// look locally first
		proxy = _.find(this.proxies, function(p) {
			return p.match(target);
		});

		// then recursively check the parents
		if (proxy == null && this.parent != null) {
			proxy = this.parent.getProxyByValue(target);
		}

		// otherwise look through the defaults
		if (proxy == null) {
			proxy = _.find(Model._defaultProxies, function(p) {
				return p.match(target);
			});
		}

		return proxy;
	}

});

},{"./m+xml":4,"./track":11,"./util":13,"trackr":16,"underscore":17}],6:[function(require,module,exports){
var Trackr = require("trackr"),
	_ = require("underscore"),
	NODE_TYPE = require("./types"),
	parse = require("./m+xml").parse,
	util = require("./util"),
	View = require("./view"),
	Model = require("./model"),
	Section = require("./section"),
	$track = require("./track").track,
	DOMRange = require("./domrange");

var Mustache =
module.exports = View.extend({
	constructor: function(data, options) {
		options = options || {};
		this._partials = {};
		this._components = {};

		// add template
		var template = options.template || _.result(this, "template");
		if (template != null) this.setTemplate(template);

		// add decorators
		this.decorate(_.extend({}, options.decorators, _.result(this, "decorators")));

		// add partials
		this.setPartial(_.extend({}, options.partials, _.result(this, "partials")));

		// initiate like a normal view
		View.call(this, data, options);
	},

	// parses and sets the root template
	setTemplate: function(template) {
		if (_.isString(template)) template = parse(template);

		if (!_.isObject(template) || template.type !== NODE_TYPE.ROOT)
			throw new Error("Expecting string or parsed template.");

		this._template = template;
		return this;
	},

	// creates a decorator
	decorate: function(name, fn, options) {
		if (typeof name === "object" && fn == null) {
			_.each(name, function(fn, n) {
				if (_.isArray(fn)) this.decorate(n, fn[0], fn[1]);
				else this.decorate(n, fn, options);
			}, this);
			return this;
		}

		if (typeof name !== "string" || name === "") throw new Error("Expecting non-empty string for decorator name.");
		if (typeof fn !== "function") throw new Error("Expecting function for decorator.");

		if (this._decorators == null) this._decorators = {};
		if (this._decorators[name] == null) this._decorators[name] = [];
		var decorators = this._decorators[name];

		if (!_.findWhere(decorators, { callback: fn })) {
			decorators.push({
				callback: fn,
				options: options || {}
			});
		}

		return this;
	},

	// finds all decorators, locally and in parent
	findDecorators: function(name) {
		var decorators = [],
			c = this;


		while (c != null) {
			if (c._decorators != null && _.isArray(c._decorators[name])) {
				c._decorators[name].forEach(function(d) {
					if (!_.findWhere(decorators, { callback: d.callback })) {
						decorators.push(_.extend({ context: c }, d));
					}
				});
			}

			c = c.parentRange;
		}

		return decorators;
	},

	// removes a decorator
	stopDecorating: function(name, fn) {
		if (typeof name === "function" && fn == null) {
			fn = name;
			name = null;
		}

		if (this._decorators == null || (name == null && fn == null)) {
			this._decorators = {};
		}

		else if (fn == null) {
			delete this._decorators[name];
		}

		else if (name == null) {
			_.each(this._decorators, function(d, n) {
				this._decorators[n] = _.filter(d, function(_d) {
					return _d.callback !== fn;
				});
			}, this);
		}

		else {
			var d = this._decorators[name];
			this._decorators[name] = _.filter(d, function(_d) {
				return _d.callback !== fn;
			});
		}

		return this;
	},

	// sets partial by name
	setPartial: function(name, partial) {
		if (_.isObject(name) && partial == null) {
			_.each(name, function(p, n) { this.setPartial(n, p); }, this);
			return this;
		}

		if (!_.isString(name) && name !== "")
			throw new Error("Expecting non-empty string for partial name.");

		if (_.isString(partial)) partial = parse(partial);
		if (_.isObject(partial) && partial.type === NODE_TYPE.ROOT) partial = Mustache.extend({ template: partial });
		if (partial != null && !util.isSubClass(View, partial))
			throw new Error("Expecting string template, parsed template, View subclass or function for partial.");

		if (partial == null) {
			delete this._partials[name];
			partial = void 0;
		} else {
			this._partials[name] = partial;
		}

		this.trigger("partial", name, partial);
		this.trigger("partial:" + name, partial);

		return this;
	},

	// looks through parents for partial
	findPartial: function(name) {
		var c = this;

		while (c != null) {
			if (c._partials != null && c._partials[name] != null) return c._partials[name];
			c = c.parentRange;
		}
	},

	// returns first rendered partial by name
	getComponent: function(name) {
		var comps, comp, res, n, i;

		comps = this._components;
		if (comps[name] != null && comps[name].length) return comps[name][0];

		for (n in comps) {
			for (i in comps[n]) {
				comp = comps[n][i]
				if (!(comp instanceof Mustache)) continue;
				res = comp.getComponent(name);
				if (res != null) return res;
			}
		}

		return null;
	},

	// returns all rendered partials by name
	getComponents: function(name) {
		return _.reduce(this._components, function(m, comps, n) {
			if (n === name) m.push.apply(m, comps);
			
			comps.forEach(function(c) {
				if (c instanceof Mustache) m.push.apply(m, c.getComponents(name));
			});

			return m;
		}, []);
	},

	// the main render function called by mount
	render: function() {
		if (this._template == null)
			throw new Error("Expected a template to be set before rendering.");

		var toMount;
		this.setMembers(this.renderTemplate(this._template, null, toMount = []));
		_.invoke(toMount, "mount");
	},

	// converts a template into an array of elements and DOMRanges
	renderTemplate: function(template, view, toMount) {
		if (view == null) view = this;
		if (toMount == null) toMount = [];
		var self = this;

		if (_.isArray(template)) return template.reduce(function(r, t) {
			var b = self.renderTemplate(t, view, toMount);
			if (_.isArray(b)) r.push.apply(r, b);
			else if (b != null) r.push(b);
			return r;
		}, []);

		switch(template.type) {
			case NODE_TYPE.ROOT:
				return this.renderTemplate(template.children, view, toMount);

			case NODE_TYPE.ELEMENT:
				var part = this.renderPartial(template.name, view);
				var obj;

				if (part != null) {
					part.addData(obj = $track({}));

					template.attributes.forEach(function(attr) {
						self.autorun(function(c) {
							var val = this.renderArguments(attr.arguments, view);
							if (val.length === 1) val = val[0];
							else if (!val.length) val = void 0;

							if (c.firstRun) obj.defineProperty(attr.name, val);
							else obj[attr.name] = val;
						});
					});

					toMount.push(part);
					return part;
				}

				else {
					var el = document.createElement(template.name);
					
					template.attributes.forEach(function(attr) {
						if (this.renderDecorations(el, attr, view)) return;
						
						this.autorun(function() {
							el.setAttribute(attr.name, this.renderTemplateAsString(attr.children, view));
						});
					}, this);

					var children = this.renderTemplate(template.children, view, toMount),
						child, i;

					for (i in children) {
						child = children[i];
						if (child instanceof DOMRange) {
							child.parentRange = view; // fake the parent
							child.attach(el);
						} else {
							el.appendChild(child);
						}
					}
					
					return el;
				}

			case NODE_TYPE.TEXT:
				return document.createTextNode(util.decodeEntities(template.value));

			case NODE_TYPE.HTML:
				return new DOMRange(util.parseHTML(template.value));

			case NODE_TYPE.XCOMMENT:
				return document.createComment(template.value);

			case NODE_TYPE.INTERPOLATOR:
				var node = document.createTextNode("");
				
				this.autorun(function() {
					var val = view.get(template.value);
					node.nodeValue = typeof val === "string" ? val : val != null ? val.toString() : "";
				});

				return node;

			case NODE_TYPE.TRIPLE:
				var range = new DOMRange();
				
				this.autorun(function() {
					range.setMembers(util.parseHTML(view.get(template.value)));
				});

				return range;

			case NODE_TYPE.INVERTED:
			case NODE_TYPE.SECTION:
				var section = new Section(view.model)
					.invert(template.type === NODE_TYPE.INVERTED)
					.setPath(template.value)
					.onRow(function() {
						var _toMount;
						this.setMembers(self.renderTemplate(template.children, this, _toMount = []));
						_.invoke(_toMount, "mount");
					});

				toMount.push(section);
				return section;

			case NODE_TYPE.PARTIAL:
				var partial = this.renderPartial(template.value, view);
				if (partial) toMount.push(partial);
				return partial;
		}
	},

	// converts a template into a string
	renderTemplateAsString: function(template, ctx) {
		if (ctx == null) ctx = this;
		if (ctx instanceof View) ctx = ctx.model;
		var self = this;

		if (_.isArray(template)) return template.map(function(t) {
			return self.renderTemplateAsString(t, ctx);
		}).filter(function(b) { return b != null; }).join("");

		switch(template.type) {
			case NODE_TYPE.ROOT:
				return this.renderTemplateAsString(template.children, ctx);

			case NODE_TYPE.TEXT:
				return template.value;

			case NODE_TYPE.INTERPOLATOR:
			case NODE_TYPE.TRIPLE:
				var val = ctx.get(template.value);
				return val != null ? val.toString() : "";

			case NODE_TYPE.SECTION:
			case NODE_TYPE.INVERTED:
				var inverted, model, val, isEmpty, makeRow, proxy, isList;

				inverted = template.type === NODE_TYPE.INVERTED;
				val = ctx.get(template.value);
				model = new Model(val, ctx);
				proxy = model.getProxyByValue(val);
				isList = model.callProxyMethod(proxy, val, "isList");
				isEmpty = Section.isEmpty(model, proxy);
				
				makeRow = function(i) {
					var row, data;

					if (i == null) {
						data = model;
					} else {
						data = model.callProxyMethod(proxy, val, "get", i);
						data = new Model(data, new Model({ $key: i }, ctx));
					}

					return self.renderTemplateAsString(template.children, data);
				}

				if (!(isEmpty ^ inverted)) {
					return isList && !inverted ?
						model.callProxyMethod(proxy, val, "keys").map(makeRow).join("") :
						makeRow();
				}
		}
	},

	// converts an argument template into an array of values
	renderArguments: function(arg, ctx) {
		if (ctx == null) ctx = this;
		if (ctx instanceof View) ctx = ctx.model;
		var self = this;

		if (_.isArray(arg)) return arg.map(function(a) {
			return self.renderArguments(a, ctx);
		}).filter(function(b) { return b != null; });

		switch(arg.type) {
			case NODE_TYPE.INTERPOLATOR:
				return ctx.get(arg.value);

			case NODE_TYPE.LITERAL:
				return arg.value;
		}
	},

	// generates a new component from a View subclass or partial's name
	renderPartial: function(klass, ctx, options) {
		var comps, name;

		// look up the partial by name
		if (typeof klass === "string") {
			name = klass;
			klass = this.findPartial(klass);
		}

		// class must be a view
		if (!util.isSubClass(View, klass)) return null;
		
		// normalize context
		if (ctx == null) ctx = this;
		if (ctx instanceof View) ctx = ctx.model;

		// create it non-reactively
		var component = Trackr.nonreactive(function() {
			return new klass(ctx, options);
		});

		// add it to the list
		if (name) {
			comps = this._components;
			if (comps[name] == null) comps[name] = [];
			comps[name].push(component);

			// auto remove when the partial is "stopped"
			component.once("stop", function() {
				comps[name] = _.without(comps[name], component);
			});
		}

		return component;
	},

	// renders decorations on an element by template
	renderDecorations: function(el, attr, ctx) {
		var self = this;

		// look up decorator by name
		var decorators = this.findDecorators(attr.name);
		if (!decorators.length) return;

		// normalize the context
		if (ctx == null) ctx = this;
		if (ctx instanceof View) ctx = ctx.model;

		// a wrapper computation to ez-clean the rest
		return this.autorun(function() {
			decorators.forEach(function(d) {
				self.autorun(function(comp) {
					// assemble the arguments!
					var args = [ {
						target: el,
						model: ctx,
						view: self,
						template: attr,
						comp: comp,
						options: d.options
					} ];

					// render arguments based on options
					if (d.options && d.options.parse === "string") {
						args.push(self.renderTemplateAsString(attr.children, ctx));
					} else if (d.options == null || d.options.parse !== false) {
						args = args.concat(self.renderArguments(attr.arguments, ctx));
					}

					// execute the callback
					d.callback.apply(d.context || self, args);
				});
			});
		});
	}

}, {

	render: function(template, data, options) {
		options = _.extend({}, options || {}, {
			template: template
		});

		return new Mustache(data || null, options);
	}

});

},{"./domrange":1,"./m+xml":4,"./model":5,"./section":10,"./track":11,"./types":12,"./util":13,"./view":14,"trackr":16,"underscore":17}],7:[function(require,module,exports){
var _ = require("underscore"),
	Mustache = require("../");

// the plugin
module.exports = function() {
	this.addAction = addAction;
	this.addActionOnce = addActionOnce;
	this.removeAction = removeAction;
	this.fireAction = fireAction;
	this.decorate(decorators);

	var initActions = _.result(this, "actions");
	if (initActions != null) this.addAction(initActions);
}

// generate decorators
var eventNames = [
	'change', 'click', 'dblclick', 'mousedown', 'mouseup',
	'mouseenter', 'mouseleave', 'scroll', 'blur', 'focus',
	'input', 'submit', 'reset', 'keydown', 'keypress', 'keyup',
	'drag', 'dragdrop', 'dragend', 'dragenter', 'dragexit',
	'dragleave', 'dragover', 'dragstart', 'drop'
];

var slice = Array.prototype.slice;
var decorators = {};

eventNames.forEach(function(event) {
	decorators["on-" + event] = function(decor, key) {
		var self = this,
			args, node;

		function listener(e) {
			// create a new action object
			var action = new Action(key);
			action.original = e;
			action.target = action.node = node;
			action.context = action.model = decor.model;
			action.view = decor.view;

			// find the first parent with the fire method
			var fireOn = self;
			while (typeof fireOn.fireAction !== "function") {
				// if it has no parent, we can't do anything
				if (fireOn.parent == null) return;
				fireOn = fireOn.parent;
			}

			// fire the action
			fireOn.fireAction.apply(fireOn, [ action ].concat(args));
		}

		node = decor.target;
		args = _.toArray(arguments).slice(2);
		node.addEventListener(event, listener);

		decor.comp.onInvalidate(function() {
			node.removeEventListener(event, listener);
		});
	}
});

// Action Class
function Action(name) {
	this.name = name;
}

Mustache.Action = Action;

Action.prototype.bubbles = true;

Action.prototype.stopPropagation = function() {
	this.bubbles = false;
	return this;
}

// Msutache Instance Methods
function addAction(name, fn) {
	if (typeof name === "object" && fn == null) {
		_.each(name, function(fn, n) { this.addAction(n, fn); }, this);
		return this;
	}

	if (typeof name !== "string" || name === "") throw new Error("Expecting non-empty string for action name.");
	if (typeof fn !== "function") throw new Error("Expecting function for action.");

	if (this._actions == null) this._actions = {};
	if (this._actions[name] == null) this._actions[name] = [];
	if (!~this._actions[name].indexOf(fn)) this._actions[name].push(fn);
	
	return this;
}

function addActionOnce(name, fn) {
	if (typeof name === "object" && fn == null) {
		_.each(name, function(fn, n) { this.addActionOnce(n, fn); }, this);
		return this;
	}

	var onAction;

	this.addAction(name, onAction = function () {
		this.removeAction(name, onAction);
		fn.apply(this, arguments);
	});

	return this;
}

function removeAction(name, fn) {
	if (typeof name === "function" && fn == null) {
		fn = name;
		name = null;
	}

	if (this._actions == null || (name == null && fn == null)) {
		this._actions = {};
	}

	else if (fn == null) {
		delete this._actions[name];
	}

	else if (name == null) {
		_.each(this._actions, function(d, n) {
			this._actions[n] = d.filter(function(f) { return f !== fn; });
		}, this);
	}

	else if (this._actions[name] != null) {
		this._actions[name] = _.without(this._actions[name], fn);
	}

	return this;
}

function fireAction(action) {
	if (typeof action === "string") action = new Action(action);
	if (_.isObject(action) && !(action instanceof Action)) action = _.extend(new Action, action);
	if (!(action instanceof Action)) throw new Error("Expecting action name, object or instance of Action.");
	
	var name = action.name,
		args = slice.call(arguments, 1);

	args.unshift(action);

	if (this._actions != null && Array.isArray(this._actions[name])) {
		this._actions[name].some(function(fn) {
			if (!action.bubbles) return true;
			fn.apply(this, args);
		}, this);
	}

	if (action.bubbles && this.parent != null) {
		// find the first parent with the fire method
		var fireOn = this.parent;
		while (typeof fireOn.fireAction !== "function") {
			// if it has no parent, we can't do anything
			if (fireOn.parent == null) return;
			fireOn = fireOn.parent;
		}

		fireOn.fireAction.apply(fireOn, args);
	}
	
	return this;
}
},{"../":3,"underscore":17}],8:[function(require,module,exports){
var _ = require("underscore");

var plugins =
exports._plugins = {};

exports.loadPlugin = function(tpl, plugin, args) {
	if (_.isString(plugin)) {
		if (plugins[plugin] == null)
			throw new Error("No plugin exists with id '" + plugin + "'.");

		plugin = plugins[plugin];
	}

	if (!_.isFunction(plugin))
		throw new Error("Expecting string or function for plugin");

	// check if plugin is already loaded on this template
	if (tpl._loaded_plugins == null) tpl._loaded_plugins = [];
	if (~tpl._loaded_plugins.indexOf(plugin)) return tpl;
	tpl._loaded_plugins.push(plugin);

	if (args == null) args = [];
	if (!_.isArray(args)) args = [ args ];

	plugin.apply(tpl, args);
	return tpl;
}

var registerPlugin =
exports.registerPlugin = function(name, fn) {
	if (typeof name !== "string") {
		throw new Error("Expecting string name for plugin.");
	}

	if (typeof fn !== "function") {
		throw new Error("Expecting function for plugin.");
	}

	if (fn === plugins[name]) return;
	if (plugins[name] != null) {
		throw new Error("Refusing to overwrite existing plugin \"name\".");
	}

	plugins[name] = fn;
}

// load built in plugins
registerPlugin("actions", require("./actions"));
registerPlugin("twoway", require("./twoway"));
},{"./actions":7,"./twoway":9,"underscore":17}],9:[function(require,module,exports){
var _ = require("underscore");

var value_types = [ "radio", "option" ];

module.exports = function(options) {
	options = options || {};

	// add methods
	this.addFormBinding = addFormBinding;
	this.getFormBinding = getFormBinding;
	this.removeFormBinding = removeFormBinding;

	// add main binding decorator
	this.decorate("bind-to", function bindTo(d, id, lazy) {
		var fbind = this.getFormBinding(id);
		if (fbind == null) return;

		var el = d.target,
			type = getType(el),
			self = this,
			onChange, lazy;

		// detect changes to the input's value
		if (typeof fbind.change === "function") {
			onChange = function(e) {
				fbind.change.call(self, getNodeValue(el, type), d.model, e);
			};

			el.addEventListener("change", onChange);
			if (!(options.lazy || lazy)) el.addEventListener("keyup", onChange);

			d.comp.onInvalidate(function() {
				el.removeEventListener("change", onChange);
				el.removeEventListener("keyup", onChange);
			});
		}

		// reactively set the value on the input
		var c = this.autorun(function() {
			setNodeValue(el, fbind.get.call(self, d.model), type);
		});

		// setNodeValue relies on the children elements
		// those won't be in the DOM till at least the next tick
		c.invalidate();
	});

	// add value decorator for radios and options
	this.decorate("value", function valueOf(d, strval) {
		var el = d.target,
			type = getType(el),
			self = this;
		
		if (!_.contains(value_types, type)) {
			el.value = strval;
			return;
		}

		var args = this.renderArguments(d.template.arguments, d.model);
		el.$bound_value = args.length <= 1 ? args[0] : args;
		el.value = strval;
	}, { parse: "string" });

	// add initial form bindings
	var initialBinds = _.result(this, "twoway");
	if (_.isObject(initialBinds)) this.addFormBinding(initialBinds);
}

function addFormBinding(id, getter, onChange) {
	if (_.isObject(id)) {
		_.each(id, function(v, k) {
			addFormBinding.call(this, k, v);
		}, this);
		return this;
	}

	if (typeof id !== "string") throw new Error("Expecting a string for the form binding ID.");
	if (this._formBindings == null) this._formBindings = {};
	if (this._formBindings[id] != null) throw new Error("A form binding with id '" + id + "' already exists.");

	if (_.isObject(getter) && onChange == null) {
		onChange = getter.change;
		getter = getter.get;
	}

	if (typeof getter !== "function") throw new Error("Expecting a function or object for the form binding getter.");
	if (typeof onChange !== "function") onChange = null;

	this._formBindings[id] = {
		get: getter,
		change: onChange
	};

	return this;
}

function getFormBinding(id) {
	if (typeof id !== "string") return;
	var c = this, bindings;

	while (c != null) {
		bindings = c._formBindings;
		if (bindings != null && bindings[id] != null) return bindings[id];
		c = c.parent;
	}
}

function removeFormBinding(id) {
	var exists = this._formBindings[id] != null;
	delete this._formBindings[id];
	return exists;
}

var type_map = {
	"text": [ "text", "color", "email", "password", "search", "tel", "url", "hidden" ],
	"number": [ "number", "range" ],
	"date": [ "date", "datetime", "datetime-local", "month", "time", "week" ],
	"file": [ "file" ],
	"checkbox": [ "checkbox" ],
	"radio": [ "radio" ]
}

function getType(el) {
	switch (el.tagName.toLowerCase()) {
		case "input":
			for (var type in type_map) {
				if (_.contains(type_map[type], el.type)) return type;
			}
			break;

		case "select":
			return "select";

		case "option":
			return "option";

		case "textarea":
			return "text";
	}
}

function getNodeValue(node, type) {
	if (type == null) type = getType(node);
	var val;

	switch (type) {
		case "number":
			val = node.valueAsNumber;
			break;
		case "text":
			val = node.value;
			break;

		case "checkbox":
			val = node.checked;
			break;

		case "date":
			val = node.valueAsDate;
			break;

		case "select":
			var opt = node.querySelector("option:checked");
			if (opt != null) val = opt.$bound_value;
			break;

		case "file":
			val = !node.multiple ? node.files[0] : _.toArray(node.files);
			break;

		case "radio":
			val = node.$bound_value;
			break;
	}

	return val;
}

function setNodeValue(el, val, type) {
	if (type == null) type = getType(el);

	switch (type) {
		case "number":
			if (document.activeElement === el) return;
			if (_.isNumber(val)) el.valueAsNumber = val;
			else el.value = val;
			break;

		case "text":
			if (document.activeElement === el) return;
			el.value = val == null ? "" : val.toString();
			break;

		case "checkbox":
			el.checked = !!val;
			break;

		case "date":
			if (document.activeElement === el) return;
			if (_.isDate(val)) el.valueAsDate = val;
			else el.value = val;
			break;

		case "select":
			_.toArray(el.querySelectorAll("option")).forEach(function(opt) {
				opt.selected = opt.$bound_value === val;
			});
			break;

		case "radio":
			el.checked = el.$bound_value === val;
			break;
	}
}
},{"underscore":17}],10:[function(require,module,exports){
var _ = require("underscore"),
	Trackr = require("trackr"),
	util = require("./util"),
	Model = require("./model"),
	View = require("./view");

var Section =
module.exports = View.extend({
	constructor: function() {
		this.rows = {};
		this._row_deps = {};
		View.apply(this, arguments);
	},

	invert: function(val) {
		if (!_.isBoolean(val)) val = !this._inverted;
		this._inverted = val;
		return this;
	},

	isInverted: function() {
		return !!this._inverted;
	},

	setPath: function(path) {
		this._path = path;
		return this;
	},

	onRow: function(fn) {
		if (!_.isFunction(fn))
			throw new Error("Expecting function for row handler.");

		this._onRow = fn;
		return this;
	},

	addRow: function(key, data) {
		// remove existing
		this.removeRow(key);

		// convert data to model
		if (!Model.isModel(data)) {
			data = new Model(data, this.model);
		}

		// create a new row
		var row = new View(data);
		
		// set up render and mount it
		row.render = this._onRow;
		this.rows[key] = row;
		this.addMember(row);
		row.mount();

		return row;
	},

	hasRow: function(key) {
		return this.getRow(key) != null;
	},

	getRow: function(key) {
		return this.rows[key];
	},

	removeRow: function(key) {
		if (this.rows[key] == null) return this;

		var row = this.rows[key];
		this.removeMember(row);
		delete this.rows[key];

		return this;
	},

	removeAllRows: function() {
		Object.keys(this.rows).forEach(this.removeRow, this);
		return this;
	},

	render: function() {
		if (this._path == null) throw new Error("Missing path.");

		var self = this,
			val, isEmpty, inverted, isList,
			rowSort, model, proxy, keys;

		val = this.get(this._path);
		model = new Model(val, this.model);
		proxy = model.getProxyByValue(val);
		inverted = this.isInverted();
		isList = model.callProxyMethod(proxy, val, "isList");

		function getEmptiness() {
			return model.callProxyMethod(proxy, val, "isEmpty");
		}

		Trackr.nonreactive(function() {
			isEmpty = !val || (isList && !getEmptiness())
		});

		if (isEmpty && inverted) {
			if (isList) getEmptiness();
			this.addRow(0, model);
		} else if (!isEmpty && !inverted) {
			if (isList) {
				keys = [];

				this.autorun(function(comp) {
					var nkeys = model.callProxyMethod(proxy, val, "keys");

					// trick Trackr so autoruns aren't controlled by this one
					Trackr.currentComputation = comp._parent;

					// remove removed rows
					_.difference(keys, nkeys).forEach(function(key) {
						if (this._row_deps[key]) {
							this._row_deps[key].stop();
							delete this._row_deps[key];
						}

						this.removeRow(key);
					}, this);

					// add added rows
					_.difference(nkeys, keys).forEach(function(key) {
						var row, rmodel;

						row = this.getRow(key);
						rmodel = row != null ? row.model :
							new Model(null, new Model({ $key: key }, this.model));

						this._row_deps[key] = this.autorun(function(c) {
							rmodel.set(model.callProxyMethod(proxy, val, "get", key));
							// if (rowSort != null) rowSort.invalidate();
						});

						// add the row after we set the data
						if (row == null) this.addRow(key, rmodel);
					}, this);
						
					// pretend like nothing happened
					Trackr.currentComputation = comp;

					// the new set of keys
					keys = nkeys;
				});

				// a reactive context that continuously sorts rows
				// rowSort = this.autorun(function() {
					// console.log(keys);
					// var before = null, i, row;

					// for (i = keys.length - 1; i >= 0; i--) {
					// 	row = this.getRow(keys[i]);
					// 	if (row == null) continue;
					// 	this.insertBefore(row, before);
					// 	before = row;
					// }
				// });
			} else {
				this.addRow(0, model);
			}
		} else if (isList) {
			getEmptiness();
		}

		// auto clean
		this.once("invalidate", function() {
			this._row_deps = {};
			this.removeAllRows();
		});
	}

}, {

	isEmpty: function(model, proxy) {
		if (!model.data) return true;
		if (proxy == null) proxy = model.getProxyByValue(model.data);
		return model.callProxyMethod(proxy, model.data, "isList") &&
			model.callProxyMethod(proxy, model.data, "isEmpty");
	}

});

},{"./model":5,"./util":13,"./view":14,"trackr":16,"underscore":17}],11:[function(require,module,exports){
var _ = require("underscore");
var Trackr = require("trackr");
var util = require("./util");

var track =
exports.track = function(obj, replacer) {
	function replace(k, v) {
		var nval;
		if (typeof replacer === "function") nval = replacer.apply(this, arguments);
		if (typeof nval === "undefined" && typeof v !== "undefined") nval = track(v);
		return nval;
	}

	if (_.isArray(obj)) return trackArray(obj, replace)
	if (util.isPlainObject(obj)) return trackObject(obj, replace);
	return obj;
}

var trackProperty =
exports.trackProperty = function(obj, prop, value, options) {
	if (!_.isObject(obj)) throw new Error("Expecting object to define the reactive property on.");
	if (typeof prop !== "string") throw new Error("Expecting string for property name.");

	var dep = new Trackr.Dependency;
	
	Object.defineProperty(obj, prop, {
		configurable: options == null || options.configurable !== false,
		enumerable: options == null || options.enumerable !== false,
		set: function(val) {
			if (val !== value) {
				value = val;
				dep.changed();
			}

			return value;
		},
		get: function() {
			dep.depend();
			return value;
		}
	});

	return obj;
}

var trackObject =
exports.trackObject = function(props, replacer) {
	if (props.__reactive) return props;

	var values = {};
	var deps = {};
	var mainDep = new Trackr.Dependency();

	function replace(ctx, name, value) {
		if (typeof value === "undefined") return;
		return Trackr.nonreactive(function() {
			return typeof replacer === "function" ? replacer.call(ctx, name, value) : value;
		});
	}

	function getter(name) {
		deps[name].depend();
		return values[name];
	}

	function setter(name, value) {
		var old = values[name];
		values[name] = replace(this, name, value);

		var dep = deps[name];
		if (dep == null) dep = deps[name] = new Trackr.Dependency();
		if (old !== values[name]) dep.changed();

		mainDep.changed();
		return values[name];
	}

	var _proto = typeof props.constructor === "function" ? Object.create(props.constructor.prototype) : {};

	_.extend(_proto, {

		defineProperty: function(name, value, options) {
			Object.defineProperty(this, name, {
				configurable: options == null || options.configurable !== false,
				enumerable: options == null || options.enumerable !== false,
				get: getter.bind(this, name),
				set: setter.bind(this, name)
			});

			this[name] = value;
			return this;
		},

		deleteProperty: function(name) {
			var dep = deps[name];
			if (delete this[name]) { // in case configurable === false
				delete values[name];
				delete deps[name];
				if (dep) dep.changed();
			}
			return this;
		},

		toJSON: function() {
			mainDep.depend();
			return _.clone(values);
		}

	});

	Object.defineProperty(_proto, "__reactive", {
		configurable: false,
		enumerable: false,
		value: true,
		writeable: false
	});

	var robj = Object.create(_proto);

	_.each(props, function(value, key) {
		robj.defineProperty(key, value);
	});

	return robj;
}

var trackArray =
exports.trackArray = function(arr, replacer) {
	if (!_.isArray(arr)) throw new Error("Expecting array.");
	if (arr.__reactive) return arr;
	
	var deps = { length: new Trackr.Dependency() };
	var values = {};
	var narr = util.patchArray([]);

	function replace(ctx, name, value) {
		if (typeof value === "undefined") return;
		return Trackr.nonreactive(function() {
			return typeof replacer === "function" ? replacer.call(ctx, name, value) : value;
		});
	}

	function getter(name) {
		deps[name].depend();
		return values[name];
	}

	function setter(name, value) {
		var old = values[name];
		values[name] = replace(this, name, value);

		var dep = deps[name];
		if (dep == null) dep = deps[name] = new Trackr.Dependency();
		if (old !== values[name]) dep.changed();

		return values[name];
	}

	function define(i) {
		var dep;

		if (typeof i === "number" && i >= narr.length) {
			if ((dep = deps[i]) != null) {
				delete deps[i];
			}

			delete narr[i];
			delete values[i];
			dep.changed();
			return;
		}

		setter.call(this, i, narr[i]);

		Object.defineProperty(narr, i.toString(), {
			configurable: true,
			enumerable: true,
			get: getter.bind(narr, i),
			set: setter.bind(narr, i)
		});
	}

	narr.observe(function(chg) {		
		var balance, start, end, len, i, prevlen;

		if (chg == null) return;

		balance = chg.added - chg.removed;
		if (!balance) return;

		len = narr.length;
		prevlen = len - balance;
		start = Math.min(prevlen, len);
		end = Math.max(prevlen, len);

		for (i = start; i < end; i++) define(i);
		deps.length.changed();
	});

	Object.defineProperty(narr, "__reactive", {
		configurable: false,
		enumerable: false,
		value: true,
		writeable: false
	});

	Object.defineProperty(narr, "$length", {
		configurable: false,
		enumerable: false,
		get: function() {
			deps.length.depend();
			return this.length;
		}
	});

	narr.push.apply(narr, arr);
	return narr;
}
},{"./util":13,"trackr":16,"underscore":17}],12:[function(require,module,exports){
module.exports = {
	ROOT              : 1,

	// XML/HTML
	HTML              : 2,
	TEXT              : 3,
	ELEMENT           : 4,
	ATTRIBUTE         : 5,
	XCOMMENT          : 6,

	// Mustache
	INTERPOLATOR      : 7,
	TRIPLE            : 8,
	SECTION           : 9,
	INVERTED          : 10,
	PARTIAL           : 11,
	MCOMMENT          : 12,

	// MISC
	LITERAL           : 13
}

},{}],13:[function(require,module,exports){
var _ = require("underscore");

// like underscore's result, but pass arguments through
exports.result = function(object, property) {
	var value = object == null ? void 0 : object[property];
	return _.isFunction(value) ? value.apply(object, Array.prototype.slice.call(arguments, 2)) : value;
};

// tests value as pojo (plain old javascript object)
var isPlainObject =
exports.isPlainObject = function(obj) {
	return obj != null && (obj.constructor === Object || obj.__proto__ === Object.prototype);
}

// tests function as a subclass of a parent function
// here, a class is technically a subclass of itself
exports.isSubClass = function(parent, fn) {
	return fn === parent || (fn != null && fn.prototype instanceof parent);
}

// cleans html, then converts html entities to unicode
exports.decodeEntities = (function() {
	if (typeof document === "undefined") return;

	// this prevents any overhead from creating the object each time
	var element = document.createElement('div');
	var entity = /&(?:#x[a-f0-9]+|#[0-9]+|[a-z0-9]+);?/ig;

	return function decodeHTMLEntities(str) {
		str = str.replace(entity, function(m) {
			element.innerHTML = m;
			return element.textContent;
		});

		element.textContent = '';
		return str;
	}
})();

// convert html into DOM nodes
exports.parseHTML = (function() {
	if (typeof document === "undefined") return;

	// this prevents any overhead from creating the object each time
	var element = document.createElement('div');

	return function parseHTML(html) {
		element.innerHTML = html != null ? html.toString() : "";
		var nodes = _.toArray(element.childNodes);
		for (var i in nodes) element.removeChild(nodes[i]);
		return nodes;
	}
})();

// the subclassing function found in Backbone
var subclass =
exports.subclass = function(protoProps, staticProps) {
	var parent = this;
	var child;

	// The constructor function for the new subclass is either defined by you
	// (the "constructor" property in your `extend` definition), or defaulted
	// by us to simply call the parent's constructor.
	if (protoProps && _.has(protoProps, 'constructor')) {
		child = protoProps.constructor;
	} else {
		child = function(){ return parent.apply(this, arguments); };
	}

	// Add static properties to the constructor function, if supplied.
	_.extend(child, parent, staticProps);

	// Set the prototype chain to inherit from `parent`, without calling
	// `parent`'s constructor function.
	var Surrogate = function(){ this.constructor = child; };
	Surrogate.prototype = parent.prototype;
	child.prototype = new Surrogate;

	// Add prototype properties (instance properties) to the subclass,
	// if supplied.
	if (protoProps) _.extend(child.prototype, protoProps);

	// Set a convenience property in case the parent's prototype is needed
	// later.
	child.__super__ = parent.prototype;

	return child;
}

var matchesSelector = typeof Element !== "undefined" ?
	Element.prototype.matches ||
	Element.prototype.webkitMatchesSelector ||
	Element.prototype.mozMatchesSelector ||
	Element.prototype.msMatchesSelector :
	function() { return false; };

exports.matchesSelector = function(elem, selector) {
	return matchesSelector.call(elem, selector)
}

var matches = exports.matches = function(node, selector) {
	if (_.isArray(selector)) return selector.some(function(s) {
		return matches(node, s);
	});

	if (selector instanceof window.Node) {
		return node === selector;
	}
	
	if (typeof selector === "function") {
		return !!selector(node);
	}
	
	if (node.nodeType === window.Node.ELEMENT_NODE) {
		return matchesSelector.call(node, selector);
	}

	return false;
}

exports.closest = function(elem, selector) {
	while (elem != null) {
		if (elem.nodeType === 1 && matches(elem, selector)) return elem;
		elem = elem.parentNode;
	}

	return null;
}

var defineComputedProperty =
exports.defineComputedProperty = function(obj, prop, value) {
	if (typeof value !== "function")
		throw new Error("Expecting function for computed property value.");

	Object.defineProperty(obj, prop, {
		configurable: true,
		enumerable: true,
		get: function() {
			return value.call(obj);
		}
	});
}

exports.defineComputedProperties = function(obj, props) {
	Object.keys(props).forEach(function(key) {
		defineComputedProperty(obj, key, props[key]);
	});
}

// array write operations
var mutatorMethods = [ 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift' ];

// patches an array so we can listen to write operations
var patchArray =
exports.patchArray = function(arr) {
	if (arr._patched) return arr;
	
	var patchedArrayProto = [],
		observers = [];

	mutatorMethods.forEach(function(methodName) {
		Object.defineProperty(patchedArrayProto, methodName, {
			value: method
		});

		function method() {
			var spliceEquivalent, summary, args, res;

			args = _.toArray(arguments);

			// convert the operation into a splice
			spliceEquivalent = getSpliceEquivalent(this, methodName, args);
			summary = summariseSpliceOperation(this, spliceEquivalent);

			// run the intended method
			res = Array.prototype[methodName].apply(this, args);

			// call the obersvsers
			observers.forEach(function(fn) {
				fn.call(this, summary);
			}, this);

			// return the result of the method
			return res;
		};
	});

	if (({}).__proto__) arr.__proto__ = patchedArrayProto;
	else {
		mutatorMethods.forEach(function(methodName) {
			Object.defineProperty(arr, methodName, {
				value: patchedArrayProto[methodName],
				configurable: true
			});
		});
	}

	_.each({
		_patched: true,
		observe: function(fn) {
			if (typeof fn !== "function") throw new Error("Expecting function to observe with.");
			observers.push(fn);
			return this;
		},
		stopObserving: function(fn) {
			var index = observers.indexOf(fn);
			if (index > -1) observers.splice(index, 1);
			return this;
		}
	}, function(v, k) {
		Object.defineProperty(arr, k, {
			configurable: false,
			enumerable: false,
			value: v,
			writeable: false
		});
	});

	return arr;
}

// converts array write operations into splice equivalent arguments
var getSpliceEquivalent =
exports.getSpliceEquivalent = function ( array, methodName, args ) {
	switch ( methodName ) {
		case 'splice':
			return args;

		case 'sort':
		case 'reverse':
			return null;

		case 'pop':
			if ( array.length ) {
				return [ -1 ];
			}
			return null;

		case 'push':
			return [ array.length, 0 ].concat( args );

		case 'shift':
			return [ 0, 1 ];

		case 'unshift':
			return [ 0, 0 ].concat( args );
	}
}

// returns a summary pf how an array will be changed after the splice operation
var summariseSpliceOperation =
exports.summariseSpliceOperation = function ( array, args ) {
	var index, addedItems, removedItems;

	if (!args) return null;

	// figure out where the changes started...
	index = +( args[0] < 0 ? array.length + args[0] : args[0] );

	// ...and how many items were added to or removed from the array
	addedItems = Math.max( 0, args.length - 2 );
	removedItems = ( args[1] !== undefined ? args[1] : array.length - index );

	// It's possible to do e.g. [ 1, 2, 3 ].splice( 2, 2 ) - i.e. the second argument
	// means removing more items from the end of the array than there are. In these
	// cases we need to curb JavaScript's enthusiasm or we'll get out of sync
	removedItems = Math.min( removedItems, array.length - index );

	return {
		index: index,
		added: addedItems,
		removed: removedItems
	};
}

},{"underscore":17}],14:[function(require,module,exports){
var _ = require("underscore"),
	Trackr = require("trackr"),
	Events = require("./events"),
	util = require("./util"),
	Model = require("./model"),
	Plugins = require("./plugins"),
	DOMRange = require("./domrange");

var View =
module.exports = DOMRange.extend({

	constructor: function(data, options) {
		// first we create the initial view state
		var state = _.result(this, "initialState") || _.result(this, "defaults");
		if (typeof state !== "undefined") {
			if (!Model.isModel(state)) {
				state = new Model(state, null, options && options.state);
			}
			
			// shove state between contexts
			if (Model.isModel(data)) {
				state.parent = data.parent;
				data.parent = state;
			}

			// add to the stack before the real data
			this.addData(state);
			this.stateModel = state;
			util.defineComputedProperty(this, "state", function() {
				return this.stateModel.data;
			});
		}

		// quick access to the top model data
		util.defineComputedProperty(this, "data", function() {
			return this.model.data;
		});

		// set the passed in data
		if (typeof data !== "undefined") this.addData(data, options);

		// initiate like a normal dom range
		DOMRange.call(this);

		// initialize with options
		this.initialize.call(this, options);
	},

	initialize: function(){},

	use: function(p) {
		return Plugins.loadPlugin(this, p, _.toArray(arguments).slice(1));
	},

	// adds data to the current stack
	addData: function(data, options) {
		if (!Model.isModel(data)) data = new Model(data, this.model, options);
		this.model = data;
		return this;
	},

	// attach + mount
	paint: function(p, n, _isMove, _isReplace) {
		DOMRange.prototype.attach.apply(this, arguments);
		if (!(_isMove || _isReplace || this.isMounted())) this.mount();
		return this;
	},

	// auto stop on detach
	detach: function(_isReplace) {
		if (!_isReplace) this.stop();
		DOMRange.prototype.detach.apply(this, arguments);
		return this;
	},

	autorun: function(fn, onlyOnActive) {
		var comp = Trackr.autorun(fn, this);
		if (onlyOnActive && !Trackr.active) comp.stop();
		return comp;
	},

	// a generalized reactive workflow helper
	mount: function() {
		var args = _.toArray(arguments), comp;

		Trackr.nonreactive(function() {
			// stop existing mount
			this.stop();

			// the first event in the cycle, before everything else
			this._mounting = true;
			this.trigger("mount:before", args);
		}, this);

		// the autorun computation
		comp = this._comp = this.autorun(function(comp) {
			this.render.apply(this, args);
			this.trigger("render", args, comp);

			// auto clean up
			comp.onInvalidate(function() {
				// remaining invalidate events
				this.trigger("invalidate", args, comp);

				// detect if the computation stopped
				if (comp.stopped) {
					this.trigger("stop", args);
					delete this._comp;
				}
			});
		});

		// remaining mount events happen after the first render
		Trackr.nonreactive(function() {
			this.trigger("mount:after", args, comp);
			delete this._mounting;
		}, this);

		return this;
	},

	render: function(){},

	isMounted: function() {
		return this.isMounting() || this._comp != null;
	},

	isMounting: function() {
		return !!this._mounting;
	},

	getComputation: function() {
		return this._comp;
	},

	invalidate: function() {
		if (this.isMounted()) this._comp.invalidate();
		return this;
	},

	onInvalidate: function(fn) {
		if (this.isMounted()) this._comp.onInvalidate(fn);
		return this;
	},

	stop: function() {
		if (this.isMounted()) this._comp.stop();
		return this;
	}

});

// chainable methods to proxy to model
[ "registerProxy" ]
.forEach(function(method) {
	View.prototype[method] = function() {
		this.model[method].apply(this.model, arguments);
		return this;
	}
});

// methods to proxy to model which don't return this
[ "set", "get", "getLocal", "getProxyByValue", "getModelAtOffset",
  "getRootModel", "findModel", "getContainerValue", "getAllModels"
].forEach(function(method) {
	View.prototype[method] = function() {
		return this.model[method].apply(this.model, arguments);
	}
});
},{"./domrange":1,"./events":2,"./model":5,"./plugins":8,"./util":13,"trackr":16,"underscore":17}],15:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],16:[function(require,module,exports){
(function (process){
//////////////////////////////////////////////////
// Package docs at http://docs.meteor.com/#tracker //
// Last merge: https://github.com/meteor/meteor/blob/d07ff8e99cfde21cf113da13d35d387b0ed309a3/packages/tracker/tracker.js //
//////////////////////////////////////////////////

/**
 * @namespace Trackr
 * @summary The namespace for Trackr-related methods.
 */
var Trackr = module.exports = {};

// http://docs.meteor.com/#tracker_active

/**
 * @summary True if there is a current computation, meaning that dependencies on reactive data sources will be tracked and potentially cause the current computation to be rerun.
 * @locus Client
 * @type {Boolean}
 */
Trackr.active = false;

// http://docs.meteor.com/#tracker_currentcomputation

/**
 * @summary The current computation, or `null` if there isn't one.  The current computation is the [`Trackr.Computation`](#tracker_computation) object created by the innermost active call to `Trackr.autorun`, and it's the computation that gains dependencies when reactive data sources are accessed.
 * @locus Client
 * @type {Trackr.Computation}
 */
Trackr.currentComputation = null;

var setCurrentComputation = function (c) {
	Trackr.currentComputation = c;
	Trackr.active = !! c;
};

var _debugFunc = function () {
	// We want this code to work without Meteor, and also without
	// "console" (which is technically non-standard and may be missing
	// on some browser we come across, like it was on IE 7).
	//
	// Lazy evaluation because `Meteor` does not exist right away.(??)
	return (typeof Meteor !== "undefined" ? Meteor._debug :
					((typeof console !== "undefined") && console.log ?
					 function () { console.log.apply(console, arguments); } :
					 function () {}));
};

var _throwOrLog = function (from, e) {
	if (throwFirstError) {
		throw e;
	} else {
		var messageAndStack;
		if (e.stack && e.message) {
			var idx = e.stack.indexOf(e.message);
			if (idx >= 0 && idx <= 10) // allow for "Error: " (at least 7)
				messageAndStack = e.stack; // message is part of e.stack, as in Chrome
			else
				messageAndStack = e.message +
				(e.stack.charAt(0) === '\n' ? '' : '\n') + e.stack; // e.g. Safari
		} else {
			messageAndStack = e.stack || e.message;
		}
		_debugFunc()("Exception from Trackr " + from + " function:",
								 messageAndStack);
	}
};

// Takes a function `f`, and wraps it in a `Meteor._noYieldsAllowed`
// block if we are running on the server. On the client, returns the
// original function (since `Meteor._noYieldsAllowed` is a
// no-op). This has the benefit of not adding an unnecessary stack
// frame on the client.
var withNoYieldsAllowed = function (f) {
	if ((typeof Meteor === 'undefined') || Meteor.isClient) {
		return f;
	} else {
		return function () {
			var args = arguments;
			Meteor._noYieldsAllowed(function () {
				f.apply(null, args);
			});
		};
	}
};

var nextId = 1;
// computations whose callbacks we should call at flush time
var pendingComputations = [];
// `true` if a Trackr.flush is scheduled, or if we are in Trackr.flush now
var willFlush = false;
// `true` if we are in Trackr.flush now
var inFlush = false;
// `true` if we are computing a computation now, either first time
// or recompute.  This matches Trackr.active unless we are inside
// Trackr.nonreactive, which nullfies currentComputation even though
// an enclosing computation may still be running.
var inCompute = false;
// `true` if the `_throwFirstError` option was passed in to the call
// to Trackr.flush that we are in. When set, throw rather than log the
// first error encountered while flushing. Before throwing the error,
// finish flushing (from a finally block), logging any subsequent
// errors.
var throwFirstError = false;

var afterFlushCallbacks = [];

// look for a requestAnimationFrame as that is preferable over nextTick or setImmediate
var requestAnimationFrame = typeof window !== "undefined" ?
	window.requestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.oRequestAnimationFrame :
	null;

// controls the deferral
Trackr.nextTick = requestAnimationFrame != null ? requestAnimationFrame.bind(window) :
	typeof process !== "undefined" ? process.nextTick :
	function (f) { setTimeout(f, 16); };

var requireFlush = function () {
	if (! willFlush) {
		Trackr.nextTick(Trackr.flush);
		willFlush = true;
	}
};

// Trackr.Computation constructor is visible but private
// (throws an error if you try to call it)
var constructingComputation = false;

//
// http://docs.meteor.com/#tracker_computation

/**
 * @summary A Computation object represents code that is repeatedly rerun
 * in response to
 * reactive data changes. Computations don't have return values; they just
 * perform actions, such as rerendering a template on the screen. Computations
 * are created using Trackr.autorun. Use stop to prevent further rerunning of a
 * computation.
 * @instancename computation
 */
Trackr.Computation = function (f, parent, ctx) {
	if (! constructingComputation)
		throw new Error(
			"Trackr.Computation constructor is private; use Trackr.autorun");
	constructingComputation = false;

	var self = this;

	// http://docs.meteor.com/#computation_stopped

	/**
	 * @summary True if this computation has been stopped.
	 * @locus Client
	 * @memberOf Trackr.Computation
	 * @instance
	 * @name  stopped
	 */
	self.stopped = false;

	// http://docs.meteor.com/#computation_invalidated

	/**
	 * @summary True if this computation has been invalidated (and not yet rerun), or if it has been stopped.
	 * @locus Client
	 * @memberOf Trackr.Computation
	 * @instance
	 * @name  invalidated
	 * @type {Boolean}
	 */
	self.invalidated = false;

	// http://docs.meteor.com/#computation_firstrun

	/**
	 * @summary True during the initial run of the computation at the time `Trackr.autorun` is called, and false on subsequent reruns and at other times.
	 * @locus Client
	 * @memberOf Trackr.Computation
	 * @instance
	 * @name  firstRun
	 * @type {Boolean}
	 */
	self.firstRun = true;

	self._id = nextId++;
	self._onInvalidateCallbacks = [];
	// the plan is at some point to use the parent relation
	// to constrain the order that computations are processed
	self._parent = parent;
	self._func = f;
	self._recomputing = false;
	self._context = ctx || null;

	var errored = true;
	try {
		self._compute();
		errored = false;
	} finally {
		self.firstRun = false;
		if (errored)
			self.stop();
	}
};

// http://docs.meteor.com/#computation_oninvalidate

/**
 * @summary Registers `callback` to run when this computation is next invalidated, or runs it immediately if the computation is already invalidated.  The callback is run exactly once and not upon future invalidations unless `onInvalidate` is called again after the computation becomes valid again.
 * @locus Client
 * @param {Function} callback Function to be called on invalidation. Receives one argument, the computation that was invalidated.
 */
Trackr.Computation.prototype.onInvalidate = function (f, ctx) {
	var self = this;

	if (typeof f !== 'function')
		throw new Error("onInvalidate requires a function");

	if (self.invalidated) {
		Trackr.nonreactive(function () {
			withNoYieldsAllowed(f).call(ctx !== void 0 ? ctx : self._context, self);
		});
	} else {
		self._onInvalidateCallbacks.push({ fn: f, ctx: ctx });
	}
};

// http://docs.meteor.com/#computation_invalidate

/**
 * @summary Invalidates this computation so that it will be rerun.
 * @locus Client
 */
Trackr.Computation.prototype.invalidate = function () {
	var self = this;
	if (! self.invalidated) {
		// if we're currently in _recompute(), don't enqueue
		// ourselves, since we'll rerun immediately anyway.
		if (! self._recomputing && ! self.stopped) {
			requireFlush();
			pendingComputations.push(this);
		}

		self.invalidated = true;

		// callbacks can't add callbacks, because
		// self.invalidated === true.
		for(var i = 0, f; f = self._onInvalidateCallbacks[i]; i++) {
			Trackr.nonreactive(function () {
				withNoYieldsAllowed(f.fn).call(f.ctx !== void 0 ? f.ctx : self._context, self);
			});
		}
		self._onInvalidateCallbacks = [];
	}
};

// http://docs.meteor.com/#computation_stop

/**
 * @summary Prevents this computation from rerunning.
 * @locus Client
 */
Trackr.Computation.prototype.stop = function () {
	if (! this.stopped) {
		this.stopped = true;
		this.invalidate();
	}
};

Trackr.Computation.prototype._compute = function () {
	var self = this;
	self.invalidated = false;

	var previous = Trackr.currentComputation;
	setCurrentComputation(self);
	var previousInCompute = inCompute;
	inCompute = true;
	try {
		withNoYieldsAllowed(self._func).call(self._context, self);
	} finally {
		setCurrentComputation(previous);
		inCompute = previousInCompute;
	}
};

Trackr.Computation.prototype._recompute = function () {
	var self = this;

	self._recomputing = true;
	try {
		while (self.invalidated && ! self.stopped) {
			try {
				self._compute();
			} catch (e) {
				_throwOrLog("recompute", e);
			}
			// If _compute() invalidated us, we run again immediately.
			// A computation that invalidates itself indefinitely is an
			// infinite loop, of course.
			//
			// We could put an iteration counter here and catch run-away
			// loops.
		}
	} finally {
		self._recomputing = false;
	}
};

//
// http://docs.meteor.com/#tracker_dependency

/**
 * @summary A Dependency represents an atomic unit of reactive data that a
 * computation might depend on. Reactive data sources such as Session or
 * Minimongo internally create different Dependency objects for different
 * pieces of data, each of which may be depended on by multiple computations.
 * When the data changes, the computations are invalidated.
 * @class
 * @instanceName dependency
 */
Trackr.Dependency = function () {
	this._dependentsById = {};
};

// http://docs.meteor.com/#dependency_depend
//
// Adds `computation` to this set if it is not already
// present.  Returns true if `computation` is a new member of the set.
// If no argument, defaults to currentComputation, or does nothing
// if there is no currentComputation.

/**
 * @summary Declares that the current computation (or `fromComputation` if given) depends on `dependency`.  The computation will be invalidated the next time `dependency` changes.

If there is no current computation and `depend()` is called with no arguments, it does nothing and returns false.

Returns true if the computation is a new dependent of `dependency` rather than an existing one.
 * @locus Client
 * @param {Trackr.Computation} [fromComputation] An optional computation declared to depend on `dependency` instead of the current computation.
 * @returns {Boolean}
 */
Trackr.Dependency.prototype.depend = function (computation) {
	if (! computation) {
		if (! Trackr.active)
			return false;

		computation = Trackr.currentComputation;
	}
	var self = this;
	var id = computation._id;
	if (! (id in self._dependentsById)) {
		self._dependentsById[id] = computation;
		computation.onInvalidate(function () {
			delete self._dependentsById[id];
		});
		return true;
	}
	return false;
};

// http://docs.meteor.com/#dependency_changed

/**
 * @summary Invalidate all dependent computations immediately and remove them as dependents.
 * @locus Client
 */
Trackr.Dependency.prototype.changed = function () {
	var self = this;
	for (var id in self._dependentsById)
		self._dependentsById[id].invalidate();
};

// http://docs.meteor.com/#dependency_hasdependents

/**
 * @summary True if this Dependency has one or more dependent Computations, which would be invalidated if this Dependency were to change.
 * @locus Client
 * @returns {Boolean}
 */
Trackr.Dependency.prototype.hasDependents = function () {
	var self = this;
	for(var id in self._dependentsById)
		return true;
	return false;
};

// http://docs.meteor.com/#tracker_flush

/**
 * @summary Process all reactive updates immediately and ensure that all invalidated computations are rerun.
 * @locus Client
 */
Trackr.flush = function (_opts) {
	// XXX What part of the comment below is still true? (We no longer
	// have Spark)
	//
	// Nested flush could plausibly happen if, say, a flush causes
	// DOM mutation, which causes a "blur" event, which runs an
	// app event handler that calls Trackr.flush.  At the moment
	// Spark blocks event handlers during DOM mutation anyway,
	// because the LiveRange tree isn't valid.  And we don't have
	// any useful notion of a nested flush.
	//
	// https://app.asana.com/0/159908330244/385138233856
	if (inFlush)
		throw new Error("Can't call Trackr.flush while flushing");

	if (inCompute)
		throw new Error("Can't flush inside Trackr.autorun");

	inFlush = true;
	willFlush = true;
	throwFirstError = !! (_opts && _opts._throwFirstError);

	var finishedTry = false;
	try {
		while (pendingComputations.length ||
					 afterFlushCallbacks.length) {

			// recompute all pending computations
			while (pendingComputations.length) {
				var comp = pendingComputations.shift();
				comp._recompute();
			}

			if (afterFlushCallbacks.length) {
				// call one afterFlush callback, which may
				// invalidate more computations
				var cb = afterFlushCallbacks.shift();
				try {
					cb.fn.call(cb.ctx);
				} catch (e) {
					_throwOrLog("afterFlush", e);
				}
			}
		}
		finishedTry = true;
	} finally {
		if (! finishedTry) {
			// we're erroring
			inFlush = false; // needed before calling `Trackr.flush()` again
			Trackr.flush({_throwFirstError: false}); // finish flushing
		}
		willFlush = false;
		inFlush = false;
	}
};

// http://docs.meteor.com/#tracker_autorun
//
// Run f(). Record its dependencies. Rerun it whenever the
// dependencies change.
//
// Returns a new Computation, which is also passed to f.
//
// Links the computation to the current computation
// so that it is stopped if the current computation is invalidated.

/**
 * @summary Run a function now and rerun it later whenever its dependencies change. Returns a Computation object that can be used to stop or observe the rerunning.
 * @locus Client
 * @param {Function} runFunc The function to run. It receives one argument: the Computation object that will be returned.
 * @returns {Trackr.Computation}
 */
Trackr.autorun = function (f, ctx) {
	if (typeof f !== 'function')
		throw new Error('Trackr.autorun requires a function argument');

	constructingComputation = true;
	var c = new Trackr.Computation(f, Trackr.currentComputation, ctx);

	if (Trackr.active)
		Trackr.onInvalidate(function () {
			c.stop();
		});

	return c;
};

// http://docs.meteor.com/#tracker_nonreactive
//
// Run `f` with no current computation, returning the return value
// of `f`.  Used to turn off reactivity for the duration of `f`,
// so that reactive data sources accessed by `f` will not result in any
// computations being invalidated.

/**
 * @summary Run a function without tracking dependencies.
 * @locus Client
 * @param {Function} func A function to call immediately.
 */
Trackr.nonReactive = 
Trackr.nonreactive = function (f, ctx) {
	var previous = Trackr.currentComputation;
	setCurrentComputation(null);
	try {
		return f.call(ctx);
	} finally {
		setCurrentComputation(previous);
	}
};

// like nonreactive but makes a function instead
Trackr.nonReactable = 
Trackr.nonreactable = function (f, ctx) {
	return function() {
		var args = arguments;
		if (ctx == null) ctx = this;
		return Trackr.nonreactive(function() {
			return f.apply(ctx, args);
		});
	};
};

// http://docs.meteor.com/#tracker_oninvalidate

/**
 * @summary Registers a new [`onInvalidate`](#computation_oninvalidate) callback on the current computation (which must exist), to be called immediately when the current computation is invalidated or stopped.
 * @locus Client
 * @param {Function} callback A callback function that will be invoked as `func(c)`, where `c` is the computation on which the callback is registered.
 */
Trackr.onInvalidate = function (f, ctx) {
	if (! Trackr.active)
		throw new Error("Trackr.onInvalidate requires a currentComputation");

	Trackr.currentComputation.onInvalidate(f, ctx);
};

// http://docs.meteor.com/#tracker_afterflush

/**
 * @summary Schedules a function to be called during the next flush, or later in the current flush if one is in progress, after all invalidated computations have been rerun.  The function will be run once and not on subsequent flushes unless `afterFlush` is called again.
 * @locus Client
 * @param {Function} callback A function to call at flush time.
 */
Trackr.afterFlush = function (f, ctx) {
	afterFlushCallbacks.push({ fn: f, ctx: ctx });
	requireFlush();
};
}).call(this,require('_process'))
},{"_process":15}],17:[function(require,module,exports){
//     Underscore.js 1.8.2
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.2';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var isArrayLike = function(collection) {
    var length = collection && collection.length;
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, target, fromIndex) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    return _.indexOf(obj, target, typeof fromIndex == 'number' && fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = input && input.length; i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = array.length; i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, 'length').length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = list && list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    var i = 0, length = array && array.length;
    if (typeof isSorted == 'number') {
      i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
    } else if (isSorted && length) {
      i = _.sortedIndex(array, item);
      return array[i] === item ? i : -1;
    }
    if (item !== item) {
      return _.findIndex(slice.call(array, i), _.isNaN);
    }
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  _.lastIndexOf = function(array, item, from) {
    var idx = array ? array.length : 0;
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    if (item !== item) {
      return _.findLastIndex(slice.call(array, 0, idx), _.isNaN);
    }
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = array != null && array.length;
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createIndexFinder(1);

  _.findLastIndex = createIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    
    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of 
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;
  
  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}]},{},[3])(3)
});
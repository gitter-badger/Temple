import * as _ from "underscore";
import { register } from "./";
import { getPropertyFromClass } from "../utils";

var slice = Array.prototype.slice;
var decorators = {};

// Action Class
export class Action {
	constructor(name) {
		this.name = name;
		this.bubbles = true;
	}

	stopPropagation() {
		this.bubbles = false;
		return this;
	}
}

// the plugin
export function plugin() {
	this.use("decorators");
	this.actions = this.addAction = add;
	this.addActionOnce = addOnce;
	this.removeAction = remove;
	this.fireAction = fire;
	this.decorate(decorators);

	// copy inherited actions
	if (typeof this !== "function") {
		var decs = getPropertyFromClass(this, "_actions");
		this._actions = _.extend(this._actions || {}, decs);
	}
}

export default plugin;
register("actions", plugin);

// standard dom events
defineEvent([
	'load', 'scroll',
	'click', 'dblclick', 'mousedown', 'mouseup', 'mouseenter', 'mouseleave',
	'keydown', 'keypress', 'keyup',
	'blur', 'focus', 'change', 'input', 'submit', 'reset',
	'drag', 'dragdrop', 'dragend', 'dragenter', 'dragexit', 'dragleave', 'dragover', 'dragstart', 'drop'
]);

export function defineEvent(event) {
	if (_.isArray(event)) return event.forEach(defineEvent);

	decorators["on-" + event] = function(decor, key) {
		var self = this,
			args, node;

		function listener(e) {
			// create a new action object
			var action = new Action(key);
			action.original = e;
			action.target = action.node = node;
			action.context = decor.context;
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
	};
}

// Msutache Instance Methods
export function add(name, fn) {
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

export function addOnce(name, fn) {
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

export function remove(name, fn) {
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

export function fire(action) {
	if (typeof action === "string") action = new Action(action);
	if (_.isObject(action) && !(action instanceof Action)) action = _.extend(new Action(), action);
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

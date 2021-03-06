import Trackr from "trackr";
import * as _ from "underscore";
import { parse } from "./m+xml";
import * as Events from "backbone-events-standalone";
import subclass from "backbone-extend-standalone";
import assignProps from "assign-props";
import { getValue } from "./proxies";
import { Map as ReactiveMap } from "trackr-objects";

export default function Context(data, parent, options) {
	if (!Context.isContext(parent)) {
		if (options == null) options = parent;
		parent = null;
	}

	options = options || {};

	// main value dependency
	this._dep = new Trackr.Dependency();

	// a reference to the parent context
	this.parent = parent;

	// a boolean for the context's transparency
	assignProps(this, "_transparent", Boolean(options.transparent));

	// set the passed data
	this.set(data, options);
}

Context.extend = subclass;

assignProps(Context.prototype, {
	__temple: true,
	__temple_type: "context",
	data: function() {
		this._dep.depend();
		return this._data;
	}
});

Context.isContext = function(o) {
	return o && o.__temple && o.__temple_type === "context";
};

_.extend(Context.prototype, Events, {
	// sets the data on the context
	set: function(data, options) {
		options = options || {};
		var previousData = this._data;
		this._data = data;
		this._dep.changed();
		if (!options.silent) this.trigger("change", data, previousData);
		return this;
	},

	append: function(context, options) {
		if (Context.isContext(context)) context.parent = this;
		else context = new Context(context, this, options);
		return context;
	},

	prepend: function(context, options) {
		let parent = this.parent;

		if (Context.isContext(context)) {
			context.parent = parent;
		} else {
			context = new Context(context, parent, options);
		}

		return (this.parent = context);
	},

	// gets the first non-transparent context on the stack
	getTopContext: function() {
		let context = this;

		while (context) {
			if (!context._transparent) return context;
			context = context.parent;
		}
	},

	// an array of all non-transparent contexts in the current stack, with the root as the first
	getAllContexts: function() {
		var contexts = [],
			context = this;

		while (context) {
			if (!context._transparent) contexts.unshift(context);
			context = context.parent;
		}

		return contexts;
	},

	// gets the context in the stack at the index
	// negative values start at root
	getContextAtOffset: function(index) {
		if (!_.isNumber(index) || isNaN(index)) index = 0;
		if (index < 0) return this.getAllContexts()[~index];

		let context = this.getTopContext();

		while (index) {
			context = context.parent;
			if (!context) break;
			if (!context._transparent) index--;
		}

		return context;
	},

	// gets the last non-transparent context in the stack
	getRootContext: function() {
		let context = this, root;

		while (context) {
			if (!context._transparent) root = context;
			context = context.parent;
		}

		return root;
	},

	// returns the first non-transparent context which passes the function
	findContext: function(fn) {
		var index = 0,
			context = this;

		while (context) {
			if (!context._transparent && fn.call(this, context, index++)) {
				return context;
			}

			context = context.parent;
		}
	},

	find: function(fn) {
		let res = this.findContext(function(ctx, index) {
			return fn.call(this, ctx.data, index);
		});

		return res ? res.data : void 0;
	},

	// returns the value at path, but only looks in the data on this context
	get: function(path) {
		if (!path) path = [];
		if (typeof path === "string") path = path.split(".");
		if (!_.isArray(path)) throw new Error("Expecting string or array for path.");

		return _.reduce(path, function(target, part) {
			var t = typeof part;
			if (t !== "string") throw new Error("Unexpected " + t + " is path.");
			return getValue(target, part);
		}, this.data);
	},

	// retrieves value with path query
	query: function(paths) {
		if (typeof paths === "string") paths = parse(paths, { startRule: "pathQuery" });
		if (!_.isArray(paths)) paths = paths != null ? [ paths ] : [];
		if (!paths.length) paths.push({ scope: "all", parts: [] });

		let self = this;
		let fnCtx = this.getTopContext() || null;

		function value(data, parts) {
			return _.reduce(parts, function(target, part) {
				if (typeof part === "object") {
					return getValue(target, self.query(part));
				}

				return getValue(target, part);
			}, data);
		}

		return _.reduce(paths, function(result, path) {
			if (typeof path !== "object") return path;

			var context = self;
			var scope = true;
			var val;

			if (path.scope === "root") {
				context = self.getRootContext();
			} else if (path.scope === "parent") {
				context = self.getContextAtOffset(path.distance);
			} else if (path.scope === "all") {
				if (!path.parts.length) context = self.getTopContext();
				scope = false;
			} else if (path.scope === "local") {
				context = self.getTopContext();
			}

			if (context == null) return;

			while (_.isUndefined(val) && context != null) {
				val = value(context.data, path.parts);
				context = context.parent == null && context !== Context.globals ?
					Context.globals : context.parent;
				if (scope) break;
			}

			if (_.isFunction(val)) {
				val = val.call(fnCtx && fnCtx.data, result, self);
			}

			return val;
		}, void 0);
	}

});

Context.globals = new Context(new ReactiveMap(), { transparent: true });

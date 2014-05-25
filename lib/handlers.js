var Temple = require("./temple"),
	_ = require("underscore"),
	util = require("./util");

var defaultHandler = {
	match			: function(target) { return false; },
	construct		: function(target) {},
	get				: function(target, path) {},
	set				: function(target, path, val) { return false; },
	keys			: function(target) { return []; },
	enumerate		: function(target, forEach, ctx) {},
	deleteProperty	: function(target, path) {},
	merge			: function(target, mixin) { return false; },
	destroy			: function(target) {}
};

var objectHandler = _.defaults({
	match: function(target) {
		return util.isPlainObject(target);
	},
	get: function(target, path) {
		return target[path];
	},
	set: function(target, path, val) {
		target[path] = val;
		return true;
	},
	keys: function(target) {
		return Object.keys(target);
	},
	enumerate: function(target, forEach, ctx) {
		for (var k in target) forEach.call(ctx, target[k], k, target);
	},
	merge: function(target, mixin) {
		if (!util.isPlainObject(mixin)) return false;
		_.each(mixin, function(v, k) { this.set(k, v); }, this);
		return true;
	},
	deleteProperty: function(target, path) {
		delete target[path];
	}
}, defaultHandler);

var mutatorMethods = [ 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift' ];

var arrayHandler = _.defaults({
	match: function(val) {
		return Array.isArray(val);
	},
	construct: function(arr) {
		var self = this,
			patchedArrayProto = [];

		mutatorMethods.forEach(function(methodName) {
			Object.defineProperty(patchedArrayProto, methodName, {
				value: method
			});

			function method() {
				var spliceEquivalent, summary, start,
					original, size, i, index, result;

				// push, pop, shift and unshift can all be represented as a splice operation.
				// this makes life easier later
				spliceEquivalent = util.getSpliceEquivalent(this, methodName, _.toArray(arguments));
				summary = util.summariseSpliceOperation(this, spliceEquivalent);

				// make a copy of the original values
				if (summary != null) {
					start = summary.start;
					original = Array.prototype.slice.call(this, start, !summary.balance ? start + summary.added : void 0);
					size = Math.abs(summary.balance) + original.length;
				} else {
					start = 0;
					original = Array.prototype.slice.call(this, 0);
					size = original.length;
				}

				// apply the underlying method
				result = Array.prototype[methodName].apply(this, arguments);

				// trigger changes
				for (i = 0; i < size; i++) {
					index = i + start;
					self.notify(index, this[index], original[i]);
				}

				return result;
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
	}
}, objectHandler);

module.exports = [ arrayHandler, objectHandler ];
module.exports.default = defaultHandler;
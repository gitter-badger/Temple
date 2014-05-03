var assert = require("assert");

describe("Scope", function() {
	var scope;

	before(function() {
		scope = new Temple.Scope();
	});

	beforeEach(function() {
		scope.set("foo", "bar");
	});

	describe("#get() & #set()", function() {
		it("sets data on construction", function() {
			var scope = new Temple(null, { foo: "bar" });
			assert.deepEqual(scope.get(), { foo: "bar" });
		});

		it("returns `scope.value` on null or empty path", function() {
			assert.strictEqual(scope.get(), scope.value);
		});

		it("gets & sets shallow path", function() {
			scope.set("foo", { bar: "baz" });
			assert.deepEqual(scope.get("foo"), { bar: "baz" });
		});

		it("gets & sets deep path", function() {
			scope.set("foo.bar", "baz");
			assert.equal(scope.get("foo.bar"), "baz");
		});

		it("get(path) executes function value iff value at path is function", function() {
			scope.set("foo", function() {
				assert.strictEqual(this, scope);
				return true;
			});

			assert.strictEqual(scope.get("foo"), true);
		});

		it("deep copies plain objects on set", function() {
			var data = { bar: { baz: "buz" } };
			scope.set("foo", data);
			assert.deepEqual(scope.get("foo"), data);
			assert.notStrictEqual(scope.get("foo"), data);
			assert.notStrictEqual(scope.get("foo.bar"), data.foo);
		});

		it("directly points to non-plain objects on set", function() {
			var data = [];
			scope.set("foo", data);
			assert.strictEqual(scope.get("foo"), data);
		});

		it("unsets", function() {
			scope.unset("foo");
			assert.strictEqual(typeof scope.get("foo"), "undefined");
		});

		it("only unsets deeply on plain objects", function() {
			scope.set("foo", [ 0, 1, 2 ]);
			assert.equal(scope.get("foo.length"), 3);
			scope.unset("foo.length");
			assert.equal(scope.get("foo.length"), 3);
		});

		it("unset() sets `this.data` to undefined on null or empty path", function() {
			scope.unset();
			assert.strictEqual(typeof scope.data, "undefined");
		});
	});

	describe("#observe()", function() {
		afterEach(function() {
			scope.stopObserving();
		});

		it("successfully adds observer", function() {
			var fn = function(){};
			scope.observe("foo", fn);
			assert.ok(scope._observers.some(function(o) {
				return o.fn === fn;
			}));
		});

		it("successfully removes observer", function() {
			var fn = function() { throw new Error("Observer wasn't removed!"); }
			scope.observe("foo", fn);
			
			assert.throws(function() {
				scope.set("foo", "baz");
			});

			scope.stopObserving("foo", fn);
			scope.set("foo", "bar");
		});

		it("calling stopObserving() without arguments clears all observers", function() {
			scope.observe("foo", function(){});
			assert.equal(scope._observers.length, 1);
			scope.stopObserving();
			assert.equal(scope._observers.length, 0);
		});

		it("calling stopObserving(path) clears all observers with matching path", function() {
			scope.observe("foo", function(){});
			scope.observe("foo", function(){});
			scope.observe("bar", function(){});
			assert.equal(scope._observers.length, 3);
			scope.stopObserving("foo");
			assert.equal(scope._observers.length, 1);
		});

		it("calling stopObserving(null, fn) clears all observers with matching function", function() {
			var fn = function(){};
			scope.observe("foo", fn);
			scope.observe("bar", fn);
			scope.observe("baz", function(){});
			assert.equal(scope._observers.length, 3);
			scope.stopObserving(null, fn);
			assert.equal(scope._observers.length, 1);
		});

		it("observes nothing when nothing changes", function() {
			var seen = false;
			scope.observe("foo", function() { seen = true; });
			scope.set("foo", "bar");
			assert.ok(!seen);
		});

		it("observes static path changes", function() {
			var seen = false;
			scope.observe("foo.bar", function(nval, oval, path) {
				assert.strictEqual(nval, "baz");
				assert.strictEqual(typeof oval, "undefined");
				assert.strictEqual(path, "foo.bar");
				seen = true;
			});

			scope.set("foo", { bar: "baz" });
			assert.ok(seen);
		});

		it("observes unset", function() {
			var seen = false;
			scope.observe("foo", function(nval, oval, path) {
				assert.strictEqual(typeof nval, "undefined");
				assert.strictEqual(oval, "bar");
				assert.strictEqual(path, "foo");
				seen = true;
			});

			scope.unset("foo");
			assert.ok(seen);
		});

		it("observes dynamic path: *", function() {
			var seen = false;
			scope.observe("*", function(nval, oval, path) {
				assert.deepEqual(nval, { bar: "baz" });
				assert.strictEqual(oval, "bar");
				assert.strictEqual(path, "foo");
				seen = true;
			});

			scope.set("foo", { bar: "baz" });
			assert.ok(seen);
		});

		it("observes dynamic path: *.bar.baz", function() {
			var seen = false;
			scope.observe("*.bar.baz", function(nval, oval, path) {
				assert.strictEqual(nval, "buz");
				assert.strictEqual(typeof oval, "undefined");
				assert.strictEqual(path, "foo.bar.baz");
				seen = true;
			});

			scope.set("foo.bar.baz", "buz");
			assert.ok(seen);
		});

		it("observes dynamic path: foo.*.baz", function() {
			var seen = false;
			scope.observe("foo.*.baz", function(nval, oval, path) {
				assert.strictEqual(nval, "buz");
				assert.strictEqual(typeof oval, "undefined");
				assert.strictEqual(path, "foo.bar.baz");
				seen = true;
			});

			scope.set("foo.bar.baz", "buz");
			assert.ok(seen);
		});

		it("observes dynamic path: foo.bar.*", function() {
			var seen = false;
			scope.observe("foo.bar.*", function(nval, oval, path) {
				assert.strictEqual(nval, "buz");
				assert.strictEqual(typeof oval, "undefined");
				assert.strictEqual(path, "foo.bar.baz");
				seen = true;
			});

			scope.set("foo.bar.baz", "buz");
			assert.ok(seen);
		});

		it("calling get() in an observer returns the new value", function() {
			var seen = false;
			scope.observe("foo.bar", function(nval, oval, path) {
				assert.strictEqual(this.get(path), nval);
				seen = true;
			});

			scope.set("foo.bar", "baz");
			assert.ok(seen);
		});
	});

	describe("#spawn() & nested scope", function() {
		var child;

		beforeEach(function() {
			child = scope.spawn();
			child.set("bar", "baz");
		});

		afterEach(function() {
			child.close();
			child = null;
		});

		it("scope.spawn() returns an instance of Temple.Scope whose parent is scope", function() {
			assert.ok(child instanceof Temple.Scope);
			assert.strictEqual(child.parent, scope);
		});

		it("child scope returns parent value at path iff child value at path is undefined", function() {
			assert.equal(child.get("bar"), "baz");
			assert.strictEqual(typeof child.value.foo, "undefined");
			assert.equal(child.get("foo"), "bar");
		});

		it("closing parent scope detaches and closes all children", function() {
			var grandchild = child.spawn();
			assert.strictEqual(grandchild.parent, child);

			child.close();
			assert.equal(grandchild.parent, null);
			assert.strictEqual(child.closed, true);
			assert.strictEqual(grandchild.closed, true);
			grandchild.close();
		});
	});
});
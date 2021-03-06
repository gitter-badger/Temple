var test = require("tape");
var render = require("./_utils").render;
var Trackr = require("trackr");
var TrackrObjects = require("trackr-objects");
var ReactiveMap = TrackrObjects.Map;
var ReactiveList = TrackrObjects.List;

test("=== Sections ===", function(_t) {
	var test = _t.test;

	test("renders section when value is true", function(t) {
		t.plan(3);
		var view = render("{{#section}}Hello World{{/section}}", { section: true });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("doesn't render section when value is false", function(t) {
		t.plan(1);
		var view = render("{{#section}}Hello World{{/section}}", { section: false });
		var el = view.el;

		t.equal(el.childNodes.length, 0, "has no nodes");
		view.detach();
	});

	test("removes section when value is changed to false", function(t) {
		t.plan(2);
		var data = new ReactiveMap({ section: true });
		var view = render("{{#section}}Hello World{{/section}}", data);
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");

		data.set("section", false);
		Trackr.flush();

		t.equal(el.childNodes.length, 0, "has no nodes");
		view.detach();
	});

	test("updates section when value is changed to truthy", function(t) {
		t.plan(4);
		var data = new ReactiveMap({ section: false });
		var view = render("{{#section}}Hello World{{/section}}", data);
		var el = view.el;

		t.equal(el.childNodes.length, 0, "has no nodes");

		data.set("section", true);
		Trackr.flush();

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("renders section in element", function(t) {
		t.plan(6);
		var view = render("<div>{{#section}}Hello World{{/section}}</div>", { section: true });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.firstChild.tagName, "DIV", "is a div");
		t.equal(el.firstChild.childNodes.length, 1, "has one node in div");
		t.equal(el.firstChild.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("renders section in section", function(t) {
		t.plan(3);
		var view = render("{{#s1}}{{#s2}}Hello World{{/s2}}{{/s1}}", { s1: true, s2: true });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("renders arrays", function(t) {
		t.plan(7);
		var view = render("{{#list}}{{ . }}{{/list}}", { list: [ 0, 1, 2 ] });
		var el = view.el;

		t.equal(el.childNodes.length, 3, "has three nodes in view");
		t.equal(el.childNodes[0].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[0].nodeValue, "0", "has correct value");
		t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[1].nodeValue, "1", "has correct value");
		t.equal(el.childNodes[2].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[2].nodeValue, "2", "has correct value");
		view.detach();
	});

	test("sections have access to index value", function(t) {
		t.plan(7);
		var view = render("{{#list}}{{ @index }}{{/list}}", { list: [ "a", "b", "c" ] });
		var el = view.el;

		t.equal(el.childNodes.length, 3, "has three nodes in view");
		t.equal(el.childNodes[0].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[0].nodeValue, "0", "has correct value");
		t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[1].nodeValue, "1", "has correct value");
		t.equal(el.childNodes[2].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[2].nodeValue, "2", "has correct value");
		view.detach();
	});

	test("updates single item in array when value is changed", function(t) {
		t.plan(6);
		var list = new ReactiveList([ "a", "b", "c" ]);
		var view = render("{{#list}}{{ . }}{{/list}}", { list: list });
		var el = view.el;

		t.equal(el.childNodes.length, 3, "has three nodes in view");
		t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[1].nodeValue, "b", "has correct value");

		list.splice(1, 1, "Hello World");
		Trackr.flush();

		t.equal(el.childNodes.length, 3, "has three nodes in view");
		t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[1].nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("updates single item in array when deep value is changed", function(t) {
		t.plan(6);
		var data = new ReactiveMap({ foo: "bar" });
		var view = render("{{# list }}{{ foo }}{{/ list }}", { list: [ 0, data, 2 ] });
		var el = view.el;

		t.equal(el.childNodes.length, 3, "has three nodes in view");
		t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[1].nodeValue, "bar", "has correct value");

		data.set("foo", "Hello World");
		Trackr.flush();

		t.equal(el.childNodes.length, 3, "has three nodes in view");
		t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.childNodes[1].nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("updates empty list when an item is added to it", function(t) {
		t.plan(4);
		var list = new ReactiveList();
		var view = render("{{# list }}{{ . }}{{/ list }}", { list: list });
		var el = view.el;

		t.equal(el.childNodes.length, 0, "has no nodes");

		list.push("Hello World");
		Trackr.flush();

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("removes section when list becomes empty", function(t) {
		t.plan(4);
		var list = new ReactiveList([ 0 ]);
		var view = render("{{# list }}{{ . }}{{/ list }}", { list: list });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.firstChild.nodeValue, "0", "has correct value");

		list.shift();
		Trackr.flush();

		t.equal(el.childNodes.length, 0, "has no nodes");
		view.detach();
	});

	// array operations
	[	[ "splice", [ 1, 1, 3 ], function(t, el) {
			t.plan(7);
			t.equal(el.childNodes.length, 3, "has three nodes in view");
			t.equal(el.childNodes[0].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[0].nodeValue, "0", "has correct value");
			t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[1].nodeValue, "3", "has correct value");
			t.equal(el.childNodes[2].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[2].nodeValue, "2", "has correct value");
		} ],
		[ "push", [ 3 ], function(t, el) {
			t.plan(3);
			t.equal(el.childNodes.length, 4, "has four nodes in view");
			t.equal(el.childNodes[3].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[3].nodeValue, "3", "has correct value");
		} ],
		[ "pop", [], function(t, el) {
			t.plan(5);
			t.equal(el.childNodes.length, 2, "has two nodes in view");
			t.equal(el.childNodes[0].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[0].nodeValue, "0", "has correct value");
			t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[1].nodeValue, "1", "has correct value");
		} ],
		[ "unshift", [ 3 ], function(t, el) {
			t.plan(5);
			t.equal(el.childNodes.length, 4, "has four nodes in view");
			t.equal(el.childNodes[0].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[0].nodeValue, "3", "has correct value");
			t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[1].nodeValue, "0", "has correct value");
		} ],
		[ "shift", [], function(t, el) {
			t.plan(3);
			t.equal(el.childNodes.length, 2, "has two nodes in view");
			t.equal(el.childNodes[0].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[0].nodeValue, "1", "has correct value");
		} ],
		[ "sort", [ function(a, b) { return b - a; } ], function(t, el) {
			t.plan(7);
			t.equal(el.childNodes.length, 3, "has three nodes in view");
			t.equal(el.childNodes[0].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[0].nodeValue, "2", "has correct value");
			t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[1].nodeValue, "1", "has correct value");
			t.equal(el.childNodes[2].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[2].nodeValue, "0", "has correct value");
		} ],
		[ "reverse", [], function(t, el) {
			t.plan(7);
			t.equal(el.childNodes.length, 3, "has three nodes in view");
			t.equal(el.childNodes[0].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[0].nodeValue, "2", "has correct value");
			t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[1].nodeValue, "1", "has correct value");
			t.equal(el.childNodes[2].nodeType, document.TEXT_NODE, "is a text node");
			t.equal(el.childNodes[2].nodeValue, "0", "has correct value");
		} ]
	].forEach(function(op) {
		test("updates for array " + op[0] + " operation", function(t) {
			var list = new ReactiveList([ 0,1,2 ]);
			var view = render("{{# list }}{{ . }}{{/ list }}", { list: list });
			var el = view.el;

			list[op[0]].apply(list, op[1]);
			Trackr.flush();

			op[2](t, el);
			view.detach();
		});
	});

	test("updates for array length change", function(t) {
		t.plan(4);
		var list = new ReactiveList();
		var view = render("{{# list.length }}Hello World{{/ list.length }}", { list: list });
		var el = view.el;

		t.equal(el.childNodes.length, 0, "has no nodes");

		list.push(1);
		Trackr.flush();

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "is a text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	_t.end();
});

test("=== Inverted Sections ===", function(_t) {
	var test = _t.test;

	test("renders inverted section when value is false", function(t) {
		t.plan(3);
		var view = render("{{^section}}Hello World{{/section}}", { section: false });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("renders inverted section when value is empty array", function(t) {
		t.plan(3);
		var view = render("{{^section}}Hello World{{/section}}", { section: [] });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("doesn't render inverted section when value is true", function(t) {
		t.plan(1);
		var view = render("{{^section}}Hello World{{/section}}", { section: true });
		var el = view.el;

		t.equal(el.childNodes.length, 0, "has no nodes");
		view.detach();
	});

	test("removes inverted section when value is changed to true", function(t) {
		t.plan(4);
		var data = new ReactiveMap({ section: false });
		var view = render("{{^section}}Hello World{{/section}}", data);
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");

		data.set("section", true);
		Trackr.flush();

		t.equal(el.childNodes.length, 0, "has no nodes");
		view.detach();
	});

	test("updates inverted section when value is changed to false", function(t) {
		t.plan(4);
		var data = new ReactiveMap({ section: true });
		var view = render("{{^section}}Hello World{{/section}}", data);
		var el = view.el;

		t.equal(el.childNodes.length, 0, "has no nodes");

		data.set("section", false);
		Trackr.flush();

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("updates non-empty list when all items are removed from it", function(t) {
		t.plan(4);
		var list = new ReactiveList([ 0 ]);
		var view = render("{{^list}}Hello World{{/list}}", { list: list });
		var el = view.el;

		t.equal(el.childNodes.length, 0, "has no nodes");

		list.pop();
		Trackr.flush();

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("renders inverted section in element", function(t) {
		t.plan(6);
		var view = render("<div>{{^section}}Hello World{{/section}}</div>", { section: false });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.firstChild.tagName, "DIV", "is a div");
		t.equal(el.firstChild.childNodes.length, 1, "has one node in div");
		t.equal(el.firstChild.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("renders inverted section in section", function(t) {
		t.plan(3);
		var view = render("{{#s1}}{{^s2}}Hello World{{/s2}}{{/s1}}", { s1: true, s2: false });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	_t.end();
});

test("=== Interpolators ===", function(_t) {
	var test = _t.test;

	test("renders interpolator", function(t) {
		t.plan(3);
		var view = render("{{ val }}", { val: "Hello World" });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("updates when value changes", function(t) {
		t.plan(6);
		var data = new ReactiveMap({ val: "Hello World" });
		var view = render("{{ val }}", data);
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");

		data.set("val", "FooBar");
		Trackr.flush();

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "FooBar", "has correct value");
		view.detach();
	});

	test("renders interpolator in element", function(t) {
		t.plan(6);
		var view = render("<div>{{ val }}</div>", { val: "Hello World" });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.firstChild.tagName, "DIV", "is a div");
		t.equal(el.firstChild.childNodes.length, 1, "has one node in div");
		t.equal(el.firstChild.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("renders interpolator in section", function(t) {
		t.plan(3);
		var view = render("{{#section}}{{ val }}{{/section}}", {
			section: true,
			val: "Hello World"
		});
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.firstChild.nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	_t.end();
});

test("=== Triple Interpolators ===", function(_t) {
	var test = _t.test;

	test("renders triple interpolator", function(t) {
		t.plan(3);
		var view = render("{{{ val }}}", { val: "<span>" });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.firstChild.tagName, "SPAN", "is a span");
		view.detach();
	});

	test("updates when value changes", function(t) {
		t.plan(8);
		var data = new ReactiveMap({ val: "<span>" });
		var view = render("{{{ val }}}", data);
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.firstChild.tagName, "SPAN", "is a span");

		data.set("val", "<div></div>Hello World");
		Trackr.flush();

		t.equal(el.childNodes.length, 2, "has two nodes in view");
		t.equal(el.childNodes[0].nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.childNodes[0].tagName, "DIV", "is a div");
		t.equal(el.childNodes[1].nodeType, document.TEXT_NODE, "has text node");
		t.equal(el.childNodes[1].nodeValue, "Hello World", "has correct value");
		view.detach();
	});

	test("renders triple interpolator in element", function(t) {
		t.plan(6);
		var view = render("<div>{{{ val }}}</div>", { val: "<span>" });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.firstChild.tagName, "DIV", "is a div");
		t.equal(el.firstChild.childNodes.length, 1, "has one node in div");
		t.equal(el.firstChild.firstChild.nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.firstChild.firstChild.tagName, "SPAN", "is a span");
		view.detach();
	});

	test("renders triple interpolator in section", function(t) {
		t.plan(3);
		var view = render("{{#section}}{{{ val }}}{{/section}}", { section: true, val: "<span>" });
		var el = view.el;

		t.equal(el.childNodes.length, 1, "has one node in view");
		t.equal(el.firstChild.nodeType, document.ELEMENT_NODE, "has element node");
		t.equal(el.firstChild.tagName, "SPAN", "is a span");
		view.detach();
	});

	_t.end();
});

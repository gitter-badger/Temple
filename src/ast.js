import * as _ from "underscore";
import { SourceNode } from "source-map";
import { hash } from "./utils";

function header(data, h) {
	if (_.isArray(data.headers) && !_.contains(data.headers, h)) {
		data.headers.push(h);
	}
}

function query(data, q) {
	let s = JSON.stringify(q);
	let v = ("q" + hash(s)).replace("-", "_");
	header(data, `var ${v} = ${s};\n`);
	return `ctx.query(${v})`;
}

export class ASTNode {
	constructor(location) {
		this._location = location;
	}

	_sn(file, chunk) {
		let loc = this._location, line, column;

		if (loc) {
			line = loc.start.line;
			column = loc.start.column;
		}

		return new SourceNode(line, column, file, chunk);
	}

	start(data) {
		this._writer = {
			chunks: [],
			data: data
		};

		return this;
	}

	indent() {
		var d = this._writer.data;
		if (typeof d.indent !== "number") d.indent = 0;
		d.indent++;
		return this;
	}

	outdent() {
		var d = this._writer.data;
		if (typeof d.indent !== "number") d.indent = 0;
		if (d.indent > 0) d.indent--;
		return this;
	}

	write(chunk) {
		let tabs = "";
		let tabchar = this._writer.data.tabchar;
		let indent = this._writer.data.indent || 0;
		if (tabchar == null) tabchar = "  ";

		for (let i = 0; i < indent; i++) tabs += tabchar;
		this.push([].concat(tabs, chunk, "\n"));

		return this;
	}

	push(chunk) {
		this._writer.chunks.push(chunk);
		return this;
	}

	end(chunk) {
		if (chunk) this.write(chunk);
		var w = this._writer;
		delete this._writer;
		return this._sn(w.data.originalFilename, w.chunks);
	}

	compile(data) {
		// throw new Error("Not implemented.");
		return this._sn(data.originalFilename);
	}

	compileString(data) {
		// throw new Error("Not implemented.");
		return this._sn(data.originalFilename);
	}

	compileArguments(data) {
		// throw new Error("Not implemented.");
		return this._sn(data.originalFilename);
	}
}

export class Root extends ASTNode {
	constructor(location, children) {
		super(location);
		this._children = children;
	}

	compile(data) {
		var oheads = data.headers;
		data.headers = [];
		var output = this._sn(data.originalFilename);
		output.add(_.invoke(this._children, "compile", data));
		output = output.join("\n");

		if (data.headers.length) {
			output.prepend("\n\n").prepend(data.headers);
			data.headers = oheads;
		}

		return output;
	}
}

export class View extends ASTNode {
	constructor(location, name, exts, attrs, partials, scripts, children) {
		super(location);
		this._name = name;
		this._extends = exts;
		this._attributes = attrs;
		this._partials = partials;
		this._scripts = scripts;
		this._children = children;
	}

	compile(data) {
		this.start(data);

		this.write(`Temple.register(${JSON.stringify(this._name)}, {`);
		this.indent();

		if (this._scripts.length || this._attributes.length) {
			this.write("initialize: function() {").indent();
			this.write("this.super.apply(this, arguments);");
			if (this._attributes.length) {
				this.write(`this.on("render:before", function(ctx) {`).indent();
				this.push(_.invoke(this._attributes, "compile", data));
				this.outdent().write(`});`);
			}
			this.push(_.invoke(this._scripts, "compile", data));
			this.outdent().write("},");
		}

		if (this._partials.length) {
			this.write("partials: {").indent();
			var p = _.invoke(this._partials, "compile", data);
			this.push(this._sn(data.originalFilename, p).join(",\n"));
			this.outdent().write("},");
		}

		if (this._extends) {
			this.write(`extends: ${JSON.stringify(this._extends)},`);
		}

		this.write("render: function(ctx) {").indent();
		// this.push(_.invoke(this._attributes, "compile", _.defaults({ element: "this.el" }, data)));
		this.push(_.invoke(this._children, "compile", data));
		this.outdent().write("}");

		this.outdent().write("});");

		return this.end();
	}
}

export class Text extends ASTNode {
	constructor(location, value) {
		super(location);
		this._value = value;
	}

	compile(data) {
		this.start(data);
		this.write(`Temple.idom.text(${JSON.stringify(this._value)});`);
		return this.end();
	}

	compileString(data) {
		return this._sn(data.originalFilename, JSON.stringify(this._value));
	}
}

export class HTMLComment extends ASTNode {
	constructor(location, value) {
		super(location);
		this._value = value;
	}
}

export class Script extends ASTNode {
	constructor(location, value) {
		super(location);
		this._value = value;
	}

	compile(data) {
		return this._sn(data.originalFilename, this._value);
	}
}

export class Element extends ASTNode {
	constructor(location, name, attrs, children) {
		super(location);
		this._name = name;
		this._attributes = attrs;
		this._children = children;
	}

	compile(data) {
		this.start(data);

		let tagName = JSON.stringify(this._name);
		let hasc = this._children.length;

		if (this._name.indexOf("-") > -1) {
			this.write(`(function(){`).indent();

			if (hasc) {
				this.write(`function body(ctx) {`).indent();
				this.push(_.invoke(this._children, "compile", data));
				this.outdent().write(`}`);
				this.write(`var view = this.renderView(${tagName}, ctx, {`);
				this.write(`partials: { "@body": body }`);
				this.write(`});`);
			} else {
				this.write(`var view = this.renderView(${tagName}, ctx);`);
			}

			this.write(`if (!view) {`).indent();
			this.write(`Temple.idom.elementOpen(${tagName});`);//${key ? "," + JSON.stringify(key) : ""}
			this.push(_.invoke(this._attributes, "compile", data));
			if (hasc) this.write(`body(ctx);`);
			this.write(`Temple.idom.elementClose(${tagName});`);
			this.outdent().write(`}`);
			this.outdent().write(`}).call(this);`);
		} else {
			this.write(`Temple.idom.elementOpen(${tagName});`);//${key ? "," + JSON.stringify(key) : ""}
			this.push(_.invoke(this._attributes, "compile", data));
			this.push(_.invoke(this._children, "compile", data));
			this.write(`Temple.idom.elementClose(${tagName});`);
		}

		return this.end();
	}
}

export class Attribute extends ASTNode {
	constructor(location, key, value, children, args) {
		super(location);
		this._key = key;
		this._value = value;
		this._children = children;
		this._arguments = args;
	}

	compile(data) {
		this.start(data);

		this.write(`this.renderDecorator(this, ${JSON.stringify(this._key)}, {`).indent();
		this.write(`mixin: { context: ctx },`);

		let str = _.invoke(this._children, "compileString", data);
		this.write([
			`string: function() { return `,
			this._sn(data.originalFilename, str).join(" + "),
			`; },`
		]);

		let args = _.invoke(this._arguments, "compileArguments", data);
		this.write([
			`"arguments": function() { return [ `,
			this._sn(data.originalFilename, args).join(", "),
			` ]; }`
		]);

		this.outdent().write(`});`);

		return this.end();
	}
}

export class Literal extends ASTNode {
	constructor(location, value) {
		super(location);
		this._value = value;
	}

	compileArguments(data) {
		return this._sn(data.originalFilename, JSON.stringify(this._value));
	}
}

export class Section extends ASTNode {
	constructor(location, inverted, query, children) {
		super(location);
		this._inverted = inverted;
		this._query = query;
		this._children = children;
	}

	compile(data) {
		this.start(data);

		let self = this;

		function renderSection(v, i) {
			if (i) self.write(`var indexctx = new Temple.Context({ "@index": ${i} }, prevctx, { transparent: true });`);
			self.write(`var ctx = new Temple.Context(${v}, ${i ? "indexctx" : "prevctx"});`);
			self.push(_.invoke(self._children, "compile", data));
		}

		this.write("(function(){").indent();
		this.write("var prevctx = ctx;");
		this.write(`var val = ${query(data, this._query)};`);
		this.write(`var proxy = Temple.proxies.getByTarget(val, [ "empty", "section" ]);`);
		let isEmpty = `Boolean(Temple.proxies.run(proxy, "empty", val))`;

		if (this._inverted) {
			this.write(`if (${isEmpty}) {`).indent();
			this.write("(function(){").indent();
			renderSection("val");
			this.outdent().write("}).call(this);");
			this.outdent().write("}");
		} else {
			this.write(`if (!${isEmpty}) {`).indent();
			this.write(`Temple.proxies.run(proxy, "section", val, (function(data, index) {`).indent();
			renderSection("data", "index");
			this.outdent().write(`}).bind(this));`);
			this.outdent().write(`}`);
		}

		this.outdent().write("}).call(this);");

		return this.end();
	}
}

export class Interpolator extends ASTNode {
	constructor(location, escaped, query) {
		super(location);
		this._escaped = escaped;
		this._query = query;
	}

	query(data) { return query(data, this._query); }

	compile(data) {
		this.start(data);
		var src, q = this.query(data);
		if (this._escaped) src = `Temple.idom.html(${q});`;
		else src = `Temple.idom.text(utils.toString(${q}));`;
		return this.end(src);
	}

	compileString(data) {
		return this._sn(data.originalFilename, `Temple.utils.toString(${this.query(data)})`);
	}

	compileArguments(data) {
		return this._sn(data.originalFilename, this.query(data));
	}
}

export class MustacheComment extends ASTNode {
	constructor(location, value) {
		super(location);
		this._value = value;
	}

	compile(data) {
		var output = this._sn(data.originalFilename);
		this._value.split("\n").forEach(function(l) {
			output.add(["// ", l, "\n"]);
		});
		return output;
	}
}

export class PartialQuery extends ASTNode {
	constructor(location, local, value) {
		super(location);
		this._local = local;
		this._value = value;
	}

	compile(data) {
		this.start(data);

		if (this._value === "@super") {
			this.write(`this.super(ctx);`);
		} else {
			this.write(`this.renderPartial(${JSON.stringify(this._value)}, ctx, {`).indent();
			this.write(`local: ${JSON.stringify(this._local)}`);
			this.outdent().write(`});`);
		}

		return this.end();
	}
}

export class Partial extends ASTNode {
	constructor(location, name, children) {
		super(location);
		this._name = name;
		this._children = children;
	}

	compile(data) {
		this.start(data);

		this.write(`${JSON.stringify(this._name)}: function(ctx) {`).indent();
		this.write(_.invoke(this._children, "compile", data));
		this.outdent().write("}");

		return this.end();
	}
}

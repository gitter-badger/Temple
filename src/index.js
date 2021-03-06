if (typeof document !== "undefined") {
	require("webcomponents.js/CustomElements.js");
}

export var version = "0.6.6";

import { compile, render, compileHTML, renderHTML, getSource } from "./compile";
import { add as register, get, create } from "./globals";
import * as proxies from "./proxies";
import * as idom from "./idom";
import * as utils from "./utils";
import Context from "./context";
import View from "./view";
import { parse } from "./m+xml";
import * as AST from "./ast";
import { Map, List, Variable } from "trackr-objects";

import * as plugins from "./plugins";
import * as partials from "./plugins/partials";
import * as actions from "./plugins/actions";
import * as decorators from "./plugins/decorators";
import { globals } from "./plugins/helpers";

export {
	View, register, get, create,
	parse, compile, render, compileHTML, renderHTML, getSource,
	idom, AST,
	proxies, Context,
	Map, List, Variable, utils,
	plugins, actions, partials, decorators, globals
};

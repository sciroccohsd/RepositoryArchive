/*
 Duane Tsuchiyama
 20 March 2018

 OrgChartBuilder v1.0.0
 Requires jQuery. Developed and tested with v3.3.1

 */

(function () {
    "use restrict";
    if (window.OrgChartBuilder) return;

    var orgChartBuilder = function () {

        // internal properties
        var _this = {},
            id, $container, $wrapper, $svg,
            // set default values
            defaults = {
                "orientation": "horizontal",
                "scaleToFit": false,
                "scale": 1,
                "gap": 10,
                "breakOn": 0
            },
            orientation = defaults.orientation,
            scaleToFit = defaults.scaleToFit,
            scale = defaults.scale,
            gap = defaults.gap,
            breakOn = defaults.breakOn,
            css = {
                "wrapper": "",
                "tree": "",
                "root": "",
                "branch": "",
                "subbranch": "",
                "item": "",
                "leaf": "",
                "line": ""
            },
            callbacks = {},
            data;

        //#region SETTERS and GETTERS
        function set(prop, value) {
            /// <summary>Sets property value</summary>  
            /// <param name="property" type="String">Property name</param>  
            /// <param name="value" type="Any">Value to set</param>

            var propType = typeof prop,
                valueType = typeof value;

            if (propType === "object" && prop !== null) {
                // object with key/value pairs sent. ignores value argument

                // loop thru each property
                for (var p in prop) set(p, prop[p]);

            } else if (propType === "string") {
                // key/value pair sent
                switch (prop) {
                    case "$container":
                    case "container":
                        if (value instanceof jQuery) {
                            $container = value;
                        } else if (valueType === "string") {
                            $container = $(value);
                        }

                        if ($container instanceof jQuery) {
                            $container.addClass("org-chart-container");
                            id = $container.attr("id") || "org-chart-" + (new Date()).getTime();
                        }
                        break;

                    case "data":
                        if (value instanceof Array) {
                            data = value.slice(0)
                        } else if (valueType === "object" && value.key) {
                            data = [$.extend({}, value)];
                        }
                        break;

                    case "direction":
                    case "orientation":
                        // used a switch-case here so I could add additional orientations
                        switch (value) {
                            case "vertical":
                            case "horizontal":
                                orientation = value;
                                break;
                        }
                        break;

                    case "scaletofit":
                    case "scaleToFit":
                        if (valueType === "boolean") scaleToFit = value;
                        toggleResizeEventHandler();
                        break;

                    case "distance":
                    case "padding":
                    case "gap":
                        if (valueType === "number" && value >= 0) gap = value;
                        break;

                    case "break":
                    case "breakon":
                    case "breakOn":
                        if (valueType === "number" && value >= 2) breakOn = value;
                        break;

                    case "class":
                    case "classes":
                    case "css":
                        if (valueType === "object" && value !== null) css = $.extend(css, value);
                        if (valueType === "string") css.leaf = value;
                        break;

                    case "fn":
                    case "callback":
                    case "callbacks":
                        if (valueType === "object" && value !== null) {
                            for (var k in value) {
                                if (valueType[k] === "function") {
                                    callbacks[k] = value[k];
                                }
                            }
                        } else if (valueType === "function") {
                            callbacks.render = value;
                        }
                        break;
                }
            }

            return _this;
        }
        function get(prop) {
            /// <summary>Gets property value</summary>  
            /// <param name="property" type="String">Property name</param>  

            var value = (arguments.length >= 2) ? arguments[1] : undefined;

            switch (prop) {
                case "id":
                case "ID": return id;

                case "$container":
                case "container": return $container || $();

                case "$svg":
                case "svg": return $svg || ($svg = get("$", ".org-chart-connectors"));

                case "data": return (data instanceof Array) ? data.slice(0) : [];

                case "direction":
                case "orientation": return orientation;

                case "scaletofit":
                case "scaleToFit": return scaleToFit;
                    break;

                case "zoom":
                case "scale": return scale;

                case "distance":
                case "padding":
                case "gap": return gap;

                case "$":
                    if (typeof value === "string") return $(value, get("container"));

                case "class":
                case "classes":
                case "css": return $.extend({}, css);

                case "template": return $.extend({}, template());

            }
        }
        //#endregion

        //#region TREE
        function render(_data) {
            /// <summary>Render the org chart.</summary>  
            /// <param name="_data" type="Array">Optional. Uses/sets the data passed. Default: previously set data</param>  

            // if data array was passed, set data
            if (_data) set("data", _data);

            // check to see if there is data and a container
            if (data.length === 0) {
                // no data, empty the container;
                get("container").empty();

            } else if (get("container").length > 0) {
                // has data and a container;
                scale = 1;
                renderOrgChart();
                toggleResizeEventHandler();
            }

            executeCallback("render", [data]);
            return _this;
        }
        function renderOrgChart() {
            /// <summary>Renders the Org Chart based on the dataset.</summary>  

            // reset cached objects
            $svg = null;  
            
            var svg = createXmlElement('svg', { "id": "org-chart-connectors", "class": "org-chart-connectors" }),
                $root = createBranch(data, "root");

            if (!$wrapper) {
                $wrapper = $("<div />", { "class": "org-chart-wrapper " + css.wrapper });
                $container.append($wrapper);
            }

            // put the org chart elements together
            //$container.addClass("org-chart-container").empty().append(svg).append($root);
            $wrapper.empty()
                .toggleClass("org-chart-horizontal", isHorizontal())
                .toggleClass("org-chart-vertical", !isHorizontal())
                .append(svg).append($root);

            // make sure leaves are balanced on branches
            balanceLeavesOnBranches();

            // draw connector lines
            drawConnectorLines();

            resize();

        }
        function createBranch(items, type) {
            /// <summary>Creates the tree and children.</summary>
            /// <param name="items" type="Array">Array of item objects.</param>
            /// <param name="type" type="String">Optional. Type of branch: "root", "branch" or "subbranch". Default: "branch";</param>
            /// <returns type="Object">jQuery UL element(s).</returns>

            // normalize parameters
            if (typeof type !== "string") type = "branch";
            switch (type) {
                case "root":
                case "branch":
                case "subbranch":
                    break;
                default:
                    type = "branch";
            }

            // convert object of orgChart objects to array of orgChart objects
            if (!(items instanceof Array) && typeof items === "object") {
                // is object. 
                if (items.key) {
                    // items is an orgChart object
                    items = [items];
                } else {
                    //try to convert values to array
                    items = Object.values(items);
                }
            }
            if (!(items instanceof Array)) return;

            // compile css classes for this element
            var classes = ["org-chart-tree"];
            if (css.tree) classes.push(css.tree);
            classes.push("org-chart-" + type);
            if (css[type]) classes.push(css[type]);

            var $frag = $(document.createDocumentFragment()),
                isSubBranch = (type === "subbranch"),
                isLastSet = true,
                sets = [],
                tempArr = items.slice(0);

            // create sets based on row breaks
            if (breakOn >= 2 && orientation === "horizontal") {
                var breaks = rowLimits(tempArr.length, breakOn);
                if (breaks.length === 1) {
                    sets.push(tempArr);
                } else {
                    for (var n = 0; n < breaks.length; n++) {
                        var arr2;
                        if (n !== breaks.length - 1) {
                            arr2 = tempArr.splice(breaks[n]);
                            sets.push(tempArr.slice(0));
                            tempArr = arr2;
                        } else {
                            sets.push(tempArr);
                        }
                    }
                }
            } else {
                sets.push(tempArr);
            }

            // loop thru each set of items
            for (var i = 0; i < sets.length; i++) {

                isLastSet = (i === sets.length - 1);
                var set = sets[i],
                    $ul = $('<ul />', { "class": classes.join(" ") });

                // loop thru each tree item
                for (var ii = 0; ii < set.length; ii++) {
                    var $li = createSibling(set[ii], isSubBranch);
                    if ($li) $ul.append($li);

                }
                if ($ul.children().length > 0) $frag.append($ul);
            }

            executeCallback("createBranch", [items, type, {
                "$uls": $frag,
                "isSubBranch": isSubBranch
            }]);

            if ($frag.children().length > 0) return $frag.children();
            return;
        }
        function createSibling(item, isSubBranch) {
            /// <summary>Creates the LI element for a single item and its children.</summary>  
            /// <param name="item" type="Object">Item object</param>  
            /// <param name="isSubBranch" type="Boolean">Optional. If true, this branch is a subbranch. Default: false;</param>
            /// <returns type="Object">jQuery LI element.</returns>

            // normalize parameters
            if (typeof isSubBranch === "boolean") isSubBranch = false;

            var $li = $('<li />', { "id": id + "-org-chart-item-" + item.key, "class": "org-chart-item " + css.item }),
                $leaf = createLeaf(item, isSubBranch),
                $subs = makeBranches(item.sub || [], "subbranch"),
                $children = makeBranches(item.children || [], "branch");

            // add leaf to item
            $li.append($leaf);
            if ($subs) $li.append($subs);
            if ($children) $li.append($children);


            executeCallback("createSibling", [item, isSubBranch, $leaf, $li, {
                "$li": $li,
                "$leaf": $leaf,
                "$sub": $subs,
                "$children": $children
            }]);
            return $li;
        }
        function makeBranches(children, type) {
            /// <summary>Parses the children/sub data to makes one or more branches.</summary>  
            /// <param name="children" type="Array">Array of org chart objects or array of arrays of org chart objects.</param>  
            /// <param name="type" type="String">Type of branch. e.g.: "branch" or "subbranch"</param>  
            /// <returns type="Object">jQuery UL element(s)</returns>

            var $frag = $(document.createDocumentFragment());

            // convert object of orgChart objects to array of orgChart objects
            if (!(children instanceof Array) && typeof children === "object") {
                // is object. 
                if (children.key) {
                    // object is an orgChart object
                    children = [children];
                } else {
                    //try to convert values to array
                    children = Object.values(children);
                }
            }
            if (!(children instanceof Array)) children = [];

            // create branches
            if (children.length > 0) {
                // this item has subs

                // is array of arrays?
                if (children[0] instanceof Array) {
                    // sub is array of arrays
                    for (var i = 0; i < children.length; i++) {
                        var $branch = createBranch(children[i] || [], type);

                        if ($branch) $frag.append($branch);
                    }
                } else {
                    // sub is array of objects
                    var $branch = createBranch(children, type);

                    if ($branch) $frag.append($branch)
                }
            }

            return $frag.children();
        }
        function createLeaf(item, isSubBranch) {
            /// <summary>Creates the Org Chart leafs.</summary>  
            /// <param name="item" type="Object">Item object</param>  
            /// <param name="isSubBranch" type="Boolean">Optional. If true, this branch is a subbranch. Default: false;</param>
            /// <returns type="Object">jQuery DIV element.</returns>

            // normalize parameters
            if (typeof isSubBranch === "boolean") isSubBranch = false;

            var classes = ["org-chart-leaf"];
            if (css.leaf) classes.push(css.leaf);
            if (item.class) classes.push(item.class);

            var href = item.url || "javascript:void(0);",
                $div = $('<div />', { "class": classes.join(" "), "style": item.style || ""}),
                $a = $('<a />', {
                    "href": href,
                    "class": "org-chart-link",
                    "title": item.description || "",
                    "target": item.urlTarget || "_parent"
                }),
                $label = $('<div />', { "class": "org-chart-title" }).text(item.title || "");

            // keep key and parent metadata
            $div.data({ "key": item.key, "parent": item.parent, "isSubBranch": isSubBranch });

            // put the leaf together
            $a.append($label);
            $div.append($a);

            if (typeof item.render === "function") {
                try {
                    item.render.apply(item, [$div, $a, {
                        "$leaf": $div,
                        "$a": $a,
                        "$label": $label,
                        "item": item,
                        "isSubBranch": isSubBranch
                    }, _this]);
                } catch (er) {
                    if (console) {
                        console.log("Rendering leaf error:");
                        console.log(er);
                    }
                }
            }
            executeCallback("createLeaf", [item.key || "", item, $div, {
                "$div": $div,
                "$a": $a,
                "$label": $label,
                "item": item,
                "isSubBranch": isSubBranch
            }]);
            return $div;
        }
        function balanceLeavesOnBranches() {
            /// <summary>Makes the left and right sides of the subbranch the same width.
            /// Centers the tree horizontally.</summary >  

            if (orientation !== "horizontal") return;

            // loop thru each of subbranches.
            $(".org-chart-tree:not(:last-child)", $container).each(function () {
                $(this).addClass("org-chart-balanced");

                // get all the LI elements
                var $branches = $("> .org-chart-item", $(this));
                // balance only if even amount
                if (($branches.length % 2) !== 0) {
                    var $hiddenLeaf = createSibling({ "key": "", "title": "", "parent": "" });
                    $hiddenLeaf.addClass("org-chart-hidden");
                    $(this).append($hiddenLeaf);
                    $branches = $("> .org-chart-item", $(this));
                }
                balanceLeaves($branches);
            });
        }
        function balanceLeaves($branch) {
            /// <summary>Splits the number leaves in half and balances the width.</summary>
            /// <param name="$branch" type="Object">jQuery LIs elements to balance. e.g.: ul.children()</param>

            var middle = $branch.length / 2,
                $first = $branch.eq(0),
                $last = $branch.eq($branch.length - 1),
                firstHalfWidth = 0,
                secondHalfWidth = 0,
                diff = 0;

            // loop thru each leaf
            $branch.each(function (i, elem) {
                var _$ = $(this);

                // sum up the widths of each half
                if (i < middle) {
                    // first half
                    firstHalfWidth += _$.outerWidth();

                } else {
                    // second half
                    secondHalfWidth += _$.outerWidth();
                }
            });

            // get the difference
            diff = Math.round(Math.abs(firstHalfWidth - secondHalfWidth));
            if (diff === 0) return;

            // add the difference to the smallest side
            if (firstHalfWidth < secondHalfWidth) {
                // first half is smaller
                $first.css({ "margin-left": diff + "px" });

            } else {
                // second half is smaller
                $last.css({ "margin-right": diff + "px" });

            }
        }
        //#endregion

        //#region SVG LINES
        function drawConnectorLines() {
            /// <summary>Gets all the DIV leafs and draws the connector lines between it and it's parent.</summary>

            var $temp = $(document.createDocumentFragment()),
                selector = ".org-chart-leaf:not(.org-chart-hidden):visible";

            get("svg").empty();

            // get all child leaf, draw connector lines from parent to child
            $(selector, $container).each(function (ndx, elem) {
                var $leaf = $(this),
                    parentKey = $leaf.data("parent"),
                    $parentItem, $parentLeaf, $line;

                if (!parentKey) return true;
                $parentItem = $("#" + id + "-org-chart-item-" + parentKey);
                if ($parentItem.length === 0) return true;

                $parentLeaf = $(selector, $parentItem);

                $line = connectorLine({
                    "parent": {
                        "$": $parentLeaf,
                        "position": (isHorizontal()) ? "bottom center" : "right center"
                    },
                    "child": {
                        "$": $leaf,
                        "position": (isHorizontal()) ? "top center" : "left center"
                    }
                });

                executeCallback("drawConnectorLine", [ndx, elem, {
                    "$leaf": $leaf,
                    "parentKey": parentKey,
                    "$parentItem": $parentItem,
                    "$parentLeaf": $parentLeaf,
                    "$line": $line
                }]);
                // add line to temp collection
                if ($line) $temp.append($line);
            });

            executeCallback("drawConnectorLines", [{
                "$svg": get("svg"),
                "children": $temp.children()
            }])

            // append all lines
            get("svg").append($temp.children());
        }
        function connectorLine(prop) {
            /// <summary>Creates the SVG Polyline that connects the parent and child leafs.</summary>  
            /// <param name="prop" type="Object">Parent, child object with positions.</param>  
            /// <returns type="Object">jQuery POLYLINE</returns>

            var points = [],
                // parent position = [x, y]
                parent = getPosition(prop.parent.$, prop.parent.position),
                // child position = [x, y]
                child = getPosition(prop.child.$, prop.child.position),
                // breaks
                breaks = [];

            // add parent position
            points.push(parent.join(","));
            // add breaks
            breaks = createBreakPoints(parent, child, "child", 10);
            if (breaks.length > 0) points.push(breaks.join(" "));
            // add child position
            points.push(child.join(","));

            return createXmlElement('polyline', { "points": points.join(" "), "class": "org-chart-connector " + css.line });

        }
        function getPosition($elem, alignment) {
            /// <summary>Gets the x, y position of the element.</summary>  
            /// <param name="$elem" type="Object">jQuery element.</param>
            /// <param name="alignment" type="String">Side and location. valid terms: [left, right, top, bottom, center]
            /// e.g.: "bottom center" or "left center".</param >
            /// <returns type="Array">[x,y] coordinates.</returns>

            var offset = offsetFromContainer($elem),
                width = $elem.outerWidth(),
                height = $elem.outerHeight(),

                top = offset.top,
                left = offset.left,
                bottom = top + height,
                right = left + width,

                frag = alignment.split(" "),
                side = frag[0],
                location = (frag.length === 2) ? frag[1] : "center",
                multiplier = (scale === 1)? 1 : 1 + scale ,
                x, y;

            // x axis (horizontal)
            switch (side) {
                case "left":
                    x = left;   // "left ANY"
                    break;
                case "right":   // "right ANY"
                    x = right;
                    break;
                case "top":
                case "bottom":
                    // and location === ...
                    switch (location) {
                        case "left":
                            x = left;   // "top|bottom left"
                            break;
                        case "right":
                            x = right;  // "top|bottom right"
                            break;
                        default:    // "center"
                            x = (left + (width / 2));   // "top|bottom center"
                            break;
                    }

                    break;
                default:
                    // use the center position as the default
                    x = (left + (width / 2));
            }

            // y axis (vertical)
            switch (side) {
                case "top":
                    y = top;    // "top ANY"
                    break;
                case "bottom":
                    y = bottom; // "bottom ANY"
                    break;
                case "left":
                case "right":
                    // and location === ...
                    switch (location) {
                        case "top":
                            y = top;    // "left|right top"
                            break;
                        case "bottom":
                            y = bottom; // "left|right bottom"
                            break;
                        default:    // "center"
                            y = (top + (height / 2));   // "left|right center"
                            break;
                    }

                    break;
                default:
                    // use the center position as the default
                    y = (top + (height / 2));
            }

            return [Math.round(x) * multiplier, Math.round(y) * multiplier];
        }
        function createBreakPoints(posA, posB, near) {
            /// <summary>X,Y points to bend between 2 positions.</summary>  
            /// <param name="posA" type="Array">[x,y] position.</param>
            /// <param name="posB" type="Array">[x,y] position.</param>
            /// <param name="near" type="String">Optional. Break near "parent" or "child" or "center". Default: "center";</param>
            /// <returns type="Array">Array of x,y (array) positions for each bend. e.g.: [[x,y], [x,y]]</returns>

            // normalize parameters
            if (typeof near !== "string") near = "center";

            var points = [],
                valA, valB, bendAt;

            var _bendAt = function (a, b) {
                /// <summary></summary>  
                /// <param name="a" type="Number">Position A point (x or y).</param>  
                /// <param name="b" type="Number">Position B point (x or y).</param>  
                /// <returns type="Number">Bend point based on near which position and distance.</returns>

                var diff;

                switch (near) {
                    case "parent":
                        return Math.min(a, b) + gap;

                    case "child":
                        return Math.max(Math.max(a, b) - gap, 0);

                    default: // "center"
                        diff = Math.abs(b - a);
                        return Math.min(a, b) + (diff / 2);
                }
            }

            if (isHorizontal()) {
                // horizontal line breaks on the y axis

                // no different = straight line (no bends)
                if (posA[0] === posB[0]) return [];

                // get y axis values
                valA = posA[1];
                valB = posB[1];

                // bend points
                bendAt = _bendAt(valA, valB);

                return [[posA[0], bendAt], [posB[0], bendAt]];

            } else {
                // vertical line breaks on the x axis

                // no different = straight line (no bends)
                if (posA[1] === posB[1]) return [];

                // get x axis values
                valA = posA[0];
                valB = posB[0];

                // bend points
                bendAt = _bendAt(valA, valB);

                return [[bendAt, posA[1]], [bendAt, posB[1]]];


            }
        }
        // NOTE: redrawing SVG objects does not work with scaling
        // NOTE: redrawing SVG objects is only needed if tree is centered
        function redrawConnectorLines() {
            /// <summary>SVG lines must be redrawn everytime the page resizes.</summary>  

            if (scale !== 1) return;

            removeConnectorLines();

            // redraw connector lines to new points
            drawConnectorLines();

            executeCallback("redrawConnectorLines");
            return _this;

        }
        function removeConnectorLines() {
            /// <summary>Removes all nodes from the SVG element.</summary>  

            // loop thru each SVG children
            var svg = document.getElementById("org-chart-connectors");
            while (svg.lastChild) svg.removeChild(svg.lastChild);

        }
        //#endregion

        //#region RESIZE
        function toggleResizeEventHandler() {
            /// <summary>Adds/removes the onresize event handler.</summary>  

            var $window = $(window),
                _id = "scaleToFit-" + id;

            if (scaleToFit) {
                // scaling, add event handler
                if ($window.data(_id) !== true) {
                    $window.on("resize." + _id, resize).data(_id, true);
                }

            } else {
                // not scaling, remove event handler
                $window.off(_id).data(_id, false);

            }
        }
        function resize() {
            /// <summary>Window onResize event handler.</summary>  

            // NOTE: redrawing SVG does not work with scaling
            // NOTE: redrawing SVG is only needed if tree is centered
            redrawConnectorLines();

            if (scaleToFit) scaleChartToFit();

            // resize the SVG container
            setSvgWidth();
            setSvgHeight();

            executeCallback("resize");
            return _this;
        }
        function setSvgWidth() {
            /// <summary>Sets the width of the SVG element to the widest LI. 
            /// Ensures connector lines are visible for the entire org chart.</summary >  

            var widestTree = getWidestWidth(".org-chart-branch"),
                widestItem = getWidestWidth(".org-chart-item");

            // set width as widt as the widest element or container
            get("svg").width(Math.max(widestTree, widestItem) * scale);
        }
        function setSvgHeight() {
            /// <summary>Sets the width of the SVG element to the widest LI.  Ensures connector lines are visible for the entire org chart.</summary>

            var tallestTree = getTallestHeight(".org-chart-tree"),
                tallestItem = getTallestHeight(".org-chart-item");

            // set height as high as the tallest element or container
            get("svg").height(Math.max(tallestTree, tallestItem) * scale);
        }

        // NOTE: redrawing SVG does not work with scaling
        function scaleChartToFit() {
            /// <summary>Tries to scale the org chart to fit.</summary>  

            // reset org chart scale
            scaleChartTo(1);

            var _scale,
                min = .1,
                max = 1,
                selector = ".org-chart-root > .org-chart-item",
                widest = getWidestWidth(selector),
                scaleWidth = 1,
                tallest = getTallestHeight(selector),
                scaleHeight = 1,
                viewportWidth = $container.innerWidth(),
                viewportHeight = $container.innerHeight();

            // check to see if page scrolls horizontally
            if (widest > viewportWidth) {
                scaleWidth = Math.floor((viewportWidth / widest) * 100) / 100;
            }

            // check to see if page scrolls vertically
            if (tallest > viewportHeight) {
                scaleHeight = Math.floor((viewportHeight / tallest) * 100) / 100;
            }

            // if both scale width and height = 0 than we don't need to scale
            if (scaleWidth === 1 && scaleHeight === 1) return;

            _scale = Math.min(Math.max(min, Math.min(scaleWidth, scaleHeight)), max);

            var overrideScale = executeCallback("scaleChartToFit", [{
                "scale": _scale,
                "widest": widest,
                "tallest": tallest,
                "min": min,
                "max": max
            }]);
            if (typeof overrideScale === "number" && overrideScale > min && overrideScale <= max) _scale = overrideScale;

            scaleChartTo(_scale);

            return _this;

        }
        function scaleChartTo(_scale) {
            /// <summary>Sets the scale level of the first tree and all SVG nodes.</summary>  
            /// <param name="_scale" type="Number">Number to scale to. e.g.: .5 (50%), 1 (100%)...</param>  

            if (typeof _scale !== "number") _scale = 1;
            // SVG points are unable to scale properly above 100%
            if (_scale <= 0 || _scale > 1) _scale = 1;

            if (scale === _scale) return;
            scale = _scale;

            // top level tree(s)
            $(".org-chart-root", $container).css("transform", ((scale === 1) ? "" : "scale(" + scale + ")"));

            // SVG nodes
            var attribute = (scale === 1) ? "removeAttribute" : "setAttribute";
            $("svg", $container).children().each(function () {
                this[attribute]("transform", "scale(" + scale + ")");
            });

            return _this;

        }
        function scaleTo(_scale) {
            /// <summary>Public scaleTo function. Resizes the SVG element after scaling.</summary>  
            /// <param name="" type=""></param>  
            /// <returns type=""></returns>

            if (typeof _scale === "string" && _scale === "fit") {
                // is "fit", try to scale to fit container
                scaleChartToFit();

            } else if (typeof _scale === "number") {
                // is a number, try to scale to that number
                scaleChartTo(_scale);

            } else {
                // unknown
                throw exception("'scale' is invalid. Requires a number (.1 - 1) or the word 'fit'.");

            }

            // resize the SVG container
            setSvgWidth();
            setSvgHeight();

            executeCallback("scaleChartTo", [_scale]);
            return _this;

        }
        //#endregion

        //#region HELPERS
        function isHorizontal() {
            /// <summary>Determines if the org chart layout is horizontal.</summary>  
            /// <returns type="Boolean">True if layout orientation is horizontal.</returns>

            return (orientation === "horizontal");
        }
        function createXmlElement(tag, attr) {
            /// <summary>Creates XML elements. jQuery does not support creation of XML (SVG) elements.</summary>  
            /// <param name="tag" type="String">SVG element tag name. e.g.: "svg", "polyline", ...</param>  
            /// <param name="attr" type="Object">Element attribute key/value pairs.</param>  
            /// <returns type="Element">SVG XML node.</returns>

            // create XML node with namespace
            var elem = document.createElementNS("http://www.w3.org/2000/svg", tag);

            // add attributes
            if (typeof attr === "object") {
                for (var name in attr) elem.setAttribute(name, attr[name]);
            }

            return elem;
        }
        function offsetFromContainer($elem) {
            /// <summary>Top and left postion from container.</summary>  
            /// <param name="$elem" type="Object">jQuery element.</param>  
            /// <returns type="Object">{top:number, left:number}</returns>

            var containerOffset = $container.offset(),
                elemOffset = $elem.offset();

            return {
                "top": elemOffset.top - containerOffset.top,
                "left": elemOffset.left - containerOffset.left
            };
        }
        function getWidestWidth(selector) {
            /// <summary>Gets the widest wide.</summary>  
            /// <param name="selector" type="String">jQuery selector.</param>  
            /// <returns type="Number">Widest width.</returns>

            var highest = 0;
            $(selector).each(function () {
                highest = Math.max($(this).outerWidth(), highest);
            });
            return highest;
        }
        function getTallestHeight(selector) {
            /// <summary>Gets the tallest height.</summary>  
            /// <param name="selector" type="String">jQuery selector.</param>  
            /// <returns type="Number">Widest width.</returns>

            var highest = 0;
            $(selector).each(function () {
                highest = Math.max($(this).outerHeight(), highest);
            });
            return highest;
        }
        function rowLimits(num, _max) {
            /// <summary>Get the number of tree items per row.</summary>
            /// <param name="num" type="Number">Number of items in the row.</param>
            /// <param name="_max" type="Number">Optional. Even integer greater than 2. Sets the maximum row limit. Default: 6;</param>
            /// <return type="Array">Array with limits for each row in the tree.</return>

            // set default
            if (typeof _max !== "number") _max = 6;
            if (_max % 2 !== 0) {
                _max = Math.floor(_max) - 1;
            }
            _max = Math.max(_max, 2);
            if (typeof num !== "number") return [_max];
            num = Math.max(Math.ceil(num), 0);

            var max = _max,
                min = Math.max(max - 2, 2),
                odd = max - 1,
                isOdd = false,
                row = [],
                orig = num,
                sort = function (a, b) { return a - b; };

            if ((num - odd) > min && (num % 2) === 1) {
                isOdd = true;
                num -= odd;
            }
            while (num > 0) {
                if (num <= max) {
                    row.sort(sort);
                    row.push(num);
                    num -= num;
                } else if ((num % max) === 0) {
                    row.push(max);
                    num -= max;
                } else if ((num % min) === 0) {
                    row.push(min);
                    num -= min;
                } else {
                    if (Math.abs(min - (num - min)) < Math.abs(max - (num - max))) {
                        row.push(min);
                        num -= min;
                    } else {
                        row.push(max);
                        num -= max;
                    }
                }
            }
            if (orig > (2 * min)) row.sort(sort);
            if (isOdd) row.push(odd);
            return row;
        }

        function executeCallback(key, args, instance) {
            /// <summary>Execute a callback function.</summary>  
            /// <param name="key" type="String">Callback to execute</param>  
            /// <param name="args" type="Array">Optional. Function arguments to pass.</param>
            /// <param name="instance" type="Object">Optional. The "this" value for the function.</param>
            /// <returns type="Any">Value returned from the callback.</returns>

            if (typeof callbacks[key] === "function") {
                try {
                    return callbacks[key].apply(instance || _this, args);
                } catch (er) {
                    if (console) {
                        console.log(key + " callback failed! Error:");
                        console.log(er);
                        return;
                    }
                }
            }
        }

        function exception(message, name) {
            /// <summary>Generates an exception object</summary>  
            /// <param name="message" type="String">Error message.</param>
            /// <param name="name" type="String">Optional. Error name. Default: "OrgChartBuilderException";</param>
            /// <returns type="Object">Exception object.</returns>

            if (name !== "string") name = "OrgChartBuilderException";
            return { "name": name, "message": message };
        }
        function template() {
            /// <summary>Org Chart object template</summary>  
            /// <returns type="Object">Org Chart object</returns>

            return {
                "key": "",          // Required. unique key/id for this node
                "parent": "",       // Required. parent key/id (leave empty if this is the top node)
                "title": "",        // Optional. display title
                "url": "",          // Optional. leaf anchor href value
                "urlTarget": "",    // Optional. leaf anchor target. default: "_parent"
                "description": "",  // Optional. leaf anchor title value
                "style": "",        // Optional. leaf style
                "class": "",        // Optional. leaf class
                "sub": [],          // Optional. sub-branches. orgChart object, Array of orgChart objects or Array of arrays of orgChart objects
                "children": [],     // Optional. main branch. orgChart object or array of orgChart objects
                "render": null      // Optional. function that executes after the leaf is created but before its render.
            };
        }
        //#endregion


        // exposed properties
        Object.defineProperties(_this, {
            "set": {
                "enumerable": true,
                "writable": false,
                "value": set
            },
            "get": {
                "enumerable": true,
                "writable": false,
                "value": get
            },

            "render": {
                "enumerable": true,
                "writable": false,
                "value": render
            },
            "scaleChartTo": {
                "enumerable": true,
                "writable": false,
                "value": scaleTo
            },
            "redrawLines": {
                "enumerable": true,
                "writable": false,
                "value": redrawConnectorLines
            },
            "removeLines": {
                "enumerable": true,
                "writable": false,
                "value": removeConnectorLines
            },
            "resize": {
                "enumerable": true,
                "writable": false,
                "value": resize
            }
        });
        return _this;
    };

    //#region OrgChartBuilder Object
    window.OrgChartBuilder = function (options) {
        /// <summary>Initiate the OrgChartBuilder object.</summary>  
        /// <param name="options" type="Object">Key/value pair of options to set.</param>
        /// <returns type="Object">OrgChartBuilder object.</returns>

        // create a new org chart builder object
        var o = new orgChartBuilder();

        // set org chart options
        if (options) o.set(options);

        // auto render if data and container is sent
        if (options.data instanceof Array && o.get("container").length > 0) o.render();

        // return object
        return o;
    };
    //#endregion
})();
if (!window.SimpleCarousel) window.SimpleCarousel = (function(){
    "use strict";

    //#region POLYFILLS
    // requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
    (function() {
        // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
        // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
        // MIT license
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
        }
    
        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = function(callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
                timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };

        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };

    }());

    /**! Promise Polyfill - 13 April 2018 **/
    /**! https://github.com/taylorhakes/promise-polyfill **/
    (function (global, factory) {
        /* jshint ignore:start */
        typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
            typeof define === 'function' && define.amd ? define(factory) : (factory());
        /* jshint ignore:end */
    }(this, (function () {
    
        // Store setTimeout reference so promise-polyfill will be unaffected by
        // other code modifying setTimeout (like sinon.useFakeTimers())
        var setTimeoutFunc = setTimeout;
    
        function noop() {}
    
        // Polyfill for Function.prototype.bind
        function bind(fn, thisArg) {
            return function () {
                fn.apply(thisArg, arguments);
            };
        }
    
        function Promise(fn) {
            if (!(this instanceof Promise))
                throw new TypeError('Promises must be constructed via new');
            if (typeof fn !== 'function') throw new TypeError('not a function');
            this._state = 0;
            this._handled = false;
            this._value = undefined;
            this._deferreds = [];
    
            doResolve(fn, this);
        }
    
        function handle(self, deferred) {
            while (self._state === 3) {
                self = self._value;
            }
            if (self._state === 0) {
                self._deferreds.push(deferred);
                return;
            }
            self._handled = true;
            Promise._immediateFn(function () {
                var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
                if (cb === null) {
                    (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
                    return;
                }
                var ret;
                try {
                    ret = cb(self._value);
                } catch (e) {
                    reject(deferred.promise, e);
                    return;
                }
                resolve(deferred.promise, ret);
            });
        }
    
        function resolve(self, newValue) {
            try {
                // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
                if (newValue === self)
                    throw new TypeError('A promise cannot be resolved with itself.');
                if (
                    newValue &&
                    (typeof newValue === 'object' || typeof newValue === 'function')
                ) {
                    var then = newValue.then;
                    if (newValue instanceof Promise) {
                        self._state = 3;
                        self._value = newValue;
                        finale(self);
                        return;
                    } else if (typeof then === 'function') {
                        doResolve(bind(then, newValue), self);
                        return;
                    }
                }
                self._state = 1;
                self._value = newValue;
                finale(self);
            } catch (e) {
                reject(self, e);
            }
        }
    
        function reject(self, newValue) {
            self._state = 2;
            self._value = newValue;
            finale(self);
        }
    
        function finale(self) {
            if (self._state === 2 && self._deferreds.length === 0) {
                Promise._immediateFn(function () {
                    if (!self._handled) {
                        Promise._unhandledRejectionFn(self._value);
                    }
                });
            }
    
            for (var i = 0, len = self._deferreds.length; i < len; i++) {
                handle(self, self._deferreds[i]);
            }
            self._deferreds = null;
        }
    
        function Handler(onFulfilled, onRejected, promise) {
            this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
            this.onRejected = typeof onRejected === 'function' ? onRejected : null;
            this.promise = promise;
        }
    
        /**
         * Take a potentially misbehaving resolver function and make sure
         * onFulfilled and onRejected are only called once.
         *
         * Makes no guarantees about asynchrony.
         */
        function doResolve(fn, self) {
            var done = false;
            try {
                fn(
                    function (value) {
                        if (done) return;
                        done = true;
                        resolve(self, value);
                    },
                    function (reason) {
                        if (done) return;
                        done = true;
                        reject(self, reason);
                    }
                );
            } catch (ex) {
                if (done) return;
                done = true;
                reject(self, ex);
            }
        }
    
        Promise.prototype['catch'] = function (onRejected) {
            return this.then(null, onRejected);
        };
    
        Promise.prototype.then = function (onFulfilled, onRejected) {
            var prom = new this.constructor(noop);
    
            handle(this, new Handler(onFulfilled, onRejected, prom));
            return prom;
        };
    
        Promise.prototype['finally'] = function (callback) {
            var constructor = this.constructor;
            return this.then(
                function (value) {
                    return constructor.resolve(callback()).then(function () {
                        return value;
                    });
                },
                function (reason) {
                    return constructor.resolve(callback()).then(function () {
                        return constructor.reject(reason);
                    });
                }
            );
        };
    
        Promise.all = function (arr) {
            return new Promise(function (resolve, reject) {
                if (!arr || typeof arr.length === 'undefined')
                    throw new TypeError('Promise.all accepts an array');
                var args = Array.prototype.slice.call(arr);
                if (args.length === 0) return resolve([]);
                var remaining = args.length;
    
                function res(i, val) {
                    try {
                        if (val && (typeof val === 'object' || typeof val === 'function')) {
                            var then = val.then;
                            if (typeof then === 'function') {
                                then.call(
                                    val,
                                    function (val) {
                                        res(i, val);
                                    },
                                    reject
                                );
                                return;
                            }
                        }
                        args[i] = val;
                        if (--remaining === 0) {
                            resolve(args);
                        }
                    } catch (ex) {
                        reject(ex);
                    }
                }
    
                for (var i = 0; i < args.length; i++) {
                    res(i, args[i]);
                }
            });
        };
    
        Promise.resolve = function (value) {
            if (value && typeof value === 'object' && value.constructor === Promise) {
                return value;
            }
    
            return new Promise(function (resolve) {
                resolve(value);
            });
        };
    
        Promise.reject = function (value) {
            return new Promise(function (resolve, reject) {
                reject(value);
            });
        };
    
        Promise.race = function (values) {
            return new Promise(function (resolve, reject) {
                for (var i = 0, len = values.length; i < len; i++) {
                    values[i].then(resolve, reject);
                }
            });
        };
    
        // Use polyfill for setImmediate for performance gains
        Promise._immediateFn =
            (typeof setImmediate === 'function' &&
                function (fn) {
                    setImmediate(fn);
                }) ||
            function (fn) {
                setTimeoutFunc(fn, 0);
            };
    
        Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
            if (typeof console !== 'undefined' && console) {
                console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
            }
        };
    
        var globalNS = (function () {
            // the only reliable means to get the global object is
            // `Function('return this')()`
            // However, this causes CSP violations in Chrome apps.
            if (typeof self !== 'undefined') {
                return self;
            }
            if (typeof window !== 'undefined') {
                return window;
            }
            if (typeof global !== 'undefined') {
                return global;
            }
            throw new Error('unable to locate global object');
        })();
    
        if (!globalNS.Promise) {
            globalNS.Promise = Promise;
        }
    
    })));
    
    /**! Deferred() - 13 April 2018 **/
    /**! https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred **/
    function Deferred() {
        if (typeof (Promise) != 'undefined' && Promise.defer) {
            return Promise.defer();
        } else if (typeof (PromiseUtils) != 'undefined' && PromiseUtils.defer) {
            return PromiseUtils.defer();
        } else {
            this.resolve = null;
            this.reject = null;
            this.promise = new Promise(function (resolve, reject) {
                this.resolve = resolve;
                this.reject = reject;
            }.bind(this));
            Object.freeze(this);
        }
    }
    //#endregion

    //#region LOCAL VARIABLES, GETTERS, SETTERS
    var id = null,
        infinite = true,
        curIndex = 0,
        minWidth = 10,
        width = null,
        minHeight = 10,
        height = null,
        resizeFrame = false,
        animateDefault = true,
        animationDuration = 300,
        autoRotate = false,
        autoRotateDelayMilliseconds = 10000,
        navOverlay = true,
        navAutoHide = false,
        navNext = true,
        navPrev = true,
        navDots = true,
        timer = {},
        dom = {
            "container": null,
            "list": null,
            "navTarget": null,
            "navContainer": null,
            "navDots": null
        },
        prefix = "simple-carousel",
        css = {
            "container": prefix + "-container",
            "list": prefix + "-list",
            "slide": prefix + "-slide",
            "focus": prefix + "-focus",
            "nextFocus": prefix + "-next-focus",

            "navContainer": prefix + "-nav-container",
            "navOverlay": prefix + "-nav-container-overlay",
            "navAutoHide": prefix + "-nav-autohide",
            "navAppend": prefix + "-nav-append",
            "navBar": prefix + "-nav-bar",
            "navNextContainer": prefix + "-nav-next-container",
            "navNext": prefix + "-nav-next",
            "navPrevContainer": prefix + "-nav-prev-container",
            "navPrev": prefix + "-nav-prev",
            "navDotsContainer": prefix + "-nav-dots-container",
            "navDots": prefix + "-nav-dots",
            "navDot": prefix + "-nav-dot",
            "navDotActive": prefix + "-nav-dot-active"
        },
        callback = {
            "navBar_render": null,
            "next": null,
            "next_click": null,
            "next_clicked": null,
            "prev": null,
            "prev_click": null,
            "prev_clicked": null,
            "transition": null,
            "dots_click": null,
            "dots_clicked": null,
            "rotate": null
        };

    function set (name, value) {
        /// <summary>Property value setter.</summary>
        /// <param name="name" type="String">Property name</param>
        /// <param name="value" type="Any">Value of property</param>
        
        var type = typeof value;
        switch (name) {
            case "container":
            case "id":
                if (type === "string") {
                    id = value;
                    dom.container = document.getElementById(value);
                } else if (type === "object") {
                    try {
                        if (value instanceof HTMLElement) {
                            dom.container = value;
                        } else if (((value instanceof HTMLCollection) || (value instanceof NodeList)) && value.length > 0) {
                            dom.container = value[0];
                        } else if (value instanceof jQuery && value.length > 0) {
                            dom.container = value[0];
                        }
                        if (dom.container && dom.container.getAttribute) {
                            id = dom.container.getAttribute("id") || "";
                        }
                    } catch (er) {}
                }
                break;
            case "css":
                if (type === "string") {
                    css.container += " " + value;
                } else if (type === "object"){
                    for (var cssName in value) {
                        if (value.hasOwnProperty(cssName) && css.hasOwnProperty(cssName)) {
                            css[cssName] += " " + value[cssName];
                        }
                    }
                }
                break;
            case "width":
                if (type === "number" && value > 10) width = parseInt(value, 10);
                break;

            case "height":
                if (type === "number" && value > 10) height = parseInt(value, 10);
                break;
    
            case "infinite":
                if (type === "boolean") infinite = value;
                break;

            case "resize":
            case "resizeFrame":
            case "resize-frame":
                if (type === "boolean") resizeFrame = value;
                break;

            case "index":
                if (type === "number" && value >= 0) curIndex = parseInt(value, 10);
                break;

            case "animate":
                if (type === "boolean") animateDefault = value;
                break;

            case "animationduration":
            case "animationDuration":
                if (type === "number" && value > 0) animationDuration = parseInt(value, 10);
                break;
            case "autorotate":
            case "autoRotate":
                if (type === "boolean") autoRotate = value;
                break;
            
            case "delay":
            case "autorotatedelay":
            case "autoRotateDelay":
            case "autorotatedelaymilliseconds":
            case "autoRotateDelayMilliseconds":
                if (type === "number" && value >= 0) autoRotateDelayMilliseconds = Math.round(value);
                break;

            case "width":
                if (type === "number") width = value;
                break;
            
            case "nav":
                if (type === "boolean") {
                    navNext = value;
                    navPrev = value;
                    navDots = value;
                }
                break;
            case "navnext":
            case "navNext":
                if (type === "boolean") navNext = value;
                break;
            case "navprev":
            case "navPrev":
                if (type === "boolean") navPrev = value;
                break;
            case "dots":
            case "navdots":
            case "navDots":
                if (type === "boolean") navDots = value;
                break;
            case "overlay":
            case "navoverlay":
            case "navOverlay":
                if (type === "boolean") navOverlay = value;
                break;
            case "autohide":
            case "autoHide":
            case "navautohide":
            case "navAutohide":
            case "navAutoHide":
                if (type === "boolean") navAutoHide = value;
                break;
            case "navcontainer":
            case "navContainer":
            case "navtarget":
            case "navTarget":
                try {
                    if (type === "string") {
                        dom.navTarget = document.getElementById(value);
                    } else if (type === "object"){
                            if (value instanceof HTMLElement) {
                                dom.navTarget = value;
                            } else if (((value instanceof HTMLCollection) || (value instanceof NodeList)) && value.length > 0) {
                                dom.navTarget = value[0];
                            } else if (value instanceof jQuery && value.length > 0) {
                                dom.navTarget = value[0];
                            }
                    }
                } catch (er) {}
                break;
            default:
                if (type === "function" && callback.hasOwnProperty(name)) callback[name] = value;
                break;
        }
    }
    //#endregion

    //#region NAVIGATION
    function showCurrent (animate) {
        /// <summary>Shows the current indexed slide without animations.
        /// Useful for initialization or switching to the new index immediately.</summary>
        /// <param name="animate" type="Boolean">Optional. If true animates the container dimensions only. Default: animateDefault;</param>

        if (typeof animate !== "boolean") animate = animateDefault;

        var slides = dom.list.children,
            length = slides.length;

        // make sure current and next index is within limits
        if (curIndex < 0) curIndex = 0;
        if (curIndex >= length) curIndex = length - 1;
        if (length === 0) return;   // nothing to show

        // remove add slide focus
        removeClass(slides, css.nextFocus);
        removeClass(slides, css.focus);
        slides[curIndex].style.left = "0px";
        addClass(slides[curIndex], [css.slide, css.focus]);

        setActiveNavDot();

        // adjust frame to fit slide
        if (resizeFrame) setContainerDimensions(dom.list.querySelectorAll("." + css.focus), false);

    }
    function transitionTo (targetIndex, animate) {
        /// <summary>Transitions the slides to a specific index.</summary>
        /// <param name="targetIndex" type="Number">Index of slide to transition to.</param>
        /// <param name="animate" type="Boolean">Optional. If true animates the transitions. Default: animateDefault;</param>
        /// <return type="Promise">Resolves after all animations, returns new index.</return>
        
        if (typeof animate !== "boolean") animate = animateDefault;

        var dfd = new Deferred(),
            slides = dom.list.children,
            length = slides.length;

        // make sure current index is within limits
        if (curIndex < 0) curIndex = 0;
        if (curIndex >= length) curIndex = length - 1;
        
        // make sure target index is within limits
        if (targetIndex < 0) targetIndex = 0;
        if (targetIndex >= length) targetIndex = length - 1;

        triggerCallback("transition", [curIndex, targetIndex, dom.list.children], dom.list.children[targetIndex]);

        // are we transitioning to a differnt slide?
        if (targetIndex !== curIndex) {
            // yes, we are transitioning
            // do we animate the transition?
            if (animate) {
                // yes, animate the transition
                // transition direction (next? prev?)
                var transition = (targetIndex > curIndex) ? transitionNext : transitionPrev,
                    transitionLoop = function(){
                        // run transition...
                        transition().then(function(){
                            // are we there yet?
                            if (targetIndex !== curIndex){
                                // no, we are not. loop again.
                                transitionLoop();
                            } else {
                                // yes, we're here. resolve promise
                                dfd.resolve(curIndex);
                            }
                        });
                    };
                // begin loop
                transitionLoop();

            } else {
                // no animation, just change the current index and show it.
                curIndex = targetIndex;
                showCurrent();
                dfd.resolve(curIndex);
            }

        } else {
            // not changing slides
            dfd.resolve(curIndex);
        }
        return dfd.promise;
    }
    function transitionNext (animate) {
        /// <summary>Transitions to the next slide.</summary>
        /// <param name="animate" type="Boolean">Optional. If true animates the transitions. Default: animateDefault;</param>
        /// <return type="Promise">Resolves after all animations, returns new index.</return>
        
        if (typeof animate !== "boolean") animate = animateDefault;

        var dfd = new Deferred(),
            slides = dom.list.children,
            length = slides.length;
        
        // make sure current index is within limits
        if (curIndex < 0) curIndex = 0;
        if (curIndex >= length) curIndex = length - 1;

        var nextIndex = Math.max(curIndex + 1, 0);
        
        // make sure next index is within limits
        if (infinite) {
            if (nextIndex >= length) nextIndex = 0;
        } else {
            if (nextIndex >= length) nextIndex = length - 1;
        }

        triggerCallback("next", [curIndex, nextIndex, dom.list.children], dom.list.children[nextIndex]);

        // are we transitioning to a different slide?
        if (nextIndex !== curIndex) {
            // yes, we are transitioning.
            // do we animate the transition?
            if (animate) {
                // yes, animate the transition.

                // add the class to display the next slide
                addClass(slides[nextIndex], css.nextFocus);
                // place the next slide to the right of the current
                var targetWidth = getWidth(slides[nextIndex]),    // width is for target
                    targetHeight = getHeight(slides[nextIndex]);
                slides[nextIndex].style.left = targetWidth + "px";
                //slides[nextIndex].style.width = targetWidth + "px";
                //slides[nextIndex].style.height = targetHeight + "px";

                // animate the frame size concurrently with the slide transition
                if (resizeFrame) setContainerDimensions(slides[nextIndex], animate);
                Animation(slides[curIndex], "left", (0 - targetWidth) + "px", animationDuration).then(function(elem){
                    removeClass(elem, css.focus);
                });
                Animation(slides[nextIndex], "left", "0px", animationDuration).then(function(elem){
                    addClass(elem, css.focus);
                    removeClass(elem, css.nextFocus);
                    curIndex = nextIndex;
                    dfd.resolve(curIndex);
                });
                setActiveNavDot(nextIndex);
            } else {
                // no animation, just change the current index and show it.
                curIndex = nextIndex;
                showCurrent();
                dfd.resolve(curIndex);
            }

        } else {
            // not changing slides
            dfd.resolve(curIndex);
        }
        return dfd.promise;
    }
    function transitionPrev (animate) {
        /// <summary>Transitions to the previous slide.</summary>
        /// <param name="animate" type="Boolean">Optional. If true animates the transitions. Default: animateDefault;</param>
        /// <return type="Promise">Resolves after all animations, returns new index.</return>
        
        if (typeof animate !== "boolean") animate = animateDefault;

        var dfd = new Deferred(),
            slides = dom.list.children,
            length = slides.length;
        
        // make sure current index is within limits
        if (curIndex < 0) curIndex = 0;
        if (curIndex >= length) curIndex = length - 1;

        var nextIndex = curIndex - 1;

        // make sure next index is within limits
        if (infinite) {
            if (nextIndex < 0) nextIndex = length - 1;
        } else {
            if (nextIndex < 0) nextIndex = 0;
        }

        triggerCallback("prev", [curIndex, nextIndex, dom.list.children], dom.list.children[nextIndex]);

        // are we transitioning to a different slide?
        if (nextIndex !== curIndex) {
            // yes, we are transitioning.
            // do we animate the transition?
            if (animate) {
                // yes, animate the transition.

                // add the class to display the next slide
                addClass(slides[nextIndex], css.nextFocus);
                // place the next slide to the left of the current
                var targetWidth = getWidth(slides[nextIndex]),    // width is for target
                    targetHeight = getHeight(slides[nextIndex]);
                slides[nextIndex].style.left = (0 - targetWidth) + "px";
                //slides[nextIndex].style.width = targetWidth + "px";
                //slides[nextIndex].style.height = targetHeight + "px";

                // animate the frame size concurrently with the slide transition
                if (resizeFrame) setContainerDimensions(slides[nextIndex], animate);
                Animation(slides[curIndex], "left", targetWidth + "px", animationDuration).then(function(elem){
                    removeClass(elem, css.focus);
                });
                Animation(slides[nextIndex], "left", "0px", animationDuration).then(function(elem){
                    addClass(elem, css.focus);
                    removeClass(elem, css.nextFocus);
                    curIndex = nextIndex;
                    dfd.resolve(curIndex);
                });
                setActiveNavDot(nextIndex);
            } else {
                // no animation, just change the current index and show it.
                curIndex = nextIndex;
                showCurrent();
                dfd.resolve(curIndex);
            }

        } else {
            // not changing slides
            dfd.resolve(curIndex);
        }
        return dfd.promise;
    }
    //#endregion

    //#region NAV: NEXT, PREV, DOTS
    function createNavigationElements () {
        /// <summary>Creates the next, prev and dot navigation.</summary>
        
        if (navPrev || navNext || navDots){
            dom.navContainer = createElement("div", { "class": css.navContainer });
            var navBar = createElement("div", { "class": css.navBar }),
                prevContainer = createElement("div", { "class": css.navPrevContainer }),
                nextContainer = createElement("div", { "class": css.navNextContainer }),
                dotsContainer = createElement("div", { "class": css.navDotsContainer }),
                prevButton, nextButton;
        
            if (navPrev) {
                prevButton = createElement("div", { "class": css.navPrev });
                prevContainer.appendChild(prevButton);
                prevContainer.addEventListener("click", prevButton_click, false);
            }
            if (navDots) {
                dom.navDots = createElement("ul", { "class": css.navDots });
                dotsContainer.appendChild(dom.navDots);
                renderNavDots();
                setActiveNavDot();
            }
            if (navNext) {
                nextButton = createElement("div", { "class": css.navNext });
                nextContainer.appendChild(nextButton);
                nextContainer.addEventListener("click", nextButton_click, false);
            }

            // the navigation bar together
            if (navOverlay) addClass(dom.navContainer, css.navOverlay);
            if (navOverlay && navAutoHide) addClass(dom.navContainer, css.navAutoHide);
            navBar.appendChild(prevContainer);
            navBar.appendChild(dotsContainer);
            navBar.appendChild(nextContainer);
            dom.navContainer.appendChild(navBar);

            triggerCallback("navBar_render", [curIndex, navBar], dom.navContainer);

            if (dom.navTarget === null && !navOverlay) addClass(dom.container, css.navAppend);
            (dom.navTarget || dom.container).appendChild(dom.navContainer);
        }
    }

    //#region nav functions
    function renderNavDots () {
        /// <summary>(re)Creates navigation dots. Assumes container is already created.</summary>
        
        // we can't (re-)render dots if there isn't a container to render to.
        if (!(dom.navDots instanceof HTMLElement)) return;

        var slides = dom.list.children,
            length = slides.length;

        dom.navDots.innerHTML = "";

        for (var i = 0; i < length; i++) {
            var dot = createElement("li", { "class": css.navDot, "data-index": i });
            dot.addEventListener("click", navDots_click, false);
            dom.navDots.append(dot);
        }
    }
    function setActiveNavDot (index) {
        /// <summary>Sets the current slide's correlated dot as active.</summary>
        /// <param name="index" type="Number">Optional. Dot to select.</param>
        
        // we can't set active dots if there are no dots to set.
        if (!(dom.navDots instanceof HTMLElement)) return;

        if (typeof index !== "number") index = curIndex;

        var slides = dom.list.children,
            dots = dom.navDots.children;

        // make sure slides and dots correlate.
        if (slides.length !== dots.length) {
            renderNavDots();
            setActiveNavDot();
            return;
        }

        // no slides, no dots to set
        if (slides.length === 0) return;

        // make sure current index is within limits
        if (index < 0) index = 0;
        if (index >= dots.length) index = dots.length - 1;

        // remove than add active dot class
        removeClass(dots, css.navDotActive);
        addClass(dots[index], css.navDotActive);
        
    }
    function startAutoRotate () {
        /// <summary>Starts the auto-rotate timer. Rotates the slides.</summary>
        
        stopAutoRotate();
        timer.autoRotate = setTimeout(function(){
            stopAutoRotate();
            var continue_rotate = function(){
                triggerCallback("rotate", [curIndex, dom.list.children], dom.list.children[curIndex]);
                startAutoRotate();
            };
            if (infinite) {
                transitionNext().then(continue_rotate);
            } else {

                if (curIndex >= (dom.list.children.length -1)) {
                    transitionTo(0).then(continue_rotate);
                } else {
                    transitionNext().then(continue_rotate);
                }
        
            }
        }, autoRotateDelayMilliseconds);
    }
    function stopAutoRotate () {
        /// <summary>Stops auto-rotate timer.</summary>
        
        clearTimeout(timer.autoRotate);
    }
    //#endregion nav functions

    //#region nav event handlers
    function nextButton_click (evt) {
        /// <summary>Navigation Next Button click event handler, moves to the next slide.</summary>
        
        stopAutoRotate();

        var event = evt || window.event,
            elem = evt.target || evt.srcElement;

        triggerCallback("next_click", [event, curIndex, dom.navContainer], elem);

        transitionNext().then(function(){
            triggerCallback("next_clicked", [event, curIndex, dom.navContainer], elem);
        });
    }
    function prevButton_click (evt) {
        /// <summary>Navigation Prev Button click event handler, moves to the next slide.</summary>
        
        stopAutoRotate();

        var event = evt || window.event,
            elem = evt.target || evt.srcElement;

        triggerCallback("prev_click", [event, curIndex, dom.navContainer], elem);

        transitionPrev().then(function(){
            triggerCallback("prev_clicked", [event, curIndex, dom.navContainer], elem);
        });
    }
    function navDots_click (evt) {
        /// <summary>Navigation Dots click event handler, moves to the next slide.</summary>
        /// <param name="evt" type="Object">Event object.</param>
        
        stopAutoRotate();

        var event = evt || window.event,
            elem = evt.target || evt.srcElement,
            ndx = parseInt(elem.getAttribute("data-index") || -1, 10);
            
        triggerCallback("dots_click", [event, ndx, dom.navContainer], elem);

        if (ndx > -1) transitionTo(ndx).then(function(){
            triggerCallback("dots_clicked", [event, curIndex, dom.navContainer], elem);
        });
    }
    //#endregion nav event handlers
    //#endregion NAV: NEXT, PREV, DOTS

    //#region HELPERS
    function triggerCallback (key, param, ctx) {
        /// <summary></summary>
        /// <param name="key" type="String">Registered Callback to trigger.</param>
        /// <param name="param" type="Array">Arguments to pass.</param>
        /// <param name="ctx" type="Object">Context for call.</param>
        
        if (callback.hasOwnProperty(key) && typeof callback[key] === "function"){
            try{
                callback[key].apply(ctx, param);
            } catch (er) {
                if (console) console.error("SimpleCarousel: An error occured while executing '" + key + "' callback: ", er);
            }
        }
    }
    function redraw () {
        /// <summary>Redraws the container dimensions and navigation dots.</summary>
        
        var slides = dom.list.children,
            length = slides.length;

        // make sure current index is within limits
        if (curIndex < 0) curIndex = 0;
        if (curIndex >= length) curIndex = length - 1;

        // add classes
        addClass(dom.container, css.container);
        addClass(dom.list, css.list);
        addClass(dom.list.children, css.slide);

        if (resizeFrame) setContainerDimensions(slides[curIndex]);
        if (!dom.navContainer) {
            createNavigationElements();
        } else {
            renderNavDots();
            setActiveNavDot();
        }

    }
    function setContainerDimensions (slides, animate) {
        /// <summary>Changes the width and height to match the slides passed.</summary>
        /// <param name="slides" type="Collection">HTML Collection or Array</param>
        /// <param name="animate" type="Boolean">Optional. If true, dimensions will be animated. Default: animateDefault;</param>
        
        if (typeof animate !== "boolean") animate = animateDefault;

        var maxWidth = width, maxHeight = height, 
            elems = (!slides.hasOwnProperty(length)) ? [slides] : slides;

        // loop thru all the children and set dimensions
        for (var i = 0; i < elems.length; i++) {
            var elem = elems[i];
            maxWidth = Math.max(maxWidth, getWidth(elem));
            maxHeight = Math.max(maxHeight, getHeight(elem));
        }

        if (animate) {
            Animation(dom.container, "width", maxWidth + "px");
            Animation(dom.container, "height", maxHeight + "px");
        } else {
            dom.container.style.width = maxWidth + "px";
            dom.container.style.height = maxHeight + "px";
        }
    }
    function addClass (elems, classnames) {
        /// <summary>Adds CSS class names to an element.</summary>
        /// <param name="elems" type="Object || Array">Target(s) element.</param>
        /// <param name="classname" type="String || Array">Class name to add. if String, separate each class name by a space.</param>

        if (typeof classnames === "string") classnames = [classnames];
        if (!(classnames instanceof Array)) return;
        if (!isHtmlCollectionTypes(elems)) elems = [elems];

        for (var i = 0; i < classnames.length; i++) {
            
            var classes = classnames[i].split(" ");
            for (var ii = 0; ii < classes.length; ii++) {
                var name = classes[ii];
                for (var iii = 0; iii < elems.length; iii++) {
                    var elem = elems[iii];
                    if (name && !hasClass(elem, name)) elem.classList.add(name);
                }
            }
        }
    }
    function removeClass (elems, classnames) {
        /// <summary>Removes CSS class names from an element.</summary>
        /// <param name="elems" type="Object || Array">Target(s) element.</param>
        /// <param name="classname" type="String || Array">Class name to add. If String, separate each class name by a space.</param>

        if (typeof classnames === "string") classnames = [classnames];
        if (!(classnames instanceof Array)) return;
        if (!isHtmlCollectionTypes(elems)) elems = [elems];

        for (var i = 0; i < classnames.length; i++) {
            
            var classes = classnames[i].split(" ");
            for (var ii = 0; ii < classes.length; ii++) {
                var name = classes[ii];
                for (var iii = 0; iii < elems.length; iii++) {
                    var elem = elems[iii];
                    if (name && hasClass(elem, name)) elem.classList.remove(name);
                }
            }
        }
    }
    function hasClass (elem, classname) {
        /// <summary>Checks to see if element has the CSS class name.</summary>
        /// <param name="elem" type="Object">Target element.</param>
        /// <param name="classname" type="String">Single class name to check.</param>
        /// <return type="Boolean">Returns true if element already has this class.</return>
        
        return elem.classList.contains(classname);
    }
    function isHtmlCollectionTypes (elems) {
        /// <summary>Checks to see if the 'elems' is any type of HTML collection.</summary>
        /// <param name="elems" type="Object">Object to check.</param>
        /// <return type="Boolean">True if it is a collection type</return>
        
        // check generic types first. is an object and has "length" prop.
        if (typeof elems === "object" && elems.hasOwnProperty("length")) return true;
        
        // else check explicit types
        var types = [Array, HTMLCollection, NodeList];
        for (var i = 0; i < types.length; i++) {
            if (elems instanceof types[i]) return true;
        }
        return false;
    }
    function getWidth (elem) {
        /// <summary>Get the outer width for an element.</summary>
        /// <param name="elem" type="Object">DOM element</param>
        /// <return type="Number">Width number in pixels. Does not append "px" to the value.</return>
        
        var style = window.getComputedStyle(elem) || elem.currentStyle;
        return elem.offsetWidth + parseInt(style.marginLeft, 10) + parseInt(style.marginRight, 10);
    }
    function getHeight (elem) {
        /// <summary>Get the outer width for an element.</summary>
        /// <param name="elem" type="Object">DOM element</param>
        /// <return type="Number">Width number in pixels. Does not append "px" to the value.</return>
        
        var style = window.getComputedStyle(elem) || elem.currentStyle;
        return elem.offsetHeight + parseInt(style.marginTop, 10) + parseInt(style.marginBottom, 10);
    }
    function Animation(elem, prop, value, duration) {
        /// <summary>Animate element property</summary>
        /// <param name="elem" type="Object">DOM element.</param>
        /// <param name="prop" type="String">CSS property name with numeric value.</param>
        /// <param name="value" type="String">Target value of property. Example: "100px"</param>
        /// <param name="duration" type="Number">Optional. Duration of animation. Default: 300;</param>
        /// <return type="Promise">promise</return>
        
        var dfd = new Deferred();
        if (typeof prop !== "string") {
            dfd.reject("Invalid 'prop' argument!");
            return dfd.promise;
        }
        if (!elem.style) {
            dfd.reject("Invalid 'elem' argument! Not a DOM object");
            return dfd.promise;
        }
        if (typeof duration !== "number") duration = 300;
    
        var style = window.getComputedStyle(elem),
            changePosition = ["top", "bottom", "left", "right"],
            dataOrigPosition = "data-orig-position";
    
        // if changing position
        if (changePosition.indexOf(prop) > -1) {
            // save orig position value and change position to absolute.
            if (!elem.hasAttribute(dataOrigPosition)) elem.setAttribute(dataOrigPosition, style.position);
            elem.style.position = "absolute";
        }
    
        var oldtimestamp = null,
            reExt = /[^\d]+$/i,
            ext = (reExt.exec(value + "") || [""])[0],
            startingValue = parseInt(style[prop] || 0, 10),
            target = parseInt(value, 10),
            units = (target - startingValue) / duration,
            moveUp = (target >= startingValue),
            curVal = startingValue;
    
        // if no extension was found on the target value, try getting it from the existing value
        if (!ext) ext = (reExt.exec(style[prop]) || [""])[0];
    
        // cache values 
        var dataOrigAttr = "data-orig-" + prop.toLowerCase(),
            dataLastAttr = "data-last-" + prop.toLowerCase();
        if (!elem.hasAttribute(dataOrigAttr)) elem.setAttribute(dataOrigAttr, startingValue + ext);
        elem.setAttribute(dataLastAttr, startingValue + ext);
    
        // exit early if starting value is the same as the target value
        if (startingValue === target) {
            elem.style[prop] = target + ((ext) ? ext :0 );
            dfd.resolve(elem);
            return dfd.promise;
        }
    
        function step(timestamp) {
            if (!oldtimestamp) oldtimestamp = timestamp;
            // get the time difference from the last frame
            var gap = timestamp - oldtimestamp;
            oldtimestamp = timestamp;
    
            // calculate the remaining duration
            duration = duration - gap;
            if (duration > 0) {
    
                // calculate how much we should move in this frame
                var movement = gap * units;
                // calculate the new current value
                curVal += movement;
                // make sure we didn't overshoot our target value
                if ((moveUp && curVal > target) || (!moveUp && curVal < target)){
                    // we overshot, set current value to the target
                    curVal = target;
                }
                // set element property to current value + extension (px, %...)
                elem.style[prop] = curVal + ((ext) ? ext :0 );
    
                // check to see if we need to run another frame
                if (curVal !== target) window.requestAnimationFrame(step);
                return;
    
            } else {
                // duration expired, set property value to it's target
                elem.style[prop] = target + ((ext) ? ext :0 );
            }
    
            dfd.resolve(elem);
        }
    
        // start the animation
        window.requestAnimationFrame(step);
    
        return dfd.promise;
    }
    function createElement (name, properties) {
        /// <summary>Creates a new HTMl DOM element.</summary>
        /// <param name="name" type="String">Name of element. Example: div, span, ul...</param>
        /// <param name="properties" type="Object">Element attributes.</param>
        /// <return type="Object">DOM element</return>
        
        var elem = document.createElement(name);
        
        properties = properties || {};
        for (var key in properties) {
            if (properties.hasOwnProperty(key)) {
                elem.setAttribute(key, properties[key]);
            }
        }
        return elem;
    }
    //#endregion

    //#region INITIALIZATION
    function setInitialDimensions () {
        /// <summary>Sets the initial width height based on user preference, container dimenstions or slides</summary>
                
        var style = window.getComputedStyle(dom.container) || dom.container.currentStyle,
            container = {
                "width": style.width,
                "height": style.height
            };
        
        if (width === null) width = parseInt(container.width, 10);
        if (height === null) height = parseInt(container.height, 10);

        dom.container.style.width = width + "px";
        dom.container.style.height = height + "px";

        for (var i = 0; i < dom.list.children.length; i++) {
            var slide = dom.list.children[i],
                slideStyle = window.getComputedStyle(slide),
                paddingLeft = parseInt(slideStyle.paddingLeft || 0, 10),
                paddingRight = parseInt(slideStyle.paddingRight || 0, 10),
                paddingTop = parseInt(slideStyle.paddingTop || 0, 10),
                paddingBottom = parseInt(slideStyle.paddingBottom || 0, 10);

            if (!slide.style.width) slide.style.width = (width - paddingLeft - paddingRight) + "px";
            if (!slide.style.height) slide.style.height = (height - paddingTop - paddingBottom) + "px";
        }
    }
    var simpleCarousel = function(){
        var obj = {};

        Object.defineProperties(obj, {
            "next": {
                "enumerable": true,
                "writable": false,
                "value": transitionNext
            },
            "prev": {
                "enumerable": true,
                "writable": false,
                "value": transitionPrev
            },
            "transitionTo": {
                "enumerable": true,
                "writable": false,
                "value": transitionTo
            },

            "startAutoRotate": {
                "enumerate": true,
                "writable": false,
                "value": startAutoRotate
            },
            "stopAutoRotate": {
                "enumerate": true,
                "writable": false,
                "value": stopAutoRotate
            }
        });

        Object.freeze(obj);
        return obj;
    };
    Object.defineProperties(simpleCarousel, {});

    function initialize (options) {
        /// <summary>Initialize the carousel.</summary>
        /// <param name="options" type="Object">SimpleCarousel options.</param>
        /// <return type="Object">new SimpleCarousel object.</return>
        
        var _simpleCarousel = new simpleCarousel();

        options = options || {};
        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                set(key, options[key]);
            }
        }
        if (typeof dom.container === "object") {
            // save list element
            dom.list = dom.container.children[0];

            // add classes
            addClass(dom.container, css.container);
            addClass(dom.list, css.list);
            addClass(dom.list.children, css.slide);

            // set initial width and height
            setInitialDimensions();

            // create the navigational elements
            createNavigationElements();
            
            // show first slide, don't animate
            showCurrent(false);

            // start auto-rotate
            if (autoRotate) startAutoRotate();
        }

        return _simpleCarousel;
    }
    Object.freeze(initialize);
    return initialize;
    //#endregion
})();
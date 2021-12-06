/**
 * WADE - Web App Development Engine
 * @version 4.1
 * @constructor
 */
function Wade()
{
    var version = '4.1';
    var self = this;
    var sceneManager = 0;
    var assetLoader = 0;
    var assetPreloader = 0;
    var inputManager = 0;
    var pendingMainLoop = 0;
    var pendingAppTimer = 0;
    var appInitialised = false;
    var appLoading = false;
    var relativeAppPath = '';
    var appTimerInterval = 1.0;
    var loadingImages = [];
    var mainLoopCallbacks = [];
    var mainLoopLastTime = 0;
    var resolutionFactor = 1;
    var forcedOrientation = 'none';
    var blankImage = new Image();
    var audioSources = [];
    var timelines = {};
    var processedTimelineEvents = [];
    var loadingBar;
    var simulationPaused;
    var internalCanvas;
    var internalContext;
    var webGlSupported;
    var forceWebGl;
    var debugMode;
    var audioContext;
    var autoLoadImages = true;
    var globalUnderscore = true;
    var imageDataCache = {};
    var blurTargets = {};
    var timeouts = [];
    var timeoutUid = 0;
    var glLayersMerged = true;
    var emptyObject = {};
    var fnToString = emptyObject.hasOwnProperty.toString;
    var objectFunctionString = fnToString.call(Object);
    var catchUpBuffer = 1; // how many seconds of lag until we give up trying to catch up
    var containerDiv = 'wade_main_div'; // the div that contains all the wade canvases
    var isImportingScene = false;
    var movementOffsets =
    {
        'straight': [{x: -1, y: -1}, {x: -1, y: 1}, {x: 1, y: -1}, {x: 1, y: 1}],
        'diagonal': [{x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0}],
        'both': [{x: -1, y: -1}, {x: -1, y: 1}, {x: 1, y: -1}, {x: 1, y: 1}, {x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0}]
    };
    movementOffsets['top-down straight'] = movementOffsets.diagonal;
    movementOffsets['top-down diagonal'] = movementOffsets.straight;
    movementOffsets['iso straight'] = movementOffsets.straight;
    movementOffsets['iso diagonal'] = movementOffsets.diagonal;
    blankImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2NkAAIAAAoAAggA9GkAAAAASUVORK5CYII='; // fully transparent image

    /**
     * The current app instance
     * @type {Object}
     */
    this.app = 0;

    /**
     * The time (in seconds) between simulation steps
     * @type {number}
     * @constant
     */
    this.c_timeStep = 1 / 60;

    /**
     * The default layer for new sprites. This is initially set to 1.
     * @type {number}
     */
    this.defaultLayer = 1;

    this._appData = 0;
    this.c_epsilon = 0.0001;

    /**
     * Initialize the engine
     * @param {string} appScript Path and filename of the main app script
     * @param {Object} [appData = {}] An object containing initialization data for the app
     * @param {Object} [options = {}] An object that contains a set of fields that specify some configuration options. All the fields are optional. Supported values are:<br/><ul>
     <li> <b>forceReload</b>: <i>boolean</i> -  Whether to force reloading the main app script (as opposed to trying to get it from the cache. Defaults to false</li>
     <li> <b>updateCallback</b>: <i>function</i> -  A function to execute when an update for the cached version of the app is available and has been downloaded. This only applies to apps using the application cache. If omitted, the default behavior is to display an alert, after which the page will be refreshed.</li>
     <li> <b>container</b>: <i>string</i> - The name of an HTML element in the current document (typically a DIV), that will contain all of the app's canvases and will be used to detect input events. Default is 'wade_main_div'.</li>
     <li> <b>debug</b>: <i>boolean</i> - Whether to run the app in debug mode. When this is active, the source code of functions loaded through scene files will be easily accessible from the debugger. This will also inject 'sourceURL' tags into all dynamically loaded scripts. Defaults to false.</li>
     <li> <b>audio</b>: <i>boolean</i> - Whether to activate audio or not. Defaults to true.</li>
     <li> <b>input</b>: <i>boolean</i> - Whether to activate input or not. Defaults to true.</li>
     <li> <b>forceWebGl</b>: <i>boolean</i> - Whether to use WebGl even when the browser detects potential performance problems. Defaults to false.</li>
     <li> <b>globalUnderscore</b>: <i>boolean</i> - Whether to use the global <b>_</b> variable to access scene objects. Defaults to true.</li></ul>
     <li> <b>audioContext</b>: <i>AudioContext</i> - An external WebAudio Context to use for all audio-related operations. If this is not specified, wade will create a new internal one.</li></ul>
     */
    this.init = function(appScript, appData, options)
    {
        options = options || {};
        var forceReload = options.forceReload;
        var updateCallback = options.updateCallback;
        forceWebGl = options.forceWebGl;
        var container = options.container;
        globalUnderscore = (typeof(options.globalUnderscore) != 'undefined')? !!options.globalUnderscore : true;

        containerDiv = container || 'wade_main_div';

        // handle application cache
        var handleApplicationCache = function()
        {
            var appCache = window.applicationCache;
            if (!appCache)
            {
                return;
            }

            if (appCache.status == appCache.UPDATEREADY)
            {
                wade.log('a new version of the app is available');
                if (updateCallback)
                {
                    updateCallback();
                }
                else
                {
                    alert('A new version is available.\nPlease press OK to restart.');
                    appCache.swapCache();
                    window.location.reload(true);
                    window.location = window.location;
                }
                return;
            }
            else
            {
                try
                {
                    appCache.update();
                } catch(e) {}
            }
            appCache.addEventListener('updateready', handleApplicationCache, false);
        };
        handleApplicationCache();

        if (appScript)
        {
            // set relative app path
            relativeAppPath = appScript.substr(0, Math.max(appScript.lastIndexOf('/'), appScript.lastIndexOf('\\')) + 1);
        }

        // add support for requestAnimationFrame
        // it has to be a bit convoluted because some browsers will have vendor-specific extensions for this, others will have no support at all
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for (var i=0; i<vendors.length && !window.requestAnimationFrame; i++)
        {
            window.requestAnimationFrame = window[vendors[i] + 'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[i] + 'CancelAnimationFrame'] || window[vendors[i] + 'CancelRequestAnimationFrame'];
        }
        if (!window.requestAnimationFrame)
        {
            window.requestAnimationFrame = function(callback)
            {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime -lastTime));
                var id = window.setTimeout(function() {callback(currTime + timeToCall);}, timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
        }
        if (!window.cancelAnimationFrame)
        {
            window.cancelAnimationFrame = function(id)
            {
                clearTimeout(id);
            }
        }

        // try to create a WebAudio context
        var enableAudio = (typeof(options.audio) == 'undefined' || options.audio);
        audioContext = options.audioContext;
        if (enableAudio && !audioContext)
        {
            try
            {
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioContext();
                var canUseWebAudio = XMLHttpRequest && (typeof (new XMLHttpRequest()).responseType === 'string');
            }
            catch (e) {}
            if (!canUseWebAudio)
            {
                wade.warn('Warning: the WebAudio API is not supported in this environment. Audio functionality will be limited');
            }
        }

        // create the asset loader
        assetLoader = new AssetLoader();
        assetLoader.init(false);

        // create the asset preloader
        assetPreloader = new AssetLoader();
        assetPreloader.init(true);

        // create and initialise the scene manager
        sceneManager = new SceneManager();
        sceneManager.init();

        // create and initialise the input manager
        inputManager = new InputManager();
        if (typeof(options.input) == 'undefined' || options.input)
        {
            inputManager.init();
        }

        // create an internal canvas context for various operations such as measuring text, etc
        internalCanvas = document.createElement('canvas');
        internalCanvas.width = internalCanvas.height = 256;
        internalContext = internalCanvas.getContext('2d');

        // generate procedural images
        this.proceduralImages.init();

        // set debug mode
        debugMode = !!options.debug;

        // load user app
        this._appData = appData? appData : {};
        if (appScript)
        {
            assetLoader.loadAppScript(appScript, forceReload);
        }
        else if (window.App)
        {
            this.instanceApp();
        }
        else
        {
            wade.warn("Warning - App is not defined.")
        }

        // start the main loop
        this.event_mainLoop();
    };

    /**
     * Stop the execution of the WADE app. The simulation and rendering loops will be interrupted, and 'onAppTimer' events will stop firing.<br/>
     * If the WADE app has scheduled any events (for example with setTimeout), it is responsible for cancelling those events.
     */
    this.stop = function()
    {
        if (pendingMainLoop)
        {
            cancelAnimationFrame(pendingMainLoop);
        }
        if (pendingAppTimer)
        {
            clearTimeout(pendingAppTimer);
        }
        this.setLoadingImages([]);
        wade.stopInputEvents();
    };

    /**
     * Stop listening for input events
     */
    this.stopInputEvents = function()
    {
        inputManager.deinit();
    };

    /**
     * Restart listening to input events after a call to wade.stopInputEvents()
     */
    this.restartInputEvents  = function()
    {
        inputManager.init();
    };

    /**
     * Stop the normal input event handling by the browser. Note that this happens by default, so you don't need to call this function unless you want to re-enable the default handling of input events, or change it programmatically.
     * @param {boolean} [toggle] Whether to cancel the normal handling of event. If this parameter is omitted, it's assumed to be true.
     */
    this.cancelInputEvents = function(toggle)
    {
        inputManager.cancelEvents(toggle);
    };

    /**
     * Get the base path of the app (i.e. the directory where the main app script is located or the directory that was set via setBasePath)<br/>
     * The result of this function depends on the path that was passed to the last call to <i>wade.init()</i> or <i>wade.setBasePath</i>. It can be an absolute path, or a path relative to the location of WADE.
     * @returns {String} The base path of the app
     */
    this.getBasePath = function()
    {
        return relativeAppPath;
    };

    /**
     * Set the base path of the app. Omit the parameter or set it to an empty string "" if you want to always use absolute paths
     * @param {String} path the base path of the app
     */
    this.setBasePath = function(path)
    {
        relativeAppPath = path || '';
    };

    /**
     * Get the full path and file name of the specified file. This could be relative to the app's main file location, or an absolute address starting with 'http://', 'https://' or '//'
     * @param {string} file The base file name
     * @returns {string} The full path and file name
     */
    this.getFullPathAndFileName = function(file)
    {
        if (!file || file.substr(0, 11) == 'procedural_' || (relativeAppPath && file.substr(0, relativeAppPath.length) == relativeAppPath))
        {
            return file;
        }
        var firstChar = file[0];
        return (firstChar=='\\' || firstChar == '/' || file.indexOf(':') != -1)? file : relativeAppPath + file;
    };

    /**
     * Load a javascript file. Although the loading happens asynchronously, the simulation is suspended until this operation is completed.<br/>
     * If a loading screen has ben set, it will be shown during the loading.<br/>
     * See preloadScript for an equivalent operation that happens in the background without suspending the simulation.
     * @param {string} file A javascript file to load. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {function} [callback] A callback to execute when the script is loaded
     * @param {boolean} [forceReload] Whether to force the client to reload the file even when it's present in its cache
     * @param {function} [errorCallback] A callback to execute when the script cannot be loaded
     * @param {boolean} [dontExecute] Scripts loaded via wade.loadScript() are automatically executed. Set this boolean to true to avoid executing them as they are loaded.
     */
    this.loadScript = function(file, callback, forceReload, errorCallback, dontExecute)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.loadScript(fileName, callback, forceReload, errorCallback, dontExecute);
    };

    /**
     * Load a javascript file asynchronously, without suspending the simulation.
     * @param {string} file A javascript file to load. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {function} [callback] A callback to execute when the script is loaded
     * @param {boolean} [forceReload] Whether to force the client to reload the file even when it's present in its cache
     * @param {function} [errorCallback] A callback to execute when the script cannot be loaded
     * @param {boolean} [dontExecute] Scripts loaded via wade.preloadScript() are automatically executed. Set this boolean to true to avoid executing them as they are loaded.
     */
    this.preloadScript = function(file, callback, forceReload, errorCallback, dontExecute)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetPreloader.loadScript(fileName, callback, forceReload, errorCallback, dontExecute);
    };

    /**
     * Get the contents of a script file
     * @param {string} file A script file to access (it has to be a file that has been loaded via wade.loadScript() or set via wade.setScript() first). It can be a relative path, or an absolute path starting with "http://"
     * @returns {string} The contents of the script file
     */
    this.getScript = function(file)
    {
        var fileName = this.getFullPathAndFileName(file);
        return assetLoader.getScript(fileName);
    };

    /**
     * Associate a file name with a script, so that any subsequent calls to getScript using the given file name will return that script.
     * @param {string} file The script file name
     * @param {string} [data] A string representation of the script
     * @param {boolean} [setForPreloader] Whether to apply this operation to the asset preloader as well as the asset loader. This is false by default. If set to true, subsequent calls to wade.preloadScript will get this cached version of the data instead of loading it again in the background.
     */
    this.setScript = function(file, data, setForPreloader)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.setScript(fileName, data);
        setForPreloader && assetPreloader.setScript(fileName, data);
    };

    /**
     * Load a JavaScript Object Notation (JSON) data file. Although the loading happens asynchronously, the simulation is suspended until this operation is completed.<br/>
     * If a loading screen has ben set, it will be shown during the loading.<br/>
     * See preloadJson for an equivalent operation that happens in the background without suspending the simulation.
     * @param {string} file A json file to load. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {Object} [objectToStoreData] An object that will be used to store the data. When the loading is complete, objectToStoreData.data will contain the contents of the json file
     * @param {function} [callback] A callback to execute when the script is loaded
     * @param {boolean} [forceReload] Whether to force the client to reload the file even when it's present in its cache#
     * @param {function} [errorCallback] A callback to execute when the json file cannot be loaded
     */
    this.loadJson = function(file, objectToStoreData, callback, forceReload, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.loadJson(fileName, objectToStoreData, callback, forceReload, errorCallback);
    };

    /**
     * Load a JavaScript Object Notation (JSON) data file asynchronously, without suspending the simulation.
     * @param {string} file A json file to load. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {Object} [objectToStoreData] An object that will be used to store the data. When the loading is complete, objectToStoreData.data will contain the contents of the json file
     * @param {function} [callback] A callback to execute when the script is loaded
     * @param {boolean} [forceReload] Whether to force the client to reload the file even when it's present in its cache
     * @param {function} [errorCallback] A callback to execute when the json file cannot be loaded
     */
    this.preloadJson = function(file, objectToStoreData, callback, forceReload, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetPreloader.loadJson(fileName, objectToStoreData, callback, forceReload, errorCallback);
    };

    /**
     * @param {string} file A JSON file to access (it has to be a file that has been loaded via wade.loadJson() or set via wade.setJson() first). It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @returns {object|Array} The contents of the JSON file
     */
    this.getJson = function(file)
    {
        var fileName = this.getFullPathAndFileName(file);
        return assetLoader.getJson(fileName);
    };

    /**
     * Associate a file name with a JSON object, so that any subsequent calls to getJson using the given file name will return that object.
     * @param {string} file The JSON file name
     * @param {Object} [data] The data object to associate with the JSON file name
     * @param {boolean} [setForPreloader] Whether to apply this operation to the asset preloader as well as the asset loader. This is false by default. If set to true, subsequent calls to wade.preloadJson will get this cached version of the data instead of loading it again in the background.
     */
    this.setJson = function(file, data, setForPreloader)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.setJson(fileName, data);
        setForPreloader && assetPreloader.setJson(fileName, data);
    };

    /**
     * Load a plain text file. Although the loading happens asynchronously, the simulation is suspended until this operation is completed.<br/>
     * If a loading screen has ben set, it will be shown during the loading.<br/>
     * See preloadText for an equivalent operation that happens in the background without suspending the simulation.
     * @param {string} file A text file to load. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {Object} [objectToStoreData] An object that will be used to store the data. When the loading is complete, objectToStoreData.data will contain the contents of the text file
     * @param {function} [callback] A callback to execute when the script is loaded
     * @param {boolean} [forceReload] Whether to force the client to reload the file even when it's present in its cache#
     * @param {function} [errorCallback] A callback to execute when the text file cannot be loaded
     */
    this.loadText = function(file, objectToStoreData, callback, forceReload, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.loadText(fileName, objectToStoreData, callback, forceReload, errorCallback);
    };

    /**
     * Load a plain text file asynchronously, without suspending the simulation.
     * @param {string} file A text file to load. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {Object} [objectToStoreData] An object that will be used to store the data. When the loading is complete, objectToStoreData.data will contain the contents of the text file
     * @param {function} [callback] A callback to execute when the script is loaded
     * @param {boolean} [forceReload] Whether to force the client to reload the file even when it's present in its cache
     * @param {function} [errorCallback] A callback to execute when the text file cannot be loaded
     */
    this.preloadText = function(file, objectToStoreData, callback, forceReload, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetPreloader.loadText(fileName, objectToStoreData, callback, forceReload, errorCallback);
    };

    /**
     * @param {string} file A text file to access (it has to be a file that has been loaded via wade.loadText() or set via wade.setText() first). It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @returns {string} The contents of the text file
     */
    this.getText = function(file)
    {
        var fileName = this.getFullPathAndFileName(file);
        return assetLoader.getText(fileName);
    };

    /**
     * Associate a file name with a text string, so that any subsequent calls to getText using the given file name will return that string.
     * @param {string} file The text file name
     * @param {string} [data] The data object to associate with the text file name
     * @param {boolean} [setForPreloader] Whether to apply this operation to the asset preloader as well as the asset loader. This is false by default. If set to true, subsequent calls to wade.preloadText will get this cached version of the data instead of loading it again in the background.
     */
    this.setText = function(file, data, setForPreloader)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.setText(fileName, data);
        setForPreloader && assetPreloader.setText(fileName, data);
    };

    /**
     * Load an image file. Although the loading happens asynchronously, the simulation is suspended until this operation is completed.<br/>
     * If a loading screen has ben set, it will be shown during the loading.<br/>
     * See preloadImage for an equivalent operation that happens in the background without suspending the simulation.
     * @param {string} file An image file to load. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {function} [callback] A callback to execute when the file is loaded
     * @param {function} [errorCallback] A callback to execute when the image cannot be loaded
     */
    this.loadImage = function(file, callback, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.loadImage(fileName, callback, errorCallback);
    };

    /**
     * This is a helper functions to load multiple images in a single function call, and is equivalent to calling wade.loadImage() multiple times.
     * @param {Array} arrayOfFileNames An array of strings, where each string is the file name of an image to load.
     */
    this.loadImages = function(arrayOfFileNames)
    {
        for (var i=0; i<arrayOfFileNames.length; i++)
        {
            this.loadImage(arrayOfFileNames[i]);
        }
    };

    /**
     * Load an image file asynchronously, without suspending the simulation.
     * @param {string} file An image file to load. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {function} [callback] A callback to execute when the file is loaded
     * @param {function} [errorCallback] A callback to execute when the image cannot be loaded
     */
    this.preloadImage = function(file, callback, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetPreloader.loadImage(fileName, callback, errorCallback);
    };

    /**
     * Release references to an image file, so it can be garbage-collected to free some memory
     * @param {string} file An image file to unload. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     */
    this.unloadImage = function(file)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.unloadImage(fileName);
        assetPreloader.unloadImage(fileName);
        delete imageDataCache[fileName];
    };

    /**
     * Release references to all the image files that have been loaded so far, so they can be garbage-collected to free some memory
     */
    this.unloadAllImages = function()
    {
        assetLoader.unloadAllImages();
        assetPreloader.unloadAllImages();
        imageDataCache = [];
    };

    /**
     * Get an image object that has previously been loaded, or a blank image
     * @param {string} [file] An image file to get. This must be the file name that was used in a previous call to loadImage, preloadImage or setImage. If omitted or falsy, a bank (white) image is returned
     * @param {string} [errorMessage] An error message to display in the console if the image hasn't been loaded. If omitted, a default error message will be printed.
     * @returns {Object} The image object that was requested
     */
    this.getImage = function(file, errorMessage)
    {
        if (file)
        {
            var fileName = this.getFullPathAndFileName(file);
            return (assetLoader.getImage(fileName, errorMessage));
        }
        else
        {
            return blankImage;
        }
    };

    /**
     * Associate a file name with an image object, so that any subsequent calls to getImage using the given file name will return that object.
     * @param {string} file The image file name
     * @param {Object} [image] The image object
     * @param {boolean} [setForPreloader] Whether to apply this operation to the asset preloader as well as the asset loader. This is false by default. If set to true, subsequent calls to wade.preloadImage will get this cached version of the data instead of loading it again in the background.
     */
    this.setImage = function(file, image, setForPreloader)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.setImage(fileName, image);
        setForPreloader && assetPreloader.setImage(fileName, image);
        delete imageDataCache[fileName];
        sceneManager.renderer.updateImageUsers(fileName);
    };

    /**
     * Load an audio file. Although the loading happens asynchronously, the simulation is suspended until this operation is completed.<br/>
     * If a loading screen has ben set, it will be shown during the loading.<br/>
     * See preloadAudio for an equivalent operation that happens in the background without suspending the simulation.
     * @param {string} file The audio file to load. Note that while some browsers support '.aac' files, some don't and support '.ogg' instead. If you plan to use one of these formats, you should provide the same file in the other format too in the same location (same file name but different extension). It then doesn't matter wheter you refer to your file as 'fileName.aac' or 'fileName.ogg', because WADE will automatically use the one that is supported by the client
     * @param {boolean} [autoplay] Whether to start play the audio file as soon as it's ready.
     * @param {boolean} [looping] Whether to repeat the audio when it's over
     * @param {function} [callback] A function to execute when the audio is ready to play
     * @param {function} [errorCallback] A callback to execute when the audio file cannot be loaded
     */
    this.loadAudio = function(file, autoplay, looping, callback, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.loadAudio(fileName, autoplay, looping, callback, errorCallback);
    };

    /**
     * Load an audio file asynchronously, without suspending the simulation.
     * @param {string} file The audio file to load. Note that while some browsers support '.aac' files, some don't and support '.ogg' instead. If you plan to use one of these formats, you should provide the same file in the other format too in the same location (same file name but different extension). It then doesn't matter wheter you refer to your file as 'fileName.aac' or 'fileName.ogg', because WADE will internally use the one that is supported by the client
     * @param {boolean} [autoplay] Whether to start play the audio file as soon as it's ready.
     * @param {boolean} [looping] Whether to repeat the audio when it's over
     * @param {function} [callback] A function to execute when the audio is ready to play
     * @param {function} [errorCallback] A callback to execute when the audio file cannot be loaded
     */
    this.preloadAudio = function(file, autoplay, looping, callback, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetPreloader.loadAudio(fileName, autoplay, looping, callback, errorCallback);
    };

    /**
     * Release references to an audio file, so it can be garbage-collected to free some memory
     * @param {string} file An audio file to unload. It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     */
    this.unloadAudio = function(file)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.unloadAudio(fileName);
        assetPreloader.unloadAudio(fileName);
    };

    /**
     * Release references to all the audio files that have been loaded so far, so they can be garbage-collected to free some memory
     */
    this.unloadAllAudio = function()
    {
        assetLoader.unloadAllAudio();
        assetPreloader.unloadAllAudio();
    };

    /**
     * Associate a file name with an audio object, so that any subsequent calls to getAudio using the given file name will return that object.
     * @param {string} file The audio file name
     * @param {Object} [audio] The audio object
     * @param {function} [callback] A function to execute when the audio has finished decoding and is fully set. This is useful if the audio object is a data URI of a compressed audio type that needs to be decoded
     * @param {boolean} [setForPreloader] Whether to apply this operation to the asset preloader as well as the asset loader. This is false by default. If set to true, subsequent calls to wade.preloadAudio will get this cached version of the data instead of loading it again in the background.
     */
    this.setAudio = function(file, audio, callback, setForPreloader)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.setAudio(fileName, audio, callback);
        setForPreloader && assetPreloader.setAudio(fileName, audio, callback);
    };

    /**
     * Play an audio file that has previously been loaded with a call to loadAudio or preloadAudio
     * @param {string} file The file name for the audio object. This must be the same string that was used in a previous call to loadAudio or preloadAudio
     * @param {boolean} [looping] Whether to repeat the audio when it's over
     * @param {function} [callback] A function to call when the sound is finished playing
     * @returns {number} a unique identifier of the audio source that is being played. A value of -1 indicates that there has been an error, e.g. the audio file was not loaded and ready to play
     */
    this.playAudio = function(file, looping, callback)
    {
        if (this.getLoadingStatus(this.getFullPathAndFileName(file)) != 'ok')
        {
            return -1;
        }

        var audio = this.getAudio(file);
        if (audioContext)
        {
            var source = audioContext.createBufferSource();
            source.buffer = audio;
            source.loop = !!looping;
            source.connect(audioContext.destination);
            source.endEventFired = false;
            source.onended = function()
            {
                source.endEventFired = true;
                if (callback)
                {
                    callback();
                    callback = null;
                }
            };
            source.start(0);
            audioSources.push(source);
            if (callback && !looping)
            {
                var checkIfFinished = function ()
                {
                    if (source.playbackState != source.FINISHED_STATE)
                    {
                        setTimeout(checkIfFinished, wade.c_timeStep);
                    }
                    else if (source.onended && !source.endEventFired)
                    {
                        source.endEventFired = true;
                        source.onended();
                    }
                };
                source.checkEnded = setTimeout(checkIfFinished, source.buffer.duration * 1000 + wade.c_timeStep);
            }
        }
        else
        {
            if (audio.alreadyPlayed && !audio.ended)
            {
                audio = new Audio(audio.src);
                this.setAudio(file, audio);
            }
            audio.loop = looping;
            audio.alreadyPlayed = true;
            if (looping)
            {
                audio.addEventListener('ended', function() {this.currentTime = 0; this.play();}, false);
            }
            audio.play();
            audioSources.push(audio);
        }
        return audioSources.length;
    };

    /**
     * Stop an audio file that was playing
     * @param {number} [uid] The unique identifier of the audio source that you want to stop playing. If omitted, all sources will be stopped
     */
    this.stopAudio = function(uid)
    {
        if (typeof(uid) == 'undefined')
        {
            for (var i=0; i<audioSources.length; i++)
            {
                if (audioSources[i])
                {
                    audioSources[i].stop();
                    audioSources[i].checkEnded && clearTimeout(audioSources[i].checkEnded);
                }
            }
        }
        else
        {
            var source = audioSources[uid-1];
            if (source)
            {
                source.stop();
                source.checkEnded && clearTimeout(source.checkEnded);
            }
        }
    };

    /**
     * Play a segment of an audio file
     * @param {string} file The file name for the audio object. This must be the same string that was used in a previous call to loadAudio or preloadAudio
     * @param {number} [start] The starting point, in seconds. If omitted or falsy, the sound will be played from the beginning
     * @param {number} [end] The ending point, in seconds. If omitted or falsy, the sound is played from the start position to the end of the source file.
     * @param {function} [callback] A function to call when the ending point is reached
     * @returns {number} a unique identifier of the audio source that is being played. A value of -1 indicates that there has been an error, e.g. the audio file was not loaded and ready to play
     */
    this.playAudioSegment = function(file, start, end, callback)
    {
        if (this.getLoadingStatus(this.getFullPathAndFileName(file)) != 'ok')
        {
            return -1;
        }

        start = start || 0;
        var audio = this.getAudio(this.getFullPathAndFileName(file));
        if (audioContext)
        {
            var source = audioContext.createBufferSource();
            source.buffer = audio;
            source.connect(audioContext.destination);
            source.endEventFired = false;
            source.onended = function()
            {
                source.endEventFired = true;
                if (callback)
                {
                    callback();
                    callback = null;
                }
            };
            source.start(0, start);
            if (callback)
            {
                var checkIfFinished = function ()
                {
                    if (source.playbackState != source.FINISHED_STATE)
                    {
                        setTimeout(checkIfFinished, wade.c_timeStep);
                    }
                    else if (source.onended && !source.endEventFired)
                    {
                        source.endEventFired = true;
                        source.onended();
                    }
                };
                source.checkEnded = setTimeout(checkIfFinished, (source.buffer.duration - start) * 1000 + wade.c_timeStep);
            }
            end && source.stop(end);
            audioSources.push(source);
        }
        else
        {
            end = end || audio.duration;
            var endFunction = function()
            {
                if (this.currentTime >= end)
                {
                    this.pause();
                    this.ended = true;
                    callback && callback();
                }
            };
            if (audio.alreadyPlayed && !audio.ended)
            {
                audio = new Audio(audio.src);
            }
            audio.addEventListener('timeupdate', endFunction, false);
            audio.alreadyPlayed = true;
            audio.play();
            audioSources.push(audio);
        }
        return audioSources.length-1;
    };

    /**
     * Load a font file. Although the loading happens asynchronously, the simulation is suspended until this operation is completed.<br/>
     * If a loading screen has ben set, it will be shown during the loading.<br/>
     * See preloadFont for an equivalent operation that happens in the background without suspending the simulation.
     * @param {string} file A fonr file to load (.woff files are universally supported, other format may be supported depending on the browser). It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {function} [callback] A callback to execute when the file is loaded
     * @param {function} [errorCallback] A callback to execute when the font cannot be loaded
     */
    this.loadFont = function(file, callback, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.loadFont(fileName, callback, errorCallback);
    };

    /**
     * Load a font file asynchronously, without suspending the simulation.
     * @param {string} file A font file to load (.woff files are universally supported, other format may be supported depending on the browser). It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @param {function} [callback] A callback to execute when the file is loaded
     * @param {function} [errorCallback] A callback to execute when the font cannot be loaded
     */
    this.preloadFont = function(file, callback, errorCallback)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetPreloader.loadFont(fileName, callback, errorCallback);
    };

    /**
     * Get the base64-encoded dataURL of a font
     * @param {string} file A font dataURL to access (it has to be data that has been set via wade.setFont() first). It can be a relative path, or an absolute path starting with "http://", "https://" or "//"
     * @returns {string} The dataURL of the font
     */
    this.getFont = function(file)
    {
        var fileName = this.getFullPathAndFileName(file);
        return assetLoader.getFont(fileName);
    };

    /**
     * Associate a file name with a font, so that any subsequent calls to getFont using the given file name will return that font.
     * @param {string} file The font file name
     * @param {string} [data] The dataURL of the font
     * @param {boolean} [setForPreloader] Whether to apply this operation to the asset preloader as well as the asset loader. This is false by default. If set to true, subsequent calls to wade.preloadFont will get this cached version of the data instead of loading it again in the background.
     */
    this.setFont = function(file, data, setForPreloader)
    {
        var fileName = this.getFullPathAndFileName(file);
        assetLoader.setFont(fileName, data);
        setForPreloader && assetPreloader.setFont(fileName, data);
    };

    /**
     * Get the current loading status of a file
     * @param {string} file The file name.
     * @returns {string | undefined} The loading status:<br/>
     * - 'loading' when the loading of the file is in progress<br/>
     * - 'ok' if the file was loaded with no problems<br/>
     * - 'error' if there were loading errors<br/>
     * - 'unknown' if WADE has never been requested to load the file
     */
    this.getLoadingStatus = function(file)
    {
        var fileName = this.getFullPathAndFileName(file);
        return assetLoader.getLoadingStatus(fileName);
    };

    /**
     * Create an instance of the user app. This function is called automatically when the main app script is finished loading.
     */
    this.instanceApp = function()
    {
        // create a new instance of the user app
        this.app = new App();
        this.app.appData = this._appData;

        // tell it to load its own assets
        if (this.app.load)
        {
            this.app.load();
        }
        appInitialised = false;
        appLoading = true;
    };

    /**
     * Initialize the user app. This function is called automatically when the main app is finished loading its assets.
     */
    this.initializeApp = function()
    {
        appInitialised = true;

        // call the init function of the user app
        if (!this.app.init)
        {
            wade.warn('Warning: Unable to initialize app. App.init function is missing.');
        }
        else
        {
            this.app.init();
        }

        // schedule app timer event
        pendingAppTimer = setTimeout(function() {wade.event_appTimerEvent();}, appTimerInterval * 1000);
    };

    /**
     * Returns the current state of all gamepads.
     * @returns {Array} An array listing all game pads. Each gamepad contains an axes and buttons array, allowing you to determine the exact state of each controller.
     */
    this.getGamepadData = function()
    {
        return inputManager.getGamepadData();
    };

    /**
     * Process a given event. A callback function with the same name as the event will be called for the objects that have been registered with addEventListener for this event.<br/>
     * Note that when a listener indicates that they have processed the event (by returning true in their callback), the event won't be passed to any more listeners.
     * @param {string} event The name of the event to process
     * @param {Object} [eventData] An object to be passed to all the callbacks that will be called
     * @returns {boolean} Whether any listener succesfully processed the event
     */
    this.processEvent = function(event, eventData)
    {
        return sceneManager.processEvent(event, eventData);
    };

    /**
     * Register a scene object to listen for all the events with a given name. When an event is triggered, a callback with the same name as the event will be called for this object and all its behaviors (when present).
     * When input events (such as onClick) occur outside the bounding boxes of the objects' sprites, the scene object will not receive the event.
     * @param {SceneObject} sceneObject A scene object that will be listening for the event
     * @param {string} event The name of the event to listen for
     */
    this.addEventListener = function(sceneObject, event)
    {
        sceneManager.addEventListener(sceneObject, event);
    };

    /**
     * Unregister an object that has previously been registered to listen for an event using addEventListener.
     * @param {SceneObject} sceneObject The scene object to unregister
     * @param {string} event The name of the event to stop listening for
     */
    this.removeEventListener = function(sceneObject, event)
    {
        sceneManager.removeEventListener(sceneObject, event);
    };

    /**
     * Check to see if a Scene Object is currently listening for a specific type of event
     * @param {SceneObject} sceneObject The scene object to check
     * @param {string} event The name of the event
     * @returns {boolean} Whether the scene object is currently listening for the event
     */
    this.isEventListener = function(sceneObject, event)
    {
        return sceneManager.isObjectListeneningForEvent(sceneObject, event);
    };

    /**
     * Register a scene object to listen for all the events with a given name. When an event is triggered, a callback with the same name as the event will be called for this object and all its behaviors (when present).
     * The scene object will receive events that occur outside the bounding boxes of the objects' sprites, where this is applicable (depending on the event type).
     * @param {SceneObject} sceneObject A scene object that will be listening to the event
     * @param {string} event The name of the event to listen for
     */
    this.addGlobalEventListener = function(sceneObject, event)
    {
        sceneManager.addGlobalEventListener(sceneObject, event);
    };

    /**
     * Unregister an object that has previously been registered to listen for an event using addGlobalEventListener.
     * @param {SceneObject} sceneObject The scene object to unregister
     * @param {string} event The name of the event to stop listenening for
     */
    this.removeGlobalEventListener = function(sceneObject, event)
    {
        sceneManager.removeGlobalEventListener(sceneObject, event);
    };

    /**
     * Get the current camera position.
     * @returns {Object} An object whose 'x', 'y' and 'z' fields represent the coordinates of the camera position in world space
     */
    this.getCameraPosition = function()
    {
        return sceneManager.renderer.getCameraPosition();
    };

    /**
     * Set a world space position for the camera.
     * @param {Object} pos An object whose 'x', 'y' and 'z' fields represent the coordinates of the camera position in world space
     */
    this.setCameraPosition = function(pos)
    {
        sceneManager.renderer.setCameraPosition(pos);
    };

    /**
     * Get the total simulation time, in seconds, since the app was started
     * @returns {number} The number of seconds the simulation has been running since the app was started
     */
    this.getAppTime = function()
    {
        return sceneManager.getAppTime();
    };

    /**
     * Get the current system clock time in millisecond. The accuracy will vary depending on the system, an accurate performance timer is used where available.
     * @returns {number} The current system clock time
     */
    this.getClockTime = function()
    {
        if (window.performance && window.performance.now)
        {
            return window.performance.now();
        }
        else
        {
            return (new Date()).getTime();
        }
    };

    /**
     * Set a custom interval for the 'onAppTimer' event. If this function is never called, the interval is 1 second by default.
     * @param {number} interval The number of seconds between 'onAppTimer' events
     */
    this.setAppTimerInterval = function(interval)
    {
        appTimerInterval = interval;
    };

    /**
     * Remove an object from an array based on the object's index into the array
     * @param {number} index The index of the object to remove
     * @param {Array} array The array that contains the object
     * @returns {Array} The array after the object has been removed
     */
    this.removeObjectFromArrayByIndex = function(index, array)
    {
        if (index >= 0)
        {
            var rest = array.slice(index + 1 || array.length);
            array.length = index;
            return array.push.apply(array, rest);
        }
        return array;
    };

    /**
     * Remove an object from an array
     * @param {Object} object The object to remove from the array
     * @param {Array} array The array that contains the object
     * @returns {Array} The array after the object has been removed
     */
    this.removeObjectFromArray = function(object, array)
    {
        var i = array.lastIndexOf(object);
        if (i != -1)
        {
            return this.removeObjectFromArrayByIndex(i, array);
        }
        return array;
    };

    /**
     * Add a scene object to the scene
     * @param {SceneObject} sceneObject The scene object to add to the scene
     * @param {boolean} [autoListen] This is true by default (if omitted), unless explicitly set to false or a falsy value. When it is true, WADE will set the object to automatically listen for any events for which handlers are defined on the object or any of its behaviors.
     * For example if the object has an onMouseDown function when it's added to the scene (or any of its behaviours has an onMouseDown function) and this parameter is true, the object will be set to listen for onMouseDown events automatically.
     * @param [params] This argument can be any type, is optional, and if present is passed to the onAddToScene event handler(s) for this object
     * @returns {SceneObject} The scene object that was just added to the scene, or null if it wasn't possible to add the object to the scene (due to constraints like grid type and coordinates)
     */
    this.addSceneObject = function(sceneObject, autoListen, params)
    {
        if (typeof(autoListen) == 'undefined')
        {
            autoListen = true;
        }
        sceneManager.addSceneObject(sceneObject, autoListen, params);
        return sceneObject;
    };

    /**
     * Remove a scene object from the scene
     * @param {SceneObject|string} sceneObject The object to remove from the scene. If the scene object that you want to remove has a name, you can use its name (a string) rather than a reference to the object itself.
     */
    this.removeSceneObject = function(sceneObject)
    {
        sceneManager.removeSceneObject(typeof(sceneObject) == 'string'? this.getSceneObject(sceneObject) : sceneObject);
    };

    /**
     * Remove multiple scene objects from the scene
     * @param {Array|SceneObjectGroup} sceneObjects An array of scene objects to remove from the scene
     */
    this.removeSceneObjects = function(sceneObjects)
    {
        for (var i=0; i<sceneObjects.length; i++)
        {
            sceneManager.removeSceneObject(sceneObjects[i]);
        }
    };

    /**
     * Remove all the scene objects from the scene
     */
    this.clearScene = function()
    {
        sceneManager.clear();
    };

    /**
     * Get the sorting method that is currently being used for the layer
     * @param {number} layerId The layer id
     * @returns {string|function} A user specified function that was previously set with setLayerSorting, or a string indicating one of the built-in types of sorting: 'bottomToTop', 'topToBottom', 'none'.<br/>
     * The default value for a layer sorting method is 'none'.
     */
    this.getLayerSorting = function(layerId)
    {
        return sceneManager.renderer.getLayerSorting(layerId);
    };

    /**
     * Set the sorting method to use for a specified layer
     * @param {number} layerId The layer id
     * @param {string|function} sortingType A user-defined function to use for sorting the layer, or a string indicating one of the built-in types of sorting: 'bottomToTop', 'topToBottom', 'none'.<br/>
     * A sorting function looks like 'function sort(a, b)' where 'a' and 'b' are two sprites. The function returns a negative number if 'a' needs to be drawn before 'b', and a positive number otherwise.<br/>
     * The default sorting type is 'none', which means that objects will be drawn in the order they were added to the scene
     */
    this.setLayerSorting = function(layerId, sortingType)
    {
        sceneManager.renderer.setLayerSorting(layerId, sortingType);
    };

    /**
     * Set a coordinate transformation for the layer. This will determine how the objects in the layer are rotated and translated when the camera moves
     * @param {number} layerId The layer id
     * @param {number} scale The scale transformation factor. The default value is 1. A value of 0 indicates that no scaling will occur when the camera moves. Higher values indicate more scaling.
     * @param {number} translate The transformation factor. The default value is 1. A value of 0 indicates that no translation will occur when the camera moves.  Higher values indicate larger translations.
     */
    this.setLayerTransform = function(layerId, scale, translate)
    {
        sceneManager.renderer.setLayerTransform(layerId, scale, translate);
    };

    /**
     * Set the resolution factor for a specific layer
     * @param {number} layerId The layer id
     * @param {number} resolutionFactor The resolution factor. It must be > 0. 1 indicates full resolution, < 1 lower resolution, > 1 higher resolution.
     */
    this.setLayerResolutionFactor = function(layerId, resolutionFactor)
    {
        sceneManager.renderer.setLayerResolutionFactor(layerId, resolutionFactor);
    };

    /**
     * Get the resolution factor for a specific  layer
     * @param {number} layerId The layer id
     * @returns {number} The resolution factor of the layer
     */
    this.getLayerResolutionFactor = function(layerId)
    {
        return sceneManager.renderer.getLayerResolutionFactor(layerId);
    };

    /**
     * Set the resolution factor for all layers
     * @param {number} _resolutionFactor The resolution factor. It must be > 0. 1 indicates full resolution, < 1 lower resolution, > 1 higher resolution.
     */
    this.setResolutionFactor = function(_resolutionFactor)
    {
        resolutionFactor = _resolutionFactor;
        sceneManager.renderer.setResolutionFactor(resolutionFactor);
    };

    /**
     * Get the current global resolution factor. Note that resolution factors of individual layers may be different, if they were set through setLayerResolutionFactor
     * @returns {number} The global resolution factor
     */
    this.getResolutionFactor = function()
    {
        return resolutionFactor;
    };

    /**
     * Get the width of the current render area
     * @returns {number} The width of the current render area
     */
    this.getScreenWidth = function()
    {
        return sceneManager.renderer.getScreenWidth();
    };

    /**
     * Get the hight of the current render area
     * @returns {number} The height of the current render area
     */
    this.getScreenHeight = function()
    {
        return sceneManager.renderer.getScreenHeight();
    };

    /**
     * Set the size of the render area. Note that, depending on the current window mode, changing the size of the render area may have no actual effect, although an onResize event will always be fired if the width and height specified are not the same as the current ones.
     * @param {number} width The width of the render area
     * @param {number} height The height of the render area
     */
    this.setScreenSize = function(width, height)
    {
        sceneManager.renderer.setScreenSize(width, height);
    };

    /**
     * Get the width of the window that contains the app
     * @returns {number} The width of the window that contains the app
     */
    this.getContainerWidth = function()
    {
        return this.isScreenRotated()? window.innerHeight : window.innerWidth;
    };

    /**
     * Get the height of the window that contains the app
     * @returns {number} The height of the window that contains the app
     */
    this.getContainerHeight = function()
    {
        return this.isScreenRotated()? window.innerWidth : window.innerHeight;
    };

    /**
     * Determine whether the canvas (or the portions of it that have changed) should be cleared between frames. This happens by default but, where possible, you may want to disable the clearing to improve performance.
     * @param {number} layerId The layer id
     * @param {boolean} toggle Whether to clear the canvas between frames
     */
    this.setCanvasClearing = function(layerId, toggle)
    {
        sceneManager.renderer.setCanvasClearing(layerId, toggle);
    };

    /**
     * Set the current window mode. This determines how the render area will be resized when the parent window is resized.
     * @param {string} mode The window mode. Valid values are:<br/>
     * 'full' - The render area will be resized to cover the whole window, as long as it's between the minimum and maximum screen sizes (see setMinScreenSize and setMaxScreenSize)<br/>
     * 'stretchToFit' - The render area will be resized to cover as much as possible of the parent window, without changing its aspect ratio<br/>
     * any other string - The render area will never be resized<br/>
     * The default value is 'full'
     */
    this.setWindowMode = function(mode)
    {
        sceneManager.renderer.setWindowMode(mode);
    };

    /**
     * Get the current window mode.
     * @returns {string} The current window mode.
     */
    this.getWindowMode = function()
    {
        return sceneManager.renderer.getWindowMode();
    };

    /**
     * Open a web page in the app's window.
     * @param {string} url The address of the web page to open
     */
    this.loadPage = function(url)
    {
        window.self.location = url;
    };

    /**
     * Clone an object
     * @param {Object} object The object to clone
     * @returns {Object} A clone of the original object
     */
    this.cloneObject = function(object)
    {
        return wade.extend(true, {}, object);
    };

    /**
     * Clone an array
     * @param {Array} array The array to clone
     * @returns {Array} A clone of the original array
     */
    this.cloneArray = function(array)
    {
        return wade.extend(true, [], array);
    };

    /**
     * Enable or disable the simulation of a scene object
     * @param {SceneObject} sceneObject The scene object
     * @param {boolean} toggle Whether to enable the simulation
     */
    this.simulateSceneObject = function(sceneObject, toggle)
    {
        if (toggle)
        {
            if (!sceneObject.simulated)
            {
                sceneManager.addEventListener(sceneObject, 'onSimulationStep');
                sceneObject.simulated = true;
            }
        }
        else
        {
            if (sceneObject.simulated)
            {
                sceneManager.removeEventListener(sceneObject, 'onSimulationStep');
                sceneObject.simulated = false
            }
        }
    };

    /**
     * Set the maximum width and height of the render area. When the window mode is set to full, even when the render area is automatically resized it will never be larger than the specified dimensions.<br/>
     * The default values are 1920 and 1080
     * @param {number} width The maximum width of the render area
     * @param {number} height The maximum height of the render area
     */
    this.setMaxScreenSize = function(width, height)
    {
        sceneManager.renderer.setMaxScreenSize(width, height);
    };

    /**
     * Get the maximum width of the render area
     * @returns {number} The maximum width of the render area, as set with the last call to <i>setMaxScreenWidth</i>, or 1920 by default
     */
    this.getMaxScreenWidth = function()
    {
        return sceneManager.renderer.getMaxScreenWidth();
    };

    /**
     * Get the maximum height of the render area
     * @returns {number} The maximum height of the render area, as set with the last call to <i>setMaxScreenHeight</i>, or 1080 by default
     */
    this.getMaxScreenHeight = function()
    {
        return sceneManager.renderer.getMaxScreenHeight();
    };

    /**
     * Set the minimum width and height of the render area. When the window mode is set to full, even when the render area is automatically resized it will never be smaller than the specified dimensions.<br/>
     * The default values are 0 and 0
     * @param {number} width The minimum width of the render area
     * @param {number} height The minimum height of the render area
     */
    this.setMinScreenSize = function(width, height)
    {
        return sceneManager.renderer.setMinScreenSize(width, height);
    };

    /**
     * Get the minimum width of the render area
     * @returns {number} The minimum width of the render area, as set with the last call to <i>setMinScreenWidth</i>, or 0 by default
     */
    this.getMinScreenWidth = function()
    {
        return sceneManager.renderer.getMinScreenWidth();
    };

    /**
     * Get the minimum height of the render area
     * @returns {number} The minimum height of the render area, as set with the last call to <i>setMinScreenHeight</i>, or 0 by default
     */
    this.getMinScreenHeight = function()
    {
        return sceneManager.renderer.getMinScreenHeight();
    };

    /**
     * Create an HTML5 canvas object and add it to the document
     * @param {number} [resolutionFactor] Resolution relative to the the other canvas objects. 1 is full resolution, < 1 is lower resolution, > 1 is higher resolution. Default is 1. How this relates to the number of logical pixels in the canvas depends on the current window mode.
     * @returns {HTMLElement}
     */
    this.createCanvas = function(resolutionFactor)
    {
        resolutionFactor = resolutionFactor || 1;

        // get the main canvas object to copy some properties from it
        var mainCanvas = document.getElementById(containerDiv);
        var container = document.getElementById(containerDiv);
        var mainWidth = parseInt(container.getAttribute("width"));
        var mainHeight = parseInt(container.getAttribute("height"));

        // create a new canvas object
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(mainWidth * resolutionFactor);
        canvas.height = Math.round(mainHeight * resolutionFactor);
        canvas.style.position = mainCanvas.style.position;
        canvas.style.margin = 'auto';
        canvas.style.top = 0;
        canvas.style.left = 0;
        canvas.style.right = 0;
        canvas.style.bottom = 0;
        canvas.style['backfaceVisibility'] = canvas.style['WebkitBackfaceVisibility'] = canvas.style['MozBackfaceVisibility'] = canvas.style['OBackfaceVisibility'] = 'hidden';

        // calculate css width and height relative to the main canvas
        var w = canvas.style.width.toString().toLowerCase();
        var h = canvas.style.height.toString().toLowerCase();
        if (w == h && w == 'auto')
        {
            canvas.style.width = mainWidth + 'px';
            canvas.style.height = mainHeight + 'px';
        }
        else
        {
            canvas.style.width = mainCanvas.style.width;
            canvas.style.height = mainCanvas.style.height;
        }

        // set css transform
        canvas.style['MozTransform'] =  canvas.style['msTransform'] = canvas.style['OTransform'] = canvas.style['WebkitTransform'] = canvas.style['transform'] = 'translate3d(0,0,0)';

        // add the canvas to the html document
        mainCanvas.appendChild(canvas);
        return canvas;
    };

    /**
     * Delete all the canvas objects created by WADE
     */
    this.deleteCanvases = function()
    {
        sceneManager.renderer.removeCanvases();
    };

    /**
     * Recreate canvas objects that were delete with a call to wade.deleteCanvases
     */
    this.recreateCanvases = function()
    {
        sceneManager.renderer.recreateCanvases();
    };

    /**
     * Checks whether the init function for the app has been executed
     */
    this.isAppInitialized = function()
    {
        return appInitialised;
    };

    /**
     * Check whether box1 contains box2
     * @param {Object} box1 An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @param {Object} box2 An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @returns {boolean} Whether box1 contains box2
     */
    this.boxContainsBox = function(box1, box2)
    {
        return (box1.minX < box2.minX && box1.maxX > box2.maxX && box1.minY < box2.minY && box1.maxY > box2.maxY);
    };

    /**
     * Check whether box1 and box2 intersect each other
     * @param {Object} box1 An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @param {Object} box2 An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @returns {boolean} Whether box1 and box2 intersect each other
     */
    this.boxIntersectsBox = function(box1, box2)
    {
        return !(box1.maxX < box2.minX || box1.minX > box2.maxX || box1.maxY < box2.minY || box1.minY > box2.maxY);
    };

    /**
     * Check whether a box contains a point
     * @param {Object} box An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @param {Object} point An object with the following fields: 'x', 'y'
     * @returns {boolean} Whether box contains point
     */
    this.boxContainsPoint = function(box, point)
    {
        return (point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY);
    };

    /**
     * Check whether an oriented box contains a point
     * @param {Object} ob An object with 'centerX' and 'centerY' fields representing its center coordinates, and the following fields:<br/>
     * 'axisXx' and 'axisXy' represent the rotated X axis (the Width axis) of the rectangle in world-space coordinates. The length of the axisX vector must be half the width of the rectangle.<br/>
     * 'axisYx' and 'axisYy' represent the rotated Y axis (the Height axis) of the rectangle in world-space coordinates. The length of the axisY vector must be half the height of the rectangle.
     * @param {Object} point An object with the following fields: 'x', 'y'
     * @returns {boolean} Whether orientedBox contains point
     */
    this.orientedBoxContainsPoint = function(ob, point)
    {
        var s = Math.sin(ob.rotation);
        var c = Math.cos(ob.rotation);
        var dx = point.x - ob.centerX;
        var dy = point.y - ob.centerY;
        var x = c * dx + s * dy;
        var y = c * dy - s * dx;
        return (x >= -ob.halfWidth && x <= ob.halfWidth && y >= -ob.halfHeight && y <= ob.halfHeight);
    };

    /**
     * Check whether two oriented boxes intersect each other. Each box must be an object with 'centerX' and 'centerY' fields representing its center coordinates, and the following fields:<br/>
     * 'axisXx' and 'axisXy' represent the rotated X axis (the Width axis) of the rectangle in world-space coordinates. The length of the axisX vector must be half the width of the rectangle.<br/>
     * 'axisYx' and 'axisYy' represent the rotated Y axis (the Height axis) of the rectangle in world-space coordinates. The length of the axisY vector must be half the height of the rectangle.
     * @param {Object} ob1 An oriented box
     * @param {Object} ob2 The other oriented box
     * @returns {boolean} Whether the two boxes intersect each other
     */
    this.orientedBoxIntersectsOrientedBox = function(ob1, ob2)
    {
        var tx = ob2.centerX - ob1.centerX;
        var ty = ob2.centerY - ob1.centerY;
        var axx = ob1.axisXx;
        var axy = ob1.axisXy;
        var ayx = ob1.axisYx;
        var ayy = ob1.axisYy;
        var bxx = ob2.axisXx;
        var bxy = ob2.axisXy;
        var byx = ob2.axisYx;
        var byy = ob2.axisYy;
        return !(Math.abs(tx * axx + ty * axy) > axx * axx + axy * axy + Math.abs(bxx * axx + bxy * axy) + Math.abs(byx * axx + byy * axy) ||
        Math.abs(tx * ayx + ty * ayy) > ayx * ayx + ayy * ayy + Math.abs(bxx * ayx + bxy * ayy) + Math.abs(byx * ayx + byy * ayy) ||
        Math.abs(tx * bxx + ty * bxy) > bxx * bxx + bxy * bxy + Math.abs(bxx * axx + bxy * axy) + Math.abs(bxx * ayx + bxy * ayy) ||
        Math.abs(tx * byx + ty * byy) > byx * byx + byy * byy + Math.abs(byx * axx + byy * axy) + Math.abs(byx * ayx + byy * ayy));
    };

    /**
     * Check whether an axis-aligned box and an oriented box overlap each other.
     * @param {Object} box An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @param {Object} ob An object with 'centerX' and 'centerY' fields representing its center coordinates, and the following fields:<br/>
     * 'axisXx' and 'axisXy' represent the rotated X axis (the Width axis) of the rectangle in world-space coordinates. The length of the axisX vector must be half the width of the rectangle.<br/>
     * 'axisYx' and 'axisYy' represent the rotated Y axis (the Height axis) of the rectangle in world-space coordinates. The length of the axisY vector must be half the height of the rectangle.
     * @returns {boolean}
     */
    this.boxIntersectsOrientedBox = function(box, ob)
    {
        var tx = (box.minX + box.maxX) / 2 - ob.centerX;
        var ty = (box.minY + box.maxY) / 2 - ob.centerY;
        var axx = (box.maxX - box.minX) / 2;
        var ayy = (box.maxY - box.minY) / 2;
        var bxx = ob.axisXx;
        var bxy = ob.axisXy;
        var byx = ob.axisYx;
        var byy = ob.axisYy;
        return !(Math.abs(tx * axx) > axx * axx + Math.abs(bxx * axx) + Math.abs(byx * axx) ||
        Math.abs(ty * ayy) > ayy * ayy + Math.abs(bxy * ayy) + Math.abs(byy * ayy) ||
        Math.abs(tx * bxx + ty * bxy) > bxx * bxx + bxy * bxy + Math.abs(bxx * axx) + Math.abs(bxy * ayy) ||
        Math.abs(tx * byx + ty * byy) > byx * byx + byy * byy + Math.abs(byx * axx) + Math.abs(byy * ayy));
    };

    /**
     * Check whether an axis-aligned box and an oriented box overlap each other.
     * @param {Object} box An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @param {Object} ob An object with 'centerX' and 'centerY' fields representing its center coordinates, and the following fields:<br/>
     * 'axisXx' and 'axisXy' represent the rotated X axis (the Width axis) of the rectangle in world-space coordinates. The length of the axisX vector must be half the width of the rectangle.<br/>
     * 'axisYx' and 'axisYy' represent the rotated Y axis (the Height axis) of the rectangle in world-space coordinates. The length of the axisY vector must be half the height of the rectangle.
     * @returns {boolean}
     */
    this.orientedBoxIntersectsBox = function(ob, box)
    {
        return this.boxIntersectsOrientedBox(box, ob);
    };

    /**
     * Expand box1 so that it encompasses both box1 and box2
     * @param {Object} box1 An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @param {Object} box2 An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     */
    this.expandBox = function(box1, box2)
    {
        box1.minX = Math.min(box1.minX, box2.minX);
        box1.minY = Math.min(box1.minY, box2.minY);
        box1.maxX = Math.max(box1.maxX, box2.maxX);
        box1.maxY = Math.max(box1.maxY, box2.maxY);
    };

    /**
     * Resize box1 so that it's fully contained in box2
     * @param {Object} box1 An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     * @param {Object} box2 An object representing a box with the following fields: 'minX', 'minY', 'maxX', 'maxY'
     */
    this.clampBoxToBox = function(box1, box2)
    {
        box1.minX = Math.min(box2.maxX, Math.max(box1.minX , box2.minX));
        box1.minY = Math.min(box2.maxY, Math.max(box1.minY , box2.minY));
        box1.maxX = Math.max(box2.minX, Math.min(box1.maxX , box2.maxX));
        box1.maxY = Math.max(box1.minY, Math.min(box1.maxY , box2.maxY));
    };

    /**
     * Send an object to a server. The object is serialized to JSON before being sent.
     * @param {string} url The web address to send the object to
     * @param {Object} object A javascript object to send
     * @param {function} callback A function to call when the server replies
     * @param {Object} extraParameters An object containing extra parameters to send together with the object (for example a cookie for csrf prevention)
     */
    this.postObject = function(url, object, callback, extraParameters)
    {
        var dataObject = {data: JSON.stringify(object)};
        if (extraParameters)
        {
            wade.extend(dataObject, extraParameters);
        }
        dataObject = JSON.stringify(dataObject);
        this.ajax({
            type: 'POST',
            url: url,
            data: dataObject,
            success: callback,
            dataType: 'json'
        });
    };

    /**
     * Set a callback to be executed when all the pending loading requests terminate. Note that preloading requests are ignored for this purpose.
     * @param {function} callback A callback to be executed when all the pending loading requests terminate
     */
    this.setGlobalLoadingCallback = function(callback)
    {
        assetLoader.setGlobalCallback(callback);
    };

    /**
     * Set or remove a callback to be executed after each simulation step. Callbacks can be named, and you can have multiple ones active at the same time (although only one for each name).
     * @param {function} [callback] The function to be executed after each simulation step. You can use a falsy value here (such as 0) to disable the callback
     * @param {string} [name] The name you want to give to the callback. Subsequent calls to setMainLoop() with the same name, will replace the callback you are setting now.
     * @param {number} [priority] When there are multiple callbacks, they will be executed in descending order of priority. Default is 0
     */
    this.setMainLoop = function(callback, name, priority)
    {
        name = name || '_wade_default';
        priority = priority || 0;
        for (var i=0; i<mainLoopCallbacks.length && (mainLoopCallbacks[i].name != name); i++) {}
        mainLoopCallbacks[i] = {func: callback, name: name, priority: priority};
        mainLoopCallbacks.sort(function(a, b) {return b.priority - a.priority;});
    };

    /**
     * Get the status of any main loop callback with the giving name
     * @param {string} name The name of the main loop
     * @returns {{func: function, name: string, priority: number}} The status of the main loop callback, or null if no match is found
     */
    this.getMainLoop = function(name)
    {
        for (var i=0; i<mainLoopCallbacks.length && (mainLoopCallbacks[i].name != name); i++) {}
        return mainLoopCallbacks[i] || null;
    };

    /**
     * Set the loading image(s) to be displayed while loading data
     * @param {string|Array} files An image file name, or an array of image file names. These images don't need to be loaded using loadImage
     * @param {string} [link] An URL to open when the loading image is clicked. The link is opened in a new window (or tab).
     */
    this.setLoadingImages = function(files, link)
    {
        for (var i=0; i<loadingImages.length; i++)
        {
            document.body.removeChild(loadingImages[i]);
        }
        loadingImages.length = 0;

        if (!wade.isArray(files))
        {
            files = [files];
        }
        for (i=0; i<files.length; i++)
        {
            // create a loading image
            var loadingImage = document.createElement('img');
            loadingImage.className = 'loadingImage_class';
            loadingImage.style.display = 'none';
            var div = document.getElementById('container');
            document.body.insertBefore(loadingImage, div);

            // point it to the specified file name
            var file = files[i];
            loadingImage.src = this.getFullPathAndFileName(file);
            loadingImages.push(loadingImage);

            // if there's a link associated with the loading images, add an event listener
            if (link)
            {
                loadingImage.addEventListener('click', function()
                {
                    window.open(link, '_blank');
                });
            }
        }
    };

    /**
     * Transform a world space position into screen space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} position An object whose 'x' and 'y' fields represent a world space position
     * @returns {Object} An object whose 'x' and 'y' fields represent a screen space position
     */
    this.worldPositionToScreen = function(layerId, position)
    {
        return sceneManager.renderer.worldPositionToScreen(layerId, position);
    };

    /**
     * Transform a world space direction into screen space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} direction An object whose 'x' and 'y' fields represent a world space direction
     * @returns {Object} An object whose 'x' and 'y' fields represent a screen space direction
     */
    this.worldDirectionToScreen = function(layerId, direction)
    {
        return sceneManager.renderer.worldDirectionToScreen(layerId, direction);
    };

    /**
     * Transform a world space box into screen space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} box An object whose 'minX', 'minY', 'maxX' and 'maxY' fields represent a world space box
     * @returns {Object} An object whose 'minX', 'minY', 'maxX' and 'maxY' fields represent a screen space box
     */
    this.worldBoxToScreen = function(layerId, box)
    {
        return sceneManager.renderer.worldBoxToScreen(layerId, box);
    };

    /**
     * Get the size (in screen pixels) of a world-space unit
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @returns {number} The size of a world-space unit in screen pixels
     */
    this.worldUnitToScreen = function(layerId)
    {
        return sceneManager.renderer.worldUnitToScreen(layerId);
    };

    /**
     * Transform a screen space position into world space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} position An object whose 'x' and 'y' fields represent a screen space position
     * @returns {Object} An object whose 'x' and 'y' fields represent a world space position
     */
    this.screenPositionToWorld = function(layerId, position)
    {
        return sceneManager.renderer.screenPositionToWorld(layerId, position);
    };

    /**
     * Transform a screen space direction into world space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} direction An object whose 'x' and 'y' fields represent a screen space direction
     * @returns {Object} An object whose 'x' and 'y' fields represent a world space direction
     */
    this.screenDirectionToWorld = function(layerId, direction)
    {
        return sceneManager.renderer.screenDirectionToWorld(layerId, direction);
    };

    /**
     * Transform a screen space box into world space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} box An object whose 'minX', 'minY', 'maxX' and 'maxY' fields represent a screen space box
     * @returns {Object} An object whose 'minX', 'minY', 'maxX' and 'maxY' fields represent a world space box
     */
    this.screenBoxToWorld = function(layerId, box)
    {
        return sceneManager.renderer.screenBoxToWorld(layerId, box);
    };

    /**
     * Get the size of a screen pixel in world-space units
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @returns {number} The size of a screen pixel in world-space units
     */
    this.screenUnitToWorld = function(layerId)
    {
        return sceneManager.renderer.screenUnitToWorld(layerId);
    };

    /**
     * Transform a world space position into canvas space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} position An object whose 'x' and 'y' fields represent a world space position
     * @returns {Object} An object whose 'x' and 'y' fields represent a canvas space position
     */
    this.worldPositionToCanvas = function(layerId, position)
    {
        return sceneManager.renderer.worldPositionToCanvas(layerId, position);
    };

    /**
     * Transform a world space direction into canvas space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} direction An object whose 'x' and 'y' fields represent a world space direction
     * @returns {Object} An object whose 'x' and 'y' fields represent a canvas space direction
     */
    this.worldDirectionToCanvas = function(layerId, direction)
    {
        return sceneManager.renderer.worldDirectionToCanvas(layerId, direction);
    };

    /**
     * Transform a world space box into canvas space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} box An object whose 'minX', 'minY', 'maxX' and 'maxY' fields represent a world space box
     * @returns {Object} An object whose 'minX', 'minY', 'maxX' and 'maxY' fields represent a canvas space box
     */
    this.worldBoxToCanvas = function(layerId, box)
    {
        return sceneManager.renderer.worldBoxToCanvas(layerId, box);
    };

    /**
     * Get the size (in canvas pixels) of a world-space unit
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @returns {number} The size of a world-space unit in canvas pixels
     */
    this.worldUnitToCanvas = function(layerId)
    {
        return sceneManager.renderer.worldUnitToCanvas(layerId);
    };

    /**
     * Transform a canvas space position into world space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} position An object whose 'x' and 'y' fields represent a canvas space position
     * @returns {Object} An object whose 'x' and 'y' fields represent a world space position
     */
    this.canvasPositionToWorld = function(layerId, position)
    {
        return sceneManager.renderer.canvasPositionToWorld(layerId, position);
    };

    /**
     * Transform a canvas space direction into world space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} direction An object whose 'x' and 'y' fields represent a canvas space direction
     * @returns {Object} An object whose 'x' and 'y' fields represent a world space direction
     */
    this.canvasDirectionToWorld = function(layerId, direction)
    {
        return sceneManager.renderer.canvasDirectionToWorld(layerId, direction);
    };

    /**
     * Transform a canvas space box into world space
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @param {Object} box An object whose 'minX', 'minY', 'maxX' and 'maxY' fields represent a canvas space box
     * @returns {Object} An object whose 'minX', 'minY', 'maxX' and 'maxY' fields represent a world space box
     */
    this.canvasBoxToWorld = function(layerId, box)
    {
        return sceneManager.renderer.canvasBoxToWorld(layerId, box);
    };

    /**
     * Get the size of a canvas pixel in world-space units
     * @param {number} layerId The id of the layer to use. This determines the translation and scale factors to use in the transformation.
     * @returns {number} The size of a canvas pixel in world-space units
     */
    this.canvasUnitToWorld = function(layerId)
    {
        return sceneManager.renderer.canvasUnitToWorld(layerId);
    };

    /**
     * Set the minimum time between input events of the same type. Events occurring before the specified interval will be ignored.
     * @param {string} type The input event type. Valid values are 'mouseDown', 'mouseUp', 'mouseMove' and 'mouseWheel'
     * @param {number} interval The minimum interval between events of the same type, in milliseconds
     */
    this.setMinimumInputEventInterval = function(type, interval)
    {
        inputManager.setMinimumIntervalBetweenEvents(type, interval);
    };

    /**
     * Check whether a mouse button is currently pressed. For touch-screen devices, the return value represents whether the screen is being touched
     * @param {number} [buttonId] Which mouse button to check (0 for left, 1 for middle, 2 for right). If omitted, the function returns true if any mouse button (or touch pointer) is pressed.
     * @returns {boolean} Whether a mouse button is pressed
     */
    this.isMouseDown = function(buttonId)
    {
        return inputManager.isMouseDown(buttonId);
    };

    /**
     * Check whether a key is currently down (it's being pressed by the user).
     * @param {number|string} keyCode The code of the key to check (as a number), or a string representing a key name (for example 'left', 'space', 'x')
     * @returns {boolean} Whether the key is pressed
     */
    this.isKeyDown = function(keyCode)
    {
        return inputManager.isKeyDown(keyCode);
    };

    /**
     * Create a separate image (more specifically an off-screen canvas) for each sprite in the sprite sheet
     * @param {string} spriteSheet The path of the input sprite sheet
     * @param {Array} [destinations] An array with the virtual paths for the single images, that can later be used to retrieve the canvas objects via wade.getImage(). If omitted, destination images will be called [spriteSheetName]_0, [spriteSheetName]_1, [spriteSheetName]_2, etc.
     * @param {number} [numCellsX=1] The number of horizontal cells
     * @param {number} [numCellsY=1] The number of vertical cells
     * @param {boolean} [unload] Whether to unload the sprite sheet after unpacking
     */
    this.unpackSpriteSheet = function(spriteSheet, destinations, numCellsX, numCellsY, unload)
    {
        numCellsX = numCellsX || 1;
        numCellsY = numCellsY || 1;
        var sheetImage = this.getImage(spriteSheet);
        var width = sheetImage.width / numCellsX;
        var height = sheetImage.height / numCellsY;
        for (var i=0; i<destinations.length && i < numCellsX * numCellsY; i++)
        {
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var animation  = new Animation(spriteSheet, numCellsX, numCellsY, 1, false, i, i);
            animation.draw(canvas.getContext('2d'), {x: width / 2, y: height / 2}, {x: width, y: height});
            wade.setImage((destinations[i] || (spriteSheet + '_' + i)), canvas);
        }
        unload && this.unloadImage(spriteSheet);
    };

    /**
     * Store an object or array in the local storage. Note that the object must be serializable, so you cannot store objects with cyclic references
     * @param {string} name The name to give the object. This can later be used with a call to retrieveLocalObject
     * @param {object|Array} object The object to store
     */
    this.storeLocalObject = function(name, object)
    {
        localStorage.setItem(name, JSON.stringify(object));
    };

    /**
     * Retrieve an object from the local storage, that has previously been saved through storeLocalObject()
     * @param {string} name The name of the object to retrieve
     */
    this.retrieveLocalObject = function(name)
    {
        var object = localStorage.getItem(name);
        return (object && JSON.parse(object));
    };

    /**
     * Toggle full screen mode. Note that not all browsers support this, so it may fail. Also, call this from an onMouseUp or onClick event to increase the chances of success.
     * @param {boolean} [toggle] Whether to enable or disable full screen mode. If not specified, "true" is assumed.
     */
    this.setFullScreen = function(toggle)
    {
        var element = document.documentElement;
        var f;
        if (toggle || typeof(toggle) == 'undefined')
        {
            f = element.requestFullScreen || element.requestFullscreen || element.mozRequestFullScreen || element.mozRequestFullscreen || element.webkitRequestFullScreen || element.webkitRequestFullscreen || element.msRequestFullScreen || element.msRequestFullscreen;
        }
        else
        {
            element = document;
            f = element.exitFullscreen || element.msExitFullscreen || element.mozCancelFullScreen || element.webkitCancelFullScreen;
        }
        f && f.call(element);
    };

    /**
     * Enable or disable image smoothing for a specific layer. This determines the type of filtering that is applied to stretched images (nearest-neighbor filtering is used when smoothing is disabled). Note that smoothing is true by default.
     * @param {number} layerId The id of the affected layer
     * @param {boolean} [toggle] Whether to enable or disable image smoothing for the layer. If not specified, "true" is assumed.
     */
    this.setLayerSmoothing = function(layerId, toggle)
    {
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        sceneManager.renderer.setLayerSmoothing(layerId, toggle);
    };

    /**
     * Get the current image smoothing state for a specific layer
     * @param layerId The layer id
     * @returns {boolean} The image smoothing state for the specified layer
     */
    this.getLayerSmoothing = function(layerId)
    {
        return sceneManager.renderer.getLayerSmoothing(layerId);
    };

    /**
     * Enable or disable image smoothing for all layers. This determines the type of filtering that is applied to stretched images (nearest-neighbor filtering is used when smoothing is disabled). Note that smoothing is true by default.
     * @param {boolean} [toggle] Whether to enable or disable image smoothing. If not specified, "true" is assumed.
     */
    this.setSmoothing = function(toggle)
    {
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        sceneManager.renderer.setSmoothing(toggle);
    };

    /**
     * Get the "global" image smoothing state. This is the image smoothing state that is applied to all the layers, unless setLayerSmoothing has been called for some specific layers.
     * @returns {boolean} The global image smoothing state
     */
    this.getSmoothing = function()
    {
        return sceneManager.renderer.getSmoothing();
    };

    /**
     * Set a tolerance for "onClick" events. A click is defined as a mouseDown followed by a mouseUp in the same place. However, especially in a touch-screen environment, it is possible (and indeed frequent) that the two events occur in slightly different places. Use this function to define the tolerance that you want for click events - default is 5.
     * @param {number} [tolerance] The tolerance for "onClick" events, in pixels.
     */
    this.setClickTolerance = function(tolerance)
    {
        inputManager.setClickTolerance(tolerance);
    };

    /**
     * Get the current mouse position, or the position of the last input event (in the case of touch events). Note that if there have been no mouse or input events since the app started, this will return an empty object
     * @returns {object} An object with 'x' and 'y' fields describing the screen coordinates of the mouse, or of the last input event
     */
    this.getMousePosition = function()
    {
        return inputManager.getMousePosition();
    };

    /**
     * Checks whether the WebAudio API is supported by the client
     * @returns {boolean} whether the WebAudio API is supported
     */
    this.isWebAudioSupported = function()
    {
        return !!audioContext;
    };

    /**
     * Force the app to be displayed in a certain orientation. For example, if the orientation is set to 'landscape', but the screen is taller than it is wide, the app will be rendered rotated by 90 degrees. Forced orientation is disabled by default.
     * @param {string} [orientation] The orientation to use. This can be 'landscape', 'portrait', or any other string (to disable forced orientation).
     */
    this.forceOrientation = function(orientation)
    {
        if (forcedOrientation != orientation)
        {
            switch (orientation)
            {
                case 'landscape':
                    forcedOrientation = 'landscape';
                    break;
                case 'portrait':
                    forcedOrientation = 'portrait';
                    break;
                default:
                    forcedOrientation = 'none';
            }
            sceneManager.setSimulationDirtyState();
            sceneManager.draw();
        }
    };

    /**
     * Checks if the app is being displayed in forced orientation mode.
     * @returns {string} A string describing the forced orientation. It can be 'landscape', 'portrait', or 'none'
     */
    this.getForcedOrientation = function()
    {
        return forcedOrientation;
    };

    /**
     * Checks whether the screen is rotated, with respect to the orientation that was set with forceOrientation(). For example, this returns true if forceOrientation() was called to set a 'landscape' orientation, and now the screen is taller than it is wide (therefore the screen appears rotated by 90 degrees to the viewer).
     * @returns {boolean}
     */
    this.isScreenRotated = function()
    {
        return sceneManager.renderer.isScreenRotated();
    };

    /**
     * Gradually move the camera to the specified position, with the specified speed. If wade.app.onCameraMoveComplete exists, it's executed when the camera finishes moving. If you need to change the camera position instantly, use setCameraPosition() instead.
     * @param {object} destination The destination of the camera. This is an object with 'x', 'y' and 'z' fields, where 'z' is depth (or distance from the scene), and is 1 by default.
     * @param {number|function} [speed] The movement speed. This can be a number, or a function of distance that returns a number
     * @param {function} [callback] A function to execute when the camera is finished moving. Using this callback is the same as defining an App.onCameraMoveComplete function, which would be called when the camera is finished moving.
     */
    this.moveCamera = function(destination, speed, callback)
    {
        // check parameters
        if (typeof(destination) != 'object' || typeof(destination.x) != 'number' || typeof(destination.y) != 'number' || typeof(destination.z) != 'number')
        {
            wade.log("Warning - invalid destination for wade.moveCamera(). It needs to be an object with x, y, and z fields.");
            return;
        }
        else if (typeof(speed) != 'number' && typeof(speed) != 'function')
        {
            wade.log("Warning - invalid speed for wade.moveCamera(). It needs to be a number, or a function that returns a number.");
            return;
        }

        // set a main loop function for camera movement
        this.setMainLoop(function()
        {
            var pos = wade.getCameraPosition();
            var dx = (destination.x - pos.x);
            var dy = (destination.y - pos.y);
            var dz = (destination.z - pos.z);
            var length = Math.sqrt(dx*dx + dy*dy + dz*dz);
            var s = (typeof(speed) == 'number')?  speed : (speed(length) || 0);
            if (length <= s * wade.c_timeStep)
            {
                wade.setCameraPosition(destination);
                wade.setMainLoop(0, '_wade_camera');
                callback && callback();
                var eventData = {cameraPosition: wade.getCameraPosition()};
                if (!wade.processEvent('onCameraMove', eventData))
                {
                    wade.app.onCameraMoveComplete && wade.app.onCameraMoveComplete(eventData);
                }
            }
            else
            {
                wade.setCameraPosition({x: pos.x + dx * s * wade.c_timeStep / length, y: pos.y + dy * s * wade.c_timeStep / length, z: pos.z + dz * s * wade.c_timeStep / length});
            }
        }, '_wade_camera');
    };

    /**
     * Check if the camera is currently moving as a result of a previous call to wade.moveCamera
     * @returns {boolean} Whether tha camera is moving
     */
    this.isCameraMoving = function()
    {
        var cameraLoop = this.getMainLoop('_wade_camera');
        return !!(cameraLoop && cameraLoop.func);
    };

    /**
     * Stop any ongoing camera movement
     */
    this.stopCamera = function()
    {
        this.setMainLoop(null, '_wade_camera');
    };

    /**
     * Set a scene object for the camera to follow.
     * @param {SceneObject} [target] The scene object to follow. If omitted or falsy, the camera target is cleared.
     * @param {number} [inertia] The inertia of the camera, between 0 (no inertia) and 1 (maximum inertia, i.e. the camera doesn't move at all)
     * @param {object} [offset] An object with 'x' and 'y' fields, that specifies an offset relative to the center of the target scene object to follow.
     */
    this.setCameraTarget = function(target, inertia, offset)
    {
        if (!target)
        {
            this.setMainLoop(0, '_wade_cameraTarget');
            return;
        }
        inertia = inertia || 0;
        offset = offset || {x:0, y:0};
        this.setMainLoop(function()
        {
            if (target.isInScene())
            {
                var targetPos = target.getPosition();
                var cameraPos = wade.getCameraPosition();
                targetPos.x += offset.x;
                targetPos.y += offset.y;
                targetPos.z = cameraPos.z;
                if (inertia)
                {
                    var actualPos = {x: targetPos.x * (1 - inertia) + cameraPos.x * inertia,
                        y: targetPos.y * (1 - inertia) + cameraPos.y * inertia,
                        z: targetPos.z * (1 - inertia) + cameraPos.z * inertia};
                    var dx = actualPos.x - targetPos.x;
                    var dy = actualPos.y - targetPos.y;
                    var dz = actualPos.z - targetPos.z;
                    if (dx*dx + dy*dy + dz*dz > inertia * inertia)
                    {
                        targetPos = actualPos;
                    }
                }
                wade.setCameraPosition(targetPos);
            }
        }, '_wade_cameraTarget');
    };

    /**
     * Force the camera position to be within the specified coordinate range. Omit or set any of the arguments to null to ignore specific boundaries. As a result, calling this function with no arguments effectively disables camera bounds.<br/>
     * Note that this takes priority over other camera functions such as wade.setCameraTarget() or wade.moveCamera()
     * @param {number} [minX] The minimum value for the camera's X axis
     * @param {number} [maxX] The maximum value for the camera's X axis
     * @param {number} [minY] The minimum value for the camera's Y axis
     * @param {number} [maxY] The maximum value for the camera's Y axis
     * @param {number} [minZ] The minimum value for the camera's Z axis
     * @param {number} [maxZ] The maximum value for the camera's Y axis
     */
    this.setCameraBounds = function(minX, maxX, minY, maxY, minZ, maxZ)
    {
        var uminX = typeof(minX) == 'undefined' || minX === null;
        var uminY = typeof(minY) == 'undefined' || minY === null;
        var uminZ = typeof(minZ) == 'undefined' || minZ === null;
        var umaxX = typeof(maxX) == 'undefined' || maxX === null;
        var umaxY = typeof(maxY) == 'undefined' || maxY === null;
        var umaxZ = typeof(maxZ) == 'undefined' || maxZ === null;
        if (uminX && uminY && uminZ && umaxX && umaxY && umaxZ)
        {
            this.setMainLoop(null, '_wade_cameraBounds');
            return;
        }

        this.setMainLoop(function()
        {
            var pos = wade.getCameraPosition();
            !uminX && (pos.x = Math.max(minX, pos.x));
            !uminY && (pos.y = Math.max(minY, pos.y));
            !uminZ && (pos.z = Math.max(minZ, pos.z));
            !umaxX && (pos.x = Math.min(maxX, pos.x));
            !umaxY && (pos.y = Math.min(maxY, pos.y));
            !umaxZ && (pos.z = Math.min(maxZ, pos.z));
            wade.setCameraPosition(pos);
        }, '_wade_cameraBounds', -1)
    };

    /**
     * Get the objects inside (or intersecting) the specified area, expressed in world units
     * @param {object} area An object with the following fields (in world-space units): 'minX', 'minY', 'maxX', 'maxY'
     * @param {number} [layerId] If specified, the object search will be restricted to this layer id
     * @returns {SceneObjectGroup} A SceneObjectGroup containing the SceneObjects in the area
     */
    this.getObjectsInArea = function(area, layerId)
    {
        var result = [];
        sceneManager.renderer.addObjectsInAreaToArray(area, result, layerId);
        return new SceneObjectGroup(result);
    };

    /**
     * Get the objects inside (or intersecting) the specified area, expressed in screen units
     * @param {object} area An object with the following fields (in screen-space units): 'minX', 'minY', 'maxX', 'maxY'
     * @returns {SceneObjectGroup} A SceneObjectGroup containing the SceneObjects in the area
     */
    this.getObjectsInScreenArea = function(area)
    {
        var result = [];
        sceneManager.renderer.addObjectsInScreenAreaToArray(area, result);
        return new SceneObjectGroup(result);
    };

    /**
     * Get the sprites inside (or intersecting) the specified area, expressed in world units
     * @param {object} area An object with the following fields (in world-space units): 'minX', 'minY', 'maxX', 'maxY'
     * @param {number} [layerId] If specified, the sprite search will be restricted to this layer id
     * @param {boolean} [sorted] If set to true or a truthy value, the resulting array will be sorted according to the layer number and each layer's sort function
     * @returns {Array} An array of sprites
     */
    this.getSpritesInArea = function(area, layerId, sorted)
    {
        var result = [];
        sceneManager.renderer.addSpritesInAreaToArray(area, result, layerId, sorted);
        return result;
    };

    /**
     * Get the sprites inside (or intersecting) the specified area, expressed in screen units
     * @param {object} [area] An object with the following fields (in screen-space units): 'minX', 'minY', 'maxX', 'maxY'. If omitted, the full currently visible screen area is used.
     * @param {boolean} [sorted] If set to true or a truthy value, the resulting array will be sorted according to the layer number and each layer's sort function
     * @returns {Array} An array of sprites
     */
    this.getSpritesInScreenArea = function(area, sorted)
    {
        if (!area)
        {
            var hw = this.getScreenWidth() / 2;
            var hh = this.getScreenHeight() / 2;
            area = {minX: -hw, minY: -hh, maxX: hw, maxY: hh};
        }
        var result = [];
        sceneManager.renderer.addSpritesInScreenAreaToArray(area, result, sorted);
        return result;
    };

    /**
     * Get all the sprites on a specific layer
     * @param {number} [layerId] The layer ID
     * @return {Array} The sprites on the layer
     */
    this.getSpritesOnLayer = function(layerId)
    {
        var layerIds = sceneManager.renderer.getActiveLayerIds();
        if (layerIds.indexOf(layerId) == -1)
        {
            return [];
        }
        return this.getLayer(layerId).getSprites();
    };

    /**
     * Get a scene object by name. This only works with objects that have been added to the scene.
     * @param {string} name The name of the scene object to look for
     * @returns {SceneObject} The scene object corresponding to the given name, or null if no SceneObjects have that name
     */
    this.getSceneObject = function(name)
    {
        var sceneObject = sceneManager.getObjectByName(name);
        return (sceneObject && (sceneObject instanceof SceneObject))? sceneObject : null;
    };

    /**
     * Get a list of all the objects in the scene, or just the objects with a given property/value pair.
     * @param {string} [property] A property that must be set for the objects. Omit this parameter or use a falsy value to get all the objects in the scene.
     * @param {*} [value] The value that the property must be set to. You can omit this parameter to get all the objects where the property is defined, regardless of its value
     * @returns {SceneObjectGroup} A SceneObjectGroup containing all the objects that are currently present in the scene and match the property-value filter
     */
    this.getSceneObjects = function(property, value)
    {
        return new SceneObjectGroup(sceneManager.getSceneObjects(property, value));
    };

    /**
     * Get the raw data of an image file or canvas, as an array of bytes
     * @param {string} file The file name associated with the image or canvas resource
     * @param {number} [posX] The left coordinate of the data to retrieve. Default is 0.
     * @param {number} [posY] The top coordinate of the data to retrieve. Default is 0.
     * @param {number} [width] The width of the image data to retrieve. By default this is the whole width of the image.
     * @param {number} [height] The height of the image data to retrieve. By default this is the whole height of the image.
     * @returns {ImageData} An HTML ImageData object containing the image data. Use its <i>data</i> property to access the byte array, where pixels are stored sequentially and for each pixel there are 4 bytes representing the red, green, blue and alpha channels in this order.
     */
    this.getImageData = function(file, posX, posY, width, height)
    {
        // get the full file name
        var fileName = this.getFullPathAndFileName(file);

        // check if it's in the cache and return a cached ImageData if available
        if (imageDataCache[fileName] && !posX && !posY && !width && !height)
        {
            return imageDataCache[fileName];
        }

        // not in the image data cache - we need to actually get an ImageData object from a canvas
        var canvas = assetLoader.getImage(fileName);
        var context;

        // it may be that the asset manager stored this asset as a canvas, or as an image. If it isn't a canvas, create a canvas and draw the image onto it
        if (!canvas.getContext)
        {
            var img = canvas;
            canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            context = canvas.getContext('2d');
            context.drawImage(img, 0, 0);
            wade.setImage(file, canvas);
        }
        else
        {
            context = canvas.getContext('2d');
        }
        posX = posX || 0;
        posY = posY || 0;
        width = width || canvas.width;
        height = height || canvas.height;

        var isFullImageData = !posX && !posY && width == canvas.width && height == canvas.height;
        if (imageDataCache[fileName] && isFullImageData)
        {
            return imageDataCache[fileName];
        }
        var imageData = context.getImageData(posX, posY, width, height);

        // store the image data in the cache
        if (isFullImageData)
        {
            imageDataCache[fileName] = imageData;
        }
        else
        {
            imageDataCache[fileName] = context.getImageData(0, 0, canvas.width, canvas.height);
        }
        return imageData;
    };

    /**
     * Write raw data into an image or canvas resource. Best used in conjunctions with wade.getImageData()
     * @param {string} file The file name associated with the image or canvas resource to modify. If a resource associated with this file name doesn't exist, it will be created and its dimensions will be set to the specified width and height, or to the image data's width and height if the widht and height parameters aren't set explicitly.
     * @param {ImageData} data A HTML ImageData object containing the raw data
     * @param {number} [destX] The left coordinate of the destination image (where the data is going to copied). Default is 0.
     * @param {number} [destY] The top coordinate of the destination image (where the data is going to copied). Default is 0.
     * @param {number} [sourceX] The left coordinate of  the source data to copy. Default is 0.
     * @param {number} [sourceY] The top coordinate of the source data to copy. Default is 0.
     * @param {number} [width] The width of the data to copy. By default this is the whole width of the source image data.
     * @param {number} [height] The height of the data to copy. By default this is the whole height of the source image data.
     */
    this.putImageData = function(file, data, destX, destY, sourceX, sourceY, width, height)
    {
        destX = destX || 0;
        destY = destY || 0;
        sourceX = sourceX || 0;
        sourceY = sourceY || 0;
        width = width || data.width;
        height = height || data.height;
        var fileName = this.getFullPathAndFileName(file);
        var canvas, context;
        if (assetLoader.getLoadingStatus(fileName) == 'ok')
        {
            canvas = assetLoader.getImage(fileName);

            // it may be that the asset manager stored this asset as a canvas, or as an image. If it isn't a canvas, create a canvas and draw the image onto it
            if (!canvas.getContext)
            {
                var img = canvas;
                canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                context = canvas.getContext('2d');
                context.drawImage(img, 0, 0);
                wade.setImage(file, canvas);
            }
            else
            {
                context = canvas.getContext('2d');
            }
        }
        else
        {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            context = canvas.getContext('2d');
            wade.setImage(file, canvas);
        }
        context.putImageData(data, sourceX, sourceY, destX, destY, width, height);
        imageDataCache[fileName] = context.getImageData(0, 0, canvas.width, canvas.height);
        sceneManager.renderer.updateImageUsers(fileName);
    };

    /**
     * Enable or disable support for multi touch. Multi touch is disabled by default.
     * @param {boolean} [toggle] Whether to enable or disable multi touch. This parameter is true by default.
     */
    this.enableMultitouch = function(toggle)
    {
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        inputManager.enableMultitouch(toggle);
    };

    /**
     * Check whether multi touch support is current enabled. By default it's disabled, unless you call wade.enableMultitouch()
     */
    this.isMultitouchEnabled = function()
    {
        return inputManager.isMultitouchEnabled();
    };

    /**
     * Get the current version of WADE as a string. If you are using it to make sure that it's greater than a certain version, you may want to use <i>wade.requireVersion</i> instead.
     * @returns {string} The current version of WADE.
     */
    this.getVersion = function()
    {
        return version;
    };

    /**
     * Ensure that the current version of WADE is greater or equal than a specific version.
     * @param {string} requiredVersion The required version of WADE. For example '1.0.2'
     * @param {string} [errorMode] The type of error message to display. This can be 'alert' to show an alert box, 'console' to print a message in the console, or anything else to not show an error message
     * @param {string} [errorMessage] The error message to display. Default is 'A newer version of WADE is required;.
     */
    this.requireVersion = function(requiredVersion, errorMode, errorMessage)
    {
        var thisVersion = version.split('.');
        var reqVersion = requiredVersion.split('.');
        for (var i=0; i < reqVersion.length; i++)
        {
            var a = (thisVersion[i] || 0);
            if (a > reqVersion[i])
            {
                return true;
            }
            else if (a < reqVersion[i])
            {
                errorMessage = errorMessage || ('A newer version of WADE is required (' + requiredVersion + ')');
                switch (errorMode)
                {
                    case 'alert':
                        alert(errorMessage);
                        break;
                    case 'console':
                        wade.log(errorMessage);
                        break;
                }
                return false;
            }
        }
        return true;
    };

    /**
     * Get the percentage of files that have been fully loaded with respect to the number of files for which a loading operation has been requested
     * @returns {number} A number between 0 and 100 indicating the percentage of loaded files
     */
    this.getLoadingPercentage = function()
    {
        return assetLoader.getPercentageComplete();
    };

    /**
     * Display (or hide) a progress bar that indicates the current loading progress
     * @param {boolean} [visible] Whether to show the loading bar or not. If omitted, this parameter is assumed to be false.
     * @param {Object} [position] An object with <i>x</i> and <i>y</i> fields describing the position in pixels (relative to the screen center) where the loading bar should appear. This is only relevant if the <i>visible</i> parameter is true.
     * @param {string} [backColor] A HTML color string to use as the background color of the loading bar
     * @param {string} [foreColor] A HTML color string to use as the foreground color of the loading bar
     */
    this.setLoadingBar = function(visible, position, backColor, foreColor)
    {
        if (visible)
        {
            var outer = document.createElement('div');
            var inner = document.createElement('div');
            outer.style.backgroundColor = backColor || 'red';
            outer.style.borderRadius = '13px';
            outer.style.padding = '3px';
            outer.style.width = '50%';
            outer.style.height = '20px';
            outer.style.position = 'absolute';
            outer.style.left = position? (position.x * 2) + 'px' : 0;
            outer.style.right = 0;
            outer.style.top = position? (position.y * 2) + 'px' : 0;
            outer.style.bottom = 0;
            outer.style.margin = 'auto';
            inner.style.backgroundColor = foreColor || 'orange';
            inner.style.borderRadius = '10px';
            inner.style.height = '20px';
            inner.style.width = 0;
            outer.appendChild(inner);
            outer.id = '__wade_loading_bar';
            loadingBar = outer;
            loadingBar.inner = inner;
            document.body.appendChild(outer);
        }
        else
        {
            loadingBar && document.body.removeChild(loadingBar);
            loadingBar = null;
        }
    };

    /**
     * Check to see if gamepads are supported in the current browser
     * @returns {boolean} Whether gamepads are supported in the current browsers
     */
    this.areGamepadsSupported = function()
    {
        return !!(navigator.webkitGetGamepads || navigator.getGamepads)
    };

    /**
     * Enabled or disable gamepad support
     * @param {boolean} [toggle] Whether to enable or disable gamepad support. If omitted, this parameter is assumed to be true.
     */
    this.enableGamepads = function(toggle)
    {
        inputManager.enableGamepads();
    };

    /**
     * Generate a data URL from an image that had previously been loaded or procedurally generated
     * @param {string} imageName The name or virtual path of the image
     * @returns {string} A base64 data URL
     */
    this.getImageDataURL = function(imageName)
    {
        var image = wade.getImage(imageName);
        if (image.toDataURL)
        {
            return image.toDataURL();
        }
        var s = new Sprite(imageName);
        s.drawToImage(imageName, true);
        return wade.getImage(imageName).toDataURL();
    };

    /**
     * Generate a data URL from a game layer
     * @param {number} layerId The layer Id
     * @returns {string} A base64 data URL
     */
    this.getLayerDataURL = function(layerId)
    {
        return this.getLayer(layerId).toDataURL();
    };

    /**
     * A function to log any message from WADE. By default, this is set to console.log
     * @param {*} data The data to log
     * @type {Function}
     */
    this.log = function(data)
    {
        console.log(data);
    };

    /**
     * A function to log any warning message from WADE. By default, this is set to console.warn
     * @param {*} data The data to log
     * @type {Function}
     */
    this.warn = function(data)
    {
        console.warn(data)
    };

    /**
     * A function to log any error message from WADE. By default, this is set to console.error
     * @param {*} data The data to log
     * @type {Function}
     */
    this.error = function(data)
    {
        console.error(data)
    };

    /**
     * Force the full redraw of the scene (or of a single layer)
     * @param {number} [layerId] The id of the layer to redraw. If omitted or falsy, all layers will be redrawn.
     */
    this.forceRedraw = function(layerId)
    {
        sceneManager.setSimulationDirtyState();
        sceneManager.renderer.forceRedraw(layerId);
    };

    /**
     * Apply a per-pixel transformation to an image. Note that you need to load the image (with wade.loadImage) before doing this, or it must be an image that is loaded in memory somehow (it can be an image that you have procedurally generated too).
     * @param {string} sourceImage The file name (or virtual path) of the source image
     * @param {function} whatToDo A function to execute for each pixel. It will receive data about the pixel, and can return an object containing output data. An example is this:<br/><i>function(r, g, b, a, x, y) { return {r: 255, g: 255, b: 255, a: 255}; }</i><br/>Where r is red, g is green, b is blue, a is alpha, and x and y are the coordinates of the pixel being processed.
     * @param {string} [targetImage] The file name (or virtual path) of the target image. If omitted, the source image will be overwritten with the new data.
     */
    this.forEachPixel = function(sourceImage, whatToDo, targetImage)
    {
        var imageData = this.getImageData(sourceImage);
        for (var i=0; i<imageData.width; i++)
        {
            for (var j=0; j<imageData.height; j++)
            {
                var p = (i + j * imageData.width) * 4;
                var result = whatToDo(imageData.data[p], imageData.data[p+1], imageData.data[p+2], imageData.data[p+3], i, j);
                if (result)
                {
                    imageData.data[p] = result.r || 0;
                    imageData.data[p+1] = result.g || 0;
                    imageData.data[p+2] = result.b || 0;
                    imageData.data[p+3] = result.a || 0;
                }
            }
        }
        targetImage = targetImage || sourceImage;
        wade.putImageData(targetImage, imageData);
    };

    /**
     * Get the canvas object being used by a layer. You can use it as a source image for sprite and effects.
     * @param {number} [layerId] The id of the layer to use. Default is 1
     * @returns {Object} An HTML5 canvas object
     */
    this.getLayerCanvas = function(layerId)
    {
        return wade.getLayer(layerId || 1).getCanvas();
    };

    /**
     * Draw a layer to an image in CPU memory
     * @param {number} layerId The id of the layer to use
     * @param {string} imageName The file name (or virtual path) of the target image
     * @param {boolean} [replace] Whether to replace the existing image at the virtual path (if it exists), or draw on top of it
     * @param {Object} [offset] An object with 'x' and 'y' fields representing the offset to use when drawing this sprite onto the image
     * @param {Object} [transform] An object with 6 parameters: 'horizontalScale', 'horizontalSkew', 'verticalSkew', 'verticalScale', 'horizontalTranslate', 'verticalTranslate'
     * @param {string} [compositeOperation] A string describing an HTML5 composite operation
     * @param {function} [callback] A function to execute when the image is ready
     */
    this.drawLayerToImage = function(layerId, imageName, replace, offset, transform, compositeOperation, callback)
    {
        var canvas = wade.getLayerCanvas(layerId);
        var source = '__wade_layer' + layerId;
        wade.draw(layerId);

        var onImageReady = function()
        {
            var c = canvas;
            canvas = this;
            wade.setImage(source, canvas);
            var s = new Sprite(source);
            var opacity = 1;
            var r = 1;
            if (wade.isSharedCanvas(c) || wade.getLayerRenderMode(layerId) == '2d')
            {
                opacity = wade.getLayerOpacity(layerId);
                r = wade.getLayerResolutionFactor(layerId);
            }
            if (opacity != 1)
            {
                s.setDrawFunction(wade.drawFunctions.alpha_(opacity, s.draw));
            }
            if (!transform)
            {
                transform = {horizontalScale: 1 / r, verticalScale: 1 / r, horizontalSkew: 0, verticalSkew: 0, horizontalTranslate: 0, verticalTranslate: 0};
            }
            s.drawToImage(imageName, replace, offset, transform, compositeOperation, '2d');
            callback && setTimeout(callback, 0);
        };

        if (wade.getLayerRenderMode(layerId) == 'webgl')
        {
            var dataURL = canvas.toDataURL();
            var img = new Image();
            img.onload = onImageReady;
            img.src = dataURL;
        }
        else
        {
            onImageReady.call(canvas);
        }
    };

    /**
     * Draw the contents of the WADE screen to an image in CPU memory
     * @param {string} imageName The file name (or virtual path) of the target image
     * @param {function} [callback] A function to execute when the image is ready
     */
    this.screenCapture = function(imageName, callback)
    {
        wade.draw();
        wade.createTransparentImage(imageName, wade.getScreenWidth(), wade.getScreenHeight());
        var layerIds = sceneManager.renderer.getActiveLayerIds();
        if (!layerIds.length)
        {
            setTimeout(callback, 0);
            return;
        }
        var numReadyImages = 0;
        var numImagesToDraw = 0;
        var onImageReady_ = function(canvasId)
        {
            return function()
            {
                drawnCanvases[canvasId].canvas = this;
                if (++numReadyImages == numImagesToDraw)
                {
                    for (var c in drawnCanvases)
                    {
                        var source = '__wade_layer_' + c;
                        wade.setImage(source, drawnCanvases[c].canvas);
                        var s = new Sprite(source);
                        var opacity = drawnCanvases[c].opacity;
                        if (opacity != 1)
                        {
                            s.setDrawFunction(wade.drawFunctions.alpha_(opacity, s.draw));
                        }
                        var r = drawnCanvases[c].resolution;
                        var transform = {horizontalScale: 1 / r, verticalScale: 1 / r, horizontalSkew: 0, verticalSkew: 0, horizontalTranslate: 0, verticalTranslate: 0};
                        s.drawToImage(imageName, false, null, transform, '', '2d');
                    }
                    wade.setTimeout(function()
                    {
                        for (var c in drawnCanvases)
                        {
                            var source = '__wade_layer_' + c;
                            wade.unloadImage(source);
                        }
                    }, 0);
                    callback && setTimeout(callback, 0);
                }
            }
        };

        var i, canvas;
        var drawnCanvases = {};
        for (i=0; i<layerIds.length; i++)
        {
            canvas = wade.getLayerCanvas(layerIds[i]);
            if (!drawnCanvases[canvas.id])
            {
                numImagesToDraw++;
                var opacity = 1;
                var resolution = 1;
                if (wade.isSharedCanvas(canvas) || wade.getLayerRenderMode(layerIds[i]) == '2d')
                {
                    opacity = wade.getLayerOpacity(layerIds[i]);
                    resolution = wade.getLayerResolutionFactor(layerIds[i]);
                }
                drawnCanvases[canvas.id] = {canvas: canvas, opacity: opacity, resolution: resolution};
            }
        }
        for (var c in drawnCanvases)
        {
            canvas = drawnCanvases[c].canvas;
            var dataURL = canvas.toDataURL();
            var img = new Image();
            img.onload = onImageReady_(c);
            img.src = dataURL;
        }
    };

    /**
     * Set the opacity of a layer. For stand-alone canvas layers this is then applied to the layer canvas via CSS. For webgl layers, this is taken into account when drawing the layer's internal frame buffer onto the screen.
     * @param {number} layerId The id of the layer
     * @param {number} opacity The opacity of the layer, between 0 (fully transparent) and 1 (fully opaque)
     */
    this.setLayerOpacity = function(layerId, opacity)
    {
        this.getLayer(layerId).setOpacity(opacity);
    };

    /**
     * Get the opacity of a layer.
     * @param {number} layerId The id of the layer
     * @returns {number} The opacity of the layer. This is a number between 0 (fully transparent) and 1 (fully opaque)
     */
    this.getLayerOpacity = function(layerId)
    {
        var opacity = parseFloat(this.getLayer(layerId).getOpacity());
        return (isNaN(opacity))? 1 : opacity;
    };

    /**
     * Set a layer's color blend mode (for WebGL layers only, for 2d canvas layers this call has no effect)
     * @param {number} layerId The id of the layer
     * @param {string} blendSrc The source color blend value. Default is 'ONE'. All WebGl color blending constant names can be used here (e.g. DST_COLOR, ONE_MINUS_SRC_COLOR, etc)
     * @param {string} blendDest The destination color blend value. Default is 'ONE_MINUS_SRC_ALPHA'. All WebGl color blending constant names can be used here (e.g. DST_COLOR, ONE_MINUS_SRC_COLOR, etc)
     */
    this.setLayerColorBlendMode = function(layerId, blendSrc, blendDest)
    {
        this.getLayer(layerId).setColorBlendMode(blendSrc, blendDest);
    };

    /**
     * Set a layer's alpha blend mode (for WebGL layers only, for 2d canvas layers this call has no effect)
     * @param {number} layerId The id of the layer
     * @param {string} blendSrc The source alpha blend value. Default is 'SRC_ALPHA'. All WebGl color blending constant names can be used here (e.g. DST_ALPHA, ONE_MINUS_SRC_ALPHA, etc)
     * @param {string} blendDest The destination alpha blend value. Default is 'ONE_MINUS_SRC_ALPHA'. All WebGl color blending constant names can be used here (e.g. DST_ALPHA, ONE_MINUS_SRC_ALPHA, etc)
     */
    this.setLayerAlphaBlendMode = function(layerId, blendSrc, blendDest)
    {
        this.getLayer(layerId).setAlphaBlendMode(blendSrc, blendDest);
    };

    /**
     * Get the name of the DIV or the HTML element that contains the App. This can be set when calling wade.init.
     * @returns {string} The name of the container element
     */
    this.getContainerName = function()
    {
        return containerDiv;
    };

    /**
     * Fade in a layer over time
     * @param {number} layerId The id of the layer to fade in
     * @param {number} time How long (in seconds) the fading should take
     * @param {function} [callback] A function to execute when the fading is complete
     */
    this.fadeInLayer = function(layerId, time, callback)
    {
        var loopName = '__wade_fadeLayer_' + layerId;
        wade.setLayerOpacity(layerId, 0);
        this.setMainLoop(function()
        {
            var opacity = wade.getLayerOpacity(layerId);
            opacity = Math.min(1, opacity + wade.c_timeStep / time);
            if (1 - opacity < wade.c_epsilon)
            {
                opacity = 1;
            }
            wade.setLayerOpacity(layerId, opacity);
            if (opacity == 1)
            {
                wade.setMainLoop(null, loopName);
                callback && callback();
            }
        }, loopName);
    };

    /**
     * Fade out a layer over time
     * @param {number} layerId The id of the layer to fade out
     * @param {number} time How long (in seconds) the fading should take
     * @param {function} [callback] A function to execute when the fading is complete
     */
    this.fadeOutLayer = function(layerId, time, callback)
    {
        var loopName = '__wade_fadeLayer_' + layerId;
        wade.setLayerOpacity(layerId, 1);
        this.setMainLoop(function()
        {
            var opacity = wade.getLayerOpacity(layerId);
            opacity = Math.max(0, opacity - wade.c_timeStep / time);
            if (opacity < wade.c_epsilon)
            {
                opacity = 0;
            }
            wade.setLayerOpacity(layerId, opacity);
            if (opacity == 0)
            {
                wade.setMainLoop(null, loopName);
                callback && callback();
            }
        }, loopName);
    };

    /**
     * Clear the canvas(es) associated with a specific layer. This can be useful when setCanvasClearing(false) has been called for a layer and you want to clear it manually.
     * @param {number} layerId The id of the layer to clear
     */
    this.clearCanvas = function(layerId)
    {
        this.getLayer(layerId).clear();
    };

    /**
     * Draw a layer, group of layers, or the whole scene. Normally you don't need to do this (WADE does it automatically when needed), but by calling this function you can manually control when the drawing happens.
     * @param {number|Array} [layerIds] The id of the layer (or layers) to draw. If omitted, the whole scene will be drawn
     */
    this.draw = function(layerIds)
    {
        sceneManager.draw(layerIds, true);
    };

    /**
     * Export the current scene to an object (optionally serializing it to a JSON string), that can then be used to import a scene like the current one, through wade.importScene()
     * @param {boolean} [stringify] Whether the result should be serialized to a JSON string
     * @param {Array} [exclude] An array of scene objects, paths and groups (or their names) to exclude from the exported scene
     * @param {boolean} [exportObjectFunctions] Whether to export a string representation of all member functions of the scene objects. False by default.
     * @returns {object|string} Either an object or a JSON string representation of the scene (depending on the <i>serialize</i> parameter)
     */
    this.exportScene = function(stringify, exclude, exportObjectFunctions)
    {
        var scene = {sceneObjects: sceneManager.exportSceneObjects(exclude, exportObjectFunctions), paths: sceneManager.exportPaths(exclude)};
        scene.sceneObjectGroups = sceneManager.exportSceneObjectGroups(exclude);
        scene.layers = sceneManager.renderer.getLayerSettings(true);
        scene.minScreenSize = {x: wade.getMinScreenWidth(), y: wade.getMinScreenHeight()};
        scene.maxScreenSize = {x: wade.getMaxScreenWidth(), y: wade.getMaxScreenHeight()};
        scene.orientation = wade.getForcedOrientation();
        scene.windowMode = wade.getWindowMode();
        scene.defaultLayer = wade.defaultLayer || 1;
        return (stringify? JSON.stringify(scene) : scene);
    };

    /**
     * Import a scene from an object that contains a description of all the entities in the scene - it could have been previously exported with wade.exportScene(), or edited manually. This will automatically load all the assets referenced in the scene data.
     * @param {object} data A scene description object, such as one created with wade.exportScene(). The format is the following (all fields are optional):<ul>
     {<br/>
		  <li><b>json</b>: An array of file names, describing which json files should be loaded. This can also be an array of objects in the format {resource: string, target: string} where <i>resource</i> is the file to load, and the result is stored in wade.app[<i>target</i>].</li>
		  <li><b>text</b>: An array of file names, describing which text files should be loaded. This can also be an array of objects in the format {resource: string, target: string} where <i>resource</i> is the file to load, and the result is stored in wade.app[<i>target</i>].</li>
		  <li><b>audio</b>: An array of audio file names</li>
		  <li><b>scripts</b>: An array of script (.js) file names. Note that these scripts will be loaded and executed after the rest of the scene has been loaded, but before any scene objects are created and added to the scene</li>
		  <li><b>images</b>: An array of image file names - you don't need to include files that are referenced by the scene objects and sprites in the scene (those will be loaded automatically).</li>
		  <li><b>minScreenSize</b>: An object with x and y components describing the minimum screen size. Refer to the documentation of wade.setMinScreenSize() for more details</li>
		  <li><b>maxScreenSize</b>: An object with x and y components describing the maximum screen size. Refer to the documentation of wade.setMaxScreenSize() for more details</li>
		  <li><b>windowMode</b>: A string describing the window mode. Refer to the documentation of wade.setWindowMode() for more details</li>
		  <li><b>orientation</b>: A string describing the orientation. Valid values are 'portrait' and 'landscape', all other values are ignored. See wade.forceOrientation() for more details</li>
		  <li><b>sceneObjects</b>: An array containing all the SceneObjects to instantiate. See the SceneObject documentation for more details about the format to use for each object</li>
		  <li><b>sceneObjectGroups</b>: An array containing SceneObjectGroups. See the SceneObjectGroup documentation for more details about the format to use for each group</li>
		  <li><b>modules</b>: An object where the name of each property is the name of an external WADE module whose importScene is called to load the scene data described by the value of that property</li>
		  <li><b>webAudioOnly</b>: A boolean describing whether audio should only be loaded through WebAudio, and only where WebAudio is supported</li>
		  <li><b>loadGlTextures</b>: A boolean describing whether WebGl textures should be created at loading time (only applies to sprites that are on WebGl layers)</li>
	 }</ul>
     * @param {{position: {x: number, y: number}, foreColor: string, backColor: string}} [loadingBar] A loading bar while loading the assets referenced in the scene data (see wade.setLoadingBar for details about the parameters, which are all optional). If omitted or falsy, no loading bar will be shown
     * @param {function} [callback] A function to execute when the scene has been imported
     * @param {boolean} [async] Whether the scene should be loaded asynchronously in the background, without blocking the simulation and rendering of the app. False by default
     * @param {boolean} [clearScene] Whether the current scene should be cleared before adding objects for the new scene. False by default
     */
    this.importScene = function(data, loadingBar, callback, async, clearScene)
    {
        isImportingScene = true;
        if (loadingBar)
        {
            wade.setLoadingBar(true, loadingBar.position, loadingBar.backColor, loadingBar.foreColor);
        }
        var sceneObjects = data.sceneObjects;
        var paths = data.paths;
        var images = data.images || [];
        if (sceneObjects)
        {
            for (var i=0; i<sceneObjects.length; i++)
            {
                if (sceneObjects[i].sprites)
                {
                    for (var j=0; j<sceneObjects[i].sprites.length; j++)
                    {
                        sceneObjects[i].sprites[j].image && (images.indexOf(sceneObjects[i].sprites[j].image) == -1) && (sceneObjects[i].sprites[j].image.substr(0, 11) != 'procedural_') && images.push(sceneObjects[i].sprites[j].image);
                        if (sceneObjects[i].sprites[j].animations)
                        {
                            for (var k in sceneObjects[i].sprites[j].animations)
                            {
                                if (sceneObjects[i].sprites[j].animations.hasOwnProperty(k))
                                {
                                    var image = sceneObjects[i].sprites[j].animations[k].image;
                                    image && (image.substr(0, 11) != 'procedural_') && (images.indexOf(image) == -1) && images.push(image);
                                }
                            }
                        }
                    }
                }
            }
        }
        var numLoaded = 0;
        var numToLoad = images.length;
        var afterLoading = function()
        {
            if (++numLoaded == numToLoad)
            {
                clearScene && wade.clearScene();
                if (data.scripts)
                {
                    for (var i=0; i<data.scripts.length; i++)
                    {
                        try
                        {
                            eval.call(window, wade.getScript(data.scripts[i]));
                        }
                        catch (e)
                        {
                            wade.error('Unable to execute script ' + data.scripts[i] + ' - ' + e.message);
                        }
                    }
                }
                data.minScreenSize && wade.setMinScreenSize(data.minScreenSize.x, data.minScreenSize.y);
                data.maxScreenSize && wade.setMaxScreenSize(data.maxScreenSize.x, data.maxScreenSize.y);
                data.windowMode && wade.setWindowMode(data.windowMode);
                data.orientation && wade.forceOrientation(data.orientation);
                if (data.layers)
                {
                    for (i=0; i<data.layers.length; i++)
                    {
                        if (data.layers[i])
                        {
                            var scaleFactor = (typeof(data.layers[i].scaleFactor) != 'number')? 1 : data.layers[i].scaleFactor;
                            var translateFactor = (typeof(data.layers[i].translateFactor) != 'number')? 1 : data.layers[i].translateFactor;
                            var useQuadtree = (typeof(data.layers[i].useQuadtree) != 'undefined') ? data.layers[i].useQuadtree : true;
                            var resolutionFactor = (typeof(data.layers[i].resolutionFactor) != 'number')? 1 : data.layers[i].resolutionFactor;
                            var blur = data.layers[i].blur || 0;
                            var postProcessShader = data.layers[i].postProcessShader || '';
                            var postProcessShaderUniforms = data.layers[i].postProcessShaderUniforms;
                            var customProperties = data.layers[i].properties || {};
                            wade.setLayerRenderMode(i, (data.layers[i].renderMode == '2d')? '2d' : 'webgl', {offScreenTarget: !!(postProcessShader || blur)});
                            wade.setLayerTransform(i, scaleFactor, translateFactor);
                            wade.useQuadtree(i, useQuadtree);
                            wade.setLayerResolutionFactor(i, resolutionFactor);
							wade.setBlur(i, blur);
                            wade.setPostProcessShader(i, postProcessShader, postProcessShaderUniforms);
                            wade.setLayerCustomProperties(i, customProperties);
                        }
                    }
                }
                if (data.defaultLayer)
                {
                    wade.defaultLayer = data.defaultLayer;
                }
                if (paths)
                {
                    for (i=0; i<paths.length; i++)
                    {
                        var path = new Path(paths[i]);
                        wade.addPath(path);
                    }
                }
                // load iso terrain first, if it exists
                if (data.modules && data.modules.iso)
                {
                    wade.iso.importScene(data.modules.iso, afterLoadingIso);
                }
                else
                {
                    afterLoadingIso();
                }

            }
        };

        var afterLoadingIso = function()
        {
            if (sceneObjects)
            {
                var glTexturesToMake = {};
                for (i=0; i<sceneObjects.length; i++)
                {
                    var obj = new SceneObject(sceneObjects[i]);
                    if (data.loadGlTextures)
                    {
                        for (j=0; j<obj.getSpriteCount(); j++)
                        {
                            var sprite = obj.getSprite(j);
                            var layerId = sprite.getLayerId();
                            if (wade.getLayerRenderMode(layerId) == 'webgl')
                            {
                                glTexturesToMake[layerId] = glTexturesToMake[layerId] || [];
                                var imageNames = sprite.getAllImageNames();
                                for (var k=0; k<imageNames.length; k++)
                                {
                                    if (glTexturesToMake[layerId].indexOf(imageNames[k]) == -1)
                                    {
                                        glTexturesToMake[layerId].push(imageNames[k]);
                                    }
                                }
                            }
                        }
                    }
                }
                for (var l in glTexturesToMake)
                {
                    var context = wade.getLayer(l).getContext();
                    for (i=0; i<glTexturesToMake[l].length; i++)
                    {
                        context.setTextureImage(wade.getImage(glTexturesToMake[l][i]), true);
                    }
                }
            }
            if (data.sceneObjectGroups)
            {
                for (i=0; i<data.sceneObjectGroups.length; i++)
                {
                    var group = new SceneObjectGroup(data.sceneObjectGroups[i]);
                    wade.addSceneObjectGroup(group);
                }
            }

            // load scene data through external modules (other than iso - iso is already loaded at this point)
            if (data.modules)
            {
                var moduleArray = Object.keys(data.modules);
                if (!moduleArray.length || (moduleArray.length == 1 && data.modules.iso))
                {
                    afterLoadingEverything();
                    return;
                }

                var afterLoadingModules = function()
                {
                    if (++numLoaded == numToLoad)
                    {
                        afterLoadingEverything();
                    }
                };

                for (var mod in data.modules)
                {
                    if (mod == 'iso')
                    {
                        continue;
                    }
                    if (data.modules.hasOwnProperty(mod))
                    {
                        if (wade[mod] && wade[mod].importScene)
                        {
                            numToLoad++;
                            wade[mod].importScene(data.modules[mod], afterLoadingModules);
                        }
                        else
                        {
                            wade.error('The scene being imported contains data for module ' + mod + ", but the module isn't available or not up to date");
                            numToLoad++;
                            setTimeout(afterLoadingModules, 0);
                        }
                    }
                }
            }
            else
            {
                afterLoadingEverything();
            }
        };

        var afterLoadingEverything = function()
        {
            setTimeout(function()
            {
                isImportingScene = false;
                if (data.timeline)
                {
                    wade.startTimeline(data.timeline);
                }
                if (data.flowChart)
                {
                    wade.runFlowChart(data.flowChart);
                }
                callback && callback();
            }, 0);
        };

        var loadError_ = function(errorMessage)
        {
            return function()
            {
                wade.error(errorMessage);
                afterLoading();
            };
        };

        var loadingPrefix = async? 'pre' : '';
        if (data.json)
        {
            numToLoad += data.json.length;
            var processedJson = {};
            var processedJsonFiles = {};
            data.json.forEach(function(json)
            {
                if (typeof(json) == 'object')
                {
                    var resource = json.resource;
                    var target =json.target;
                }
                else
                {
                    resource = json;
                }
                var key = resource + '___' + target;
                if (!processedJson[key])
                {
                    wade[loadingPrefix + 'loadJson'](resource, null, function(data)
                    {
                        if (target)
                        {
                            wade.app[target] = wade.isArray(data)? wade.cloneArray(data) : wade.cloneObject(data);
                        }
                        afterLoading();
                    }, false, loadError_('Failed to load JSON file ' + resource));
                    processedJson[key] = true;
                    processedJsonFiles[resource] = true;
                }
                else
                {
                    numToLoad--;
                }
            });
        }
        if (data.text)
        {
            numToLoad += data.text.length;
            var processedText = {};
            data.text.forEach(function(text)
            {
                if (typeof(text) == 'object')
                {
                    var resource = text.resource;
                    var target =text.target;
                }
                else
                {
                    resource = text;
                }
                var key = resource + '___' + target;
                if (!processedText[key])
                {
                    wade[loadingPrefix + 'loadText'](resource, null, function(data)
                    {
                        if (target)
                        {
                            wade.app[target] = data;
                        }
                        afterLoading();
                    }, false, loadError_('Failed to load text file ' + resource));
                    processedText[key] = true;
                }
                else
                {
                    numToLoad--;
                }
            });
        }
        if (data.audio)
        {
            if (!data.webAudioOnly || wade.isWebAudioSupported())
            {
                numToLoad += data.audio.length;
                for (i=0; i<data.audio.length; i++)
                {
                    if (data.audio.indexOf(data.audio[i]) == i)
                    {
                        wade[loadingPrefix + 'loadAudio'](data.audio[i], false, false, afterLoading, loadError_('Failed to load audio file ' + data.audio[i]));
                    }
                    else
                    {
                        numToLoad--;
                    }
                }
            }
        }
        if (data.fonts)
        {
            numToLoad += data.fonts.length;
            for (i=0; i<data.fonts.length; i++)
            {
                if (data.fonts.indexOf(data.fonts[i]) == i)
                {
                    wade[loadingPrefix + 'loadFont'](data.fonts[i], afterLoading, loadError_('Failed to load font file ' + data.fonts[i]));
                }
                else
                {
                    numToLoad--;
                }
            }
        }
        if (data.scripts)
        {
            numToLoad += data.scripts.length;
            for (i=0; i<data.scripts.length; i++)
            {
                if (data.scripts.indexOf(data.scripts[i]) == i)
                {
                    wade[loadingPrefix + 'loadScript'](data.scripts[i], afterLoading, false, loadError_('Failed to load script file ' + data.scripts[i]), true);
                }
                else
                {
                    numToLoad--;
                }
            }
        }
        if (images.length)
        {
            for (i=0; i<images.length; i++)
            {
                if (images.indexOf(images[i]) == i)
                {
                    wade[loadingPrefix + 'loadImage'](images[i], afterLoading, loadError_('Failed to load image file ' + images[i]));
                }
                else
                {
                    numToLoad--;
                }
            }
        }

        if (!numToLoad)
        {
            numToLoad = 1;
            afterLoading();
        }
    };

    /**
     * Load a JSON file that contains the description of a wade scene, and process that file to load any assets being used and instantiate SceneObjects, Sprites, TextSprites and Animations according to the scene description. This is the same as wade.preloadScene(), except that the loading happens synchronously, blocking the rendering and simulation of the current scene
     * @param {string} fileName The name of a JSON file containing a description of the scene
     * @param {{position: {x: number, y: number}, foreColor: string, backColor: string}} [loadingBar] A loading bar while loading the assets referenced in the scene data (see wade.setLoadingBar for details about the parameters, which are all optional). If omitted or falsy, no loading bar will be shown
     * @param {function} [callback] A function to execute when the scene has been loaded
     * @param {boolean} [clearScene] Whether the previous scene should be cleared before adding objects for the new scene. False by default
     */
    this.loadScene = function(fileName, loadingBar, callback, clearScene)
    {
        wade.loadJson(fileName, null, function(data)
        {
            wade.importScene(data, loadingBar, callback, false, clearScene);
        });
    };
    /**
     * Load a JSON file that contains the description of a wade scene, and process that file to load any assets being used and instantiate SceneObjects, Sprites, TextSprites and Animations according to the scene description. This is the same as wade.loadScene(), except that the loading happens asynchronously without blocking the rendering and simulation of the current scene
     * @param {string} fileName The name of a JSON file containing a description of the scene
     * @param {{position: {x: number, y: number}, foreColor: string, backColor: string}} [loadingBar] A loading bar while loading the assets referenced in the scene data (see wade.setLoadingBar for details about the parameters, which are all optional). If omitted or falsy, no loading bar will be shown
     * @param {function} [callback] A function to execute when the scene has been loaded
     * @param {boolean} [clearScene] Whether the previous scene should be cleared before adding objects for the new scene. False by default
     */
    this.preloadScene = function(fileName, loadingBar, callback, clearScene)
    {
        wade.preloadJson(fileName, null, function(data)
        {
            wade.importScene(data, loadingBar, callback, true, clearScene);
        });
    };

    /**
     * Enable or disable quadtree optimization for a specific layer. Note that this optimization is enabled by default, so normally you don't need to call this function. Sometimes you may want to wade.useQuadtree(layerId, false) for layers that have lots of small moving objects that you don't need to know the exact positions of, such as particles.
     * @param {number} layerId The id of the layer for which you want to enable/disable the quadtree optimization
     * @param {boolean} [toggle] Whether to enable or disable the quadtree. If omitted, this parameter is assumed to be true.
     */
    this.useQuadtree = function(layerId, toggle)
    {
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        this.getLayer(layerId).useQuadtree(toggle);
    };

    /**
     * Check whether a layer is using quadtree-based optimizations
     * @param {number} layerId The id of the layer to check
     * @returns {boolean} Whether the layer is using a quadtree
     */
    this.isUsingQuadtree = function(layerId)
    {
        return this.getLayer(layerId).isUsingQuadtree();
    };

    /**
     * Pause the simulation
     * @param {string} [mainLoopName] The name of the main loop that you want to pause. If omitted, the whole simulation will be paused.
     */
    this.pauseSimulation = function(mainLoopName)
    {
        if (mainLoopName)
        {
            for (var i=0; i<mainLoopCallbacks.length; i++)
            {
                if (mainLoopCallbacks[i].name == mainLoopName)
                {
                    mainLoopCallbacks[i].paused = true;
                    return;
                }
            }
        }
        else
        {
            simulationPaused = true;
        }
    };

    /**
     * Resume the simulation (typically after it was paused via wade.pauseSimulation)
     * @param {string} [mainLoopName] The name of the main loop that you want to resume. If omitted, the whole simulation will be resumed.
     */
    this.resumeSimulation = function(mainLoopName)
    {
        var i;
        if (mainLoopName)
        {
            for (i=0; i<mainLoopCallbacks.length; i++)
            {
                if (mainLoopCallbacks[i].name == mainLoopName)
                {
                    mainLoopCallbacks[i].paused = false;
                    return;
                }
            }
        }
        else
        {
            for (i=0; i<mainLoopCallbacks.length; i++)
            {
                mainLoopCallbacks[i].paused = false;
            }
            simulationPaused = false;
        }
    };

    /**
     * Set how many seconds of lag should be tolerated before WADE stop trying to catch up with missed frames
     * @param {number} bufferTime The buffer time, in seconds
     */
    this.setCatchUpBuffer = function(bufferTime)
    {
        catchUpBuffer = bufferTime;
    };

    /**
     * Retrieve the length of the catch-up buffer, that is how many seconds of lag should be tolerated before WADE stops trying to catch up with missed frames
     * @returns {number} The buffer time, in seconds
     */
    this.getCatchUpBuffer = function()
    {
        return catchUpBuffer;
    };

    /**
     * Prevent the WADE App from being executed inside an iframe
     */
    this.preventIframe = function()
    {
        if (!window.location || !window.top.location || !location || !top.location || window.location !== window.top.location || location !== top.location)
        {
            wade = 0;
        }
    };

    /**
     * Only allow the WADE App to be executed on a specific domain. Note that this will still allow you to execute the app on your localhost or 127.0.0.1, regardless of the domain specified
     * @param {string} domain The domain where you want the WADE App to be executed. For example 'www.clockworkchilli.com'
     */
    this.siteLock = function(domain)
    {
        var origin = 'localhost';
        try
        {
            origin = top.location.hostname;

        }
        catch(e)
        {
            try
            {
                origin = this.getHostName(top.location.origin);
            }
            catch (e)
            {
                try
                {
                    origin = this.getHostName(top.location.href);
                }
                catch(e) {}
            }
        }
        var s = origin.toLowerCase();
        if (s != domain.toLowerCase() && s != 'localhost' && s != '127.0.0.1')
        {
            wade = 0;
        }
    };

    /**
     * Get the host name based on a URL string
     * @param {string} url The URL string
     * @returns {string} The host name
     */
    this.getHostName = function(url)
    {
        var u = URL || webkitURL;
        try
        {
            url = new u(url).hostname;
        }
        catch (e)
        {
            var pos = url.indexOf('//');
            if (pos != -1)
            {
                url = url.substr(pos + 2);
            }
            pos = url.indexOf('/');
            if (pos != -1)
            {
                url = url.substr(0, pos);
            }
            pos = url.indexOf(':');
            if (pos != -1)
            {
                url = url.substr(0, pos);
            }
            pos = url.indexOf('?');
            if (pos != -1)
            {
                url = url.substr(0, pos);
            }
        }
        return url;
    };

    /**
     * Only allow the App to be linked only from selected domains
     * @param {string|Array} domains A string (or an array of strings) representing the allowed domain(s)
     */
    this.whitelistReferrers = function(domains)
    {
        var referrer = document.referrer;
        if (!referrer)
        {
            return;
        }
        referrer = this.getHostName(referrer);
        var d;
        if (typeof(domains) == 'string')
        {
            d = [domains.toLowerCase()];
        }
        else if (wade.isArray(domains))
        {
            d = [];
            for (var i=0; i<domains.length; i++)
            {
                d.push(domains[i].toLowerCase());
            }
        }
        else
        {
            return;
        }
        if (referrer && d.indexOf(referrer.toLowerCase()) == -1)
        {
            wade = 0;
        }
    };

    /**
     * Do not allow the App to be linked from selected domains
     * @param {string|Array} domains A string (or an array of strings) representing the blacklisted domain(s)
     */
    this.blacklistReferrers = function(domains)
    {
        var referrer = document.referrer;
        if (!referrer)
        {
            return;
        }
        referrer = this.getHostName(referrer);
        if (!referrer)
        {
            return;
        }
        var d;
        if (typeof(domains) == 'string')
        {
            d = [domains.toLowerCase()];
        }
        else if (wade.isArray(domains))
        {
            d = [];
            for (var i=0; i<domains.length; i++)
            {
                d.push(domains[i].toLowerCase());
            }
        }
        else
        {
            return;
        }
        if (referrer && d.indexOf(referrer.toLowerCase()) != -1)
        {
            wade = 0;
        }
    };

    /**
     * Remove a layer that was previously created, and free all the associated resources
     * @param {number} layerId The id of the layer to remove
     */
    this.removeLayer = function(layerId)
    {
        sceneManager.renderer.removeLayer(layerId);
    };

    /**
     * Remove all layers that contain no sprites, and release all the associated resources
     * @param {Array} [exceptions] An array of layer id's that you do NOT want to remove even if unused
     */
    this.removeUnusedLayers = function(exceptions)
    {
        sceneManager.renderer.removeUnusedLayers(exceptions);
    };

    /**
     * Set a CSS 3D transform on a layer. See <a href="https://developer.mozilla.org/en-US/docs/Web/Guide/CSS/Using_CSS_transforms">this MDN article</a> for more details.
     * @param {number} layerId The id of the layer
     * @param {string} [transformString] Any valid CSS 3D transform string. Omitting this parameter resets the transform
     * @param {string} [transformOrigin] Any valid CSS 3D transform-origin string. Omitting this parameter resets the transform origin to (50% 50%)
     * @param {number} [time] The time (in seconds) needed for the transform to be applied. Omitting this parameter or setting it to 0 results in the transform to be applied instanty. Any other number will result in the transform being applied smoothly over the specified period of time
     * @param {function} [callback] A function to execute when the transform has been applied
     */
    this.setLayer3DTransform = function(layerId, transformString, transformOrigin, time, callback)
    {
        this.getLayer(layerId).set3DTransform(transformString || 'translate3d(0, 0, 0)', transformOrigin || '50% 50%', time, callback);
    };

    /**
     * Skip any frames that have been missed due to lag up to this point (don't try to catch up). This won't affect future missed frames, i.e. WADE will still try to catch up on those unless you call skipMissedFrames again.
     */
    this.skipMissedFrames = function()
    {
        mainLoopLastTime = (new Date()).getTime();
    };

    /**
     * Get the current index of a scene object in the scene.
     * @param {SceneObject} sceneObject The SceneObject
     * @returns {number} The current index of the scene object in the scene
     */
    this.getSceneObjectIndex = function(sceneObject)
    {
        return sceneManager.getSceneObjectIndex(sceneObject);
    };

    /**
     * Set the index of a scene object in the scene. You may want to do this if you care about SceneObjects being exported in a specific order with wade.exportScene().
     * @param {SceneObject} sceneObject The SceneObject
     * @param {number} index The desired index in the scene
     * @returns {number} The actual index of the SceneObject in the scene after attempting this operation. If the scene has N objects, and you try to set the index to a number greater than N-1, the object will be moved at index N-1 instead. If the object hasn't been added to the scene yet, this function will return -1.
     */
    this.setSceneObjectIndex = function(sceneObject, index)
    {
        return sceneManager.setSceneObjectIndex(sceneObject, index);
    };

    /**
     * Set the tolerance for swipe events.
     * @param {number} tolerance The tolerance value to use for swipe events. Default is 1.
     * @param {number} [numSamples] The number of samples used for gesture detection. Default is 1.
     */
    this.setSwipeTolerance = function(tolerance, numSamples)
    {
        numSamples = (numSamples || 3);
        inputManager.setSwipeTolerance(tolerance, numSamples);
    };

    /**
     * Set the render mode for a layer
     * @param {number} layerId The id of the layer
     * @param {string} renderMode The render mode for the layer. This can be either '2d' or 'webgl'. On devices that don't support webgl, setting the render mode to 'webgl' won't have any effect.
     * @param {object} [options] An object with rendering-related options. At present, only the 'offScreenTarget' option is implemented (for webgl), and it defaults to false.
     */
    this.setLayerRenderMode = function(layerId, renderMode, options)
    {
        this.getLayer(layerId, renderMode).setRenderMode(renderMode, options);
    };

    /**
     * Get the current render mode of a layer.d
     * @param {number} layerId The id of the layer
     * @returns {string} The layer render mode. This can be either '2d' or 'webgl'
     */
    this.getLayerRenderMode = function(layerId)
    {
        return this.getLayer(layerId).getRenderMode();
    };

    /**
     * Check to see if WebGL is supported
     * @returns {boolean} Whether WebGL is supported in the current environment
     */
    this.isWebGlSupported = function()
    {
        if (typeof(webGlSupported) != 'undefined')
        {
            return !!webGlSupported;
        }
        else
        {
            try
            {
                var canvas = document.createElement('canvas');
                var context = canvas.getContext('webgl', {failIfMajorPerformanceCaveat: !forceWebGl}) || canvas.getContext('experimental-webgl', {failIfMajorPerformanceCaveat: !forceWebGl});
            }
            catch(e)
            {
                webGlSupported = false;
                return false;
            }
            webGlSupported = !!context;
            return webGlSupported;
        }
    };

    /**
     * Check whether we are currently running in debug mode
     * @returns {boolean} Whether we are currently running in debug mode
     */
    this.isDebugMode = function()
    {
        return !!debugMode;
    };

    /**
     * If WebAudio is supported, get the current WebAudio context
     * @returns {AudioContext} The current WebAudio context. If WebAudio is not supported, this function returns undefined.
     */
    this.getWebAudioContext = function()
    {
        return audioContext;
    };

    /**
     * Get a list of the id's of all layers that are currently active (including empty ones)
     * @returns {Array} An array of layer id's
     */
    this.getActiveLayerIds = function()
    {
        return sceneManager.renderer.getActiveLayerIds();
    };

    /**
     * Get a 32-bit integer hash of a given string
     * @param {string} str The string to hash
     * @returns {number} The hash of the input string
     */
    this.hashString = function(str)
    {
        var i, chr, len;
        var hash = 0;
        if (!str.length)
        {
            return hash;
        }
        for (i = 0, len = str.length; i < len; i++)
        {
            chr   = str.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // convert to 32bit integer
        }
        return hash;
    };

    /**
     * Create a pseudo-array, i.e. an object that behaves partly like an array of the specified maxLength, with the ability to execute a function every time an element of the array changes.
     * Note that a pseudo-array only supports the [] operator, the length property and the push function. Other properties of Array are currently not supported.
     * @param {number} maxLength The maximum number of elements in the array
     * @param {function} onSet A function to execute when an element in the array changes. The function will receive 3 arguments: the index of the element, the new value of the element, and a boolean indicating whether this is a new element.
     */
    this.createPseudoArray = function(maxLength, onSet)
    {
        var a = [];
        var pseudoArray = {isPseudoArray: true};
        for (var i=0; i<maxLength; i++)
        {
            (function(i)
            {
                Object.defineProperty(pseudoArray, i.toString(),
                    {
                        enumerable: true,
                        set: function(val)
                        {
                            var isNewValue = i >= a.length;
                            a[i] = val;
                            onSet(i, val, isNewValue);
                        },
                        get: function()
                        {
                            return a[i];
                        }
                    });
            })(i);
        }
        Object.defineProperty(pseudoArray, 'length',
            {
                enumerable: true,
                set: function(val)
                {
                    for (var i = a.length-1; i>=val; i--)
                    {
                        onSet(i);
                    }
                    a.length = val;
                },
                get: function()
                {
                    return a.length;
                }
            });
        pseudoArray.push = function()
        {
            for (var i=0; i<arguments.length; i++)
            {
                var index = a.push(arguments[i]) - 1;
                onSet(index, arguments[i], true);
            }
        };
        return pseudoArray;
    };

    /**
     * Set whether WADE should try to automatically load images that haven't yet been loaded when the app is trying to use them. This happens by default, so you don't need to call autoLoadImages() unless you want to disable the behavior or re-enable it programmatically.
     * @param {boolean} [toggle] Whether to auto-load images or not. If omitted this is assumed to be true.
     */
    this.autoLoadImages = function(toggle)
    {
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        autoLoadImages = toggle;
    };

    /**
     * Check whether WADE is automatically trying to load images that haven't yet been loaded when the app is trying to use them.
     * @returns {boolean} The status of the auto-load behavior.
     */
    this.isAutoLoadingImages = function()
    {
        return autoLoadImages;
    };

    /**
     * Add a Path to the scene
     * @param {Path} path The path to add to the scene
     */
    this.addPath = function(path)
    {
        sceneManager.addPath(path);
    };

    /**
     * Remove a Path from the scene
     * @param {Path|string} path The path to be removed from the scene, or its name as a string
     */
    this.removePath = function(path)
    {
        sceneManager.removePath(typeof(path) == 'string'? this.getPath(path) : path);
    };

    /**
     * Get a list of all the paths in the scene, or just the paths with a given property/value pair.
     * @param {string} [property] A property that must be set for the paths. Omit this parameter or use a falsy value to get all the paths in the scene.
     * @param {*} [value] The value that the property must be set to. You can omit this parameter to get all the paths where the property is defined, regardless of its value
     * @returns {Array} An array containing references to all the paths that are currently present in the scene
     */
    this.getPaths = function(property, value)
    {
        return sceneManager.getPaths(property, value);
    };

    /**
     * Get a path, given its name as a string
     * @param {string} name The name of the path
     * @returns {Path} The Path object with the given name, or null if no path with a matching name is in the scene
     */
    this.getPath = function(name)
    {
        var path = sceneManager.getObjectByName(name);
        return (path && (path instanceof Path))? path : null;
    };

    /**
     * Given a name, get the corresponding object, regardless of its type (it can be a SceneObject, a Path, a SceneObjectGroup, etc)
     * @param {string} name The name of the object
     * @returns {object} The object with the given name
     */
    this.getObjectByName = function(name)
    {
        return sceneManager.getObjectByName(name);
    }

    /**
     * Add a SceneObjectGroup to the scene
     * @param {SceneObjectGroup} sceneObjectGroup The scene object group to add to the scene
     */
    this.addSceneObjectGroup = function(sceneObjectGroup)
    {
        sceneManager.addSceneObjectGroup(sceneObjectGroup);
    };

    /**
     * Remove a SceneObjectGroup from the scene
     * @param {SceneObjectGroup|string} sceneObjectGroup The scene object group to be removed from the scene, or its name as a string
     */
    this.removeSceneObjectGroup = function(sceneObjectGroup)
    {
        sceneManager.removeSceneObjectGroup(typeof(sceneObjectGroup) == 'string'? this.getSceneObjectGroup(sceneObjectGroup) : sceneObjectGroup);
    };

    /**
     * Get a SceneObjectGroup, given its name as a string
     * @param {string} name The name of the SceneObjectGroup
     * @returns {SceneObjectGroup} The SceneObjectGroup with the given name, or null if no scene object group with a matching name is in the scene
     */
    this.getSceneObjectGroup = function(name)
    {
        var sceneObjectGroup = sceneManager.getObjectByName(name);
        return (sceneObjectGroup && wade.isArray(sceneObjectGroup) && sceneObjectGroup.getGroupCenter)? sceneObjectGroup: null;
    };

    /**
     * Get all the SceneObjectGroups in the scene. Optionally apply a filter to only select groups that contain some specific objects.
     * @param {SceneObject|Array} sceneObjects If specified, restrict the result to groups that contain this SceneObject or this array of SceneObjects
     * @return {Array} An array of SceneObjectGroups
     */
    this.getSceneObjectGroups = function(sceneObjects)
    {
        return sceneManager.getSceneObjectGroups(sceneObjects);
    };

    /**
     * Get the key name associated with a numerical key code
     * @param {number} keyCode The key code
     * @returns {string} The key name
     */
    this.getKeyName = function(keyCode)
    {
        return inputManager.getKeyName(keyCode);
    };

    /**
     * Get the numerical key code associated with a key name, or 0 if the name isn't valid
     * @param {string} keyName The key name
     * @returns {number} The key code
     */
    this.getKeyCode = function(keyName)
    {
        return inputManager.getKeyCode(keyName);
    };


    /**
     * Check whether an object is an Array
     * @param {object} a The object to test
     * @returns {boolean} Whether the object is a JavaScript Array
     */
    this.isArray = function(a)
    {
        return Array.isArray(a);
    };

    /**
     * Perform an asynchronous HTTP request
     * @param {Object} params An object with the following fields - only 'url' is mandatory:<br/><ul>
     *     <li>url: string</li>
     *     <li>type: string (either 'GET' or 'POST')</li>
     *     <li>cache: boolean (defaults to true - set it to false to ensure you don't get a cached result)</li>
     *     <li>dataType: string (set to 'json' to get the response as a JSON object)</li>
     *     <li>success: function (a callback to execute when a successful response has been received - the response data is passed to the callback)</li>
     *     <li>contentType: string (a Content-Type)</li>
     *     <li>error: function (a callback to execute if the request fails - any data that was received, such as an incomplete response, is passed to the callback)</li></ul>
     */
    this.ajax = function(params)
    {
        params = params || {};
        var type = params.type || 'GET';
        var url = params.url;
        if (!url)
        {
            wade.error('Invalid ajax request - url was not specified');
            return;
        }
        if (typeof(params.cache) != 'undefined' && !params.cache)
        {
            url += ((/\?/).test(url) ? "&" : "?" + (new Date()).getTime());
        }
        var onComplete = function()
        {
            var response = this.responseText;
            if (params.dataType)
            {
                switch (params.dataType)
                {
                    case 'json':
                        try
                        {
                            response = JSON.parse(response);
                        }
                        catch (e)
                        {
                            wade.error('Failed to load JSON data from ' + params.url + ' : ' + e);
                            params.error && params.error(response);
                            return;
                        }
                        break;
                }
            }
            params.success && params.success(response);
        };
        var onError = function()
        {
            params.error && params.error(this.responseText);
        };
        var req = new XMLHttpRequest();
        req.addEventListener('load', onComplete);
        req.addEventListener('error', onError);
        req.open(type, url);
        if (params.timeout)
        {
            req.addEventListener('timeout', onError);
            req.timeout = params.timeout;
        }
        if (params.contentType)
        {
            req.setRequestHeader("Content-type", params.contentType);
        }
        req.send(params.data || null);
    };

    /**
     * Start a timeline. A timeline is a series of events, each associated with some code to execute and a time (in seconds) since the start of the timeline.<br/>
     * The reference time can be either the app's simulation time, or the system clock, and can be set in <i>timeline.referenceTime</i>. Please consider how you want variable framerate to affect your timing when you choose a value for this. Note that code won't be execute while the simulation isn't running, regardless of the type of referenceTime. However, the app time is paused while the simulation is paused, the clock time is not.<br/>
     * @param {Object} timeline A timeline object with the following structure: <pre>
     * {
     *     referenceTime: string (it can be either 'app' or 'clock' - if unspecified, it defaults to 'app')
     *     events: [{time: number, code: string}, {time: number, code: string}]
     * }
     * </pre>
     * @param {number} [time=0] The starting point of the timeline
     * @param {string} [timelineId] The ID of an existing timeline that you want to replace. If null or unspecified, a new timeline will be created
     * @returns {string} The id of the new timeline. This can be used to call wade.stopTimeline() and wade.resumeTimeline()
     */
    this.startTimeline = function(timeline, time, timelineId)
    {
        if (!timeline.events)
        {
            timeline.events = [];
        }
        time = time || 0;
        if (!timelineId)
        {
            timelineId = this.timelineUid = (this.timelineUid  + 1) || 1;
            timelineId = '__wade_timeline_' + timelineId;
            timelines[timelineId] = {timeline: timeline, time: time, active: true};
        }
        var startTime = timeline.referenceTime == 'clock'?  this.getClockTime() / 1000 : this.getAppTime();
        var processTimeline = function()
        {
            var now = (timeline.referenceTime == 'clock'?  self.getClockTime() / 1000 : self.getAppTime()) - startTime + time;
            timelines[timelineId].time = now;
            var numUnprocessed = 0;
            for (var i=0; i<timeline.events.length; i++)
            {
                if (!timeline.events[i].processed && timeline.events[i].code)
                {
                    numUnprocessed++;
                    if (now >= timeline.events[i].time)
                    {
                        timeline.events[i].processed = true;
                        var code = '(function(){' + timeline.events[i].code + '})()';
                        if (debugMode)
                        {
                            var eventId = processedTimelineEvents.length;
                            processedTimelineEvents.push({time: timeline.events[i].time, code: timeline.events[i].code});
                            code += '\n//# sourceURL=timeline_event_' + eventId + '_' + timeline.events[i].time + 's.js';
                        }
                        eval.call(window, code);
                    }
                }
            }
            if (!numUnprocessed)
            {
                self.setMainLoop(null, timelineId);
            }
        };
        this.setMainLoop(processTimeline, timelineId);
        processTimeline();
        return timelineId;
    };

    /**
     * Stop an active timeline
     * @param {string} timelineId The ID of the timeline, as obtained by a previous call to wade.startTimeline()
     */
    this.stopTimeline = function(timelineId)
    {
        if (timelines[timelineId])
        {
            timelines[timelineId].active = false;
        }
        this.setMainLoop(null, timelineId);
    };

    /**
     * Resume an inactive timeline
     * @param {string} timelineId The ID of the timeline, as obtained by a previous call to wade.startTimeline()
     */
    this.resumeTimeline = function(timelineId)
    {
        timelines[timelineId].active = true;
        this.startTimeline(timelines[timelineId].timeline, timelines[timelineId].time, timelineId);
    };

    /**
     * This function can only be used in debug mode to get the details of a timeline event that has been processed. To run WADE in debug mode, set the debug option to true when calling wade.init()
     * @param {number} [eventId=0] The index of the event, e.g. use 0 for the first event that was processed
     * @returns {Object} An object with a time parameter (a number) and a code parameter (a string)
     */
    this.getProcessedTimelineEvent = function(eventId)
    {
        if (!debugMode)
        {
            wade.error('Cannot call wade.getProcessedTimelineEvent when not in debug mode');
            return {time: 0, code: ''};
        }
        return processedTimelineEvents[eventId || 0];
    };

    /**
     * Stop and delete all timelines
     */
    this.clearTimelines = function()
    {
        for (var timelineId in timelines)
        {
            this.stopTimeline(timelineId);
        }
        timelines = {};
    };

    /**
     * Create a transparent image
     * @param {string} imageName A name that identifies the new image. This can later be used by wade.getImage(imageName) and similar functions, or set as a source image of a Sprite or Animation.<br/>
     * Note that if an image with the same name exists, it will be replaced by the new transparent image.
     * @param {number} width The width of the image in pixels
     * @param {number} height The height of the image in pixels
     */
        this.createTransparentImage = function(imageName, width, height)
    {
        var s = new Sprite();
        s.setDrawFunction(wade.doNothing);
        s.setSize(width, height);
        s.drawToImage(imageName, true, null, null, '', '2d');
    };

    /**
     * Get a reference to all the timelines, active and inactive. You can check the <i>active</i> flag on each timeline to check its status.
     * @returns {object} An object where each field is a (named) timeline. See wade.startTimeline for a full description of the timeline data structure
     */
    this.getTimelines = function()
    {
        return timelines;
    };

    /**
     * Set a post-process shader for a layer
     * @param {number} layerId The ID of the layer
     * @param {string} [shaderSource] The contents of a "main(void)" fragment shader function. If omitted or empty, the default pixel shader is used, resulting in no post-processing.
     * @param {string} [shaderUniforms] An object that specifies the name and type of custom shader uniforms that you want to use. For example {tintColor: 'vec4'}. Values will be retrieved from public properties of the Sprite using the same name. So in this example, make sure that your sprite has got a property called tintColor that is an array with 4 elements. Supported types are currently: float, vec2, vec3, vec4, int, ivec2, ivec3, ivec4 and sampler2D.
     */
    this.setPostProcessShader = function(layerId, shaderSource, shaderUniforms)
    {
        this.getLayer(layerId).setPostProcessShader(shaderSource, shaderUniforms);
    };

    /**
     * Get the post process shader code being used by a layer
     * @param {number} layerId The ID of the layer
     */
    this.getPostProcessShader = function(layerId)
    {
        return this.getLayer(layerId).getPostProcessShader();
    };

    /**
     * Get the post process shader uniforms being used by a layer
     * @param {number} layerId The ID of the layer
     * @returns {object} An object whose keys are uniform names and whose values are uniform types
     */
    this.getPostProcessShaderUniforms = function(layerId)
    {
        return this.getLayer(layerId).getPostProcessShaderUniforms();
    };

    /**
     * Set a custom property for a layer. This is mainly useful to set the values of shader uniforms used in custom post-process shaders.
     * @param {number} layerId The ID of the layer
     * @param {string} key The name of the property to set
     * @param {*} [value] The value of the property
     */
    this.setLayerCustomProperty = function(layerId, key, value)
    {
        this.getLayer(layerId).setCustomProperty(key, value);
    };

    /**
     * Set a set of custom properties for a layer. This is mainly useful to set the values of shader uniforms used in custom post-process shaders. Note that, unlike wade.setLayerCustomProperty(), this will completely remove any existing custom properties from the layer before setting the new ones.
     * @param layerId
     * @param properties
     */
    this.setLayerCustomProperties = function(layerId, properties)
    {
        this.getLayer(layerId).setCustomProperties(properties);
    };

    /**
     * Retrieve the value of a custom property of a layer
     * @param {number} layerId The ID of the layer
     * @param {string} key The name of the property to set
     * @returns {*} The value of the property
     */
    this.getLayerCustomProperty = function(layerId, key)
    {
        return this.getLayer(layerId).getCustomProperty(key);
    };


    /**
     * Get the entire set of custom properties of a layer
     * @param {number} layerId The ID of the layer
     * @returns {Object} An object containing all the custom properties
     */
    this.getLayerCustomProperties = function(layerId)
    {
        return this.getLayer(layerId).getCustomProperties();
    };

    /**
     * Schedule the execution of a function. This is similar to JavaScript's native setTimeout function, but it depends on the app simulation time (that can be paused programmatically or when the app is running in a background tab) rather than the actual clock time.
     * @param {function} f A function to execute
     * @param {number} time The app simulation time, in milliseconds, to wait until the function is executed
     * @returns {number} A unique ID that can be used to cancel the timeout via <i>wade.clearTimeout()</i>
     */
    this.setTimeout = function(f, time)
    {
        if (typeof(time) == 'function' && typeof(f) == 'number')
        {
            var temp = time;
            time = f;
            f = temp;
        }
        timeouts.push({f: f, time: self.getAppTime() * 1000 + (time || 0), uid: ++timeoutUid});
        return timeoutUid;
    };

    /**
     * Schedule the periodic execution of a function. This is similar to JavaScript's native setInterval function, but it depends on the app simulation time (that can be paused programmatically or when the app is running in a background tab) rather than the actual clock time.
     * @param {function} f A function to execute periodically
     * @param {number} time The app simulation time, in milliseconds, to wait between function calls
     * @returns {number} A unique ID that can be used to cancel the interval via <i>wade.clearInterval()</i>
     */
    this.setInterval = function(f, time)
    {
        if (typeof(time) == 'function' && typeof(f) == 'number')
        {
            var temp = time;
            time = f;
            f = temp;
        }
        timeouts.push({f: f, time: self.getAppTime() * 1000 + (time || 0), repeat: (time || 0), uid: ++timeoutUid});
        return timeoutUid;
    };

    /**
     * Cancel a timeout that was previously scheduled with <i>wade.setTimeout()</i>
     * @param {number} timeoutUid The unique ID of the timeout to cancel.
     * @returns {boolean} Whether an active timeout with the specified ID was found and removed
     */
    this.clearTimeout = function(timeoutUid)
    {
        for (var i=0; i<timeouts.length; i++)
        {
            if (timeouts[i].uid == timeoutUid && !timeouts[i].repeat)
            {
                wade.removeObjectFromArrayByIndex(i, timeouts);
                return true;
            }
        }
        return false;
    };

    /**
     * Cancel an interval that was previously scheduled with <i>wade.setInterval()</i>
     * @param {number} intervalUid The unique ID of the interval to cancel.
     * @returns {boolean} Whether an active interval with the specified ID was found and removed
     */
    this.clearInterval = function(intervalUid)
    {
        for (var i=0; i<timeouts[i]; i++)
        {
            if (timeouts[i].uid == intervalUid && timeouts[i].repeat)
            {
                wade.removeObjectFromArrayByIndex(i, timeouts);
                return true;
            }
        }
        return false;
    };

    /**
     * Remove any active timeouts or intervals that have been set via <i>wade.setTimeout()</i> or <i>wade.setInterval()</i>
     * @returns {boolean} Whether any timeout or interval was active and was removed
     */
    this.clearAllTimeoutsAndIntervals = function()
    {
        var any = timeouts.length;
        timeouts.length = 0;
        return !!any;
    };

    /**
     * Execute a flow chart
     * @param {object} flowChartData This is an object that contains a set of boxes. Each property of this object is the unique id of a box. Each box is itself an object with the following properties:<br/><ul>
     *     <li>uid: string - a unique identifier for the box</li>
     *     <li>children: object - an object where each property name represents a condition, and each property value is the uid of another box in the chart</li>
     *     <li>title: string</li>
     *     <li>code: string - the code to execute for the box. This code can call this.next(condition) to advance to the next box. It is possible to call this.next() without arguments to simply go to the first child in the list of children. Note that moving from one box to the next is an asynchronous process.</li>
     *     <li>startNode: boolean</li> Whether this is a starting node
     *     </ul>
     * @param {string} [startNode] The title or the uid of the starting box. If omitted or null, the entire data is scanned to find a box with the startNode flag. When that fails, the first box is used as a start node.
     * @param {boolean} [precompile] Whether the code for all boxes should be compiled when runFlowChart is called, as opposed to compiling each function as it is needed. This is true by default.
     * @param {number} [delay=0] How many milliseconds to wait when moving from one box to the next
     * @param {SceneObject} [parentObject] The owner of the flow chart. This determines the context (i.e. the meaning of the <i>this</i> keyword) for the flow chart functions.
     * @returns {object} An object that contains data about the current state of the flow chart, as follows:<br/><ul>
     *     <li>startTime: number - when the flow chart was executed. This is a number in seconds relative to the starting point of the wade app</li>
     *     <li>flowChartData: object - a copy of the data that is passed in as the first argument to this function</li>
     *     <li>visitedNodes: array - a list of the uid's of all the nodes that have been visited so far</li>
     *     <li>running: boolean - whether the flow chart is still executing</li></ul>
     */
    this.runFlowChart = function(flowChartData, startNode, precompile, delay, parentObject)
    {
        // set default values for some arguments
        if (typeof(precompile) == 'undefined')
        {
            precompile = true;
        }
        delay = delay || 0;
        var flowChart = {visitedNodes: [], startTime: wade.getAppTime(), flowChartData: wade.cloneObject(flowChartData)};

        var runNode = function(node)
        {
            if (parentObject && parentObject.isInScene && !parentObject.isInScene() || flowChart.cancelled)
            {
                flowChart.running = false;
                if (parentObject)
                {
                    delete parentObject.next;
                }
                return;
            }
            if (!node.func)
            {
                node.func = compile(node);
            }
            flowChart.visitedNodes.push(node.uid);

            if (parentObject)
            {
                parentObject.next = next;
            }
            node.func.call(parentObject || flowChartContext);
        };

        // define the "next" function
        var next = function(condition)
        {
            var firstChild = flowChart.currentNode.children && flowChart.currentNode.children[Object.keys(flowChart.currentNode.children)[0]];
            var childUid = (typeof(condition) == 'undefined')? firstChild : flowChart.currentNode.children && flowChart.currentNode.children[condition];
            flowChart.currentNode = (childUid || (typeof(childUid) == 'number')) && boxes[childUid];
            if (!flowChart.currentNode)
            {
                flowChart.currentNode = null;
                flowChart.running = false;
                var eventData = {flowChartData: flowChart.flowChartData};
                if (parentObject)
                {
                    parentObject.process('onFlowChartEnd', eventData);
                }
                wade.app.onFlowChartEnd && wade.app.onFlowChartEnd(eventData);
                return;
            }
            wade.setTimeout(function()
            {
                runNode(flowChart.currentNode);
            }, delay || 0);
        };
        var flowChartContext = {next: next};

        // compile code
        var compile = function(box)
        {
            var code = box.code;
            if (!code)
            {
                box.func = wade.doNothing;
            }
            else
            {
                code = '(function(){' + code + '})';
                box.func = eval.call(window, code);
            }
        };
        var boxes = flowChart.flowChartData.boxes;
        for (var box in boxes)
        {
            if (boxes.hasOwnProperty(box))
            {
                if (precompile)
                {
                    compile(boxes[box]);
                }

                // find the start node
                if (!flowChart.currentNode)
                {
                    // if no start node was specified as an argument for this function, let's use a box with the startNode flag
                    if (!startNode && boxes[box].startNode && (typeof(startNode) != 'number'))
                    {
                        flowChart.currentNode = boxes[box];
                        if (!precompile)
                        {
                            break;
                        }
                    }
                    // if start node was specified, the first box that has a matching title or UID is selected
                    if ((startNode || typeof(startNode) == 'number') && (boxes[box].title == startNode || box == startNode))
                    {
                        flowChart.currentNode = boxes[box];
                        if (!precompile)
                        {
                            break;
                        }
                    }
                }
            }
        }
        flowChart.currentNode = flowChart.currentNode || boxes[Object.keys(boxes)[0]];
        if (!flowChart.currentNode)
        {
            wade.warn('Unable to run flow chart - no start node was found');
            return null;
        }

        // run the first node
        flowChart.running = true;
        runNode(flowChart.currentNode);
        if (parentObject)
        {
            parentObject.flowChartStatus = flowChart;
        }
        return flowChart;
    };


    /**
     * Define whether WebGL layers should be merged. When they are merged, each layer uses a separate render target, but they all share the same context. When layers are not merged, each layer gets its own separate gl context. By default layers are merged. <br/>
     * Note that changing this at run time is expensive as it results in deletion and recreation of any gl contexts that may already exist.  <br/>
     * Also note that only contiguous layers can be merged: inserting a 2d canvas layer between WebGL layers will prevent those layers from being merged.
     * @param {boolean} [toggle] Whether WebGL layers should be merged. If this parameter is omitted it is assumed to be true.
     */
    this.mergeGlLayers = function(toggle)
    {
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        if (!!toggle !== !!glLayersMerged)
        {
            glLayersMerged = !!toggle;
            var layers = this.getAllLayers();
            for (var i=0; i<layers.length; i++)
            {
                if (layers[i].getRenderMode() == 'webgl')
                {
                    layers[i].removeCanvas();
                    layers[i].initCanvas();
                }
            }
        }
    };

    /**
     * Check whether WebGL layers are currently merged (i.e. they share the same context where possible). See mergeGlLayers for details.
     * @returns {boolean} Whether WebGL layers are currently merged
     */
    this.areGlLayersMerged = function()
    {
        return glLayersMerged;
    };

	/*** Given a collision map, find a path between two points on the map. This implements a variant of the popular A* algorithm.
	 * @param {Object} parameters An object with the following properties: <ul>
     *     <li>start: {x: number, y: number}</li>
     *     <li>target: {x: number, y: number}</li>
     *     <li>collisionMap: [[], [], ...] a bi-dimensional array, where each truthy value represents a blocked tile on the map</li>
     *     <li>boundaries (optional): {minX: number, minY: number, maxX: number, maxY: number}</li>
     *     <li>movementOffsets (optional): [{x: number, y: number}, {x: number, y: number}, ...] An array of possible movement offsets. This can also be one of the following strings: 'straight', 'diagonal', 'both'</li>
     *     <li>heightMap (optional): [[], [], ...] a bi-dimensional array with the height of each map tile; currently only used when maxStepHeight is not 0</li>
     *     <li>maxStepHeight (optional): the maximum height difference between two tiles that will not block movement</li>
     *     <li>maxPathLength (optional): the maximum length of the path that can be returned</li></ul>
	 * @returns {Array} An array of objects with x and y fields representing the tiles that make up the path from the starting point to the goal. Note that the starting point is not included. This may be an empty array if it wasn't possible to find a valid path.
 	 */
	this.findPath = function(parameters)
	{
		var gridStart = {x: parameters.start.x, y: parameters.start.y};
		var gridTarget = {x: parameters.target.x, y: parameters.target.y};
		var collisionMap = parameters.collisionMap;
		var boundaries = parameters.boundaries || {minX: 0, minY: 0, maxX: collisionMap.length-1, maxY: collisionMap[0].length-1};
		var heightMap = parameters.heightMap;
		var offsets = parameters.movementOffsets || movementOffsets.straight;
		if (typeof(offsets) == 'string')
        {
            offsets = movementOffsets[offsets];
        }
        var maxPathLength = parameters.maxPathLength || 0;
	    var maxStepHeight = parameters.maxStepHeight;

		var useMaxStepHeight = typeof(maxStepHeight) != 'undefined';
		var i, j;
		var closedSet = [];
		var openSet = [gridStart];
		gridStart.gScore = 0;
		gridStart.hScore = Math.abs(gridStart.x - gridTarget.x) + Math.abs(gridStart.y - gridTarget.y);
		gridStart.fScore = gridStart.hScore;

		while (openSet.length)
		{
			var minFScore = openSet[0].fScore;
			var currentNode = openSet[0];
			var currentNodeIndex = 0;
			for (i=1; i<openSet.length; i++)
			{
				var node = openSet[i];
				var f = node.fScore;
				if (f < minFScore)
				{
					currentNode = node;
					minFScore = f;
					currentNodeIndex = i;
				}
			}
			if (currentNode.x == gridTarget.x && currentNode.y == gridTarget.y)
			{
				var result = [];
				var resultNode = currentNode;
				while (resultNode.cameFrom)
				{
					result.push(resultNode);
					resultNode = resultNode.cameFrom;
				}
				result.push(gridStart);
				var reverseResult = [];
				for (i=0; i<result.length; i++)
				{
					reverseResult.push(result[result.length-1-i]);
				}
				return reverseResult;
			}
			wade.removeObjectFromArrayByIndex(currentNodeIndex, openSet);
			closedSet.push(currentNode);
			if (maxPathLength && currentNode.gScore >= maxPathLength)
			{
				continue;
			}

			var currentHeight = heightMap && heightMap[currentNode.x] && heightMap[currentNode.x][currentNode.y] || 0;
			for (i=0; i<offsets.length; i++)
			{
				var offset = offsets[i];
				var neighbor = {x: currentNode.x + offset.x, y: currentNode.y + offset.y};
				if (neighbor.x < boundaries.minX || neighbor.y < boundaries.minY || neighbor.x > boundaries.maxX || neighbor.y > boundaries.maxY)
				{
					continue;
				}
				if (useMaxStepHeight && (Math.abs((heightMap[neighbor.x] && heightMap[neighbor.x][neighbor.y] || 0)- currentHeight) > maxStepHeight))
				{
					continue;
				}
				if (collisionMap[neighbor.x])
				{
					if (collisionMap[neighbor.x][neighbor.y])
					{
						continue;
					}
				}
				var neighborInClosedSet = false;
				for (j=0; j<closedSet.length; j++)
				{
					var closedNode = closedSet[j];
					if (closedNode.x == neighbor.x && closedNode.y == neighbor.y)
					{
						neighborInClosedSet = true;
						break;
					}
				}
				if (neighborInClosedSet)
				{
					continue;
				}
				var tentativeGScore = currentNode.gScore + 1;
				var neighborInOpenSet = false;
				for (j=0; j<openSet.length; j++)
				{
					var openNode = openSet[j];
					if (openNode.x == neighbor.x && openNode.y == neighbor.y)
					{
						neighborInOpenSet = true;
						neighbor = openNode;
						break;
					}
				}
				var tentativeIsBetter = false;
				if (!neighborInOpenSet)
				{
					openSet.push(neighbor);
					neighbor.hScore = Math.abs(neighbor.x - gridTarget.x) + Math.abs(neighbor.y - gridTarget.y);
					tentativeIsBetter = true;
				}
				else if (tentativeGScore < neighbor.gScore)
				{
					tentativeIsBetter = true;
				}
				if (tentativeIsBetter)
				{
					neighbor.cameFrom = currentNode;
					neighbor.gScore = tentativeGScore;
					neighbor.fScore = neighbor.gScore + neighbor.hScore;
				}
			}
		}
		return [];
	};

    /**
     * Turn Sprite batching on or off for a specific layer. Sprite batching is on by default.
     * @param {number} [layerId] The layer id. If omitted or null, batching will be enabled or disabled for all currently active layers.
     * @param {boolean} [toggle] Whether Sprite batching should be enabled. If this parameter is omitted it is assumed to be true.
     */
    this.enableBatching = function(layerId, toggle)
    {
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        if (typeof(layerId) == 'undefined' || layerId === null)
        {
            var layerIds = sceneManager.renderer.getActiveLayerIds();
            for (var i=0; i < layerIds.length; i++)
            {
                this.getLayer(layerIds[i]).enableBatching(toggle);
            }
        }
        else
        {
            this.getLayer(layerId).enableBatching(toggle);
        }
    };

	/**
	 * Check if Sprite batching is currently enabled on a specific layer
	 * @param {number} layerId The layer id
	 * @returns {boolean} Whether Sprite batching is currently enabled
	 */
	this.isBatchingEnabled = function(layerId)
	{
		return this.getLayer(layerId).isBatchingEnabled();
	};

	/**
	 * Set the strength of the blur effect
	 * @param {number} [layerId] The layer id. If omitted or null, the same value will be applied to all currently active layers.
	 * @param {number} [blurAmount=0] The strength of the blur effeft. Typically this is a number between 0 (no blur) and 1 (full blur)
     * @param {number} [time=0] How long the transition to the new blur level should last (in seconds)
	 */
	this.setBlur = function(layerId, blurAmount, time)
    {
        blurAmount = blurAmount || 0;
		if (typeof(layerId) == 'undefined' || layerId === null)
		{
			var layerIds = sceneManager.renderer.getActiveLayerIds();
			for (var i=0; i < layerIds.length; i++)
			{
                if (time)
                {
                    blurTargets[layerIds[i]] = {startValue: this.getLayer(layerIds[i]).getBlur(), endValue: blurAmount, time: time, startTime: this.getAppTime()};
                }
                else
                {
                    this.getLayer(layerIds[i]).setBlur(blurAmount);
                    delete blurTargets[layerIds[i]];
                }
			}
		}
		else
		{
            if (time)
            {
                blurTargets[layerId] = {startValue: this.getLayer(layerId).getBlur(), endValue: blurAmount, time: time, startTime: this.getAppTime()};
            }
            else
            {
                this.getLayer(layerId).setBlur(blurAmount);
                delete blurTargets[layerId];
            }
		}
    };

	/**
	 * Get the current strength of the blur effect on a specific layer
	 * @param {number} layerId The layer id
	 * @returns {number} The current strength of the blur effect
	 */
	this.getBlur = function(layerId)
	{
		return this.getLayer(layerId).getBlur();
	};

    /**
     * Force an update of the blur texture for a specific layer even when the blur amount is set to 0 for that layer
     * @param {number} [layerId] The layer id. If omitted or null, this will be applied to all currently active layers.
     * @param {boolean} [toggle] Whether the blur texture should always be updated. If this parameter is omitted it is assumed to be true.
     */
    this.alwaysUpdateBlur = function(layerId, toggle)
    {
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        if (typeof(layerId) == 'undefined' || layerId === null)
        {
            var layerIds = sceneManager.renderer.getActiveLayerIds();
            for (var i=0; i < layerIds.length; i++)
            {
                this.getLayer(layerIds[i]).alwaysUpdateBlur(!!toggle);
            }
        }
        else
        {
            this.getLayer(layerId).alwaysUpdateBlur(!!toggle);
        }
    };

    // Below are some member functions and parameters that need to be public for the rest of the engine to see them, but shouldn't be exposed to the WADE API (hence no JSDOC-style comments).

    this.getPathIndex = function(path)
    {
        return sceneManager.getPathIndex(path);
    };

    this.setPathIndex = function(path, index)
    {
        return sceneManager.setPathIndex(path, index);
    };

    this.doNothing = function()
    {
    };

    this.isImportingScene = function()
	{
		return !!isImportingScene;
	};

    this.getAudio = function(file)
    {
        var fileName = this.getFullPathAndFileName(file);
        return assetLoader.getAudio(fileName);
    };

    this.playSilentSound = function()
    {
        if (audioContext)
        {
            var oscillator = audioContext.createOscillator();
            oscillator.frequency.value = 440;
            var amp = audioContext.createGain();
            amp.gain.value = 0;
            oscillator.connect(amp);
            amp.connect(audioContext.destination);

            if (oscillator.start)
            {
                oscillator.start(0);
            }
            else
            {
                oscillator.noteOn(0);
            }
            if (oscillator.stop)
            {
                oscillator.stop(0.001);
            }
            else
            {
                oscillator.noteOff(0.001);
            }
        }
        else
        {
            var audio = new Audio();
            audio.src = 'data:audio/wav;base64,UklGRjoAAABXQVZFZm10IBAAAAABAAEA6AcAANAPAAACABAAZGF0YQYAAAAAAAAAAAA%3D';
            try
            {
                audio.play();
            }
            catch (e) {}
        }
    };

    this.event_mainLoopCallback_ = function()
    {
        return function()
        {
            self.event_mainLoop();
        };
    };

    this.event_mainLoop = function()
    {
        var i, j, time;
        // schedule next execution
        pendingMainLoop = requestAnimationFrame(this.event_mainLoopCallback_());

        // if we are in the middle of importing a scene, no main loops
        if (isImportingScene)
        {
            return;
        }

        // only do stuff if all the resources have finished loading
        if (assetLoader.isFinishedLoading())
        {
            // hide the loading images
            for (i=0; i<loadingImages.length; i++)
            {
                if (loadingImages[i].style.display != 'none')
                {
                    loadingImages[i].style.display = 'none';
                }
            }

            // hide the loading bar if there is one
            if (loadingBar && loadingBar.style.display != 'none')
            {
                loadingBar.style.display = 'none';
            }

            // if the app is initialised, step and draw
            if (appInitialised)
            {
				// update blur levels
				var now = self.getAppTime();
				for (var layerId in blurTargets)
				{
					var blurTime = (now - blurTargets[layerId].startTime) / blurTargets[layerId].time;
					if (blurTime >= 1)
					{
						self.getLayer(layerId).setBlur(blurTargets[layerId].endValue);
						delete blurTargets[layerId];
					}
					else
					{
						self.getLayer(layerId).setBlur(blurTargets[layerId].startValue * (1 - blurTime) + blurTargets[layerId].endValue * blurTime);
					}
				}

                // draw
                sceneManager.draw();

                // determine how many simulation steps we need to do
                time = (new Date()).getTime();
                var numSteps = 0;
                var maxSteps = 3;
                var numStepsBehind = Math.round((time - mainLoopLastTime) / (wade.c_timeStep * 1000));
                if (mainLoopLastTime)
                {
                    numSteps = Math.min(maxSteps, numStepsBehind);
                }
                else
                {
                    mainLoopLastTime = time;
                }

                if (numSteps)
                {
                    // if we are so many steps behind, stop trying to catch up
                    if (numStepsBehind > catchUpBuffer / wade.c_timeStep)
                    {
                        numSteps = 1;
                        mainLoopLastTime = time;
                    }
                    else
                    {
                        mainLoopLastTime += numSteps * wade.c_timeStep * 1000;
                    }
                }

                // step
                for (i=0; i<numSteps && !simulationPaused; i++)
                {
                    // step the scene manager
                    sceneManager.step();

                    // process timeouts and intervals
                    var appTime = self.getAppTime() * 1000;
                    for (j=timeouts.length-1; j>=0; j--)
                    {
                        if (appTime >= timeouts[j].time)
                        {
                            var t = timeouts[j];
                            if (t.repeat)
                            {
                                t.time += t.repeat;
                            }
                            else
                            {
                                self.removeObjectFromArrayByIndex(j, timeouts);
                            }
							t.f();
                        }
                    }

                    // execute the mainLoop callbacks
                    for (j=0; j<mainLoopCallbacks.length; j++)
                    {
                        if (!mainLoopCallbacks[j].paused)
                        {
                            var f = mainLoopCallbacks[j].func;
                            f && f();
                        }
                    }
                }

                if (simulationPaused)
                {
                    sceneManager.setSimulationDirtyState();
                }
            }
            else if (appLoading)
            {
                // if the app hasn't been initialised yet, but it's finished loading, initialise it now
                this.initializeApp();
            }
        }
        else
        {
            mainLoopLastTime = (new Date()).getTime();

            // if the loading image is supposed to be visible, show it
            for (i=0; i<loadingImages.length; i++)
            {
                if (loadingImages[i].src)
                {
                    loadingImages[i].style.display = 'inline';
                }
            }

            // update the loading bar if there is one
            if (loadingBar)
            {
                loadingBar.inner.style.width = this.getLoadingPercentage() + '%';
            }
        }
    };

    this.event_appTimerEvent = function()
    {
        // schedule next execution
        pendingAppTimer = setTimeout('wade.event_appTimerEvent();', appTimerInterval * 1000);
        // tell the sceneManager to process the event
        sceneManager.appTimerEvent();
    };

    this.onObjectNameChange = function(sceneObject, oldName)
    {
        if (sceneObject.isInScene())
        {
            sceneManager.changeObjectName(sceneObject, oldName);
        }
    };

    this.onObjectGroupNameChange = function(objectGroup, oldName)
    {
        sceneManager.changeObjectName(objectGroup, oldName);
    };

    this.getLayer = function(layerId, renderMode)
    {
        return sceneManager.renderer.getLayer(layerId, renderMode);
    };

    this.getAllLayers = function()
    {
        return sceneManager.renderer.getAllLayers();
    };

    this.isSharedCanvas = function(canvas)
    {
        var layers = this.getAllLayers();
        var count = 0;
        for (var i=0; i<layers.length; i++)
        {
            if (layers[i].getCanvas() == canvas)
            {
                if (++count == 2)
                {
                    return true;
                }
            }
        }
        return false;
    };

    this.updateMouseInOut = function(oldPosition, newPosition)
    {
        sceneManager.updateMouseInOut(oldPosition, newPosition);
    };

    this.addImageUser = function(image, user)
    {
        sceneManager.renderer.addImageUser(image, user);
    };

    this.removeImageUser = function(image, user)
    {
        sceneManager.renderer.removeImageUser(image, user);
    };

    this.removeAllImageUsers = function(image)
    {
        sceneManager.renderer.removeAllImageUsers(image);
    };

    this.getInternalContext = function()
    {
        return internalContext;
    };

    this.getImageUsers = function(image)
    {
        return sceneManager.renderer.getImageUsers(image);
    };

    this.releaseImageReference = function(image)
    {
        assetLoader.releaseImageReference(this.getFullPathAndFileName(image));
    };

    // borrowed this from jQuery
    this.extend = function ()
    {
        var options, name, src, copy, copyIsArray, clone, target = arguments[0] || {},
            i = 1,
            length = arguments.length,
            deep = false;

        // Handle a deep copy situation
        if (typeof target === "boolean")
        {
            deep = target;

            // Skip the boolean and the target
            target = arguments[i] || {};
            i++;
        }

        // Handle case when target is a string or something (possible in deep copy)
        if (typeof target !== "object" && typeof target !== "function")
        {
            target = {};
        }

        // Extend wade itself if only one argument is passed
        if (i === length)
        {
            target = this;
            i--;
        }

        for (; i < length; i++)
        {
            // Only deal with non-null/undefined values
            if ((options = arguments[i]) != null)
            {

                // Extend the base object
                for (name in options)
                {
                    src = target[name];
                    copy = options[name];

                    // Prevent never-ending loop
                    if (target === copy)
                    {
                        continue;
                    }

                    // Recurse if we're merging plain objects or arrays
                    if (deep && copy && (wade.isPlainObject(copy) || (copyIsArray = wade.isArray(copy))))
                    {

                        if (copyIsArray)
                        {
                            copyIsArray = false;
                            clone = src && wade.isArray(src) ? src : [];
                        }
                        else
                        {
                            clone = src && wade.isPlainObject(src) ? src : {};
                        }

                        // Never move original objects, clone them
                        target[name] = wade.extend(deep, clone, copy);
                    }
                    else if (copy !== undefined) // Don't bring in undefined values
                    {
                        target[name] = copy;
                    }
                }
            }
        }

        // Return the modified object
        return target;
    };

    // borrowed this from jQuery (simplified a bit)
    this.isPlainObject = function(obj)
    {
        var proto, Ctor;

        // Detect obvious negatives
        // Use toString to catch host objects
        if (!obj)
        {
            return false;
        }
        try
        {
            if (toString.call(obj) !== '[object Object]')
            {
                return false;
            }
        }
        catch(e)
        {
            try
            {
                if (Object.prototype.toString.call(obj) !== '[object Object]')
                {
                    return false;
                }
            }
            catch (e) {}
        }

        proto = Object.getPrototypeOf(obj);

        // Objects with no prototype (e.g., `Object.create( null )`) are plain
        if (!proto)
        {
            return true;
        }

        // Objects with prototype are plain iff they were constructed by a global Object function
        Ctor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
        return typeof Ctor === "function" && fnToString.call(Ctor) === objectFunctionString;
    };

    this.texImage2D = function(context, image)
    {
        var w = image.width;
        var h = image.height;
        var isPowerOfTwo = !((w & (w-1)) || (h & (h-1)));
        if (image.image)
        {
            context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, image.image);
        }
        else
        {
            context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, w, h, 0, context.RGBA, context.UNSIGNED_BYTE, null)
        }
        if (isPowerOfTwo)
        {
            context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
            context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR_MIPMAP_NEAREST);
            context.generateMipmap(context.TEXTURE_2D);
        }
        else
        {
            context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR); // NPOT
            context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR); // NPOT ?
            context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE); // NPOT
            context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE); // NPOT
        }
    };


    this.isUsingGlobalUnderscore = function()
    {
        return globalUnderscore;
    };

    this.shaderErrorLog = this.log;
	this.shaderSuccessLog = this.doNothing;

    this.deprecate = function(oldName, newName)
    {
        this[oldName] = function()
        {
            self.warn('wade.' + oldName + ' is deprecated. Please use wade.' + newName + ' instead');
            return self[newName].apply(self, arguments);
        }
    };

    // avoid console.log errors when the debugger is not attached
    if (!window.console)
    {
        window.console = {};
    }
    if (!window.console.log)
    {
        window.console.log = this.doNothing;
    }
    if (!window.console.warn)
    {
        window.console.warn = window.console.log;
    }
    if (!window.console.error)
    {
        window.console.error = window.console.warn;
    }

    // deprecated function names
    this.deprecate('playAudioSegmentIfAvailable', 'playAudioSegment');
    this.deprecate('playAudioIfAvailable', 'playAudio');
    this.deprecate('setMainLoopCallback', 'setMainLoop');
}

/**
 * This is the global object that is used to interact with the engine
 * @type {Wade}
 */
wade = new Wade();

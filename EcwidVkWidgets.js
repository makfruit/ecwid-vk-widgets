/*
 * A script for Ecwid to display Vkontakte social widgets (like, share, comments) on the product pages.
 */

/*
 * EcwidVkWidgets module - the main one. It initialize VK widgets, handle Ecwid events
 * and show the widgets. It also provides interfaces to all included modules.
 */
var EcwidVkWidgets = (function(module) {
  var _config;
  var _activeWidgets = [];

  /*
   * Extend object
   */
  function _extend(target, src, isRecursive) {
    var targetType = typeof (target);
    var srcType = typeof (src);
    if (
      'undefined' == targetType
      || 'undefined' == srcType
    ) {
      return src || target;
    }

    if (target === src) {
      return target;
    }

    if ('object' == srcType) {
      if ('object' != targetType) {
        target = {};
      }
      for (var key in src) {
        if (isRecursive) {
          target[key] = _extend(target[key], src[key], isRecursive);

        } else {
          target[key] = src[key];
        }
      }

    } else {
      target = src;
    }

    return target;
  }

  /*
   * Set configuration
   */
  function _setConfig(userConfig) {
    if (
      typeof userConfig != 'object'
      || !userConfig.vkApiId
    ) {
      EcwidVkWidgets.Log.err(EcwidVkWidgets.Messages.ERR_VKAPIID_NOT_SET);
      return false;
    }

    _config = _extend(EcwidVkWidgets.DefaultConfig, userConfig, true);
  }

  /*
   * Check whether at least one widget is enabled
   */
  function _isEnabled() {
    return (_activeWidgets.length > 0);
  }

  /*
   * Prepare and show widgets on the current page
   */
  function _showProductPageWidgets() {
    // Get the product information
    var productInfo = EcwidVkWidgets.EcwidApi.getEcwidProductInfo();

    // Get the page URL
    var pageUrl = window.location;

    // Show widgets
    for (var i in _activeWidgets) {
      _activeWidgets[i].show(productInfo, pageUrl);
    }
  }

  /*
   * Init VK Widgets: 
   *   - initialize VK libraries, 
   *   - create widget objects,
   *   - attach event handlers
   */
  function _start() {
    // Init VK API
    try {
      VK.init({
        apiId: _config.vkApiId,
        onlyWidgets: true
      });

    } catch (e) {
      EcwidVkWidgets.Log.err(EcwidVkWidgets.Messages.ERR_VK_NOT_INIT);
      return false;
    }

    // Create widget objects and fill the _activeWidgets array
    for (var widgetType in _config.appearance) {
      if (_config.appearance[widgetType].enabled) {
        _activeWidgets[_activeWidgets.length] = EcwidVkWidgets.WidgetsFactory.createWidget(widgetType, _config.appearance[widgetType]);
      }
    }
    
    // Attach handlers if needed
    if (_isEnabled()) {
      EcwidVkWidgets.EcwidApi.attachProductPageLoadedHandler(_showProductPageWidgets);
    }
  }

  /*
   * The main function: set configuration, initialize and show widgets
   */
  function _load(config) {
    // Check if Ecwid exists on the page
    if (typeof (window.Ecwid) != 'object') {
      EcwidVkWidgets.Log.err(EcwidVkWidgets.Messages.ERR_NO_ECWID);
      return false;
    }

    // Set configuration
    _setConfig(config);

    // Load dependencies and init widgets
    EcwidVkWidgets.Loader.load(
      [
        {
          test: window.jQuery,
          sources: ['https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js']
        },
        {
          test: window.VK,
          sources: [
            'http://userapi.com/js/api/openapi.js?48',
            'https://vkontakte.ru/js/api/share.js?9'
          ]
        }
      ],
      _start
    );
  }

  // Public
  return (_extend(
    module,
    {
      load: _load,
      extend: _extend
    }
  ));
}(EcwidVkWidgets || {}));

/*
 * EcwidVkWidgets.Loader module provides functions for checking dependencies, 
 * loading remote scripts and invoking a callback function after all dependencies 
 * are loaded
 */
EcwidVkWidgets.Loader = (function(module) {
  var _scripts = [];
  var _numScripts = 0;

  // Final callback (called after all the scripts are loaded)
  var _completeCallback = function() {};  

  /*
   * Callback on script loading
   */
  function _onScriptLoaded() {
    if (--_numScripts <= 0) {
      _completeCallback();
    }
  }

  /*
   * Load external JS script
   */
  var _injectJs = function(src, callback) {
    var script = document.createElement("script");
    script.setAttribute("src", src);
    script.charset = "utf-8";
    script.setAttribute("type", "text/javascript");
    script.onreadystatechange = script.onload = callback;
    document.body.appendChild(script);
  }

  /*
   * Load all dependencies
   */
  var _load = function(dependencies, callback) {
    _completeCallback = callback;
    if (typeof dependencies !== 'undefined') {
      // Test and collect sources for loading
      for (var d in dependencies) {
        if (
          typeof (dependencies[d].test) === 'undefined'
          && typeof (dependencies[d].sources) === 'object'
        ) {
          for (var s in dependencies[d].sources) {
            _scripts[_scripts.length] = dependencies[d].sources[s];
          }
        }
      }

      _numScripts = _scripts.length;

      if (_numScripts <= 0) {
        _completeCallback();

      } else {
        for (var i = 0; i < _numScripts; i++) {
          _injectJs(_scripts[i], _onScriptLoaded);
        }
      }

    } else {
      _completeCallback();
    }
  }

  // Public
  return (EcwidVkWidgets.extend(
    module,
    {
      load: _load
    }
  ));

})(EcwidVkWidgets.Loader || {});

/*
 * EcwidVkWidgets.EcwidApi module provides Ecwid-related function (JS API wrappers, 
 * product info parsers and so on)
 */
EcwidVkWidgets.EcwidApi = (function(module) {
  /*
   * Truncate text in product description according to the given limits
   */
  var _truncateProductDescription = function(text, length) {
    return ($.trim(text).substring(0, length).split(" ").slice(0, -1).join(" ") + "...");
  }

  /* 
   * Parse the page source and get the product information
   */
  var _getEcwidProductInfo = function() {
    var productInfo = {
      'imageUrl': $('.ecwid-productBrowser-details-thumbnail > img').attr('src'),
      'productTitle': $('.ecwid-productBrowser-head').text(),
      'productDescr': $('.ecwid-productBrowser-details-descr').text()
    };
    return productInfo;
  }

  /*
   * Assign a handler to the Ecwid.OnPageLoaded event
   */
  var _attachProductPageLoadedHandler = function(callback) {
    //Ecwid.OnPageLoaded.add(func);
    Ecwid.OnPageLoaded.add(function(page) {
      if (
        typeof (page) == 'object'
        && 'PRODUCT' == page.type
      ) {
        callback();
      }
    });
  }

  // Public
  return (EcwidVkWidgets.extend(
    module,
    {
      attachProductPageLoadedHandler: _attachProductPageLoadedHandler,
      truncateProductDescription: _truncateProductDescription,
      getEcwidProductInfo: _getEcwidProductInfo
    }
  ));

})(EcwidVkWidgets.EcwidApi || {});

/*
 * EcwidVkWidgets.Widget module: Abstract Widget (as a cached mixin)
 */
EcwidVkWidgets.Widget = (function(module) {

  module.createHTMLContainer = function() {
    // Here, 'this' refers to child class
    $('#' + this.config.elmId).remove();
    $(this.config.elmParentSelector).append(
      "<div id='" + this.config.elmId + "' class='" + this.config.elmCssClass + "'></div>"
    ).show(); 
  }

  /*
   * Mixin function
   */
  function mixin() {
    for (key in module) {
      if (module.hasOwnProperty(key)) {
        this[key] = module[key];
      }
    }
    return this;    
  }

  return mixin;
  
})(EcwidVkWidgets.Widget || {});

/*
 * EcwidVkWidgets.WidgetsFactory module: Factory of widgets
 */
EcwidVkWidgets.WidgetsFactory = (function(module) {
  var _TYPE_LIKE = 'like';
  var _TYPE_SHARE = 'share';
  var _TYPE_COMMENTS = 'comments';

  /*
   * Create an instance of a widget object
   */
  function _createWidget(type, config) {
    if (typeof (type) !== 'string') {
      EcwidVkWidgets.Log.wrn(EcwidVkWidgets.Messages.WRN_BAD_WIDGET_TYPE);
      return false;
    }

    switch(type) {
      case _TYPE_LIKE:
        return new EcwidVkWidgets.LikeWidget(config);
        break;

      case _TYPE_SHARE:
        return new EcwidVkWidgets.ShareWidget(config);
        break;

      case _TYPE_COMMENTS:
        return new EcwidVkWidgets.CommentsWidget(config);
        break;

      default:
        return new EcwidVkWidgets.LikeWidget(config);
    }
  }

  return EcwidVkWidgets.extend(
    module,
    {
      createWidget: _createWidget
    }
  );

})(EcwidVkWidgets.WidgetsFactory || {});


/*
 * EcwidVkWidgets.LikeWidget module: Like Widget (extends Widget)
 */
EcwidVkWidgets.LikeWidget = function(config) {
  this.config = config;

  var that = this;
  this.show = function(productInfo, pageUrl) {
    that.createHTMLContainer();
    VK.Widgets.Like(
      that.config.elmId, 
      {
        type: that.config.type,
        width: that.config.width,
        pageTitle: productInfo.productTitle,
        pageDescription: EcwidVkWidgets.EcwidApi.truncateProductDescription(
          productInfo.productDescr, 
          that.config.shareTextMaxLength
        ),
        pageUrl: pageUrl,
        pageImage: productInfo.imageUrl,
        image: productInfo.imageUrl,
        text: productInfo.productTitle,
        height: that.config.height,
        verb: that.config.verb
      }
    );
  }
}
EcwidVkWidgets.Widget.call(EcwidVkWidgets.LikeWidget.prototype);

/*
 * EcwidVkWidgets.ShareWidget module: Share Widget (extends Widget)
 */
EcwidVkWidgets.ShareWidget = function(config) {
  this.config = config;

  var that = this;
  this.show = function(productInfo, pageUrl) {
    that.createHTMLContainer();
    $('#' + that.config.elmId).html(
      VK.Share.button({
        url: pageUrl,
        title: productInfo.productTitle,
        description: EcwidVkWidgets.EcwidApi.truncateProductDescription(
          productInfo.productDescr, 
          that.config.shareTextMaxLength
        ),
        image: productInfo.imageUrl,
        noparse: that.config.noparse
      })
    );
  }
}
EcwidVkWidgets.Widget.call(EcwidVkWidgets.ShareWidget.prototype);

/*
 * EcwidVkWidgets.CommentsWidget module: Comments Widget (extends Widget)
 */
EcwidVkWidgets.CommentsWidget = function(config) {
  this.config = config;

  var that = this;
  this.show = function(productInfo, pageUrl) {
    that.createHTMLContainer();
    VK.Widgets.Comments(
      that.config.elmId, 
      {
        width: that.config.width,
        limit: that.config.limit,
        attach: that.config.attach,
        autoPublish: that.config.autoPublish,
        mini: that.config.mini,
        height: that.config.height,
        norealtime: that.config.norealtime,
        pageUrl: pageUrl
      }
    );
  }
}
EcwidVkWidgets.Widget.call(EcwidVkWidgets.CommentsWidget.prototype);

/*
 * EcwidVkWidgets.Log module provides functions for status messages, 
 * like warnings, errors and simple logs. 
 */
EcwidVkWidgets.Log = (function(module) {
  var _PREFIX = "EcwidVkWidgets: ";
  var _TYPE_MSG = 1;
  var _TYPE_WRN = 2;
  var _TYPE_ERR = 3;

  /*
   * Prepare and print message
   */
  function _log(message, type) {
    // Prepare message
    message = _PREFIX + message.toString();

    // Detect message type and print it
    switch (type) {
      case _TYPE_MSG:
        EcwidVkWidgets.Log.Console.log(message);
        break;

      case _TYPE_WRN:
        EcwidVkWidgets.Log.Console.warn(message);
        break;

      case _TYPE_ERR:
        EcwidVkWidgets.Log.Console.error(message);
        break;

      default:
        EcwidVkWidgets.Log.Console.log(message);
        break;
    }

  }
  
  function _msg(message) {
    _log(message, _TYPE_MSG);
  }

  function _wrn(message) {
    _log(message, _TYPE_WRN);
  }

  function _err(message) {
    _log(message, _TYPE_ERR);
  }

  // Public
  return (EcwidVkWidgets.extend(
    module,
    {
      msg: _msg,
      wrn: _wrn,
      dbg: _wrn, // alias for debug
      err: _err
    }
  ));

})(EcwidVkWidgets.Log || {});

/*
 * EcwidVkWidgets.Log.Console module: wrapper for window.console with fallbacks
 */
EcwidVkWidgets.Log.Console = (function(module) {
  var _module = {};
  function _void() {}

  if (typeof window.console == 'undefined') {
    _module = {
      log: _void,
      warn: _void,
      error: _void
    }

  } else {
    _module.log = (
      window.console.log ? 
        function(message) { window.console.log(message) }
        :  _void
    );
    _module.warn = (
      window.console.warn ?
        function(message) { window.console.warn(message) }
        : _module.log
    );
    _module.error = (
      window.console.error ?
        function(message) { window.console.error(message) }
        : _module.log
    );
  }

  // Public
  return (EcwidVkWidgets.extend(
    module,
    _module
  ));

})(EcwidVkWidgets.Log.Console || {});

/*
 * EcwidVkWidgets.DefaultConfig module: widgets' default settings.
 * Please refer to the Vkontakte API documentation for the details:
 * http://vk.com/pages?oid=-1&p=%D0%94%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F
 */
EcwidVkWidgets.DefaultConfig = (function(module) {
  var _config = {
    vkApiId: '',
    appearance: {
      like: {
        enabled: false,
        elmId: "ecwid_vk_like",
        shareTextMaxLength: 140, // VK restrictions
        elmParentSelector: ".ecwid-productBrowser-details-like", // widget's place
        elmCssClass: "ecwid-vk-like",

        type: 'full', // {'full', 'button', 'mini', 'vertical'}
        width: 250,
        height: 22,
        verb: 0 // {0, 1}
      },

      share: {
        enabled: false,
        elmId: "ecwid_vk_share",
        shareTextMaxLength: 140, // VK restrictions
        elmParentSelector: ".ecwid-productBrowser-details-like", // widget's place
        elmCssClass: "ecwid-vk-share",

        noparse: true
      },

      comments: {
        enabled: true,
        elmId: "ecwid_vk_comments",
        elmParentSelector: ".ecwid-productBrowser-details-comments", // widget's place
        elmCssClass: "ecwid-vk-comments",

        width: 500, // {300-inf}
        limit: 10, // {5-100}
        attach: '*', // { 'graffiti', 'photo', 'audio', 'video', 'link', '*' }
        autoPublish: 1, // {0, 1}
        mini: 'auto', // { 0, 1, 'auto' }
        height: 500, // {0, 500-inf}
        norealtime: 0 // {0, 1}
      }
    }
  }

  return (EcwidVkWidgets.extend(module, _config, true));

}(EcwidVkWidgets.DefaultConfig || {}));

/*
 * EcwidVkWidgets.Messages module: messages constants
 */
EcwidVkWidgets.Messages = (function(module) {
  var _module = {
    ERR_NO_ECWID: "Ecwid isn't found on the page",
    ERR_VKAPIID_NOT_SET: "VK API ID is not set",
    ERR_VK_NOT_INIT: "VK initialization failed",

    WRN_BAD_WIDGET_TYPE: "Failed to create widget: invalid type"
  }

  return (EcwidVkWidgets.extend(module, _module, true));

}(EcwidVkWidgets.DefaultConfig || {}));

/*
 /*
 * Component Name : CreditCard
 *
 * This component encapsulates the logic for tokenizing a credit card (using an external tokenizer service)
 *
 * data options
 *      useTokenizer : should we even try and tokenize
 *      tokenScript : the list of scripts to use (will alternate between them if there is more than one
 *      finalScript : a final script to call if other ones fail (needed for TTO to retry at the f5 the final time)
 *      retryAmounts : array of timeout values
 *      systemId : system Id of your application that you have set up with the tokenizer onboarding
 *      evtName : Mojo will publish an event under this name.
 *                payload will contain an object with the key
 *                "start" : null,
 *                "success" : token,
 *                "fail" : true (indicating credit card error) | false (indicates tokenizer error)
 *                "info" : MojoException with information.
 *
 * full documentation: http://wikis.intuit.com/tto/index.php/Credit_Card_Tokenizer
 * 
 */

Mojo.uiComponents.CreditCard = Mojo.interfaces.uiComponent.extend({

    tokenTryCnt:0,

    // PUBLIC API
    //-----------------------------------------------
    create:function ($component, data) {
        var t = this;
        var data = data || {};

        var $el = jQuery('<span id="ccWrapper" />'); 							// credit card input fields wrapper
        var $customerCCInput = jQuery('<input class="customerCC" />'); 		// real user input field
        var $tokenizedCCInput = jQuery('<input class="tokenizedCC" />'); 		// pay input field - this will be bound to the model
        var $maskedCCInput = jQuery('<input class="maskedCC" />'); 			// masked content input field

        t._copyDataAttributes($component, $customerCCInput);
        $customerCCInput.attr("maxlength", $component.attr("maxlength"));	//copy over any maxlength attributes.

        // capture the widget attributes
        t.useTokenizer = (typeof data.useTokenizer !== "undefined") ? data.useTokenizer : true;
        t.maskingEnabled = typeof data.modelMaskedProp !== 'undefined'; 	// optionally mask credit card 
        t.storeUntokenizedEnabled = typeof data.modelUntokenizedProp !== 'undefined';	// optionally store customers original cc input
        t.retryAmounts = data.retryAmounts;
        t.tokenScript = data.tokenScript;
        t.finalScript = data.finalScript;
        t.sysid = data.systemId;
        t.msg = data.msg || "Invalid credit card.";
        t.tokenizingEvtName = data.evtName || "TOKENIZER";
        t.tokenTryCnt = 0;

        // capture the html elements
        t.$customerCCInput = $customerCCInput;
        t.$tokenizedCCInput = $tokenizedCCInput;
        if (t.maskingEnabled) {                                             // only add the masked field if enabled
            t.$maskedCCInput = $maskedCCInput;
        }
        t.$el = $el;

        if (t.useTokenizer) {

            //// bind the fields to the model
            // when tokenizing bind the tokenized field to the main credit card model property send in the uiwidget data-bind
            $tokenizedCCInput.attr("data-bind", $component.attr("data-bind"));
            // dont send the original cc
            $customerCCInput.removeAttr("data-bind");
            // otherwise allow the customer input field to continue to be bound to the main credit card model property send in the uiwidget data-bind
            // as accomplished above: t._copyDataAttributes($component, $customerCCInput);
            if (t.storeUntokenizedEnabled) {
                $customerCCInput.attr("data-bind", data.modelUntokenizedProp);	// if storeUntokenizedEnabled bind to model
            }
            if (t.maskingEnabled) {
                $maskedCCInput.attr("data-bind", data.modelMaskedProp);			// if maskingEnabled bind to model
            }

            //// setup the user events listeners
            $customerCCInput.focus(function () {
                Tokenizer.Abort(); // abort any currently running tokenization
            });
            $customerCCInput.blur(function () {
                if (t.$customerCCInput.val()!="") {
                    t._publishEvent("start");
                    t._tokenizeCC();
                }
            });
            $maskedCCInput.focus(function () {
                t._showCCInput('customerCC');
                t.$customerCCInput.focus();
            });
        } else {
            TRACE("Tokenizer is disabled");
        }

        $el.append($customerCCInput);
        if (t.useTokenizer) {
            $el.append($tokenizedCCInput);
            if (t.maskingEnabled) { // only add the masked field if enabled
                $el.append($maskedCCInput);
            }
        }

        return $el;
    },

    update:function () {

    },

//--------------------------------------
// Private methods for tokenizing
//--------------------------------------
    _tokenizeCC:function () {
        var t = this;
        var cc = t.$customerCCInput.val();
        if (typeof Tokenizer === "undefined" || cc == null)
            return;

        // swap retry urls on every retry
        var _url = t.tokenScript;
        _url += "?sysid=" + t.sysid;
        t.$customerCCInput.attr("tknURL", _url);

        Tokenizer.setScriptSrc(_url);
        Tokenizer.setSuccessCB(function (token) {
            t._handleTokenSuccess(cc, token);
        });
        Tokenizer.setErrorCB(function (errType, rsp) {
            t._handleTokenError(errType, rsp);
        });
        Tokenizer.TokenizeCC(cc, t.retryAmounts[t.tokenTryCnt] * 1000); // Set the timeout based on the retry count
        TRACE("Tokenizing:");
        TRACE(" - cc: " + cc);
        TRACE(" - url: " + _url);
        TRACE(" - retry #" + (t.tokenTryCnt + 1) + ": " + t.retryAmounts[t.tokenTryCnt] + " seconds");

        return true;
    },

    //----------------------------------------------------------------------------
    _showCCInput:function (name) {
        var t = this;
        t.$el.attr('class', '');
        t.$el.addClass(name);
    },

    //----------------------------------------------------------------------------
    _handleTokenSuccess:function (cc, token) {
        TRACE("Tokenize Success. Credit Card Token: " + token);
        this._publishEvent("success", {'ccNum':cc, 'token':token, 'maskedToken':this._maskToken(token)});
        if (this.maskingEnabled) {
            this._showCCInput('maskedCC');
        }
        this._doClearTokenCode();
    },

    //----------------------------------------------------------------------------
    _handleTokenError:function (errorType, rsp) {
        var t = this;
        TRACE("Tokenize Failed. errorType: " + errorType);

        var origCCNum = t.$customerCCInput.val();
        var cc = origCCNum.substring(origCCNum.length - 4);
        var scrpt = t.$customerCCInput.attr("tknURL");
        var msg = "Tokenizer Message: Try #" + (t.tokenTryCnt + 1) + "; CC=" + cc + "; URL= " + scrpt + "; MSG= ";

        // Credit Card Error
        if (Tokenizer.kCCError == errorType) {
            var errorMsg = "Encountered CC error";
            TRACE(errorMsg);

            t._doFail(errorType, errorMsg, origCCNum);
        }

        // Non-recoverable - bail and display an error
        else if (Tokenizer.kError_NonRecoverable == errorType) {
            var errorMsg = "Encountered non-recoverable error in tokenizer";
            TRACE(errorMsg);

            t._doFail(errorType, errorMsg, origCCNum);
            msg += rsp.error.code + " - Non Recoverable...ABORTING";
            t._publishEvent("info", new MojoException("TOKENIZER", msg, LOG_ERROR));
        }
        else if (Tokenizer.kError_JSONParser == errorType) {
            var errorMsg = "Encountered json parser error in tokenizer";
            TRACE(errorMsg);

            t._doFail(errorType, errorMsg, origCCNum);
            msg += "JSON Parse Error - Non Recoverable...ABORTING";
            t._publishEvent("info", new MojoException("TOKENIZER", msg, LOG_ERROR));
        }


        // Recoverable errors - try again
        else if (Tokenizer.kError_Recoverable == errorType) {
            TRACE("Encountered recoverable error, retrying...");

            msg += rsp.error.code + " - Recoverable...Retrying";
            t._publishEvent("info", new MojoException("TOKENIZER", msg, LOG_INFO));
            t._doRetryTokenizer();
            return;
        }
        else if (Tokenizer.kError_Timeout == errorType) {
            TRACE("Encountered timeout error, retrying...");

            msg += t.retryAmounts[t.tokenTryCnt] + " seconds Timed out: - ...Retrying";
            t._publishEvent("info", new MojoException("TOKENIZER", msg, LOG_INFO));
            t._doRetryTokenizer();
            return;
        }

        t._doClearTokenCode();
    },

    //----------------------------------------------------------------------------
    _doRetryTokenizer:function () {
        var t = this;
        // If we've maxed out our retries
        if (++t.tokenTryCnt >= t.retryAmounts.length) {
            var errorMsg = "Not retrying tokenizer because token retry count exceeds max allowable retry amount";
            TRACE(errorMsg);
            t._publishEvent("info", new MojoException("TOKENIZER", "Tokenizer Error: Timout...ABORTING", LOG_ERROR));

            var origCCNum = t.$customerCCInput.val();
            t._doFail(Tokenizer.kError_Timeout, errorMsg, origCCNum);
            t._doClearTokenCode();
        }
        // Else try again
        else {
            TRACE("Retrying tokenizer");
            t._tokenizeCC();
        }
    },

    //----------------------------------------------------------------------------
    _doClearTokenCode:function () {
        TRACE("Clearing token");
        Tokenizer.Abort();
        this.tokenTryCnt = 0;
    },

    //----------------------------------------------------------------------------
    _doFail:function (errorType, errorMsg, origCCNum) {
        TRACE("Setting tokenizer error: " + errorMsg);
        this._publishEvent("fail", {'type':errorType, 'msg':errorMsg, 'ccNum':origCCNum});
    },

    //----------------------------------------------------------------------------
    _publishEvent:function (type, data) {
        var obj = {};
        obj[type] = data;
        Mojo.publishEvent(this.tokenizingEvtName, obj);

    },

    //----------------------------------------------------------------------------
    // change all but the last four characters to *
    _maskToken:function (token) {
        var maskedToken = '';
        for (var i = 0; i < token.length; i++) {
            maskedToken += (i < token.length - 4) ? '*' : token[i];
        }
        return maskedToken;
    }


});
Mojo.uiComponents.registry.registerComponentClass("creditcard", Mojo.uiComponents.CreditCard);


//-----------------------------------------------------------------------------
// Tokenizer Namespace
//
// Copyright <c> 2012 Intuit, Inc. All rights reserved
//-----------------------------------------------------------------------------
sdsa_rsp = null; // The token script will insert this variable, so it needs to be defined
// at the same level as the Tokenizer class

Tokenizer = new function () // anonymous class/function enforces namespace behavior
{
    var Tokenizer = this;

    // Public Error Conditions
    // ---------------------------------------------
    Tokenizer.kCCError = 1;
    Tokenizer.kError_Recoverable = 2;
    Tokenizer.kError_NonRecoverable = 3;
    Tokenizer.kError_Timeout = 4;
    Tokenizer.kError_JSONParser = 5;


    var kTokenCookieName = "sdsa_cc";
    var kTokenCookiePath = "/sdsa";
    var kPublicDomain = ".intuit.com";
    var kExpCookieDate = "Friday, 12-Dec-00 12:00:00 GMT";

    // Early versions of Safari dont allow setting of a cookie
    // In a path that is not the same as the page that was served
    // In this case just use the root path, per the Tokenizing guys,
    //  This should work just the same.
//   if (gbSafari) kTokenCookiePath = '/'

    var kTokenScriptID = 'TKN';

    var _tokenScriptSrc = "https://gwsoajsod.intuit.com/sdsa?sysid=tto";
    var _tokenTimer = null;
    var _responseWaiter = null;
    var _tokenWaitTime = 20000; // default to 20 seconds
    var _successCB = null;
    var _errorCB = null;
    var _cnt = 0;

//---------------------------------------------------
// Public API
//---------------------------------------------------
    Tokenizer.TokenizeCC = function (cc, waitTime) {
        if (waitTime)
            _tokenWaitTime = waitTime;
        Tokenizer._clearTokenCode();
        document.cookie = kTokenCookieName + '=' + cc + ';path=' + kTokenCookiePath + ';domain=' + kPublicDomain + ';secure';
        var head = document.getElementsByTagName('head').item(0);
        var ts = document.getElementById(kTokenScriptID);
        if (ts) head.removeChild(ts);

        var script = document.createElement('script');
        script.src = _tokenScriptSrc + '&num=' + _cnt++;  // Add uniqueness to the script so we don't get a cached version
        script.type = 'text/javascript';
        script.id = kTokenScriptID;
        head.appendChild(script);

        setTimeout('Tokenizer._waitForToken()', 0);

        // Abort if we don't get a response in the specified time
        _tokenTimer = setTimeout('Tokenizer._abort()', _tokenWaitTime);

    };

    //----------------------------------------------------------------------------
    Tokenizer.setSuccessCB = function (cb) {
        _successCB = cb;
    };
    //----------------------------------------------------------------------------
    Tokenizer.setErrorCB = function (cb) {
        _errorCB = cb;
    };

    //----------------------------------------------------------------------------
    Tokenizer.Abort = function () {
        Tokenizer._clearTokenCode();
    };

    //----------------------------------------------------------------------------
    Tokenizer.setScriptSrc = function (src) {
        _tokenScriptSrc = src;
    };

//---------------------------------------------------
// Private API
//---------------------------------------------------

    Tokenizer._waitForToken = function () {
        if (!(sdsa_rsp)) {
            _responseWaiter = setTimeout('Tokenizer._waitForToken()', 200);
            return;
        }
        Tokenizer._parseTokenizerResponse();
        clearTimeout(_responseWaiter);
        clearTimeout(_tokenTimer);
    };

    //----------------------------------------------------------------------------
    Tokenizer._clearTokenCode = function () {
        // Clear the token cookie and script from the DOM
        document.cookie = kTokenCookieName + "=0; expires=" + kExpCookieDate + "; domain=" + kPublicDomain + "; path=" + kTokenCookiePath;
        var head = document.getElementsByTagName('head').item(0);
        var ts = document.getElementById(kTokenScriptID);
        if (ts) head.removeChild(ts);

        // Reset the token variable
        sdsa_rsp = null;

        // Clear our timeouts
        clearTimeout(_responseWaiter);
        clearTimeout(_tokenTimer);
    };

    //----------------------------------------------------------------------------
    Tokenizer._parseTokenizerResponse = function () {
        try {
            var rsp = sdsa_rsp;
            if (rsp.token) {
                if (_successCB) _successCB(rsp.token)
            }
            else if (rsp.error) {
                var err = rsp.error.code;
                // The 100 series errors are cc errors
                if (err < 200) {
                    if (_errorCB) _errorCB(Tokenizer.kCCError, rsp)
                }
                // The 200-499 series of errors are non-recoverable - bail and don't pass token
                else if (err < 500) {
                    if (_errorCB) _errorCB(Tokenizer.kError_NonRecoverable, rsp)
                }
                // The 500 series error are token service errors - try again
                else {
                    if (_errorCB) _errorCB(Tokenizer.kError_Recoverable, rsp)
                }
            }
        }
        catch (e) {
            if (_errorCB) _errorCB(Tokenizer.kError_JSONParser, rsp);
        }
    };

    //----------------------------------------------------------------------------
    Tokenizer._abort = function () {
        Tokenizer._clearTokenCode();
        if (_errorCB) _errorCB(Tokenizer.kError_Timeout, 'Tokenizer Timeout')
    }


};

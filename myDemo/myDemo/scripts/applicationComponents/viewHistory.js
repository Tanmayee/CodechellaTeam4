/*
 Utility class that listens for Flow transition events
 And keeps a stack of the VIEW transitions (and ACTIONs if specified).

 This class will also listen for named events to perform a "back" in the system.
 The "Back" pops the last view off the stack and "jumps" to it.
 The named event that this class will listen for is passed in the constructor.
 So it is up to the application to define those events and publish them so this class can do its thing.

 Implementation details :
 As each flow transition is executed in the flow, an event is fired that contains information about the node that it
 is transitioning to.  Most importantly part of this information is the id of the current flow and
 the stack of flows that were executed to get to the node. This transition is put on a stack of recent views.
 When a 'back' is requested the last view on the stack is popped.
 And a jump request is constructed that uses the path element of the item (which, remember, contains a stack of flows that are needed to reach the node).
 As each path element is reconstructed, it uses the id element of the flow to regenerate the flowState of that flow. (It just so happens that the flow's id
 is the same as the FLOW_SCOPED model for that flow, so it is easy to get a handle to it).

 Actions can also be put on this stack, but they have to explicitly have the history : always attribute as part of their definition.
 I think the best practice if you want to put an action in the history is to have history : never on all of the possible view that the action could lead to.

 Flows default to history="always" but can specify "never" in the flow definition, in which case their subflows will also be removed from history.
 Modal flows are always removed from history when they exit.

 Listens for flowTransition events
 {
 "name" : name of the flow,
 "id" : uuid of the flow,
 "def" : flow definition json
 "metaData" : {
 "nodeName" : node name of the flow
 "  path" : array of flowJump objects that tell the system how to statefully regen the flows
 }
 }

 flowEnd
 {   "name" : name of the flow,
 "id" : uuid of the flow,
 "metaData": "metaData" : {
 "nodeName" : node name of the flow
 "path" : array of flowJump objects that tell the system how to statefully get to this flow
 }
 }

 */
var viewHistory = function (backEvent, maxSize) {

    var _impl = {

        start : function () {
            _listening = true;
        },

        stop : function (clear) {
            if (clear) _impl.clear();
            _listening = false;
        },

        // Clear the history
        clear : function () {
            _currentTransition = null;
            _history = [];
            _flowScopeMap = {};
        },

        // Create a string representation of the guts of our module so that it can be saved off.
        serialize : function () {
            var s = {
                "flowscopes" : _flowScopeMap,
                "history" : _history,
                "current" : _currentTransition
            };

            return Mojo.utils.jsonSerializer.toString(s);
        },

        // Rehydrate the state of the module. Most likely from what was saved off.
        deserialize : function (str) {
            var s = Mojo.utils.jsonSerializer.toJSON(str);
            _flowScopeMap = s.flowscopes;
            _history = s.history;
            _currentTransition = s.current;
        },

        // pop the last thing off the stack, but don't go back to it
        pop : function () {
            if (_history.length > 0) _history.pop();
        },

        // Event handler that listens for flow transition events
        captureTransition : function (transObj) {
            transObj.modal = transObj.modal || Mojo.application.applicationController.inModal();

            if (!_listening || _maxSize == 0) return;

            // Listen here for a transition off the _currentTransition
            if (_currentTransition) {

                if (_maxSize && _history.length == _maxSize) {
                    _history.shift();
                    // adjust forgetWhenDone object indexes due to the shift
                    _.each(_forgetWhenDone, function(value,key) {
                        if(value <= 0) {
                            delete _forgetWhenDone[key];
                        }
                        else {
                            _forgetWhenDone[key] = value - 1;
                        }
                    });
                }
                _history.push(_currentTransition);
                _currentTransition = null;
            }

            // Create a new transition object
            if(_rememberState(transObj)) {
                _currentTransition = transObj;
            }
            if(transObj.stateDef.state_type === Mojo.flow.constants.kFlowState) {
                // if starting a modal flow or a history=never flow, record the flow ref and the starting position in the _history,
                // so flow states can be removed from the history when the flow is done
                if(transObj.stateDef.history === Mojo.flow.constants.historyType.kNever || transObj.modal) {
                    _forgetWhenDone[transObj.stateDef.ref] = _history.length;
                }
            }
        },

        // Capture flow end states so we can save off the flowscoped data.
        // we'll need to hydrate this later if someone wants to back into a flow that has gone out of scope
        captureFlowEnd : function (endObj) {
            if (!_listening) return;
            // determine if the ended flow needs to be removed from the history
            if(_forgetWhenDone[endObj.name]) {
                var index = _forgetWhenDone[endObj.name];
                if(_history[index].name === endObj.name) {
                    _history.splice(index, _history.length - index);
                }
                delete _forgetWhenDone[endObj.name];
            }
            else {
                var flowId = endObj.id;
                var flowscopeModel = Mojo.getModel(flowId);
                if (flowscopeModel) {
                    var data = flowscopeModel.serialize();
                    _flowScopeMap[flowId] = data;
                    TRACE("VIEW HISTORY - captured flow '" + endObj.name + "' ending with flowscope: " + data);
                }
                else {
                    TRACE("viewHistory component could not find flowscoped model for flow: '" + endObj.name + "'", LOG_WARNING);
                }
            }
        },

        doBack : function (evtOptions) {
            if (_history.length) {
                // Since we're going back, blow away the current transition so it doesn't get put on the stack later
                _currentTransition = null;

                var lastTrans = _history.pop();
                var navPath = [];
                path = lastTrans.metaData.path;

                // inner function to add a flow jump Object to the path
                function _pushFlowJumpObj(jumpObj) {
                    var inputData = null;
                    var m = Mojo.getModel(jumpObj.id);
                    // flowscope model is still in scope
                    if (m) {
                        inputData = m.serialize();
                        inputData = Mojo.utils.jsonSerializer.toJSON(inputData);
                    }
                    // flow has gone out of scope, reydrate its data from what we saved off
                    else if (_flowScopeMap[jumpObj.id]) {
                        inputData = Mojo.utils.jsonSerializer.toJSON(_flowScopeMap[jumpObj.id]);
                    }

                    navPath.push(new Mojo.flow.flowJumpObj(jumpObj.nodeName, inputData, {"modal": jumpObj.modal, "forceFlowId": jumpObj.id}));
                }

                // Iterate over the flowJump objects and
                // regen the flowscope for each of the nodes in the path to the view
                jQuery.each(path, function (idx, jumpObj) {
                    _pushFlowJumpObj(jumpObj);
                });
                // now push the view node on the path
                _pushFlowJumpObj(lastTrans);


                options = evtOptions || {};
                options.jump = navPath;
                Mojo.publishEvent(Mojo.constants.events.kNavigation, options);
            }
        }

    };

    var _currentTransition = null;
    var _flowScopeMap = {};
    var _history = [];
    var _forgetWhenDone = {};
    var _listening = true;
    var _maxSize = null;

    /**
     * Determine whether a state being transitioned to should be remembered in the history stack.
     * The default is true for views, false for actions.  Other types are never pushed onto the stack.
     */
    var _rememberState = function(transObj) {
        switch(transObj.stateDef.state_type) {
            case Mojo.flow.constants.kActionState:
                return  (transObj.stateDef.history === Mojo.flow.constants.historyType.kAlways);
            case Mojo.flow.constants.kViewState:
                return  (transObj.stateDef.history !== Mojo.flow.constants.historyType.kNever);
            default:
                return false;
        }
    };

    if (!isNaN(maxSize)) {
        _maxSize = parseInt(maxSize);
        _maxSize = (_maxSize > 0)?_maxSize:0;
    }


    Mojo.subscribeForEvent(Mojo.constants.events.kFlowTransition, _impl.captureTransition, _impl);
    Mojo.subscribeForEvent(Mojo.constants.events.kFlowEnd, _impl.captureFlowEnd, _impl);
    Mojo.subscribeForEvent(backEvent, _impl.doBack, _impl);
    return _impl;
};
/*
 * Component Name : states
 *
 * This component inserts all of the states as <option /> elements into an empty <select /> element
 *
 * data options
 *      includeMilitary : include the military states in the list of options
 *      includeTerritories : include the US territories in the list of options
 *
 *
 *  VALIDATORS - this js class provides some extra validators to use
 *
 *      stateZip : validation on a zip code field that it is in the range of the selected state
 *
 *      militaryCity : validation on a city field that the city must be APO, FPO, DPO if the state selected is a military address
 *                     takes the ID of the state element as an argument
 *
 *      militaryState : validation on a state widget that the state must be AA, AE, AP if the city entered is a military address
 *                      takes the ID of the citye element as an argument
 *
 *
 *  ADDITIONAL APIs
 *
 *      Look in the stateCodes jQuery extension to find additional functionality available to your application
 *
 */
Mojo.uiComponents.States = Mojo.interfaces.uiComponent.extend({

    // PUBLIC API
    //-----------------------------------------------
    create : function ($component, data) {
        var data = data || {};
        var $el = jQuery("<select></select>").html(jQuery.stateCodes.toOptions(data.includeMilitary, data.includeTerritories));
        this._copyDataAttributes($component, $el);

        return $el;
    },

    update : function () {

    }
});
Mojo.uiComponents.registry.registerComponentClass("states", Mojo.uiComponents.States);

/*
    Additional validators that complement the state component
 */
var stateZip = Mojo.inputStrategies.baseStrategy.extend({
    validate : function ($el, stateFldId) {
        var zip = $el.val();
        var stateCode = $("#" + stateFldId).val();
        if (!stateCode || ! zip) return

        if ( !jQuery.stateCodes.isValidZip(stateCode, zip) ) {
            return "ZIP code is invalid for " + jQuery.stateCodes.toStateName(stateCode);
        }
    }
});

var militaryCity = Mojo.inputStrategies.baseStrategy.extend({
    validate : function ($el, stateFldId) {
        var city = $el.val();
        var stateCode = $("#" + stateFldId).val();
        if (stateCode == "AA" || stateCode == "AE" || stateCode == "AP") {
            if (city == "APO" || city == "DPO" || city == "FPO") return;
            else return "City must be APO, DPO, or FPO"
        }

    }
});

var militaryState = Mojo.inputStrategies.baseStrategy.extend({
    validate : function ($el, cityFldId) {
        var stateCode = $el.val();
        var city = $("#" + cityFldId).val()
        if (city == "APO" || city == "DPO" || city == "FPO") {
            if (stateCode == "AA" || stateCode == "AE" || stateCode == "AP") return;
            else return "State Code must be AA, AE, or AP"
        }
    }
});

Mojo.addInputStrategy("stateZip", new stateZip());
Mojo.addInputStrategy("militaryCity", new militaryCity());
Mojo.addInputStrategy("militaryState", new militaryState());

/*
 Additional Functionality to support state related stuff
 */
(function ($) {

    //------------------------------------------------
    // Private statics
    var kFederalMap = { code : "US", name : "Federal" },

        kUSState = [
            { code : "AL", name : "Alabama", zipRanges : [ "35000-35299", "35400-36999" ] },
            { code : "AK", name : "Alaska", zipRanges : ["99500-99999"]},
            { code : "AZ", name : "Arizona", zipRanges : ["85000-85399", "85500-85799", "85900-86099", "86300-86599"]},
            { code : "AR", name : "Arkansas", zipRanges : ["71600-72999"]},
            { code : "CA", name : "California", zipRanges : ["90000-90899", "91000-92899", "93000-96199"]},
            { code : "CO", name : "Colorado", zipRanges : ["80000-81699"]},
            { code : "CT", name : "Connecticut", zipRanges : ["06000-06999"]},
            { code : "DC", name : "D.C.", zipRanges : ["20000-20099", "20200-20599", "56900-56999"]},
            { code : "DE", name : "Delaware", zipRanges : ["19700-19999"]},
            { code : "FL", name : "Florida", zipRanges : ["32000-33999", "34100-34999"]},
            { code : "GA", name : "Georgia", zipRanges : ["30000-31999", "39800-39999"]},
            { code : "HI", name : "Hawaii", zipRanges : ["96700-96899"]},
            { code : "ID", name : "Idaho", zipRanges : ["83200-83899"]},
            { code : "IL", name : "Illinois", zipRanges : ["60000-62099", "62200-62999" ]},
            { code : "IN", name : "Indiana", zipRanges : ["46000-47999"]},
            { code : "IA", name : "Iowa", zipRanges : ["50000-51699", "52000-52899"]},
            { code : "KS", name : "Kansas", zipRanges : ["66000-66299", "66400-67999"]},
            { code : "KY", name : "Kentucky", zipRanges : ["40000-42799" ]},
            { code : "LA", name : "Louisiana", zipRanges : ["70000-70199", "70300-70899", "71000-71499"]},
            { code : "ME", name : "Maine", zipRanges : ["03900-04999"]},
            { code : "MD", name : "Maryland", zipRanges : ["20600-21299", "21400-21999"]},
            { code : "MA", name : "Massachusetts", zipRanges : ["01000-02799", "05599"]},
            { code : "MI", name : "Michigan", zipRanges : ["48000-49999"]},
            { code : "MN", name : "Minnesota", zipRanges : ["55000-55199", "55300-56799" ]},
            { code : "MS", name : "Mississippi", zipRanges : ["38600-39799"]},
            { code : "MO", name : "Missouri", zipRanges : ["63000-63199", "63300-64199", "64400-65899"]},
            { code : "MT", name : "Montana", zipRanges : ["59000-59999"]},
            { code : "NE", name : "Nebraska", zipRanges : ["68000-68199", "68300-69399"]},
            { code : "NV", name : "Nevada", zipRanges : ["88900-89199", "89300-89599", "89700-89899"]},
            { code : "NH", name : "New Hampshire", zipRanges : ["03000-03899"]},
            { code : "NJ", name : "New Jersey", zipRanges : ["07000-08999"]},
            { code : "NM", name : "New Mexico", zipRanges : ["87000-87199", "87300-87599", "87700-88499"]},
            { code : "NY", name : "New York", zipRanges : ["00499", "00599", "06390", "10000-14999"]},
            { code : "NC", name : "North Carolina", zipRanges : ["27000-28999"]},
            { code : "ND", name : "North Dakota", zipRanges : ["58000-58899"]},
            { code : "OH", name : "Ohio", zipRanges : ["43000-45999"]},
            { code : "OK", name : "Oklahoma", zipRanges : ["73000-73199", "73400-74199", "74300-74999"]},
            { code : "OR", name : "Oregon", zipRanges : ["97000-97999"]},
            { code : "PA", name : "Pennsylvania", zipRanges : ["15000-19699"]},
            { code : "RI", name : "Rhode Island", zipRanges : ["02800-02999"]},
            { code : "SC", name : "South Carolina", zipRanges : ["29000-29999"]},
            { code : "SD", name : "South Dakota", zipRanges : ["57000-57799"]},
            { code : "TN", name : "Tennessee", zipRanges : ["37000-38599"]},
            { code : "TX", name : "Texas", zipRanges : ["73300-73399", "75000-77099", "77200-79999", "88500-88599"]},
            { code : "UT", name : "Utah", zipRanges : ["84000-84799"]},
            { code : "VT", name : "Vermont", zipRanges : ["05000-05499", "05600-05999"]},
            { code : "VA", name : "Virginia", zipRanges : ["20100-20199", "22000-24699"]},
            { code : "WA", name : "Washington", zipRanges : ["98000-98699", "98800-99499"]},
            { code : "WV", name : "West Virginia", zipRanges : ["24700-26899"]},
            { code : "WI", name : "Wisconsin", zipRanges : ["53000-53299", "53400-53599", "53700-54999"]},
            { code : "WY", name : "Wyoming", zipRanges : ["82000-83199", "83400-83499"]}
        ],

        kUSTerritoryStates = [
            { code : "AS", name : "American Samoa", zipRanges : ["96799"] },
            { code : "FM", name : "Federated States of Micronesia", zipRanges : [ "96900-96999"] },
            { code : "GU", name : "Guam", zipRanges : ["96910-96939"] },
            { code : "MH", name : "Marshall Islands", zipRanges : [ "96900-96999"] },
            { code : "MP", name : "Northern Marianas", zipRanges : ["96950-96959"] },
            { code : "PR", name : "Puerto Rico", zipRanges : [ "00600-00799", "00900-00999"] },
            { code : "PW", name : "Palau", zipRanges : [ "96900-96999" ] },
            { code : "VI", name : "Virgin Islands", zipRanges : [ "00800-00899"] }
        ],

        kMilitaryCodes = [
            {code : "AA", name : "AA", zipRanges : ["34000-34099"]},
            {code : "AE", name : "AE", zipRanges : ["09000-09899"]},
            {code : "AP", name : "AP", zipRanges : ["96200-96699"]}
        ],

        kUSStateLen = kUSState.length,

        kNoIncomeTax = ["AL", "FL", "NV", "SD", "TX", "WA", "WY"],

        kSupportedStates = [];


    //------------------------------------------------
    // Public
    $.extend({
        stateCodes : {

            //----------------------------------------
            isStateCode : function (code) {
                code = code.toUpperCase();

                for (var i = 0; i < kUSStateLen; i += 1) {
                    if (kUSState[i].code === code) {
                        return true;
                    }
                }

                return false;
            },

            //----------------------------------------
            isUSTerritoryCode : function (code) {
                var found = false;
                code = code.toUpperCase();

                $.each(kUSTerritoryStates, function (index, obj) {
                    if (obj.code === code) {
                        found = true;
                        return false;	// Exit loop
                    }
                });
                return found;
            },

            //----------------------------------------
            toStateCode : function (name) {
                name = name.toLowerCase();

                for (var i = 0; i < kUSStateLen; i += 1) {
                    if (kUSState[i].name === name) {
                        return kUSState[i].code;
                    }
                }

                return "";
            },

            //----------------------------------------
            toStateName : function (code) {
                code = code.toUpperCase();

                for (var i = 0; i < kUSStateLen; i += 1) {
                    if (kUSState[i].code === code) {
                        return kUSState[i].name;
                    }
                }
                for (var i = 0; i < kMilitaryCodes.length; i += 1) {
                    if (kMilitaryCodes[i].code === code) {
                        return kMilitaryCodes[i].name;
                    }
                }
                for (var i = 0; i < kUSTerritoryStates.length; i += 1) {
                    if (kUSTerritoryStates[i].code === code) {
                        return kUSTerritoryStates[i].name;
                    }
                }

                return "";
            },

            //----------------------------------------
            toOptions : function (includeMilitary, includeTerritories) {
                var fmt = ["<option value='", null, "'>", null, "</option>"],
                    a = ["<option value=''>Select State</option>"];

                for (var i = 0; i < kUSStateLen; i++) {
                    fmt[1] = kUSState[i].code;
                    fmt[3] = kUSState[i].name;
                    a.push(fmt.join(''));
                }

                if (includeMilitary) {
                    for (i = 0; i < kMilitaryCodes.length; i++) {
                        fmt[1] = kMilitaryCodes[i].code;
                        fmt[3] = kMilitaryCodes[i].name;
                        a.push(fmt.join(''));
                    }
                }

                if (includeTerritories) {
                    for (i = 0; i < kUSTerritoryStates.length; i++) {
                        fmt[1] = kUSTerritoryStates[i].code;
                        fmt[3] = kUSTerritoryStates[i].name;
                        a.push(fmt.join(''));
                    }
                }
                return a.join('');
            },

            //----------------------------------------
            toAbbrOptions : function () {
                // IE7 requires that the value be specified even though its the same as the contents,
                // otherwise option.value always returns "".
                var fmt = ["<option value='", null, "'>", null, "</option>"],
                    a = ["<option value=''></option>"];

                for (var i = 0; i < kUSStateLen; i += 1) {
                    fmt[1] = fmt[3] = kUSState[i].code;
                    a.push(fmt.join(''));
                }

                return a.join('');
            },

            //----------------------------------------
            hasIncomeTax : function (code) {
                if ($.isEmpty(code)) {
                    return false;
                }

                var i, cnt = kNoIncomeTax.length;
                code = code.toUpperCase();

                for (i = 0; i < cnt; i += 1) {
                    if (code === kNoIncomeTax[i]) {
                        return false;
                    }
                }

                return true;
            },

            //----------------------------------------
            getSupportedStateCodes : function () {
                return kSupportedStates;
            },

            //----------------------------------------
            getSupportedStateNames : function () {
                var name,
                    names = [],
                    that = this;

                $.each(kSupportedStates, function (index, obj) {
                    name = that.toStateName(obj);
                    if (name !== "") {
                        names.push(name);
                    }
                });

                return names;
            },

            //----------------------------------------
            getZipRange : function (code) {
                var i = 0;
                for (i = 0; i < kUSState.length; i += 1) {
                    if (kUSState[i].code === code) {
                        return kUSState[i].zipRanges;
                    }
                }
                for (i = 0; i < kUSTerritoryStates.length; i += 1) {
                    if (kUSTerritoryStates[i].code === code) {
                        return kUSTerritoryStates[i].zipRanges;
                    }
                }
                for (i = 0; i < kMilitaryCodes.length; i += 1) {
                    if (kMilitaryCodes[i].code === code) {
                        return kMilitaryCodes[i].zipRanges;
                    }
                }
            },

            isValidZip : function (code, zip) {
                if (!code || !zip) return true;

                // Get the ranges
                var ranges = this.getZipRange(code)
                if (!ranges) return true;

                // Not see if we're in range
                for (var i = 0; i < ranges.length; i++) {
                    var range = ranges[i]
                    var bounds = range.split('-')
                    var lower = bounds[0];
                    var upper = bounds[1]
                    if (upper && (zip >= lower && zip <= upper)) return true;
                    else if (!upper && zip == lower) return true;
                }

                return false;
            }
        }
    });
})(jQuery);


/**
 * class: LocalStorageDAO
 * @author Miller, Greg
 *
 * about:
 * Strategy for storing off data to HTML5 localstorage
 */
Mojo.model.localStorageDAO = Mojo.interfaces.DAO.extend({


// Function: save
// @Override
// Save data to local storage
//
// Parameters:
//    modelList - the list of models
    save : function (modelList, success, error) {
        if (!window.localStorage) {
            if (error) {
                error();
            }
            return;
        }

        try {
            jQuery.each(modelList, function (index, model) {
                var name = MojoOptions.appId + "." + model.getName();
                localStorage.setItem(name, model.serialize());
            });
            if (typeof success === "function") {
                success();
            }
        }
        catch (ex) {
            throw new MojoException("Mojo.model.localStorageStrategy", "Could not save data", LOG_ERROR, ex);
        }
    },

// Function: load
// @Override
// Load the data from local storage
//
// Parameters:
//    modelList - the list of models
    load : function (modelList, success, error) {
        if (!window.localStorage) {
            if (error) {
                error();
            }
            return;
        }

        try {
            jQuery.each(modelList, function (index, model) {
                var name = MojoOptions.appId + "." + model.getName();
                var data = localStorage.getItem(name);
                if (data) {
                    model.deserialize(data);
                }
            });
            if (typeof success === "function") {
                success();
            }
        }
        catch (ex) {
            throw new MojoException("Mojo.model.localStorageStrategy", "Could not load data", LOG_ERROR, ex);
        }
    },

// Function: destroy
// @Override
// Clear the local storage and the in memory model
//
// Parameters:
//    modelList - the list of models
    destroy : function (modelList, success, error) {
        if (!window.localStorage) {
            if (error) {
                error();
            }
            return;
        }

        jQuery.each(modelList, function (index, model) {
            var name = MojoOptions.appId + "." + model.getName();
            localStorage.removeItem(name);
        });
        if (typeof success === "function") {
            success();
        }
    },

// Function: refresh
// @Override
// refresh the in memory model with data from storage
//
// Parameters:
//    modelList - the list of models
    refresh : function (modelList, success, error) {
        this.load(modelList, success, error);
    }

});
	


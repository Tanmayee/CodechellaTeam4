// All flows are referenced based, so we need to provide some sort of mapping mechanism between the
// reference and the actual implementation.  And where to find the implementations
 
var flowResolverConfig = {
	pathToFlows : "scripts/flows",  // Or where your flow definitions will reside on your server
	aliasMap : {
		main : "MyDemo.json",
		subflow : "MySubFlow.json",
		"*" : ".json"  /* wildcard to indicate that flow refs name maps directly to the names of the flow definition,
		       					 must provide default extension for wildcarded references*/
	}         
};
		
// All views are referenced based, so we need to provide some sort of mapping mechanism between the
 // reference and the actual implementation.  And where to find the implementations
		 
var viewResolverConfig = {
	pathToViews : "html", // Or where your html files will reside on your server
	aliasMap : {
		"Pg1" : "Page1.htm",
		"Pg2" : "Page2.htm",
		"*"   : ".htm" /* wildcard to indicate that page refs map directly to the names of the html files, 
		       			must provide default extension for wildcarded references*/
	}
 }; 
		 	
// All action are referenced based, so we need to provide some sort of mapping mechanism between the
// reference and the actual implementation.  And where to find the implementations
		 
var actionExecutorConfig = {
	pathToActions : "scripts/actions", // Or where your javascript action files will reside on your server
};


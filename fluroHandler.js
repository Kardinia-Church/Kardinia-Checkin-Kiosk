/**
 * Handle the Fluro interactions
 */

const DATE_FORMAT = 'YYYY-MM-DD HH:mm';
const fs = require("fs");
const HTMLParser = require("node-html-parser");
const Fluro = require("fluro");
const EVENT_HANDLER_NAME = "Fluro";

module.exports = {
    fluro: undefined,
    eventHandler: undefined,
    printerHandler: undefined,
    htmlPath: undefined,
    configId: undefined,
    kioskConfiguration: undefined,

    //Initialize
    init: async function (eventHandler, printerHandler, mainDirectory, configs) {
        var self = this;
        self.eventHandler = eventHandler;
        self.printerHandler = printerHandler;
        self.htmlPath = mainDirectory + "/temp/";
        self.configId = configs["kioskConfigurationId"];


        //Ensure our directory is available
        if (!fs.existsSync(self.htmlPath)) {
            self.eventHandler.info("Output directory didn't exist, created it", EVENT_HANDLER_NAME);
            fs.mkdirSync(self.htmlPath, { recursive: true });
        }

        this.eventHandler.info("Connecting", EVENT_HANDLER_NAME);
        this.fluro = new Fluro({
            apiURL: configs["apiUrl"],
            applicationToken: configs["applicationToken"],
            domain: configs["applicationDomainName"],
        });
        this.fluro.date.defaultTimezone = DATE_FORMAT;
        await this.getKioskConfiguration(this.configId);
        return true;
    },

    //Check if everything is working correctly. Will resolve with true or false depending on success
    check: function () {
        var self = this;
        return new Promise((resolve) => {
            require("dns").resolve(self.fluro.apiURL, function (error) {
                if (error) {
                    self.eventHandler.error("Failed to resolve the apiURL", EVENT_HANDLER_NAME);
                    resolve(false);
                }
                else {
                    setTimeout(function () {
                        //Next check that we can get something from Fluro
                        self.fluro.api.get("/session", {}).then((result) => {
                            if (result.status == 200) {
                                if (self.kioskConfiguration === undefined) {
                                    self.eventHandler.error("The kiosk configuration from Fluro is invalid", EVENT_HANDLER_NAME);
                                    resolve(false);
                                }
                                else {
                                    //DO A TEST PRINT HERE TO ENSURE IT WORKS


                                    resolve(true);
                                }
                            }
                            else {
                                console.log(result);
                                self.eventHandler.error("Failed to do a Fluro api get call", EVENT_HANDLER_NAME);
                                resolve(false);
                            }
                        }).catch((error) => {
                            console.log(error);
                            self.eventHandler.error("Failed to do a Fluro api get call", EVENT_HANDLER_NAME);
                            resolve(false);
                        });
                    }, 2000);
                }
            });
        });
    },

    /**
     * Do the api calls for a set of domains and return an object with merged values
     *
     * Possible calls include
     * contact
     * contactDepth
     * family
    **/
    apiGet: function (checkinId, personId, selectors) {
        var self = this;
        var ret = {};
        return new Promise((resolve, reject) => {
            //Set our contact get first as this is required
            if (personId === undefined || personId == "") { resolve(undefined); } //If there is no person id return nothing
            self.fluro.api.get("/content/contact/" + personId, {
                cache: false,
                params: {
                    appendContactDetail: selectors.indexOf("contactDepth") != -1 ? "all" : undefined //Only go deep if contactDepth is set (this adds a delay)
                }
            }).then((contactResult) => {
                ret["contact"] = contactResult.data;
                var waitingFor = [];
                var populateParentIds = [];

                //Iterate through the selectors required and grab the information from Fluro
                for (var i = 0; i < selectors.length; i++) {
                    switch (selectors[i]) {
                        case "family": {
                            if (ret["contact"].family != undefined) {
                                waitingFor.push(self.fluro.api.get("/content/family/" + ret["contact"].family._id, { cache: false }).then((result) => {
                                    ret["family"] = result.data;

                                    //If there is a request for the parents populate them here
                                    if (selectors.indexOf("parents") != -1) {
                                        ret["parents"] = [];
                                        for (var j = 0; j < result.data.items.length; j++) {
                                            if (result.data.items[j].householdRole == "parent") {
                                                populateParentIds.push(result.data.items[j]._id);
                                            }
                                        }
                                    }
                                }).catch((error) => {
                                    self.eventHandler.error("Failed to get family information for person id " + personId + ": " + error, EVENT_HANDLER_NAME);
                                }));
                            }
                        }
                    }
                }

                //Wait till all the requests are completed
                Promise.all(waitingFor).then(() => {
                    waitingFor = [];

                    //Ok the main calls are done, is there any other calls needed
                    if (populateParentIds.length > 0) {
                        for (var i = 0; i < populateParentIds.length; i++) {
                            waitingFor.push(self.fluro.api.get("/content/contact/" + populateParentIds[i], { cache: false }).then((parentResult) => {
                                ret["parents"].push(parentResult.data);
                            }).catch((error) => {
                                self.eventHandler.error("Failed to get parent information for id " + personId + ": " + error, EVENT_HANDLER_NAME);
                            }));
                        }
                    }

                    //Wait for the secondary calls to complete
                    Promise.all(waitingFor).then(() => {
                        resolve(ret);
                    });
                });

            }).catch((error) => {
                self.eventHandler.error("Failed to get contact information for id " + personId + ": " + error, EVENT_HANDLER_NAME);
                reject();
            });
        });
    },

    //Get the kiosk configuration file from fluro
    getKioskConfiguration: function (configId) {
        var self = this;
        return new Promise((resolve) => {
            self.fluro.api.get("/content/code/" + configId).then(result => {
                self.kioskConfiguration = JSON.parse(result.data.body);
                resolve(self.kioskConfiguration);
            }).catch(error => {
                console.log(error);
                self.eventHandler.error("Failed to get the kiosk configuration (" + configId + ") from Fluro", EVENT_HANDLER_NAME);
                resolve(undefined);
            });
        })
    },

    //Handle a print request
    handlePrintRequest: async function (request) {
        var self = this;
        var title = request.data.title;
        var html = HTMLParser.parse(request.data.html);

        var write = function () {
            fs.writeFile(self.htmlPath + "temp_" + request.data.uuid + ".html", html.outerHTML, function (error, result) {
                if (error) {
                    self.eventHandler.error("Could not write temp html file: " + error, EVENT_HANDLER_NAME);
                }
                else {
                    self.printerHandler.printHTML(request.data.uuid);
                }
            });
        }

        //Edit the HTML with our extra fields
        var checkinId = "";
        var checkinEvent = "";
        var contactId = "";
        try { checkinId = html.querySelector("#checkinId").innerHTML; html.querySelector("#checkinId").remove(); } catch (e) { }
        try { checkinEvent = html.querySelector("#checkinEvent").innerHTML; html.querySelector("#checkinEvent").remove(); } catch (e) { }
        try { contactId = html.querySelector("#contactId").innerHTML; html.querySelector("#contactId").remove(); } catch (e) { }

        /**
         * Hide show elements based on the event / other parameters
         */

        //Fuze
        if (!checkinEvent.toLowerCase().includes("fuze")) {
            try { html.querySelector("#ifFuze").remove(); } catch (e) { }
        }

        //Playgroups
        if (!checkinEvent.toLowerCase().includes("playgroups")) {
            try { html.querySelector("#ifPlaygroups").remove(); } catch (e) { }
        }

        //Service
        if (!checkinEvent.toLowerCase().includes("service")) {
            try { html.querySelector("#ifService").remove(); } catch (e) { }
        }

        //If this is a service label change the label based on the contact information
        if (checkinEvent.toLowerCase().includes("service")) {
            var found = false;

            //Search for the contact within these groups. The key will be populated to the title if they are a member
            var groups = {
                "Kids Leader": this.fluro.api.get("/content/team/5fd4058b349139729074df18"),
                "Kids Junior Leader": this.fluro.api.get("/content/team/609a0eefadfab73b1cdd5c96"),
                "Kids Parent Helper": this.fluro.api.get("/content/team/609a0f17c86b9537dbfdb9ff"),
            }

            for (var i in groups) {
                var current = await groups[i];
                for (var j = 0; j < current.data.provisionalMembers.length; j++) {
                    if (current.data.provisionalMembers[j]._id == contactId) {
                        try { html.querySelector("#labelTitle").innerHTML = i; } catch (e) { }
                        try { html.querySelector("#doNotPrintLabel").remove(); } catch (e) { } //Remove the doNotPrint so we do print a label
                        found = true;
                        break;
                    }

                }
                if (found) { break; }
            }
        }

        //Don't print the label if present
        if (html.querySelector("#doNotPrintLabel") !== null) {
            self.eventHandler.info("No need to print this label", EVENT_HANDLER_NAME);
            return;
        }


        if (checkinId != undefined && contactId != undefined) {
            self.eventHandler.info("Getting more detailed information from Fluro", EVENT_HANDLER_NAME);
            var selectors = [];
            var callbacks = [];

            //Push the selector if it does not exist
            var pushSelector = function (selector) {
                if (selectors.indexOf(selector) == -1) { selectors.push(selector); }
            }

            /**
             * Contact Information
             */

            // Populate the computedAge tag
            if (html.querySelector("#computedAge") != null) {
                pushSelector("contact");
                callbacks.push(function (result) {
                    try {
                        const today = new Date();
                        const dob = new Date(result.contact.dob);
                        const monthDiff = today.getMonth() - dob.getMonth();
                        let computedAge = today.getFullYear() - dob.getFullYear();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()))
                            computedAge--;
                        html.querySelector("#computedAge").innerHTML = computedAge;
                    }
                    catch (e) {
                        if (!isNaN(result.contact.age) && result.contact.age >= 0)
                            html.querySelector("#computedAge").innerHTML = result.contact.age;
                    }
                });
            }
            //Populate the name tag notes
            if (html.querySelector("#nameTagNotes") != null) {
                pushSelector("contact");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#nameTagNotes").innerHTML = result.contact.nametagNotes;
                    }
                    catch (e) { }
                });
            }

            //Populate the school grade
            if (html.querySelector("#grade") != null) {
                pushSelector("contact");
                callbacks.push(function (result) {
                    try {
                        for (var i in result.contact.academicCalendar.grades) {
                            if (result.contact.academicCalendar.grades[i].key == result.contact.academicGrade) {
                                html.querySelector("#grade").innerHTML = result.contact.academicCalendar.grades[i].title;
                                break;
                            }
                        }
                    }
                    catch (e) { }
                });
            }

            //Populate the contact email
            if (html.querySelector("#email") != null) {
                pushSelector("contact");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#email").innerHTML = result.contact.emails[0];
                    }
                    catch (e) { }
                });
            }

            //Populate the contact local phone number
            if (html.querySelector("#localPhone") != null) {
                pushSelector("contact");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#localPhone").innerHTML = result.contact.local[0];
                    }
                    catch (e) { }
                });
            }

            /**
             * Family information
             */

            //Populate the family phone
            if (html.querySelector("#familyPhone") != null) {
                pushSelector("family");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#familyPhone").innerHTML = result.family.phoneNumbers[0];
                    }
                    catch (e) { }
                });
            }

            //Populate the family email
            if (html.querySelector("#familyEmail") != null) {
                pushSelector("family");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#familyEmail").innerHTML = result.family.emails[0];
                    }
                    catch (e) { }
                });
            }

            //Populate the parent's full name
            if (html.querySelector("#parentFullName") != null) {
                pushSelector("family");
                pushSelector("parents");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#parentFullName").innerHTML = result.parents[0].title;
                    }
                    catch (e) { }
                });
            }

            //Populate the parent's first name
            if (html.querySelector("#parentFirstName") != null) {
                pushSelector("family");
                pushSelector("parents");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#parentFirstName").innerHTML = result.parents[0].firstName;
                    }
                    catch (e) { }
                });
            }

            //Populate the parent's last name
            if (html.querySelector("#parentLastName") != null) {
                pushSelector("family");
                pushSelector("parents");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#parentLastName").innerHTML = result.parents[0].lastName;
                    }
                    catch (e) { }
                });
            }

            //Populate the parent's email
            if (html.querySelector("#parentEmail") != null) {
                pushSelector("family");
                pushSelector("parents");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#parentEmail").innerHTML = result.parents[0].emails[0];
                    }
                    catch (e) { }
                });
            }

            //Populate the parent's local phone number
            if (html.querySelector("#parentLocalPhone") != null) {
                pushSelector("family");
                pushSelector("parents");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#parentLocalPhone").innerHTML = result.parents[0].local[0];
                    }
                    catch (e) { }
                });
            }

            /**
             * Health concerns etc
             */

            //Populate the shapes element
            if (html.querySelector("#checkinShapes") != null) {
                pushSelector("contact");
                pushSelector("contactDepth");
                callbacks.push(function (result) {
                    try {
                        var hasHealthConcerns = result.contact.details.medicalandHealth.data.healthConcerns;
                        var hasCustodyArrangements = result.contact.details.medicalandHealth.data.custodyArrangements;
                        var hasMedication = result.contact.details.medicalandHealth.data.medication || result.contact.details.medicalandHealth.data.medicationDetails;
                        var hasMediaRelease = result.contact.details.medicalandHealth.data.mediaRelease == "Yes";
                        var hasAllergies = result.contact.details.medicalandHealth.data.allergies || result.contact.details.medicalandHealth.data.allergiesDetails;
                        var hasDietary = result.contact.details.medicalandHealth.data.doyouhaveanydietaryneeds || result.contact.details.medicalandHealth.data.dietaryNeeds.length > 0 || result.contact.details.medicalandHealth.data.dietaryOther;

                        if (hasHealthConcerns) { html.querySelector("#checkinShapes").innerHTML += "<p>&FilledSmallSquare;</p>"; }
                        if (hasCustodyArrangements) { html.querySelector("#checkinShapes").innerHTML += "<p>&bigstar;</p>"; }
                        if (hasMedication) { html.querySelector("#checkinShapes").innerHTML += "<p>&sung;</p>"; }
                        if (!hasMediaRelease) { html.querySelector("#checkinShapes").innerHTML += "<p>&CirclePlus;</p>"; }
                        if (hasAllergies) { html.querySelector("#checkinShapes").innerHTML += "<p>&boxtimes;</p>"; }
                        if (hasDietary) { html.querySelector("#checkinShapes").innerHTML += "<p>&phone;</p>"; }
                    }
                    catch (e) { }
                });
            }


            //Populate the contact's emergency contact(s)
            if (html.querySelector("#emergencyContacts") != null) {
                pushSelector("contact");
                pushSelector("contactDepth");
                callbacks.push(function (result) {
                    try {
                        var c1 = result.contact.details.medicalandHealth.data.emergencyContact1;
                        var c2 = result.contact.details.medicalandHealth.data.emergencyContact2;
                        var line = "";
                        if (c1 != undefined) {
                            line += c1.name + " (" + c1.relationship + ") - " + c1.phone;
                        }
                        if (line != "") { line += ", "; }
                        if (c2 != undefined) {
                            line += c2.name + " (" + c2.relationship + ") - " + c2.phone;
                        }

                        html.querySelector("#emergencyContacts").innerHTML = line;
                    }
                    catch (e) { }
                });
            }

            //Populate the contact's media release
            if (html.querySelector("#mediaRelease") != null) {
                pushSelector("contact");
                pushSelector("contactDepth");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#mediaRelease").innerHTML = result.contact.details.medicalandHealth.data.mediaRelease || "";
                    }
                    catch (e) { }
                });
            }

            //Populate the contact's medical consent
            if (html.querySelector("#medicalConsent") != null) {
                pushSelector("contact");
                pushSelector("contactDepth");
                callbacks.push(function (result) {
                    try {
                        html.querySelector("#medicalConsent").innerHTML = result.contact.details.medicalandHealth.data.medicalConsent || "";
                    }
                    catch (e) { }
                });
            }

            //Populate the contact's allergies
            if (html.querySelector("#allergies") != null) {
                pushSelector("contact");
                pushSelector("contactDepth");
                callbacks.push(function (result) {
                    try {
                        if (result.contact.details.medicalandHealth.data.allergies == true) {
                            html.querySelector("#allergies").innerHTML = result.contact.details.medicalandHealth.data.allergiesDetails || "Unknown";
                        }
                        else {
                            html.querySelector("#allergies").innerHTML = "none";
                        }
                    }
                    catch (e) { }
                });
            }

            //Populate the contact's dietaries
            if (html.querySelector("#dietaries") != null) {
                pushSelector("contact");
                pushSelector("contactDepth");
                callbacks.push(function (result) {
                    try {
                        if (result.contact.details.medicalandHealth.data.doyouhaveanydietaryneeds == true) {
                            var temp = "";
                            for (var i = 0; i < result.contact.details.medicalandHealth.data.dietaryNeeds.length; i++) {
                                temp += result.contact.details.medicalandHealth.data.dietaryNeeds[i] + ", ";
                            }
                            html.querySelector("#dietaries").innerHTML = temp.slice(0, temp.length - 2);
                        }
                        else {
                            html.querySelector("#dietaries").innerHTML = "none";
                        }
                    }
                    catch (e) { }
                });
            }

            //Populate the contact's medication
            if (html.querySelector("#medication") != null) {
                pushSelector("contact");
                pushSelector("contactDepth");
                callbacks.push(function (result) {
                    try {
                        if (result.contact.details.medicalandHealth.data.medication == true) {
                            html.querySelector("#medication").innerHTML = result.contact.details.medicalandHealth.data.medicationDetails || "Unknown";
                        }
                        else {
                            html.querySelector("#medication").innerHTML = "none";
                        }
                    }
                    catch (e) { }
                });
            }

            //Push write so it's completed once all the other callbacks complete
            callbacks.push(write);

            //Do our API call and callback to the above fns when completed
            if (selectors.length > 0) {
                self.apiGet(checkinId, contactId, selectors).then((result) => {
                    for (var i = 0; i < callbacks.length; i++) {
                        callbacks[i](result);
                    }
                }).catch(e => {
                    console.log(e);
                    self.eventHandler.error("An error occurred while gathering information about the contact from Fluro", EVENT_HANDLER_NAME);
                });
            }
            else {
                write();
            }
        }
        else {
            write();
        }
    }
}
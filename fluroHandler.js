/**
 * Handle the Fluro interactions
 */

const DATE_FORMAT = 'YYYY-MM-DD HH:mm';
const fs = require("fs");
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
     * Get a checkin from Fluro
     * @param {string} checkinId 
     * @returns A promise
     */
    getCheckin: function (checkinId) {
        var self = this;
        return new Promise((resolve, reject) => {
            self.fluro.api.get("/content/checkin/" + checkinId).then(result => {
                resolve(result.data);
            }).catch(error => {
                reject(error);
            });
        });
    },

    /**
     * Get the contact from Fluro
     * @param {*} contactId 
     */
    getContact: function (contactId) {
        var self = this;
        return new Promise((resolve, reject) => {
            self.fluro.api.get("/content/contact/" + contactId, {
                params: {
                    appendContactDetail: "all"
                }
            }).then(result => {
                resolve(result.data);
            }).catch(error => {
                reject(error);
            });
        });
    },

    /**
     * Get a family from Fluro
     * @param {string} id 
     * @returns A promise
     */
    getFamily: function (id) {
        var self = this;
        return new Promise((resolve, reject) => {
            self.fluro.api.get("/content/family/" + id).then(result => {
                resolve(result.data);
            }).catch(error => {
                reject(error);
            });
        });
    },

    /**
     * Get a event from Fluro
     * @param {string} id 
     * @returns A promise
     */
    getEvent: function (id) {
        var self = this;
        return new Promise((resolve, reject) => {
            self.fluro.api.get("/content/event/" + id).then(result => {
                resolve(result.data);
            }).catch(error => {
                reject(error);
            });
        });
    },

    /**
    * Get the rosters from Fluro for an event
    * @param {object} the event 
    * @returns A promise
    */
    getRosters: async function (event) {
        var self = this;

        var waitingFor = [];
        for (var i in event.rosters) {
            waitingFor.push(new Promise((resolve, reject) => {
                self.fluro.api.get("/content/roster/" + event.rosters[i]._id, {
                    cache: false
                }).then(result => {
                    resolve(result.data);
                }).catch(error => { reject(error); })
            }));
        }
        return await Promise.all(waitingFor);
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

    /**
     * Generate a document to print
     * @param {object} data
     * @returns A promise which if successful returns the document
     */
    generateDocument: function (data) {
        var self = this;
        return new Promise((resolve, reject) => {
            self.fluro.api.get("/content/code/" + this.kioskConfiguration.printTemplateId, {
                cache: false
            }).then(result => {
                var document = {
                    html: result.data.body,
                    data: data,
                    type: "",
                };

                resolve(document);
            }).catch(error => {
                console.log(error);
                self.eventHandler.error(`Failed to get the the ${type} printer template from Fluro`, EVENT_HANDLER_NAME);
                reject();
            });
        });
    },

    /**
     * Generate the print
     * @param {string} incoming The incoming message from the fluro html event
     */
    currentPool: {},
    checkTimeout: undefined,
    generatePrint: async function (incoming) {
        return new Promise((resolve, reject) => {
            var self = this;

            if (incoming == "DONOTPRINT") { reject(); return; }

            var checkin = JSON.parse(incoming);
            if (!checkin.checkinId || !checkin.contactId || !checkin.familyId || !checkin.checkedInById || !checkin.eventId || !checkin.batchId) {
                self.eventHandler.error(`There was an error with the incoming print from Fluro`, EVENT_HANDLER_NAME);
                reject();
                return;
            }

            //Add the current to the pool and wait for any extra prints to come in, we need to print them together
            self.currentPool[checkin.checkinId] = checkin;

            //Check our pool after a bit
            if (self.checkTimeout) { clearTimeout(self.checkTimeout); }
            self.checkTimeout = setTimeout(async function () {
                //Get more information about the checkin
                var event;
                var rosters;
                var family;
                var contacts = [];

                var waitingFor = [];
                waitingFor.push(self.getEvent(self.currentPool[Object.keys(self.currentPool)[0]].eventId));
                waitingFor.push(self.getFamily(self.currentPool[Object.keys(self.currentPool)[0]].familyId));
                for (var i in self.currentPool) {
                    waitingFor.push(self.getContact(self.currentPool[i].contactId));
                }

                self.eventHandler.info("Getting the extra information about the checkin...", EVENT_HANDLER_NAME);

                try {
                    var results = await Promise.all(waitingFor);
                    event = results[0];
                    family = results[1];
                    for (var i = 2; i < results.length; i++) {
                        contacts.push(results[i]);
                    }
                }
                catch (error) {
                    console.log(error);
                    self.eventHandler.error(`Failed to print the checkin because something happened while getting the extra information`, EVENT_HANDLER_NAME);
                    reject();
                    return;
                }

                //Validate
                if (!event || !family || contacts.length != Object.keys(self.currentPool).length) {
                    self.eventHandler.error(`A validation error occurred when getting the extra information about the checkin`, EVENT_HANDLER_NAME);
                    reject();
                    return;
                }


                //Get the rosters for the event
                try { var rosters = await self.getRosters(event); }
                catch (error) {
                    console.log(error);
                    self.eventHandler.error(`Failed to get the rosters for the event from Fluro`, EVENT_HANDLER_NAME);
                    reject();
                    return;
                }

                //Find the family role
                for (var i in contacts) {
                    //Figure out if this is a parent or child
                    if (family) {
                        for (var j in family.items) {
                            if (family.items[j]._id == contacts[i]._id) {
                                contacts[i].familyRole = family.items[j].householdRole;
                            }
                        }
                    }
                    else {
                        contacts[i].familyRole = "contact";
                    }

                    //Find the role for the contact if they're rostered onto this event
                    contacts[i].roles = [];
                    for (var i in rosters) {
                        for (var j in rosters[i].slots) {
                            for (var k in rosters[i].slots[j].assignments) {
                                if (rosters[i].slots[j].assignments[k].contact == contacts[i]._id) {
                                    contacts[i].roles.push(rosters[i].slots[j].title);
                                }
                            }
                        }
                    }
                }

                self.eventHandler.info("Generating the print", EVENT_HANDLER_NAME);

                //Generate the document
                resolve(await self.generateDocument({
                    event: event,
                    family: family,
                    contacts: contacts,
                    checkin: self.currentPool[Object.keys(self.currentPool)[0]]
                }));
                self.currentPool = {};
            }, 500);
        }).catch(error => {
            console.log(error);
            this.eventHandler.error(`Failed to get the checkin with id ${checkinId} from Fluro`, EVENT_HANDLER_NAME);
            reject();
        });
    }
}
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
            self.fluro.api.get("/content/checkin/" + checkinId, {
                cache: false
            }).then(result => {
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
                cache: false,
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
            self.fluro.api.get("/content/family/" + id, {
                cache: false
            }).then(result => {
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
            self.fluro.api.get("/content/event/" + id, {
                cache: false
            }).then(result => {
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
     * @param {string} checkinId The checkin id 
     */
    currentPool: {},
    checkTimeout: undefined,
    generatePrint: async function (checkinId) {
        return new Promise((resolve, reject) => {
            var self = this;
            if (checkinId == "" || checkinId == "DONOTPRINT") { reject(); return; }

            this.getCheckin(checkinId).then(result => {
                self.currentPool[result._id] = result;

                //Check our pool after a bit
                if (self.checkTimeout) { clearTimeout(self.checkTimeout); }
                self.checkTimeout = setTimeout(async function () {
                    //Get more information about the event
                    try { var event = await self.getEvent(self.currentPool[Object.keys(self.currentPool)[0]].event._id); }
                    catch (error) {
                        console.log(error);
                        self.eventHandler.error(`Failed to get the contact with id ${self.currentPool[Object.keys(self.currentPool)[0]]._id} from Fluro`, EVENT_HANDLER_NAME);
                        return;
                    }

                    //Get the rosters for the event
                    try { var rosters = await self.getRosters(event); }
                    catch (error) {
                        console.log(error);
                        self.eventHandler.error(`Failed to get the rosters for the event from Fluro`, EVENT_HANDLER_NAME);
                        return;
                    }

                    //Get information about the family
                    var family;
                    try { family = await self.getFamily(self.currentPool[Object.keys(self.currentPool)[0]].family); }
                    catch (error) {
                        console.log(error);
                        self.eventHandler.error(`Failed to get the family with id ${self.currentPool[Object.keys(self.currentPool)[0]].family} from Fluro`, EVENT_HANDLER_NAME);
                        return;
                    }

                    //Find the family role
                    var contacts = [];
                    for (var i in self.currentPool) {
                        var current = self.currentPool[i];

                        //Grab more information about the contact
                        try { var contact = await self.getContact(current.contact._id); }
                        catch (error) {
                            console.log(error);
                            self.eventHandler.error(`Failed to get the contact with id ${current.contact._id} from Fluro`, EVENT_HANDLER_NAME);
                            return;
                        }

                        current.event = event;
                        current.contact = contact;

                        //Figure out if this is a parent or child
                        if (family) {
                            for (var j in family.items) {
                                if (family.items[j]._id == current.contact._id) {
                                    current.familyRole = family.items[j].householdRole;
                                }
                            }
                        }
                        else {
                            current.familyRole = "contact";
                        }

                        //Find the role for the contact if they're rostered onto this event
                        current.roles = [];
                        for (var i in rosters) {
                            for (var j in rosters[i].slots) {
                                for (var k in rosters[i].slots[j].assignments) {
                                    if (rosters[i].slots[j].assignments[k].contact == current.contact._id) {
                                        current.roles.push(rosters[i].slots[j].title);
                                    }
                                }
                            }
                        }

                        contacts.push(current);
                    }

                    //Generate the document
                    var date = new Date(self.currentPool[Object.keys(self.currentPool)[0]].created);
                    resolve(await self.generateDocument({
                        event: event,
                        family: family,
                        contacts: contacts,
                        date: `${date.toDateString()} ${date.toLocaleString().split(",")[1]}`,
                        checkin: self.currentPool[Object.keys(self.currentPool)[0]]
                    }));
                    self.currentPool = {};
                }, 1000);
            }).catch(error => {
                console.log(error);
                this.eventHandler.error(`Failed to get the checkin with id ${checkinId} from Fluro`, EVENT_HANDLER_NAME);
                reject();
            });
        });
    }
}
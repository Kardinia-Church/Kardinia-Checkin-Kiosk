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
     * Get a printer template from Fluro
     * @param {string} type 
     * @returns A promise
     */
    getPrinterTemplate: function (type) {
        id = this.kioskConfiguration.templates[type];

        var self = this;
        return new Promise((resolve, reject) => {
            if (!id) { reject(); }

            self.fluro.api.get("/content/code/" + id, {
                cache: false
            }).then(result => {
                resolve(result.data);
            }).catch(error => {
                reject(error);
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

    /**
     * Generate a document to print
     * @param {string} type
     * @param {object} contact
     * @returns A promise which if successful returns the document
     */
    generateDocument: function (type, contact) {
        var self = this;
        return new Promise((resolve, reject) => {
            self.getPrinterTemplate(type).then(result => {
                var date = new Date(contact.created);
                contact.date = `${date.toDateString()} ${date.toLocaleString().split(",")[1]}`;

                console.log(contact);

                var document = {
                    html: result.body,
                    data: {
                        contact: contact,
                    },
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
                    var family;
                    if (Object.keys(self.currentPool).length > 1) {
                        family = await self.getFamily(self.currentPool[Object.keys(self.currentPool)[0]].family);
                    }

                    //Find the family role
                    var stickers = [];
                    for (var i in self.currentPool) {
                        var current = self.currentPool[i];

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

                        //Generate the stickers for each contact first
                        switch (current.familyRole) {
                            case "contact": {
                                stickers.push(await self.generateDocument("general", current));
                                break;
                            }
                        }

                        //Generate the pickup sticker if required




                    }

                    resolve(stickers);
                    self.currentPool = {};
                }, 500);
            }).catch(error => {
                console.log(error);
                this.eventHandler.error(`Failed to get the checkin with id ${checkinId} from Fluro`, EVENT_HANDLER_NAME);
                reject();
            });
        });
    }
}
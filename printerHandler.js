// const HTML5ToPDF = require("html5-to-pdf");
const pdfToPrinter = require("pdf-to-printer");
const fs = require("fs");
const EVENT_HANDLER_NAME = "Printer";
const pdf = require("pdf-creator-node");
const supportedPrinters = {
    "microsoftPDF": {
        friendlyName: "PDF",
        USBName: "Microsoft Print to PDF",
        // printOptions: ['-print-settings paper="A4"'],
        "width": 100,
        "height": 100,
        "rotate": false
    },
    "brotherQL580N": {
        friendlyName: "Brother QL-580N",
        USBName: "Brother QL-580N",
        // printOptions: ['-print-settings "fit"'],
        "width": 62,
        "height": 100,
        "rotate": true
    },
    "brotherQL820NWB": {
        friendlyName: "Brother QL820NWB",
        USBName: "Brother QL-820NWB",
        // printOptions: ['-print-settings "fit"'],
        "width": 62,
        "height": 100,
        "rotate": true
    },
    "DYMOLabelWriter450Turbo": {
        friendlyName: "DYMO Label Writer 450 Turbo",
        USBName: "DYMO LabelWriter 450 Turbo",
        // printOptions: ['-print-settings "fit"'],
        "width": 54,
        "height": 101,
        "rotate": true
    }
};

module.exports = {
    eventHandler: undefined,
    fluroHandler: undefined,
    outputPath: undefined,
    printerId: undefined,
    fluroPrinterId: undefined,
    printerUSBName: undefined,
    printerWidth: undefined,
    printerHeight: undefined,
    printerRotate: undefined,
    enablePopups: true,
    gotInformationFromFluro: false,
    enabled: false,
    printerType: undefined,
    successCallback: () => { },
    failureCallback: () => { },
    printCallback: () => { },

    init: async function (eventHandler, fluroHandler, mainDirectory, printerId) {
        var self = this;
        this.eventHandler = eventHandler;
        this.fluroHandler = fluroHandler;
        this.printerId = printerId;
        this.outputPath = mainDirectory + "/temp/";

        //Ensure our directory is available
        if (!fs.existsSync(this.outputPath)) {
            this.eventHandler.info("Output directory didn't exist, created it", EVENT_HANDLER_NAME);
            fs.mkdirSync(this.outputPath, { recursive: true });
        }

        return true;
    },

    //Get a list of the printers on the system
    getPrinterUSBs: function () {
        return pdfToPrinter.getPrinters();
    },

    check: function () {
        var self = this;

        //Check that the printer exists on the system
        var checkPrinterState = function () {
            return new Promise((resolve) => {
                pdfToPrinter.getPrinters().then((result) => {
                    var found = false;
                    for (var i = 0; i < result.length; i++) {
                        if (result[i].name == self.printerUSBName) {
                            found = true;
                            break;
                        }
                    }
                    if (found == false) {
                        self.eventHandler.error("The printer " + self.printerUSBName + " was not found", EVENT_HANDLER_NAME);
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    }
                }).catch((error) => {
                    resolve(false);
                    self.eventHandler.error("An error occurred while getting a list of available printers: " + error, EVENT_HANDLER_NAME);
                });
            })
        };

        return new Promise((resolve) => {
            if (self.printerUSBName === undefined) {
                self.eventHandler.error("There is no printer set", EVENT_HANDLER_NAME);
                resolve(false);
            }
            else if (self.gotInformationFromFluro == false) {
                self.getPrinterInformationFromFluro().then(() => {
                    checkPrinterState().then((success) => { resolve(success); });
                }).catch(() => {
                    self.eventHandler.error("Could not get printer information from Fluro", EVENT_HANDLER_NAME);
                    resolve(false);
                });
            }
            else {
                checkPrinterState().then((success) => { resolve(success); });
            }
        });
    },

    //Should popups be shown
    setPopupEnable(enable) {
        this.enablePopups = enable;
    },

    //Should the printer be enabled?
    setPrinterEnable(enable) {
        this.enabled = enable;
    },

    //Set the function to call when a print succeeds (info, closePopupMS)
    setSuccessCallback(callbackFn) {
        var self = this;
        this.successCallback = function (info, closePopupMS) {
            if (self.enablePopups == true) {
                callbackFn(info, closePopupMS);
            }
        }
    },

    //Set the function to call when a print fails (info, closePopupMS)
    setFailureCallback(callbackFn) {
        var self = this;
        this.failureCallback = function (info, closePopupMS) {
            if (self.enablePopups == true) {
                callbackFn(info, closePopupMS);
            }
        }
    },

    //Set the function to call when the print has begun (info, closePopupMS)
    setPrintingCallback(callbackFn) {
        var self = this;
        this.printCallback = function (info, closePopupMS) {
            if (self.enablePopups == true) {
                callbackFn(info, closePopupMS);
            }
        }
    },

    //Set the printer type from a set of predefined printer types
    setPrinterType: function (type) {
        if (supportedPrinters[type] === undefined) {
            this.eventHandler.error("Printer type " + type + " does not exist", EVENT_HANDLER_NAME);
            if (this.printerType) {
                return false;
            }
            else {
                type = Object.keys(this.getPrinterTypes())[0];
            }
        }
        this.printerType = supportedPrinters[type];
        this.printerUSBName = supportedPrinters[type].USBName;
        this.eventHandler.info("Printer set to: " + this.printerUSBName, EVENT_HANDLER_NAME);
    },
    //Get the list of supported predefined printer types
    getPrinterTypes: function () {
        return supportedPrinters;
    },
    //Set the manual printer settings
    setCustomPrinter: function (USBName) {
        this.printerUSBName = USBName;
        this.eventHandler.info("Printer set to: " + this.printerUSBName, EVENT_HANDLER_NAME);
    },

    //Get information about this printer from Fluro
    getPrinterInformationFromFluro: function () {
        var self = this;
        return new Promise((resolve, reject) => {
            this.fluroHandler.fluro.api.get("printer/" + this.printerId, { cache: false }).then((result) => {
                self.gotInformationFromFluro = true;
                self.printerWidth = result.data.data.width;
                self.printerHeight = result.data.data.height;
                self.printerRotate = result.data.data.rotated;
                self.eventHandler.info("Got printer information from Fluro, Our printer name is " + result.data.title, EVENT_HANDLER_NAME);
                resolve(result);
            }).catch((error) => {
                self.failureCallback("Cannot get information about this printer from Fluro", false);
                self.eventHandler.error("Failed to get information about the printer from Fluro: " + error, EVENT_HANDLER_NAME);
                reject();
            });
        });
    },

    //TO BE DEPRECIATED
    //Get the list of printer templates from fluro
    getPrinterTemplatesFromFluro: async function () {
        try { return await this.fluroHandler.fluro.api.get("/printer/templates", { cache: false }); }
        catch (e) { return undefined; }
    },

    //NEED TO UPDATE
    //Start a test print
    testPrint: function () {
        return this.fluroHandler.fluro.api.get("/printer/" + this.printerId + "/test", { cache: false });
    },

    //NEED TO BE UPDATED
    //Create a new printer for our checkin on Fluro
    createNewPrinterFluro(fluroHandler, checkinId, platform, applicationVersion, applicationName, firebaseToken, printLabelId) {
        var self = this;

        return new Promise(async (resolve, reject) => {
            fluroHandler.fluro.api.post("/printer/register", {
                title: checkinId,
                platform: platform,
                deviceID: firebaseToken,
                metadata: {
                    version: applicationVersion,
                    name: applicationName
                },
                data: {
                    rotated: false,
                    width: self.printerType.width,
                    height: self.printerType.height,
                    templateChild: printLabelId,
                    templateParent: printLabelId //This technically doesn't work but eh
                }
            }).then(resolve).catch(reject);
        });
    },

    //Update the fluro settings for our printer
    updateFluroInformation: function (stationName, rotate, width, height, childTemplateId, parentTemplateId, firebaseToken, printerId = undefined) {
        return this.fluroHandler.fluro.api.put("/printer/" + (printerId || this.printerId), {
            title: stationName,
            deviceID: firebaseToken,
            data: {
                rotated: rotate,
                width: width,
                height: height,
                templateChild: childTemplateId,
                templateParent: parentTemplateId
            }
        });
    },

    /**
     * Print a PDF
     * @param {string} filename 
     */
    printPDF: async function (filename) {
        var self = this;
        const nodeCmd = require('node-cmd');
        nodeCmd.runSync(__dirname + `/../PDFtoPrinter.exe ${filename} "${self.printerUSBName}"`, function (error, data, stdError) {
            if (error) {
                self.failureCallback("Something happened while communicating with the printer", 3000);
                self.eventHandler.error("There was a problem while printing: " + error, EVENT_HANDLER_NAME);
            }
        });

        self.successCallback("Printed successfully to " + self.printerUSBName + " (" + self.printerHeight + "x" + self.printerWidth + ")", 3000);
        self.eventHandler.info("Printed successfully to " + self.printerUSBName + " (" + self.printerHeight + "x" + self.printerWidth + ")", EVENT_HANDLER_NAME);
    },

    /**
     * Print a sticker
     * @param {object} document The document to input 
     */
    printSticker: async function (document) {
        var self = this;
        document.data.printer = {
            height: (!self.printerRotate ? self.printerHeight : self.printerWidth) + "mm",
            width: (!self.printerRotate ? self.printerWidth : self.printerHeight) + "mm",
            border: "10mm"
        };

        pdf.create({
            path: `${this.outputPath}temp_${document.id}.pdf`,
            html: document.html,
            data: JSON.stringify(document.data) //We pass a stringified version to allow for better processing on the HTML side using JS
        }, {
            border: "5mm",
            height: (!self.printerRotate ? self.printerHeight : self.printerWidth) + "mm",
            width: (!self.printerRotate ? self.printerWidth : self.printerHeight) + "mm",
        }).then(async function (result) {
            //If the file is less than 5kb assume it's an empty pdf and don't print it
            if (fs.statSync(result.filename).size > 2000) {
                self.eventHandler.info("Finished the PDF generation, printing now!", EVENT_HANDLER_NAME);
                await self.printPDF(result.filename);
                //Delete our pdf
                await fs.promises.unlink(result.filename);
            }
            else {
                self.eventHandler.info("Finished the PDF generation but it was empty...", EVENT_HANDLER_NAME);
                //Delete our pdf
                await fs.promises.unlink(result.filename);
            }
        }).catch(error => {
            console.log(error);
        });
    }
}
const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const { setup: setupPushReceiver } = require('electron-push-receiver');
const { autoUpdater } = require('electron-updater');


const { default: got } = require("got/dist/source");
const nconf = require("nconf");
const path = require("path");
const os = require('os');
const fs = require("fs");
const MAIN_DIRECTORY = app.getPath("home") + "\\kardinia-kiosk";
const APPLICATION_VERSION = app.getVersion();
const APPLICATION_NAME = "KardiniaKiosk";
const EVENT_HANDLER_NAME = "Main";

var fluroHandler = require("./fluroHandler.js");
var printerHandler = require("./printerHandler.js");
var eventHandler = require("./eventHandler.js");
eventHandler.directory = MAIN_DIRECTORY;
var config = nconf.use("file", { file: MAIN_DIRECTORY + "/config.conf" });
var configs = {};
var states = {
    Config: false,
    Internet: false,
    Fluro: false,
    Printer: false
};
var logs = [];
var windows = {};
var developmentMode = false;
var localStorageListener;

//When the app is ready open our windows!
var prevMouseEvent;
app.on("ready", async () => {
    //Make sure our working directory exists
    if (!fs.existsSync(MAIN_DIRECTORY)) {
        fs.mkdirSync(MAIN_DIRECTORY, { recursive: true });
        eventHandler.info("Working directory didn't exist, created it", EVENT_HANDLER_NAME);
    }
    eventHandler.info("Kardinia Kiosk Version " + APPLICATION_VERSION, EVENT_HANDLER_NAME);
    eventHandler.info("Config location " + MAIN_DIRECTORY, EVENT_HANDLER_NAME);

    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('update-available', () => {
        eventHandler.info("Update available, downloading it!", EVENT_HANDLER_NAME);
        generatePopupWindow("info", "There is an update!", "Downloading and installing the update, please wait. This may take some time but the process is automatic", false);
    });
    autoUpdater.on('update-downloaded', () => {
        eventHandler.info("Downloaded an update, restarting and installing!", EVENT_HANDLER_NAME);
        autoUpdater.quitAndInstall();
    });

    //Attempt to load the config and set things up
    if (loadConfig() == true) {
        generatePopupWindow("info", "Getting things ready!", "Please wait", false);
        states.Config = true;
        await check();

        //Add our callbacks for status updates for the popup window
        printerHandler.setSuccessCallback(function (info, closeAfterMS) {
            generatePopupWindow("printSuccess", "Print Successful", info, closeAfterMS);
        });
        printerHandler.setFailureCallback(function (info, closeAfterMS) {
            generatePopupWindow("error", "Printer Error", info, closeAfterMS);
        });
        printerHandler.setPrintingCallback(function (info, closeAfterMS) {
            generatePopupWindow("printing", "Printing", info, closeAfterMS);
        });

        //Setup a hidden window that just handles the print events
        var pushReceiver = new BrowserWindow({
            x: 0,
            y: 0,
            backgroundThrottling: false,
            webPreferences: {
                backgroundThrottling: false,
                skipTaskbar: true,
                nodeIntegration: true,
                webSecurity: false,
                contextIsolation: false,
                nodeIntegration: true
            },
            skipTaskbar: true
        });
        pushReceiver.loadFile("./web/pushReceiver.html");
        setupPushReceiver(pushReceiver);
        pushReceiver.hide();
        //Send the id
        setTimeout(function() {
            pushReceiver.webContents.send("startFirebaseService", configs["fluroFirebaseID"]);
        }, 2000);

        generatePopupWindow("info", "Getting things ready!", "Please wait", 1);
        generateMainWindow();
        generatePosterWindow();
        generateSettingsWindow();

        //Every minute double check everything is good
        setInterval(function () {
            check();
        }, 60000);
    }
    else {
        eventHandler.error("Failed to start application as there are configuration errors. Please update the configuration!", EVENT_HANDLER_NAME);
        generatePopupWindow("error", "This kiosk has invalid configuration", "Please contact your technical director for assistance. The check-in cannot continue as it's missing critical configuration settings", false);
    }

    electron.powerSaveBlocker.start('prevent-app-suspension');
});

//Check if everything is functioning correctly. Returns true if there are no critical errors
async function check() {
    var criticalError = false;
    if (await checkInternet() == true) {
        states.Internet = true;

        //Initialize if they haven't already
        if (states.Fluro == false) {
            if (fluroHandler.init(eventHandler, printerHandler, MAIN_DIRECTORY, configs) == false) {
                eventHandler.error("Fluro failed to init", mainName);
                criticalError = true;
            }
        }

        //Check fluro for problems
        if (await fluroHandler.check() == false) {
            criticalError = true;
            if (states.Fluro == true) { eventHandler.error("Fluro failed checks", mainName); }
            states.Fluro = false;
        }
        else {
            states.Fluro = true;
            if (states.Printer == false) {
                //If there is no printer id set attempt to find our printer based on our kiosk name or create one
                if (configs["fluroPrinterID"] == "unset") {
                    eventHandler.warning("There is no fluro printer set. We will attempt to find one based on our checkin id or create one", EVENT_HANDLER_NAME);

                    if (configs["kioskId"] != "") {
                        //Attempt to add the printer, if it exists Fluro returns it's id
                        try {

                            printerHandler.printerType = printerHandler.getPrinterTypes()[Object.keys(printerHandler.getPrinterTypes())[0]];
                            var result = await printerHandler.createNewPrinterFluro(fluroHandler, "KIOSK - " + configs["kioskId"], os.platform(), APPLICATION_VERSION, APPLICATION_NAME, "TOKEN NOT SET YET");

                            //Save the id to our settings and restart
                            config.set("fluroPrinterID", result.data._id);
                            configs["fluroPrinterID"] = result.data._id;
                            config.save(function (error) {
                                if (error) { eventHandler.error("Failed to save the config file: " + error, "Config"); return false; }
                                restartApplication();
                            });
                        }
                        catch (error) {
                            console.log(error);
                            eventHandler.error("Failed to create our print station", EVENT_HANDLER_NAME);
                        }
                    }
                    else {
                        eventHandler.error("There is no kiosk id set, will not attempt to create a station with Fluro", EVENT_HANDLER_NAME);
                    }
                }

                printerHandler.init(eventHandler, fluroHandler, MAIN_DIRECTORY, configs["fluroPrinterID"]);
                if (configs["customPrinter"]["USBName"] != "unset") {
                    printerHandler.setCustomPrinter(configs["customPrinter"]["USBName"], configs["customPrinter"]["printOptions"]);
                }
                else {
                    printerHandler.setPrinterType(configs["printerType"]);
                }
            }

            //Check the printer
            if (await printerHandler.check() == false) {
                if (states.Printer == true) { eventHandler.error("The printer failed checks", EVENT_HANDLER_NAME); }
                states.Printer = false;
                printerHandler.setPopupEnable(false); //Disable popups from this point
            }
            else {
                states.Printer = true;
            }
        }
    }
    else {
        states.Internet = false;
        eventHandler.error("There is no internet connection", EVENT_HANDLER_NAME);
        criticalError = true;
    }

    //If there is a critical error reset everything and try again in a bit
    if (criticalError == true) {
        eventHandler.error("There was a critical error, the handlers have been reset and will attempt connection shortly", EVENT_HANDLER_NAME);
        states.Fluro = false;
        states.Printer = false;
        fluroHandler = require("./fluroHandler.js");
        printerHandler = require("./printerHandler.js");
        sendToRenderer("states", states);
        return false;
    }

    sendToRenderer("states", states);
    return true;
}

//Check if the internet is working
async function checkInternet() {
    return await require("is-online")();
}

//Load in our config
function loadConfig() {
    var error = false;
    eventHandler.info("Loading configuration", EVENT_HANDLER_NAME);

    //Load in a config line, will return the value otherwise undefined
    var readConfig = function (configName, defaultValue) {
        var temp = config.get(configName);
        if (temp === undefined || temp === "") {
            config.set(configName, defaultValue);
            configs[configName] = defaultValue;
            error = true;
            eventHandler.warning("Configuration " + configName + " was reset to default values", EVENT_HANDLER_NAME);
        }
        else {
            configs[configName] = temp;
        }
    }

    //Read in our configurations
    readConfig("printerType", "microsoftPDF");
    readConfig("customPrinter", {
        "USBName": "unset",
        "printOptions": []
    });
    readConfig("apiUrl", "https://api.fluro.io");
    readConfig("applicationToken", "");
    readConfig("applicationDomainName", "");
    readConfig("fluroPrinterID", "unset");
    readConfig("kioskConfigurationId", "");
    readConfig("kioskId", "");
    readConfig("kioskCampus", "");
    readConfig("fluroFirebaseID", "");

    //We have something that has a default value alert of this
    if (error) {
        
        //Save the changes
        config.save(function (error) {
            if (error) { eventHandler.error("Failed to save the config file: " + error, EVENT_HANDLER_NAME); }
        });

        return false;
    }

    sendToRenderer("configs", configs);
    return true;
}

//Define our windows
function generateMainWindow() {
    try {
        windows["mainWindow"].restore();
        return windows["mainWindow"];
    }
    catch (e) { }
    windows["mainWindow"] = new BrowserWindow({
        x: 0,
        y: 0,
        backgroundThrottling: false,
        webPreferences: {
            backgroundThrottling: false
        },
        fullscreen: !developmentMode,
        frame: developmentMode,
        skipTaskbar: true
    });
    windows["mainWindow"].sendLogs = true;

    //Attempt to inject our settings into the page
    windows["mainWindow"].webContents.on("did-finish-load", function () {
        if (windows["mainWindow"].webContents.getURL().includes("http") == true) {
            eventHandler.info("Attempting to inject settings into Fluro checkin site", EVENT_HANDLER_NAME);

            //Inject the our fluro printer id
            windows["mainWindow"].webContents.executeJavaScript("var printerId = '\x22" + configs["fluroPrinterID"] + "\x22'; var same = localStorage.getItem('ngStorage-printStationID') == printerId; localStorage.setItem('ngStorage-printStationID','" + '"' + configs["fluroPrinterID"] + '"' + "'); if(same == false){window.location.reload();}", true).then((result) => {
            }).catch((error) => {
                eventHandler.error("Failed to inject the print station id into the checkin", EVENT_HANDLER_NAME);
                console.log(error);
            });
        }
        //Add a button on the top left and bottom right to allow access to the config screen
        var buttonEvent = function (corner) {
            if (corner) {
                buttonClicked = true;
                clearTimeout(buttonTimeout);
                buttonTimeout = setTimeout(function () {
                    buttonClicked = false;
                }, 5000);
            }
            else if (buttonClicked == true) {
                buttonClicked = false;
                clearTimeout(buttonTimeout);
                window.localStorage.setItem("configAccess", true);
            }
        }
        var generateButton = function (corner) {
            var button = document.createElement("button");
            button.style.position = "absolute";
            button.style.zIndex = 9999999;
            button.style.width = "3vw";
            button.style.height = "3vw";
            button.style.opacity = 0;
            button.onclick = function () {
                buttonEvent(corner);
            }
            if (corner) { button.style.top = 0; } else { button.style.bottom = 0; }
            if (corner) { button.style.left = 0; } else { button.style.right = 0; }
            document.getElementsByTagName("html")[0].appendChild(button);
        }
        windows["mainWindow"].webContents.executeJavaScript("localStorage.setItem('configAccess', null); var buttonTimeout; var buttonClicked = false; var buttonEvent = " + buttonEvent.toString() + "; var generateButton = " + generateButton.toString() + "; generateButton(); generateButton(true)", true).then((result) => {
        }).catch((error) => {
            eventHandler.error("Failed to inject the configuration access buttons (gesture)", EVENT_HANDLER_NAME);
            console.log(error);
        });

        //Add a listener to listen for config requests on the local storage
        clearInterval(localStorageListener);
        localStorageListener = setInterval(function () {
            try {
                windows["mainWindow"].webContents.executeJavaScript("window.localStorage.getItem('configAccess')", true).then((result) => {
                    if (result == "true") {
                        eventHandler.info("Got request to open configuration", EVENT_HANDLER_NAME);
                        generateSettingsWindow();
                        windows["mainWindow"].webContents.executeJavaScript("window.localStorage.setItem('configAccess', null);", true).then((result) => {
                        }).catch((error) => {
                            eventHandler.error("Failed to reset configuration access buttons (gesture) flag", EVENT_HANDLER_NAME);
                            console.log(error);
                        });
                    }
                }).catch((error) => {
                    eventHandler.error("Failed to get local storage to detect configuration window access buttons (gesture)", EVENT_HANDLER_NAME);
                    console.log(error);
                });
            }
            catch (e) { }
        }, 1000);
    });

    windows["mainWindow"].loadFile("./web/blank.html");
    return windows["mainWindow"];
}
function generatePosterWindow() {
    try {
        windows["posterWindow"].restore();
        return windows["posterWindow"];
    }
    catch (e) { }
    windows["posterWindow"] = new BrowserWindow({
        x: 0,
        y: -1000,
        backgroundThrottling: false,
        webPreferences: {
            backgroundThrottling: false
        },
        fullscreen: !developmentMode,
        frame: developmentMode,
        skipTaskbar: true
    });
    windows["posterWindow"].loadFile("./web/blank.html");
    windows["posterWindow"].webContents.on("did-finish-load", function () {
        try {
            windows["posterWindow"].webContents.executeJavaScript("document.getElementsByTagName('html')[0].style.overflow = 'hidden';"); //Disable scroll bars
        }
        catch (e) { }
    });
    return windows["posterWindow"];
}
function generateSettingsWindow() {
    try {
        windows["settingsWindow"].restore();
        return windows["settingsWindow"];
    }
    catch (e) { }
    windows["settingsWindow"] = new BrowserWindow({
        x: 0,
        y: 0,
        backgroundThrottling: false,
        webPreferences: {
            backgroundThrottling: false,
            skipTaskbar: true,
            nodeIntegration: true,
            webSecurity: false,
            contextIsolation: false,
            nodeIntegration: true
        },
        fullscreen: !developmentMode,
        frame: developmentMode
    });
    windows["settingsWindow"].sendLogs = true;
    windows["settingsWindow"].setAlwaysOnTop(true, "screen");
    windows["settingsWindow"].loadFile("./web/config.html");
    return windows["settingsWindow"];
}
var popupWindowCloseTimeout;
function generatePopupWindow(type = "info", title = "Someone forgot to set a title", description = "Someone forgot to set a description", closeAfterMS = 3000) {
    try {
        //If there is a window open update what it is displaying
        windows["popupWindow"].restore();
        sendToRenderer("updatePopup",
            JSON.stringify({
                type, title, description
            }), windows["popupWindow"]);
    }
    catch (e) {
        //If it failed to restore the window open a new one
        windows["popupWindow"] = new BrowserWindow({
            x: 0,
            y: 0,
            backgroundThrottling: false,
            webPreferences: {
                skipTaskbar: true,
                nodeIntegration: true,
                webSecurity: false,
                contextIsolation: false,
                nodeIntegration: true,
                backgroundThrottling: false,
                additionalArguments: ["popupArgs=" + JSON.stringify({
                    type, title, description
                })]
            },
            fullscreen: !developmentMode,
            frame: developmentMode,
            transparent: true
        });
        windows["popupWindow"].loadFile("./web/popup.html");
        windows["popupWindow"].setAlwaysOnTop(true, "screen");
    }

    //If the window is set to auto close after sometime
    clearTimeout(popupWindowCloseTimeout);
    if (closeAfterMS != false) {
        popupWindowCloseTimeout = setTimeout(function () {
            eventHandler.info("Auto closing the popup window after " + closeAfterMS + "ms", EVENT_HANDLER_NAME);
            windows["popupWindow"].close();
        }, closeAfterMS);
    }
    return windows["popupWindow"];
}

//Quit the app
function quit() {
    if (process.platform !== "darwin") {
        app.quit();
    }
}

//When the app is requested to close ensure we close
app.on("window-all-closed", () => {
    quit();
});

//Close a window
function closeWindow(window) {
    try {
        if (windows[window]) {
            eventHandler.info("Requested to close window: " + window, EVENT_HANDLER_NAME);
            windows[window].close();
        }
        else {
            return "Could not find that window";
        }
    } catch (e) { }
}

//Reload a window
function reloadWindow(window) {
    try {
        if (windows[window]) {
            eventHandler.info("Requested to reload window: " + window, EVENT_HANDLER_NAME);
            windows[window].reload();
        }
        else {
            return "Could not find that window";
        }
    } catch (e) { }
}

//Restart the application
function restartApplication() {
    app.relaunch();
    app.exit();
}

//Event handles
eventHandler.on(eventHandler.error, function (info, domain) {
    console.log("[ERROR][" + domain + "] - " + info);
    logs.push({
        type: "error",
        domain,
        info
    });
    sendToRenderer("error", {
        "info": info,
        "domain": domain
    });
});
eventHandler.on(eventHandler.info, function (info, domain) {
    console.log("[INFO][" + domain + "] - " + info);
    logs.push({
        type: "info",
        domain,
        info
    });

    sendToRenderer("info", {
        "info": info,
        "domain": domain
    });
});
eventHandler.on(eventHandler.warning, function (info, domain) {
    console.log("[WARN][" + domain + "] - " + info);
    logs.push({
        type: "warning",
        domain,
        info
    });
    sendToRenderer("warning", {
        "info": info,
        "domain": domain
    });
});

//////////////////////////////
/// Sends from the windows ///
//////////////////////////////

//Send something to a window or all windows
function sendToRenderer(message, value, window) {
    if (window) {
        window.webContents.send(message, value);
    }
    else {
        for (var i in windows) {
            try {
                windows[i].webContents.send(message, value);
            }
            catch (e) { }
        }
    }
}

//////////////////////////////
/// Calls from the windows ///
//////////////////////////////

//Get information about the kiosk
ipcMain.handle("getKioskInformation", async (event) => {
    eventHandler.info("Request to get kiosk modes", EVENT_HANDLER_NAME);

    //Find the modes enabled at the campus otherwise allow all modes
    try {
        var modes = {};
        if (fluroHandler.kioskConfiguration.campusModes[configs["kioskCampus"]]) {
            for (var i = 0; i < fluroHandler.kioskConfiguration.campusModes[configs["kioskCampus"]].length; i++) {
                modes[fluroHandler.kioskConfiguration.campusModes[configs["kioskCampus"]][i]] = fluroHandler.kioskConfiguration.modes[fluroHandler.kioskConfiguration.campusModes[configs["kioskCampus"]][i]];
            }
        }
        else {
            modes = fluroHandler.kioskConfiguration.modes;
        }
    } catch (e) {
        eventHandler.error("Failed to populate modes from Fluro", EVENT_HANDLER_NAME);
        modes = {};
    }

    return {
        kioskId: configs["kioskId"],
        printerId: configs["fluroPrinterID"],
        printerType: configs["printerType"],
        customPrinter: configs["customPrinter"],
        printerEnabled: printerHandler.enabled,
        version: APPLICATION_VERSION,
        modes: modes
    };
});


//Get the logs
ipcMain.handle("getLogs", function (event) {
    return logs;
});

//Change the poster URL
ipcMain.handle("changePosterURL", function (event, url) {
    eventHandler.info("Changed poster window URL to " + url, EVENT_HANDLER_NAME);
    try { windows["posterWindow"].loadURL(url); }
    catch (e) { }
    return true;
});

//Change the main window URL
ipcMain.handle("changeMainURL", function (event, url) {
    eventHandler.info("Changed main window URL to " + url, EVENT_HANDLER_NAME);
    try { windows["mainWindow"].loadURL(url); }
    catch (e) { }
    return true;
});

//Close a window
ipcMain.handle("closeWindow", function (event, window) {
    closeWindow(window);
});

//Open the popup window
ipcMain.handle("openPopup", function (event, type, title, description, keepOpenMS) {
    eventHandler.info("Opened the popup window", EVENT_HANDLER_NAME);
    generatePopupWindow(type, title, description, keepOpenMS);
    return true;
});

//Open the settings window
ipcMain.handle("openSettings", function (event) {
    eventHandler.info("Opened the settings window", EVENT_HANDLER_NAME);
    generateSettingsWindow();
    return true;
});

//Open the settings window
ipcMain.handle("closeApplication", function (event) {
    eventHandler.info("Request to quit application", EVENT_HANDLER_NAME);
    quit();
    return true;
});
ipcMain.handle("getStates", function (event) {
    return states;
});

//Reload the windows
ipcMain.handle("reloadWindows", function (event) {
    eventHandler.info("Reloading the windows", EVENT_HANDLER_NAME);
    for (var i in windows) {
        reloadWindow(i);
    }

    return true;
});

//Restart the application
ipcMain.handle("restartApplication", function (event) {
    eventHandler.info("Restarting the application", EVENT_HANDLER_NAME);
    restartApplication();
    return true;
});

//Save printer settings
ipcMain.handle("savePrinterSettings", async function (event, object) {
    eventHandler.info("Updating the printer settings", EVENT_HANDLER_NAME);

    //Config file
    if (object.printerType) {
        //If they changed the printer type copy over the width and height to our printer type
        if (configs["printerType"] != object.printerType) {
            object.fluroWidth = printerHandler.getPrinterTypes()[object.printerType].width;
            object.fluroHeight = printerHandler.getPrinterTypes()[object.printerType].height;
            object.fluroRotate = printerHandler.getPrinterTypes()[object.printerType].rotate;
        }
        config.set("printerType", object.printerType);
    }
    if (object.fluroPrinterId) { config.set("fluroPrinterID", object.fluroPrinterId); }
    if (object.printerUSB) {
        config.set("customPrinter", {
            "USBName": object.printerUSB,
            "printOptions": []
        });
    }

    //Fluro settings
    if (object.fluroPrinterId && object.setFluro == true) {

        printerHandler.updateFluroInformation(object.fluroStationName, object.fluroRotate, object.fluroWidth, object.fluroHeight, object.fluroChildTemplate, object.fluroParentTemplate, object.fluroPrinterId).then(result => {
            eventHandler.info("The Fluro print station was updated", EVENT_HANDLER_NAME);
            restartApplication();
        }).catch(error => {
            console.log(error);
            eventHandler.error("There was an error saving the settings to the Fluro print station", EVENT_HANDLER_NAME);
        });
    }

    //Save the changes
    config.save(function (error) {
        if (error) { eventHandler.error("Failed to save the config file: " + error, "Config"); return false; }
        if (object.setFluro == false) {
            restartApplication();
        }
    });

    return true;
});

//Restart the application
ipcMain.handle("getPrinterSettings", async function (event) {
    eventHandler.info("Getting the printer settings", EVENT_HANDLER_NAME);
    var fluroPrinter = undefined; try { fluroPrinter = await printerHandler.getPrinterInformationFromFluro(); } catch (e) { }
    var fluroTemplates = await printerHandler.getPrinterTemplatesFromFluro();
    var printerUSBs = await printerHandler.getPrinterUSBs();
    return {
        printerId: configs["fluroPrinterID"],
        printerType: configs["printerType"],
        customPrinter: configs["customPrinter"],
        fluroPrinter: fluroPrinter ? fluroPrinter.data : undefined,
        fluroTemplates: fluroTemplates ? fluroTemplates.data : undefined,
        printerTypes: printerHandler.getPrinterTypes(),
        printerUSBs: printerUSBs
    }
});

//Start a test print
ipcMain.handle("issueTestPrint", async function (event) {
    eventHandler.info("Attempting to print a test label using Fluro", EVENT_HANDLER_NAME);
    var result = undefined; try { await printerHandler.testPrint(); eventHandler.info("Successfully sent a test print", EVENT_HANDLER_NAME); } catch (e) {
        console.log(e);
        eventHandler.error("There was a problem sending the test print", EVENT_HANDLER_NAME);
    }
    return true;
});

//Enable or disable the printing functionality
ipcMain.handle("enablePrinter", function (event, state) {
    if (typeof state == "string" && state.toLowerCase() == "toggle") {
        state = !printerHandler.enabled;
    }

    eventHandler.info("Changed the printer state to " + state, EVENT_HANDLER_NAME);
    printerHandler.setPrinterEnable(state);
    return true;
});

//Update the printer id with our FMC token
ipcMain.handle("setTokenToPrinter", async function (event, token) {
    eventHandler.info("Setting our token with the printer on Fluro", EVENT_HANDLER_NAME);
    try {
        var result = await printerHandler.updateFluroInformation(undefined, undefined, undefined, undefined, undefined, undefined, token, undefined);
        if (result.data._id != configs["fluroPrinterID"]) {
            eventHandler.info("Our local print station id is different from Fluros, updating our id and restarting", EVENT_HANDLER_NAME);
            config.set("fluroPrinterID", result.data._id);
            configs["fluroPrinterID"] = result.data._id;
            config.save(function (error) {
                if (error) { eventHandler.error("Failed to save the config file: " + error, "Config"); return false; }
                restartApplication();
            });
        }
    }
    catch (e) {
        eventHandler.error("An error occurred while updating the printer", EVENT_HANDLER_NAME);
        console.log(e);
    }

    return true;
});

//Called when a print notification comes from firebase
ipcMain.handle("gotPrintFromFirebase", async function (event, incoming) {
    if (incoming.data.html === undefined) { return; }
    if (printerHandler.enabled) {
        eventHandler.info("Got print notification for " + incoming.data.title, EVENT_HANDLER_NAME);
        if (incoming.data.html === undefined) { return false; }
        if (incoming.data.html.length < 10) {
            eventHandler.info("Page is blank ignoring", EVENT_HANDLER_NAME);
            return false;
        }

        generatePopupWindow("info", "Getting Ready!", "Getting some information, please wait..", false);
        fluroHandler.handlePrintRequest(incoming);
    }
    else {
        eventHandler.info("Got print notification but the printer is disabled, ignoring", EVENT_HANDLER_NAME);
    }

    return true;
});

//Little funny
ipcMain.handle("easterEgg", function() {
    //Copy html file to temp
    fs.createReadStream("./easterEgg.html").pipe(fs.createWriteStream(MAIN_DIRECTORY + "/temp/" + "temp_LOL.html"));
    printerHandler.printHTML("LOL");
});
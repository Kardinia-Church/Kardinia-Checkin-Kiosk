var ipcRenderer = require("electron").ipcRenderer;
var kioskInformation = undefined;

//Get the kiosk information
function getKioskInformation() {
    return new Promise((resolve, reject) => {
        ipcRenderer.invoke("getKioskInformation").then((result) => {
            kioskInformation = result;
            resolve(kioskInformation);
        }).catch((error) => reject(error));
    });
}

//Hide one element and show another (also supports passing of array for multiple ids)
function hideShowElements(hideElementId, showElementId) {
    if (hideElementId) {
        if (typeof hideElementId == "string") { hideElementId = [hideElementId]; }
        for (var i = 0; i < hideElementId.length; i++) {
            document.getElementById(hideElementId[i]).classList.add("hidden");
        }
    }
    if (showElementId) {
        if (typeof showElementId == "string") { showElementId = [showElementId]; }
        for (var i = 0; i < showElementId.length; i++) {
            document.getElementById(showElementId[i]).classList.remove("hidden");
        }
    }
}

//Get the logs
function getLogs() {
    return ipcRenderer.invoke("getLogs");
}

//Change the poster URL
function changePosterURL(url) {
    return ipcRenderer.invoke("changePosterURL", url);
}

//Close a window
function closeWindow(window) {
    return ipcRenderer.invoke("closeWindow", window);
}

//Change the main window url
function setMainWindowURL(url) {
    return ipcRenderer.invoke("changeMainURL", url);
}

//Change the poster window URL
function setPosterWindowURL(url) {
    return ipcRenderer.invoke("changePosterURL", url);
}

//Open the popup window
function openPopupWindow(type, title, description, keepOpenMS) {
    return ipcRenderer.invoke("openPopup", type, title, description, keepOpenMS);
}

//Open the settings window
function openSettingsWindow() {
    return ipcRenderer.invoke("openSettings");
}

//Close the application
function closeApplication() {
    return ipcRenderer.invoke("closeApplication");
}

//Get the statuses information
function getStates() {
    return ipcRenderer.invoke("getStates");
}

//Refresh all the windows
function reloadWindows() {
    return ipcRenderer.invoke("reloadWindows");
}

//Restart the kiosk application
function restart() {
    return ipcRenderer.invoke("restartApplication");
}


//Subscribe to a message from the main
function subscribe(event, callback) {
    ipcRenderer.on(event, callback);
}

//On an info message from main
function onInfo(callback) {
    subscribe("info", callback);
}

//On an info message from main
function onError(callback) {
    subscribe("error", callback);
}

//On an info message from main
function onWarning(callback) {
    subscribe("warning", callback);
}

//When the status updates
function onStatusUpdate(callback){
    subscribe("states", callback);
}

//When the configuration is updated
function onConfigUpdate(callback){
    subscribe("configs", callback);
}

//Get the printer settings
function getPrinterSettings() {
    return ipcRenderer.invoke("getPrinterSettings");
}

//Save new print settings
function savePrinterSettings(object) {
    return ipcRenderer.invoke("savePrinterSettings", object);
}

//Test print
function issueTestPrint() {
    return ipcRenderer.invoke("issueTestPrint");
}

//Enable or disable the printer
function enablePrinter(state) {
    return ipcRenderer.invoke("enablePrinter", state);
}

//Get the current window URLs
function getWindowURLS() {
    return ipcRenderer.invoke("getWindowURLS");
}
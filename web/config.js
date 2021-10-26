//Update our page with information from the main process
async function update() {
    console.log("Update window");
    showLoader(true, "main");
    updateStates(await getStates(), await getKioskInformation());

    //Update our HTML fields
    //Add our options
    var element = document.getElementById("modeSelection");
    element.innerHTML = "";
    for (var i in kioskInformation.modes) {
        var mode = document.createElement("a");
        mode.href = "#";
        mode.innerHTML = kioskInformation.modes[i].label;
        mode.setAttribute("modeId", i);
        mode.onclick = function (element) {
            updateKioskMode(element.target.getAttribute("modeId"));
        }
        element.appendChild(mode);
    }

    //Set the kiosk id
    document.getElementById("kioskId").innerHTML = "Kiosk " + kioskInformation.kioskId + "</br>Kiosk Version " + kioskInformation.version + "";
    document.getElementById("kioskId").style.color = "black";

    showLoader(false, "main");
}

//Update the HTML status indicators
function updateStates(states, kioskInformation) {

    //Update the status
    document.getElementById("checks").innerHTML = "";
    for (var i in states) {
        var elem = document.createElement("p");
        var icon = document.createElement("i");
        elem.style.margin = "10px";
        elem.style.display = "inline";
        elem.style.color = states[i] == true ? "green" : "red";
        icon.classList = [(states[i] == true ? "fas fa-check" : "fas fa-times")];
        if (i.toLowerCase() == "printer" && kioskInformation.printerEnabled == false) {
            i = i + " (Disabled)";
            elem.style.color = "gray";
            icon.classList = "fas fa-ghost";
            document.getElementById("togglePrinterButton").innerHTML = "Enable Printer";
        }
        else {
            document.getElementById("togglePrinterButton").innerHTML = "Disable Printer";
        }
        elem.innerText = i + " ";
        elem.appendChild(icon);
        document.getElementById("checks").appendChild(elem);
    }
}

//Toggle the printer on or off
async function togglePrinter() {
    enablePrinter("toggle");
    updateStates(await getStates(), await getKioskInformation());
}

window.onload = async function () {
    document.getElementById("modeSelection").style.paddingRight = document.getElementById("modeSelection").offsetWidth - document.getElementById("modeSelection").clientWidth + "px";
    update();

    //Add the console information
    var logs = await getLogs();
    for (var i = 0; i < logs.length; i++) {
        addDebug(logs[i].type, logs[i].info, logs[i].domain);
    }
    setTimeout(function () { document.getElementById("debug").scrollTop = document.getElementById("debug").scrollHeight; }, 3000);

    // //Update this window every 60 seconds
    // setInterval(function () {
    //     update();
    // }, 500000);

    //When the status updates
    onStatusUpdate(async function (event, status) {
        updateStates(status, await getKioskInformation());
    });

    //When logs come in
    onInfo(function (event, status) {
        addDebug("info", status.info, status.domain);
    });
    onWarning(function (event, status) {
        addDebug("warning", status.info, status.domain);
    });
    onError(function (event, status) {
        addDebug("error", status.info, status.domain);
    });
}

window.onclick = function (event) {
    //Close all open drop downs
    if (!event.target.matches(".dropbtn")) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains("show")) {
                dropdowns[i].classList.remove("show");
            }
        }
    }
}

//Add a line to the debug terminal
function addDebug(type, message, domain) {
    console.log(message);
    var p = document.createElement("p");
    switch (type) {
        case "info": { p.style.color = "white"; break; }
        case "warning": { p.style.color = "yellow"; break; }
        case "error": { p.style.color = "red"; break; }
    }
    p.innerText = "[" + type.toUpperCase() + "][" + domain + "] - " + message;
    document.getElementById("debug").appendChild(p);

    //Scroll the debug down if the user hasn't scrolled up
    var scroll = false;
    if (document.getElementById("debugContainer").classList.contains("debugMaximized")) {
        scroll = document.getElementById("debug").scrollTop + 2000 > document.getElementById("debug").scrollHeight;
    }
    else {
        scroll = document.getElementById("debug").scrollTop + 400 > document.getElementById("debug").scrollHeight;
    }
    if (scroll) {
        document.getElementById("debug").scrollTop = document.getElementById("debug").scrollHeight;
    }
}

//Close the configuration window
function closeConfigWindow() {
    closeWindow("settingsWindow").then((result) => {
        console.log(result);
    }).catch((error) => {
        console.log("Failed to close the window because: " + error);
    });
}

//Open a dropdown with id
async function openDropDown(id) {
    if (id == "modeSelection") {
        //If we're not fully connected show warnings
        await update();
        var checks = await getStates();
        var criticalError = false;
        if (checks["Config"] !== true) { openPopupWindow("error", "Cannot continue", "Sorry there are configuration errors, this check-in cannot continue. Please check the configuration or contact a campus technical director", 5000); criticalError = true; }
        else if (checks["Internet"] !== true) { openPopupWindow("error", "No Internet", "Sorry there is no internet, please check the WiFi settings or contact a campus technical director", 5000); criticalError = true; }
        else if (checks["Fluro"] !== true) { openPopupWindow("error", "No Internet", "Sorry there is a problem connecting to Fluro, please check the WiFi settings or contact a campus technical director", 5000); criticalError = true; }
        else if (checks["Printer"] !== true) { openPopupWindow("warning", "There are problems with the printer", "The check-in can continue but the printer will not function correctly", 5000); }

        //Only if there are no critical errors open the mode selection
        if (criticalError != true) {
            document.getElementById(id).classList.toggle("show");
        }
    }
}


//Show the advanced menu
function openAdvanced(show) {
    if (show == true) {
        hideShowElements("main", "advanced");
        document.getElementById("debug").scrollTop = document.getElementById("debug").scrollHeight;
    }
    else {
        hideShowElements("advanced", "main");
    }
}

//Show the loader
function showLoader(show, backgroundElementId) {
    if (show == true) {
        hideShowElements(backgroundElementId, "loader");
    }
    else {
        hideShowElements("loader", backgroundElementId);
    }
}

//Maximize / minimize the debug window
function resizeDebug() {
    var container = document.getElementById("debugContainer");
    var button = document.getElementById("changeDebugSizeButton");
    if (container.classList.contains("debugMinimized")) {
        button.innerHTML = "<i class='fas fa-angle-double-down'></i>";
        container.classList.replace("debugMinimized", "debugMaximized");
    }
    else {
        button.innerHTML = "<i class='fas fa-angle-double-up'></i>";
        container.classList.replace("debugMaximized", "debugMinimized");
    }
    document.getElementById("debug").scrollTop = document.getElementById("debug").scrollHeight;
}

//Update the kiosk mode
function updateKioskMode(modeId) {
    var mode = kioskInformation.modes[modeId];
    if (mode) {
        console.log(mode);
        console.log("Change kiosk mode to " + mode.label);
        setMainWindowURL(mode.mainURL);
        setPosterWindowURL(mode.posterURL);
        enablePrinter(mode.enablePrinter);
        closeConfigWindow();
    }
    else {
        console.log("The mode was not found");
    }
}

//Show the printer settings
async function openPrinterSettings(show) {
    if (show == true) {
        hideShowElements("advanced", "loader");
        var printerSettings = await getPrinterSettings();

        //Populate the printer types
        var printerTypes = document.getElementById("printerType");
        printerTypes.innerHTML = "<option value='disable'>Disabled</option> <option value='custom'>Custom</option>";
        for (var i in printerSettings.printerTypes) {
            printerTypes.innerHTML += "<option value='" + i + "'>" + printerSettings.printerTypes[i].friendlyName + "</option>";
        }
        printerTypes.value = printerSettings.printerType;
        if (printerSettings.printerType == "custom") {
            hideShowElements(undefined, ["printerUSB, printerUSBLabel"]);
        }

        //Populate printer usbs
        var printerUSBs = document.getElementById("printerUSB");
        printerUSBs.innerHTML = "<option value='unset'>None</option>";
        for (var i in printerSettings.printerUSBs) {
            printerUSBs.innerHTML += "<option value='" + printerSettings.printerUSBs[i].deviceId + "'>" + printerSettings.printerUSBs[i].name + "</option>";
        }
        printerUSBs.value = printerSettings.customPrinter.USBName;

        //Populate fluro printer id
        document.getElementById("fluroPrinterId").value = printerSettings.printerId;

        //Populate fluro printer settings
        if (printerSettings.fluroPrinter) {
            var fluroPrinterNameTagTemplate = document.getElementById("fluroPrinterNameTagTemplate");
            var fluroPrinterParentTemplate = document.getElementById("fluroPrinterParentTemplate");
            fluroPrinterNameTagTemplate.innerHTML = "";
            fluroPrinterParentTemplate.innerHTML = "";
            for (var i = 0; i < printerSettings.fluroTemplates.length; i++) {
                switch (printerSettings.fluroTemplates[i].data.type) {
                    case "child": {
                        fluroPrinterNameTagTemplate.innerHTML += "<option value='" + printerSettings.fluroTemplates[i]._id + "'>" + printerSettings.fluroTemplates[i].title + "</option>";
                        break;
                    }
                    case "parent": {
                        fluroPrinterParentTemplate.innerHTML += "<option value='" + printerSettings.fluroTemplates[i]._id + "'>" + printerSettings.fluroTemplates[i].title + "</option>";
                        break;
                    }
                }
            }
            fluroPrinterNameTagTemplate.value = printerSettings.fluroPrinter.data.templateChild;
            fluroPrinterParentTemplate.value = printerSettings.fluroPrinter.data.templateParent;
            document.getElementById("fluroWidth").value = printerSettings.fluroPrinter.data.width;
            document.getElementById("fluroHeight").value = printerSettings.fluroPrinter.data.height;
            document.getElementById("fluroRotate").checked = printerSettings.fluroPrinter.data.rotated;
            document.getElementById("fluroStationName").value = printerSettings.fluroPrinter.title;
            hideShowElements("fluroSettingsError", "fluroSettings");
        }

        hideShowElements("advancedMain", "printerSettings");

        //Show the printer usb selector if set to custom
        document.getElementById("printerType").onchange = function (event) {
            if (event.target.value == "custom") {
                hideShowElements(undefined, ["printerUSB", "printerUSBLabel"]);
            }
            else {
                hideShowElements(["printerUSB", "printerUSBLabel"], undefined);
                document.getElementById("printerUSB").value = "unset";
            }
        }

        hideShowElements("loader", "advanced");
    }
    else {
        hideShowElements("printerSettings", "advancedMain");
    }
}

//Save the printer settings
async function updatePrinterSettings() {
    if (await savePrinterSettings({
        printerType: document.getElementById("printerType").value,
        printerUSB: document.getElementById("printerUSB").value,
        fluroPrinterId: document.getElementById("fluroPrinterId").value,
        fluroParentTemplate: document.getElementById("fluroPrinterParentTemplate").value,
        fluroChildTemplate: document.getElementById("fluroPrinterNameTagTemplate").value,
        fluroWidth: parseInt(document.getElementById("fluroWidth").value),
        fluroHeight: parseInt(document.getElementById("fluroHeight").value),
        fluroRotate: document.getElementById("fluroRotate").checked,
        fluroStationName: document.getElementById("fluroStationName").value,
        setFluro: document.getElementById("fluroSettingsError").classList.contains("hidden") == true
    }) == true) {
        openPrinterSettings(false);
    }
}

//Show the application configuration
function openConfiguration(show) {
    if (show == true) {
        hideShowElements("configurationSettings", "advancedMain");
    }
    else {
        hideShowElements("advancedMain", "configurationSettings");
    }
}

//Show the troubleshooting page
function openTroubleshooting(show) {
    if (show == true) {
        hideShowElements("main", "troubleshooting");
    }
    else {
        hideShowElements("troubleshooting", "main");
    }
}

//Open a troubleshooting HTML page
function openTroubleshootingPage(page) {
    window.location.href = "./troubleshooting/" + page + ".html";
}

function easterEgg() {
    ipcRenderer.invoke("easterEgg");
}
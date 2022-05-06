# Features
* A captive kiosk experience
* Checks for issues with the Kiosk and reports if there are any issues
* Allows for Kiosk "modes" which is downloaded from Fluro allowing for dynamic updates
* Allows for updating the printer settings both on the Fluro print station and locally
* Does not require a login, uses an API key instead
* Supports populating extra information to a label from Fluro
* Selects the Kiosk print station automatically when the checkin page is loaded
* Will automatically create a print station for the kiosk id with Fluro if it does not exist
* Connects to the Fluro web socket for printer updates
* Disabling the printer in certain modes
* Campus specific modes
* Auto updater
* Default startup mode for specific checkin(s)

# Features to come
* Campus specific form auto filling
* Setting all kiosks to the same mode
* Attempt to connect to wifi if connection issues are present
* Open the checkin page based on an event directly
* Choose what type of label printing: disabled, both, child only, parent only

# Misc features to add
* Do a test print every so often blocking print to ensure the printer is still connected to Fluro

# Known bugs
None!

# Basic Usage
The kiosk will display a configuration page initially.
* To select a mode press the "Select kiosk mode" button and the Kiosk will set up based on the configuration from Fluro
* The troubleshooting button can be used for basic steps to troubleshoot problems.
* The advanced button is intended for extra troubleshooting steps, it allows for updating settings, restarting the kiosk, and reading logs.
* To get back into the kiosk configuration simply ```tap the top-left corner than the bottom-right corner```.

# Setup
1. Go to Fluro > Developers > Code
2. Create or duplicate a `print template`. Entering the following ```<%= get('_id') %>```
3. Create or duplicate a `pickup print template`. Entering the following ```DONOTPRINT```
4. Create a basic code with HTML. This is your label that will be printed. Set this to the example html seen in `label formatting`.
5. Create another basic code as Javascript with the example configuration seen below in `fluro configuration`
6. In the application configuration file this created code in 4 is the `kioskConfigurationId`
7. Get the ID for the created code in 3 and put this into the configuration as `printTemplate`
8. Enter the fluro firebase id. (Ask for it, or find it yourself in the Fluro print application, I'm not listing it here as i'm not sure if this is private..)
9. Set the kiosk id and kiosk campus.

# Installation
1. Install the relevant drivers below and configure the printers accordingly
2. Ensure nodejs is installed on the system
3. Download the latest installer from the releases
4. Let it install
5. Open the app to generate the configuration for the first time
6. Edit the configuration file to include the Fluro api keys etc located in ```<USER_DIRECTORY>/kardinia-kiosk/config.conf```
7. Add the application to startup
6. Relaunch the application


## Dymo Printer
### Label Writer 450 Turbo - Config type = ```DYMOLabelWriter450Turbo```
* Download and install the driver from [here](https://www.dymo.com/en_AU/labelwriter-450-turbo.html)
* Go into printer preferences and set the paper size to 99014 (Shipping Label)

## Brother Printer
### QL-580N - Config type = ```brotherQL580N```
* Download and install the driver from [here](https://support.brother.com/g/b/downloadhowto.aspx?c=au&lang=en&prod=lpql580eas&os=10011&dlid=dlfp100103_000&flang=181&type3=347)
* Go into printer preferences and set the label size to Normal Format, 62mm (width), 100mm (length), 3mm (Feed)

### QL-820NWB - Config type = ```brotherQL820NWB```
* Download and install the driver from [here](https://support.brother.com/g/b/downloadtop.aspx?c=us_ot&lang=en&prod=lpql820nwbeus)
* Go into printer preferences and set the label size to paper size = 62mm, 62mm (width), 100mm (length), 3mm (Feed)

# Application Configuration
The application configuration file can be found in ```<USER DIRECTORY>/kardinia-kiosk/config.conf```. The file contains the following information:
* ```printerType``` The printer type to use, see supported printer types above. (Can be set in the application)
* ```customPrinter``` If desired one can set a custom printer to be used here
* ```apiUrl``` The Fluro api url
* ```applicationToken``` The application token for access to Fluro. See Fluro -> Applications for more
* ```applicationDomainName``` Same as above
* ```fluroPrinterID``` The Fluro printer id this checkin should use. (Auto generated using the kiosk id but can be overridden using this parameter)
* ```kioskConfigurationId``` The ID of the code to read for configuration settings in Fluro. See Fluro configuration below
* ```kioskId``` The name of this kiosk (Will be used to generate a printer in Fluro named Kiosk - Name)
* ```kioskCampus``` The campus of this kiosk read from the kiosk configuration file read from Fluro
* ```fluroFirebaseID``` The fluro firebase id used for printer events. If you don't know this ID you can find it in the fluro print station application (or ask, it's not set to keep it private for Fluro's sake)


# Fluro Configuration
The kiosk will request a configuration file from Fluro, this file defines the modes available to the kiosk. This can be found in Fluro -> Developers

Example
```
{
    "modes": {
        "mode1": {
            "label": "Mode 1",
            "posterURL": "http://google.com",
            "mainURL": "http://google.com",
            "enablePrinter": true
        },
        "mode2": {
            "label": "Mode 2",
            "posterURL": http://google.com",
            "mainURL": "http://google.com",
            "enablePrinter": false
        }
    },

    "campusModes": {
        "Campus1": ["mode1", "mode2"]
    },

    "kioskStartupModes": {
        "KioskId": "mode2"
    },

    "printTemplate": "<id>"
}
```

* ```label``` Is the friendly label shown on the button
* ```posterURL``` Is the URL the application will direct to on the top "poster" monitor
* ```mainURL``` Is the URL the application will direct to on the bottom monitor
* ```enablePrinter``` Will enable or disable the printer (true/false)
* ```campusModes``` Is what is shown in the select mode window, allows for multi campus setups
* ```kioskStartupModes``` Forces a kiosk to a mode when it first turns on
* ```printTemplate``` The id of the code containing the HTML to generate the print output

# Label Formatting
The labels are printed out as a HTML document, this allows for high flexibility and use of Javascript.

## Example
```
<html>
<style>
    * {
        font-family: Arial, sans-serif;
        padding: 0;
        margin: 0;
    }

    p {
        font-size: 4mm;
    }

    .checkinDate {
        font-size: 3mm;
        position: fixed;
        left: 0;
    }

    .batchID {
        position: fixed;
        font-size: 6mm;
        line-height: 6mm;
        padding: 2mm;
        border-radius: 3mm;
        font-weight: 800;
        background: #000 !important;
        color: #fff !important;
        right: 1mm;
    }

    .shapes {
        position: fixed;
        font-size: 6mm;
        line-height: 6mm;
        padding: 2mm;
        border-radius: 3mm;
        font-weight: 800;
        background: #000 !important;
        color: #fff !important;
        right: 1mm;
    }

    .label {
        overflow: hidden;
        background-color: pink;
    }
</style>
<script>
    //Generate a generic label
    function generateGenericLabel(label, checkin, contact, event, family, date, printer) {
        //Format the roles
        var role = "";
        for (var i in contact.roles) {
            role += contact.roles[i] + ", ";
        }

        var div = document.createElement("div");
        div.classList.add("label");
        div.style.height = "calc(" + printer.width + " - " + printer.border + ")";
        div.style.height = "calc(" + printer.height + " - " + printer.border + ")";

        div.innerHTML += "<h2>" + contact.title + "</h2>";
        div.innerHTML += "<h1>" + contact.roles + "</h1>";
        div.innerHTML += "<br>";
        div.innerHTML += "<h3>" + event.title + "</h3>";

        var offset = ((parseInt(printer.height.split("mm")[0]) - parseInt(printer.border.split("mm")[0])) * label) + "mm";
        div.innerHTML += "<p class='checkinDate' style='top: calc(" + offset + " - 5mm)'>Checkin Date: " + date + "</p>";
        div.innerHTML += "<p class='batchID' style='top: calc(" + offset + " - 10mm)'>" + checkin.batchID + "</p>";
        return div.outerHTML;
    }

    //Generate a child label
    function generateChildLabel(label, checkin, contact, event, family, date, printer) {
        //Format the roles
        var role = "";
        for (var i in contact.roles) {
            role += contact.roles[i] + ", ";
        }

        //Find the parents
        var parents = [];
        if (family) {
            for (var i in family.items) {
                if (family.items[i].householdRole == "parent") {
                    parents.push(family.items[i].title);
                }
            }
        }

        //Generate the shapes
        var shapes = "";
        if (contact.contact.details && contact.contact.details.medicalandHealth && contact.contact.details.medicalandHealth.data) {
            var temp = contact.contact.details.medicalandHealth.data;
            if (temp.allergies == true) {
                shapes += "<p>&boxtimes;</p>"
            }
            if (temp.doyouhaveanydietaryneeds == true) {
                shapes += "<p>&phone;</p>"
            }
            if (temp.custodyArrangements == true) {
                shapes += "<p>&bigstar;</p>"
            }
            if (temp.healthConcerns == true) {
                shapes += "<p>&FilledSmallSquare;</p>"
            }
            if (temp.medication == true) {
                shapes += "<p>&sung;</p>"
            }
            if (temp.mediaRelease && temp.mediaRelease.toLowerCase() != "yes" && temp.mediaRelease != true) {
                shapes += "<p>&CirclePlus;</p>"
            }
        }


        var div = document.createElement("div");
        div.classList.add("label");
        div.style.width = "calc(" + printer.width + " - " + printer.border + ")";
        div.style.height = "calc(" + printer.height + " - " + printer.border + ")";

        div.innerHTML += "<h1>" + contact.title + "</h1>";
        div.innerHTML += "<p><strong>Age: </strong>" + contact.age + " <strong>Grade: </strong>" + (contact.academicGrade ? "Year " + contact.academicGrade.split("year")[1] : "-") + "</p>";
        if (parents.length > 0) {
            div.innerHTML += "<p><strong>Parent(s): </strong></p>";
            div.innerHTML += "<p>" + parents + "</p>";
        }
        if (checkin.checkedInBy._id != contact._id) {
            div.innerHTML += "<p><strong>Checked in by: </strong></p>";
            div.innerHTML += "<p>" + checkin.checkedInBy.title + " (" + checkin.phoneNumber + ")</p>";
        }
        if (contact.roles.length > 0) {
            div.innerHTML += "<p><strong>Roles: </strong>" + contact.roles + "</p>";
        }
        div.innerHTML += "<p><strong>Event: </strong>" + event.title + "</p>";

        var offset = ((parseInt(printer.height.split("mm")[0]) - parseInt(printer.border.split("mm")[0])) * label) + "mm";
        div.innerHTML += "<p class='checkinDate' style='top: calc(" + offset + " - 5mm)'>Checkin Date: " + date + "</p>";
        div.innerHTML += "<p class='batchID' style='top: calc(" + offset + " - 10mm)'>" + checkin.batchID + "</p>";
        if (shapes != "") {
            div.innerHTML += "<div class='shapes' style='top: calc(" + offset + " - " + printer.height + " + 10mm)'>" + shapes + "</div>";
        }
        return div.outerHTML;
    }

    //Generate a pickup label
    function generatePickupLabel(label, checkin, contacts, event, family, date, printer) {
        //Find the parents
        var parents = [];
        if (family) {
            for (var i in family.items) {
                if (family.items[i].householdRole == "parent") {
                    parents.push(family.items[i].title);
                }
            }
        }

        //Get the children in this pickup
        var children = [];
        for (var i in contacts) {
            if (contacts[i].familyRole == "child") {
                children.push(contacts[i].title);
            }
        }
        if (children.length <= 0) {
            return "";
        }


        var div = document.createElement("div");
        div.classList.add("label");
        div.style.width = "calc(" + printer.width + " - " + printer.border + ")";
        div.style.height = "calc(" + printer.height + " - " + printer.border + ")";


        div.innerHTML += "<h1>Parent Pickup</h1>";
        div.innerHTML += "<h2>" + event.title + "</h2>";

        div.innerHTML += "<p><strong>Child(s): </strong></p>";
        div.innerHTML += "<p>" + children + "</p>";

        if (parents.length > 0) {
            div.innerHTML += "<p><strong>Parent(s): </strong></p>";
            div.innerHTML += "<p>" + parents + "</p>";
        }
        div.innerHTML += "<p><strong>Checked in by: </strong></p>";
        div.innerHTML += "<p>" + checkin.checkedInBy.title + " (" + checkin.phoneNumber + ")</p>";

        var offset = ((parseInt(printer.height.split("mm")[0]) - parseInt(printer.border.split("mm")[0])) * label) + "mm";
        div.innerHTML += "<p class='checkinDate' style='top: calc(" + offset + " - 5mm)'>Checkin Date: " + date + "</p>";
        div.innerHTML += "<p class='batchID' style='top: calc(" + offset + " - 10mm)'>" + checkin.batchID + "</p>";
        return div.outerHTML;
    }


    window.onload = function() {
        var labelDiv = document.getElementById("labels");

        //This gets the data and converts it to a JSON object. It's adding it to the DOM first because of a limitation in the renderer used..
        labelDiv.innerHTML = "{{this}}";
        var data = JSON.parse(labelDiv.innerHTML);
        labelDiv.innerHTML = "";

        var label = 1;
        for (var i in data.contacts) {
            if (data.contacts[i].familyRole == "child") {
                labelDiv.innerHTML += generateChildLabel(label++, data.checkin, data.contacts[i], data.event, data.family, data.date, data.printer);
            } else {
                labelDiv.innerHTML += generateGenericLabel(label++, data.checkin, data.contacts[i], data.event, data.family, data.date, data.printer);
            }
        }
        if (data.contacts.length > 0) {
            labelDiv.innerHTML += generatePickupLabel(label, data.checkin, data.contacts, data.event, data.family, data.date, data.printer);
        }
    }
</script>
<div id="labels"></div>

</html>
```
On the kiosk side we convert the data into a stringified JSON object and then convert it back when we render. This allows for better access of the object.


# How printing works
For ease of use the application will go to Fluro to get the print templates, of which there are 3.
1. The print template itself
2. The parent pickup print template. (This is ignored)
3. The HTML code this application prints.

The print templates (1,2) are the Fluro print templates. These MUST contain the following code
Child
```
<%= get('_id') %>
```
Pickup
```
DONOTPRINT
```

The above print templates are only used for the application to get the checkin id event. The application will then get 3 from Fluro and generate the label(s) based on this.

# Development
## Dependencies
1. [NodeJS](https://nodejs.org/en/)
## First build
1. Clone the project using ```git clone https://github.com/Kardinia-Church/Kardinia-Checkin-Kiosk```
2. Install npm dependencies using ```npm install```
## Running
To run the application for development use ```npm run start```
## Building the distributable
Generate a executable in the output folder using ```npm run make```

# Deploying
In deploying a new version the kiosks will automatically download and install their updates. Follow the steps:
1. Ensure the app is ready for deployment
2. Run ```npm run build``` to build the application
4. Goto ```https://github.com/Kardinia-Church/Kardinia-Checkin-Kiosk/releases```
5. Click ```draft a new release``` and give it a tag ```v<VERSION>``` title, and description
6. Upload the setup executable, the blockmap and the latest.yaml to the release (Note the file must be less than 500mb)
7. Click publish release
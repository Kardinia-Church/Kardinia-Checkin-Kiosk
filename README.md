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
    }
}
```

* ```label``` Is the friendly label shown on the button
* ```posterURL``` Is the URL the application will direct to on the top "poster" monitor
* ```mainURL``` Is the URL the application will direct to on the bottom monitor
* ```enablePrinter``` Will enable or disable the printer (true/false)

# Supported Printer Functions
When a check-in occurs it sends the application a print event. This contains a HTML string that is sent which is processed here and printed. There is extra functionality within this application which allows for customized data points to be entered into a label.

## How to use
To use this functionality on Fluro one can edit the HTML and add empty elements with id equal to what is wanted listed below. To edit the HTML goto developers/code in Fluro and create/edit a check-in printer template where the HTML can be edited.

### Example
```
<d class="nametag">
    <% //These are required for the Kardinia checkin application to do api calls %>
    <d id="checkinId"><%= get('_id') %></d>
    <d id="contactId"><%= get('contact._id') %></d>

    <d><%= get('age') %></d>
    <d id="grade"></d>
</d>
```

## Extra functionality
### grade
Populate the school grade of the contact
```<d id="grade"></d>```
### email
Populate the first most email of the contact
```<d id="email"></d>```
### localPhone
Populate the first most local phone number of the contact
```<d id="localPhone"></d>```
### familyPhone
Populate the first most phone number for the family
```<d id="familyPhone"></d>```
### familyEmail
Populate the first most email for the family
```<d id="familyEmail"></d>```
### parentFullName
Populate the first most parent's full name
```<d id="parentFullName"></d>```
### parentFirstName
Populate the first most parent's first name
```<d id="parentFirstName"></d>```
### parentLastName
Populate the first most parent's last name
```<d id="parentLastName"></d>```
### parentEmail
Populate the first most parent's first most email
```<d id="parentEmail"></d>```
### parentLocalPhone
Populate the first most parent's first most local phone number
```<d id="parentLocalPhone"></d>```

### doNotPrintLabel
Will disable the printing of the label entirely
```<p id="doNotPrintLabel"></p>```
### ifFuze
Will hide the element if the event name doesn't contain "fuze"
```<div id="ifFuze"><div>```
### ifPlaygroups
Will hide the element if the event name doesn't contain "playgroups"
```<div id="ifPlaygroups"><div>```
### ifService
Will hide the element if the event name doesn't contain "service"
```<div id="ifService"><div>```
### labelTitle
Special case for if the event is a service. This will populate the label title based on what service team they are apart of
```<h1 id="labelTitle"></h1>```

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
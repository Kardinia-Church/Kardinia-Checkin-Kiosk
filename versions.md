# Version History
## v2.2.0
First stable release.
## v2.2.1
* Fixed the default rotate for brother printers being incorrect
## v2.2.2
* Removed polling for kiosk states every 60 seconds in the configuration page as this would effectively spam Fluro if the kiosk was left on for a long period of time
* Printer will be disabled for the first few seconds to avoid printing unwanted labels
## v2.2.3
* Fixed a bug where the checkin modes would not be cleared when populated
* Fixed a bug where the printer templates would not be cleared when populated
* Added console log for HTML for ticket (for debug purposes)
## v2.2.4
* Enabled printing of backgrounds
## v2.2.6
* Disabled the "exit configuration" button if there is no mode set
* Fixed a styling issue with the drop down menu for the modes
* When changing a mode, changed the pages to display a blank page as the previous implementation was confusing 
## v2.3.0
* Added extra label functionality
* Added shapes functionality to labels
## v2.3.1
* Fixed sizing of the shapes print out
* DYMO printers are no longer supported on this version (will print incorrectly). Will aim to fix this at a later date
## v2.3.2
* Fixed DYMO printers
* Fixed sizing issues with the shapes print out


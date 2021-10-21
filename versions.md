# Version History
## v2.2.0
First stable release.
## v2.2.1
* Fixed the default rotate for brother printers being incorrect
## v2.2.2
* Removed polling for kiosk states every 60 seconds in the configuration page as this would effectively spam Fluro if the kiosk was left on for a long period of time
* Printer will be disabled for the first few seconds to avoid printing unwanted labels
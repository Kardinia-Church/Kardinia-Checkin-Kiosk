/**
 * Event Handler
 */

var fs = require('fs');
var util = require('util');
module.exports = {
    directory: ".",
    callbacks: {},

    //Send to the callbacks
    sendCallback: function (event, arg, domain) {
        if (this.callbacks[event] === undefined) { return; }

        //Add to log file
        var log = fs.createWriteStream(this.directory + '/logs.txt', { flags: 'a' });
        var date = new Date();
        var dateString = date.getDay() + "/" + date.getMonth() + "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
        log.write(dateString + " => " + "[" + event() + "][" + domain + "] - " + arg + "\n");

        console.log = function (d) {
            log.write(dateString + " => " + "[console] - " + util.format(d) + "\n");
            process.stdout.write(util.format(d) + "\n");
        }

        for (var i = 0; i < this.callbacks[event].length; i++) {
            this.callbacks[event][i](arg, domain);
        }
    },

    //Add a callback
    on: function (event, callback) {
        if (this.callbacks[event] === undefined) { this.callbacks[event] = []; }
        this.callbacks[event].push(callback);
    },

    //Remove a callback
    remove: function (event, callback) {
        for (var i in this.callbacks) {
            if (i == event) {
                for (var j = 0; j < this.callbacks[event].length; j++) {
                    if (this.callbacks[event][j] == callback) {
                        this.callbacks[event].splice(j, 1);
                    }
                }
            }
        }
    },

    /////////////////////////////////
    //Specific calls

    error: function (error, domain) {
        if (error === undefined) { return "error"; }
        this.sendCallback(this.error, error, domain);
    },

    info: function (info, domain) {
        if (info === undefined) { return "info"; }
        this.sendCallback(this.info, info, domain);
    },

    warning: function (warn, domain) {
        if (warn === undefined) { return "warn"; }
        this.sendCallback(this.warning, warn, domain);
    }
}
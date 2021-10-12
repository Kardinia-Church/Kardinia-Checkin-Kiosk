function displayPrinting() {
    document.getElementById("popup").classList = ["info"];
    document.getElementById("icon").classList = ["fas fa-print"];
    document.getElementById("title").innerHTML = "Printing Your Label";
    document.getElementById("description").innerHTML = "Please wait";
}
function displayPrintSuccess() {
    document.getElementById("popup").classList = ["success"];
    document.getElementById("icon").classList = ["fas fa-check"];
    document.getElementById("title").innerHTML = "Your Label Has Been Printed!";
    document.getElementById("description").innerHTML = "Please pick up your label from the printer";
}
function displayInfo(title, description) {
    document.getElementById("popup").classList = ["info"];
    document.getElementById("icon").classList = ["fas fa-info"];
    document.getElementById("title").innerHTML = title || "Something Happened";
    document.getElementById("description").innerHTML = description || "";
}
function displayWarning(title, description) {
    document.getElementById("popup").classList = ["warning"];
    document.getElementById("icon").classList = ["fas fa-exclamation-triangle"];
    document.getElementById("title").innerHTML = title || "Something Happened";
    document.getElementById("description").innerHTML = description || "";
}
function displayError(title, description) {
    document.getElementById("popup").classList = ["error"];
    document.getElementById("icon").classList = ["fas fa-times"];
    document.getElementById("title").innerHTML = title || "Something Happened";
    document.getElementById("description").innerHTML = description || "";
}

function updatePopup(arg) {
    var args = JSON.parse(arg);
    switch (args.type) {
        case "printing": { displayPrinting(); break; }
        case "printSuccess": { displayPrintSuccess(); break; }
        case "info": { displayInfo(args.title, args.description); break; }
        case "warning": { displayWarning(args.title, args.description); break; }
        case "error": { displayError(args.title, args.description); break; }
        default: { displayError("Internal Error", "A popup type was not defined"); }
    }
}

window.onload = function () {
    //Get our arguments
    for (var i = 0; i < window.process.argv.length; i++) {
        if (window.process.argv[i].includes("popupArgs=")) {
            updatePopup(window.process.argv[i].split("popupArgs=")[1]);
        }
    }

    //Subscribe to updated popup conditions
    subscribe("updatePopup", function (event, args) {
        updatePopup(args);
    });

    document.getElementsByTagName("body")[0].style.display = "block";
}
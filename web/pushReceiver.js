const { ipcRenderer } = require ('electron');
const {
  START_NOTIFICATION_SERVICE,
  NOTIFICATION_SERVICE_STARTED,
  NOTIFICATION_SERVICE_ERROR,
  NOTIFICATION_RECEIVED,
  TOKEN_UPDATED,
} = require ('electron-push-receiver/src/constants');

// Listen for service successfully started
ipcRenderer.on(NOTIFICATION_SERVICE_STARTED, (_, token) => {
  ipcRenderer.invoke("setTokenToPrinter", token);
});

// Handle notification errors
ipcRenderer.on(NOTIFICATION_SERVICE_ERROR, (_, error) => {
  console.log('notification error', error);
})

// Send FCM token to backend
ipcRenderer.on(TOKEN_UPDATED, (_, token) => {
  console.log('token updated', token);
  ipcRenderer.invoke("setTokenToPrinter", token);
});

// Display notification
ipcRenderer.on(NOTIFICATION_RECEIVED, (_, serverNotificationPayload) => {
  console.log("HELLO");
  console.log(serverNotificationPayload);


    ipcRenderer.invoke("gotPrintFromFirebase", serverNotificationPayload);
});

//Start service. 
ipcRenderer.on("startFirebaseService", (_, senderId) => {
  ipcRenderer.send(START_NOTIFICATION_SERVICE, senderId)
});
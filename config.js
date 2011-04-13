// This file stores needed configuration for the game.

module.exports = {
    // Absolute url of the game. Needed for facebook auth. 
    siteUrl: "http://colorgame.ashtuchkin.cloud9ide.com",
    listenPort: 80,

    // To use facebook auth, place your own Facebook App auth parameters here.
    appId: "<your app id>",
    appSecret: "<your app secret>",
    appScope: "",

    cookieSecret: "Secret!!!",

    gameSettings: {
        width: 30,
        height: 30,
        colors: 6
    },
    
    checkInterval: 1000, // Interval between state checks. Must be less than any other timeout.
    waitingForOtherPlayersTimeout: 5000,
    readyTimeout: 3000,
    endGameOnIdleTimeout: 60000, // End game if there were no moves for this time.
    finishTimeout: 5000 // Show finishing dialog for this time.
};
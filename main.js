var express = require('express');
var app = express.createServer();
var io = require('socket.io');
var auth = require('connect-auth');

app.use(express.cookieParser());
app.use(express.logger());
app.use(express.session({secret:"aksjdfh"}));
app.use(auth([ auth.Facebook({appId : "190439364333692", appSecret: "cbd3a5731d2a895592227df2f8232cdf", scope: "email", callback: "http://localhost:4000/auth/facebook"})]));

app.set('view options', { layout: false });

app.get('/', function(req, res) {
    if( !req.isAuthenticated() ) {
        res.render('index.ejs');
    } else {
        res.send( JSON.stringify( req.getAuthDetails()) );
    }
});

// Method to handle a sign-in with a specified method type, and a url to go back to ...
app.get('/auth/facebook', function(req,res) {
  req.authenticate(['facebook'], function(error, authenticated) { 
     if(authenticated ) {
        res.end("<html><h1>Hello Facebook user:" + JSON.stringify( req.getAuthDetails() ) + ".</h1></html>");
      }
      else {
        res.end("<html><h1>Facebook authentication failed :( </h1></html>");
      }
   });
});




// =========================  socket.io, I choose you
var socket = io.listen(app);

socket.on('connection', function(client){
    client.send("Hello!");
    
    client.on('message', function(){
        client.send('Hello again!');
    });
    client.on('disconnect', function(){
    });
});


// Listen for the requests.
app.listen(process.env.C9_PORT);


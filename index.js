var express = require('express'),
    app = express.createServer(),
    util = require('util'),
    io = require('socket.io'),
    sessions = require('cookie-sessions'),
    fb = require('facebook-js'),
    appId = "190439364333692", 
    appSecret = "cbd3a5731d2a895592227df2f8232cdf",
    appScope = "email,offline_access,publish_stream",
    appCallback = "http://colorgame.ashtuchkin.cloud9ide.com/auth",
    facebookClient = require('facebook-js')(appId, appSecret),
    Board = require('./public/board.js');

app.use(express.logger());
app.use(express.static("./public"));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(sessions({secret: 'Secret!!'}));
var socket = io.listen(app);

// We use templating engine "ejs" with templates extension ".html"
app.register('.html', require ('ejs'));
app.set('view engine', 'html'); // default extension to look for
app.set('view options', { layout: false });


app.get('/', function(req, res) {
    var locals = { userid: false };
    
    if( !req.session || !req.session.token ) {
        locals.auth_url = facebookClient.getAuthorizeUrl({ client_id: appId, redirect_uri: appCallback, scope: appScope });
        
    } else {
        locals.userid = req.session.userid;
        locals.username = req.session.username;
    }
    
    res.render('index', {locals: locals});
});

app.get('/auth', function(req, res) {
    facebookClient.getAccessToken({
        redirect_uri: appCallback, 
        code: req.param('code')}, 
            function (error, token) {
                facebookClient.apiCall("GET", "/me", {access_token: token.access_token}, function(err, data) {
                    req.session = {
                        token: token.access_token,
                        username: data.name,
                        userid: data.id
                    };
                    res.redirect("/");
                });
            });
});

app.get('/logout', function(req, res) {
    delete req.session;
    res.redirect("/");
});


var settings = {
    width: 30,
    height: 30,
    colors: 6
};

var curState = "Idle";
var board = null;
var clients = {};
var anonymousCount = 0;
var lastStateChange = new Date();

socket.on('connection', function(client){
    var session = sessions.readSession('_node', 'Secret!!', 1000*60*60*24, client.request);
    if (session) {
        client.userid = session.userid;
        if (!(client.userid in clients)) {
            clients[client.userid] = {
                userid: session.userid, 
                username: session.username, 
                wannaplay: false,
                playing: false,
                sessions:1,
                last_played: new Date()
            };
            socket.broadcast({type:"client", client:clients[client.userid]})
        } else {
            clients[client.userid].sessions++;
        }
    } else {
        anonymousCount++;
        socket.broadcast({type:"anon", count: anonymousCount});
    }
    
    client.send({type:'state', state:curState, board:board, clients:clients});
    client.send({type:'anon', count: anonymousCount});
    
    client.on('message', function(msg){
        if (msg.type === 'wannaplay') {
            clients[client.userid].wannaplay = msg.wannaplay;
            socket.broadcast({type:"client", client:clients[client.userid]});
        } else if (msg.type === 'move') {
            if (curState !== 'Playing' || !clients[client.userid].playing)
                return;
            var res = board.move(client.userid, msg.x, msg.y);
            if (res.success) {
                socket.broadcast({type:'move', userid:client.userid, x: msg.x, y: msg.y});
            }
        }
    });
    client.on('disconnect', function(){
        if (client.userid) {
            if (client.userid in clients) {
                var c = clients[client.userid];
                c.sessions--;
                if (c.sessions === 0) {
                    socket.broadcast({type:'client', client: clients[client.userid]});
                    delete clients[client.userid];
                }
            }
        } else {
            anonymousCount--;
            socket.broadcast({type:"anon", count: anonymousCount});
        }
    });
});

// State machine.
setInterval(function() {
    if (curState == "Idle") {
        var players = [];
        for (var id in clients)
            if (clients[id].wannaplay)
                players.push(id);
        if (players.length > 0) {
            // Start the game. Choose at most 4 players that played long ago.
            players.sort(function(id_a, id_b) {
                if (clients[id_a].last_played < clients[id_b].last_played) return -1;
                else if (clients[id_a].last_played == clients[id_b].last_played) return 0;
                else return 1;
            });
            
            if (players.length > 4)
                players.splice(4, players.length);
            
            // Create the board.
            settings.player_ids = players;
            board = new Board(settings);
            for (var i = 0; i < players.length; i++) {
                clients[players[i]].playing = true;
                clients[players[i]].last_played = new Date();
            }
            
            curState = "Ready";
            lastStateChange = new Date();
            socket.broadcast({type:'state', state:curState, board:board, clients:clients});
        }
    } else if (curState == "Ready") {
        if ((new Date() - lastStateChange) > 3500) {
            curState = "Playing";
            socket.broadcast({type:'state', state:curState});
        }
    } else if (curState == "Playing") {
        
    }

}, 2000);


// Listen for the requests.
if (process.env.C9_PORT)
    app.listen(process.env.C9_PORT);
else
    app.listen(80);


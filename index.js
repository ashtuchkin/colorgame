var express = require('express'),
    app = express.createServer(),
    util = require('util'),
    io = require('socket.io'),
    sessions = require('cookie-sessions'),
    fb = require('facebook-js'),
    appId = "190439364333692", 
    appSecret = "cbd3a5731d2a895592227df2f8232cdf",
//    appScope = "email,offline_access,publish_stream",
    appScope = "",
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
    var locals = { userid: false, username: '', auth_url:'' };
    
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
    var session = null, 
        userid = null,
        cur_client = null;
    if (client.request)
        session = sessions.readSession('_node', 'Secret!!', 1000*60*60*24, client.request);
    if (session) {
        userid = session.userid;
        if (!(userid in clients)) {
            clients[userid] = cur_client = {
                userid: session.userid, 
                username: session.username, 
                wannaplay: false,
                playing: false,
                sessions: 1,
                last_played: +new Date()
            };
            if (board) {
                for (var i = 0; i < board.player_ids.length; i++)
                    if (board.player_ids[i] === userid) {
                        cur_client.wannaplay = cur_client.playing = true;
                    }
            }

            socket.broadcast({type:"client", client:cur_client}, client.sessionId);
        } else {
            cur_client = clients[userid];
            cur_client.sessions++;
        }
    } else {
        anonymousCount++;
        socket.broadcast({type:"anon", count: anonymousCount}, client.sessionId);
    }
    
    client.send({type:'state', state:curState, board:board, clients:clients, anon: anonymousCount});
    
    client.on('message', function(msg){
        if (msg.type === 'wannaplay') {
            cur_client.wannaplay = msg.wannaplay;
            socket.broadcast({type:"client", client:cur_client});
        } else if (msg.type === 'move') {
            if (curState !== 'Playing' || !cur_client || !cur_client.playing)
                return;
            var res = board.move(userid, msg.x, msg.y);
            if (res.success) {
                socket.broadcast({type:'move', userid:userid, x: msg.x, y: msg.y});
                lastStateChange = new Date();
            }
        }
    });
    client.on('disconnect', function(){
        if (userid) {
            if (userid in clients) {
                cur_client.sessions--;
                if (cur_client.sessions === 0) {
                    socket.broadcast({type:'client', client: cur_client});
                    delete clients[userid];
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
            lastStateChange = new Date();
            curState = "Waiting 5 sec for more players";
            socket.broadcast({type:'state', state:curState});
        }
    } else if (curState == "Waiting 5 sec for more players") {
        var players = [];
        for (var id in clients)
            if (clients[id].wannaplay)
                players.push(id);
        
        if (players.length === 0) {
            curState = "Idle";
            socket.broadcast({type:'state', state:curState});
            return;
        }
        
        if (players.length === 4 || (new Date()-lastStateChange) > 5000) {
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
            var date = new Date();
            for (var i = 0; i < players.length; i++) {
                clients[players[i]].playing = true;
                clients[players[i]].last_played = +new Date() + i;
            }
            
            curState = "Ready";
            lastStateChange = new Date();
            socket.broadcast({type:'state', state:curState, board:board, clients:clients});
        }
    } else if (curState == "Ready") {
        if ((new Date() - lastStateChange) > 3000) {
            curState = "Playing";
            lastStateChange = new Date();
            socket.broadcast({type:'state', state:curState});
        }
    } else if (curState == "Playing") {
        var players_ok = false;
        for (var id in clients)
            if (clients[id].playing && clients[id].wannaplay)
                players_ok = true;  // If at least one player wants to play.
        var sum = 0;
        for (var id in board.players)
            sum += board.players[id].count;
        
        if ((new Date() - lastStateChange) > 20000 || !players_ok || sum == board.height*board.width) {
            curState = "Finished";
            lastStateChange = new Date();
            socket.broadcast({type:'state', state:curState });
        }
    } else if (curState == "Finished") {
        if ((new Date() - lastStateChange) > 5000) {
            curState = "Idle";
            board = null;
            for (var id in clients)
                if (clients[id].playing) {
                    clients[id].playing = clients[id].wannaplay = false;    
                }
            lastStateChange = new Date();
            socket.broadcast({type:'state', state:curState, board: board, clients: clients });
        }
    }

}, 1000);


// Listen for the requests.
if (process.env.C9_PORT)
    app.listen(process.env.C9_PORT);
else
    app.listen(80);


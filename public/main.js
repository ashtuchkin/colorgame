var socket = new io.Socket();
var board = null;
var state = "Connecting..";
var clients = {};
var anonymousCount = 0;

socket.connect();
socket.on('connect', function(){
    state = "Connected";
    UpdateLeftColumn();    
});
socket.on('message', function(msg){
    if (msg.type === "state") {
        if ('state' in msg)     state = msg.state;
        if ('clients' in msg)   clients = msg.clients;
        if ('anon' in msg)      anonymousCount = msg.anon;
        if ('board' in msg)     InitBoard(msg.board);
        UpdateLeftColumn();
        if (state == "Ready") {
            setTimeout(function() { $(window).humanMsg({message:"Ready!", autoHide:500 });}, 1000);
            setTimeout(function() { $(window).humanMsg({message:"Steady!", autoHide:500 });}, 2000);
            setTimeout(function() { $(window).humanMsg({message:"Go!", autoHide:500 });}, 3000);
        }
        if (state == "Finished" && board) {
            var res = "";
            for (var i = 0; i < board.player_ids.length; i++) {
                var id = board.player_ids[i];
                var username = (id in clients) ? clients[id].username : "Unknown";
                var count = board.players[id].count;
                res += username + ": " + count + "<br>";
            }
            $(window).humanMsg({message:res, autoHide:5000 });
        }
    } else if (msg.type === "client") {
        if (msg.client.sessions === 0)
            delete clients[msg.client.userid];
        else
            clients[msg.client.userid] = msg.client;
        UpdateLeftColumn();
    } else if (msg.type === "anon") {
        anonymousCount = msg.count;
        UpdateLeftColumn();
    } else if (msg.type === "move") {
        if (board) {
            $("#x"+msg.x+"y"+msg.y).fadeToggle(100).fadeToggle(100);
            var res = board.move(msg.userid, msg.x, msg.y);
            if (res.success) {
                PaintBoard(res.changed);
            }
        }
    }
});
socket.on('disconnect', function(){
    state = "Disconnected. Trying to reconnect..";
    UpdateLeftColumn();
});

function PaintBoard(changed) {
    for (var y = 0; y < board.height; y++)
        for (var x = 0; x < board.width; x++)
            if (!changed || changed[y][x])
                $("#pos-"+x+"-"+y).attr("class", "color"+board.board[y][x]);
}

function InitBoard(options) {
    $("#board").empty();
    board = null;

    if (options) {
        board = new Board(options);
    
        var s = "<table>";
        for (var y = 0; y < board.height; y++) {
            s += "<tr>";
            for (var x = 0; x < board.width; x++)
                s += "<td id='pos-"+x+"-"+y+"'>&nbsp;</td>";
            s += "</tr>";
        }
        s += "</table>";
    
        $("#board").append(s).click(function(ev) {
            if (userid && clients[userid] && clients[userid].playing && state == "Playing") {
                var $target = $(ev.target);
                var id = $target.attr('id') || "";
                var pos = id.split('-');
                if ($target.is("td") && pos[0] === "pos" && pos.length === 3) {
                    socket.send({type:"move", x:+pos[1], y:+pos[2]});
                }
            }
        });
    
        PaintBoard();
    }
}

function ClientTemplate(client, classes) {
    return '<div id="u'+client.userid+'" class="client '+classes+'">'+
                '<div class="client_img"><img src="https://graph.facebook.com/'+client.userid+'/picture"/ width=50 height=50 ></div>'+
                '<div class="client_name"><a href="http://facebook.com/profile.php?id='+client.userid+'">'+client.username+'</a></div>'+
             '</div>';
}

function ClientHeaderTemplate(name, classes) {
    return '<div class="client_header '+(classes === undefined ? '' : classes)+'">'+name+'</div>';    
}

function Clients() {
    // 1. Sort all clients by their last_played date.
    var all_ids = [];
    for (var id in clients)
        all_ids.push(id);
        
    all_ids.sort(function(id_a, id_b) {
        if (clients[id_a].last_played < clients[id_b].last_played) return -1;
        else if (clients[id_a].last_played == clients[id_b].last_played) return 0;
        else return 1;
    });
    
    // 2. Split everyone into playing, wannplay and watching.
    var playing_ids = [], wannaplay_ids = [], viewing_ids = [];
    for (var i = 0; i < all_ids.length; i++) {
        var id = all_ids[i];
        if (clients[id].playing) playing_ids.push(id);
        else if (clients[id].wannaplay) wannaplay_ids.push(id);
        else viewing_ids.push(id);
    }

    // 3. Create blocks
    var s = "";
    if (playing_ids.length > 0) {
        s += ClientHeaderTemplate("Players");
        for (var i = 0; i < playing_ids.length; i++)
            s += ClientTemplate(clients[playing_ids[i]], clients[playing_ids[i]].wannaplay ? "" : "finished");
    }
    if (wannaplay_ids.length > 0) {
        s += ClientHeaderTemplate("Want to play");
        for (var i = 0; i < wannaplay_ids.length; i++)
            s += ClientTemplate(clients[wannaplay_ids[i]], "");
    }
    if (viewing_ids.length > 0) {
        s += ClientHeaderTemplate("Viewers");
        for (var i = 0; i < viewing_ids.length; i++)
            s += ClientTemplate(clients[viewing_ids[i]], "");
    }
    if (anonymousCount > 0) {
        s += ClientHeaderTemplate("Anonymous ("+anonymousCount+")");
    }
    
    return s;
}

function AuthBox() {
    if (userid === false) {
        return  '<div class="auth">'+
                    '<div class="fb_button" id="fb-login" style="float:left; background-position: left -188px">' +
                        '<a href="'+auth_url+'" class="fb_button_medium">'+
                            '<span id="fb_login_text" class="fb_button_text">Sign in with Facebook</span>'+
                        '</a></div></div>';
    } else {
        return ClientTemplate(window, '')+
            '<div class="logout"><a href="/logout">Logout</a></div>';
    }
}

function UpdateLeftColumn() {
    var s = '<div id="header">Color game</div>';
    s += ClientHeaderTemplate("Me", "first_header");
    s += AuthBox();
    s += ClientHeaderTemplate("Game State");
    s += '<div id="gamestate">' + state + '</div>';
    var wannaplay = userid && clients[userid] && clients[userid].wannaplay;
    s += "<div id='wannaplay'><button id='wannaplay_button'>"+(wannaplay ? "Finish" : "I want to play")+"</button></div>";
    s += Clients();
    $("#leftcolumn").empty().append(s);

    $("#wannaplay_button").click(function() {
        if (!userid || !(userid in clients)) { 
            alert("Please sign in with Facebook");
            return;
        }
        socket.send({type:"wannaplay", wannaplay:!clients[userid].wannaplay});
    });
}

$(function(){
    UpdateLeftColumn();
});
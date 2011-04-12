var socket = new io.Socket();
var board = null;
var state = "Idle";
var clients = {};
var anonymousCount = 0;

socket.connect();
//socket.on('connect', function(){})
socket.on('message', function(msg){
    if (msg.type === "state") {
        if ('state' in msg) {
            state = msg.state;
            UpdateGameState();
        }
        if ('clients' in msg) {
            clients = msg.clients;
            UpdateClients();
        }
        if ('board' in msg && msg.board)
            InitBoard(msg.board);
    } else if (msg.type === "client") {
        if (msg.client.sessions == 0)
            delete clients[msg.client.userid];
        else
            clients[msg.client.userid] = msg.client;
        UpdateClients();
    } else if (msg.type === "anon") {
        anonymousCount = msg.count;
        UpdateGameState();
    } else if (msg.type === "move") {
        if (board) {
            $("#x"+msg.x+"y"+msg.y).fadeToggle(100).fadeToggle(100);
            var res = board.move(msg.userid, msg.x, msg.y);
            if (res.success) {
                PaintBoard(res.changed);
            }
        }
    } else
        alert(msg);
})
//socket.on('disconnect', function(){})

function PaintBoard(changed) {
    for (var y = 0; y < board.height; y++)
        for (var x = 0; x < board.width; x++)
            if (!changed || changed[y][x])
                $("#x"+x+"y"+y).attr("class", "color"+board.board[y][x]);
}

function InitBoard(options) {
    board = new Board(options);

    var s = "<table>";
    for (var y = 0; y < board.height; y++) {
        s += "<tr>";
        for (var x = 0; x < board.width; x++)
            s += "<td id='x"+x+"y"+y+"'></td>";
        s += "</tr>";
    }
    s += "</table>";

    $("#board").empty().append(s);
    
    PaintBoard();
    
    if (userid && clients[userid].playing) // Not anonymous user and is playing.
        for (var y = 0; y < board.height; y++)
            for (var x = 0; x < board.width; x++)
                (function(x, y){
                    $("#x"+x+"y"+y).click(function(e){
                        if (state == "Playing")
                            socket.send({type:"move", x: x, y: y});
                    });
                })(x, y);
}

function UpdateClients() {
    var s = "<ul>";
    for (var id in clients) {
        var c = clients[id];
        s += '<li id="u'+id+'"><img src="https://graph.facebook.com/'+c.userid+'/picture"/>'+c.username+'</li>';
    }

    $("#clients").empty().append(s);

    for (var id in clients) {
        var c = clients[id];
        if (c.wannaplay)
            $("#u"+id).addClass('wannaplay');
        if (c.playing)
            $("#u"+id).addClass('playing');
    }
}

function UpdateGameState() {
    $("#gamestate").empty().append("State: " + state + "<br/>Anonymous: "+anonymousCount);
    if (userid && (userid in clients)) {
        if (clients[userid].playing)
            $("#gamestate").append("<br/>I'm playing!");
        $("#gamestate").append("<button id='wannaplay'>I want to play</button>");
        $("#wannaplay").click(function() {
            socket.send({type:"wannaplay", wannaplay:true});
        })
    }
}

/*
// Onload.
$(function(){
    Init({width:30, height:30, colors:6, players: [0]});

});
*/

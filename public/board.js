var playerpos = [
    {x:0, y:0},
    {x:1, y:1},
    {x:1, y:0},
    {x:0, y:1}
];

// options: {width:60, height:60, colors:6, players:[<ids>], board: [[]] }, 
var Board = function(options) {
    this.width = options.width;
    this.height = options.height;
    this.colors = options.colors;
    
    if (options.board)
        this.board = this.copy_board(options.board);
    else {
        this.board = []; // Board will be board[y][x]
        for (var i = 0; i < options.height; i++)
        {
            this.board.push([]);
            for (var j = 0; j < options.width; j++)
                this.board[i].push(Math.floor(Math.random()*options.colors));
        }
    }
    this.player_ids = options.player_ids;
    if ('players' in options)
        this.players = options.players;
    else {
        this.players = {};
        for (var i = 0; i < this.player_ids.length; i++)
        this.players[this.player_ids[i]] = {
            i: i,
            x: (this.width-1)*playerpos[i].x,
            y: (this.height-1)*playerpos[i].y,
            count: 1
        };
    }
};

Board.prototype.copy_board = function(board) {
    var res = new Array(board.length);
    for (var i = 0; i < board.length; i++) {
        res[i] = new Array(board[i].length);
        for (var j = 0; j < board[i].length; j++)
            res[i][j] = board[i][j];
    }
    return res;
};

Board.prototype.empty_board = function(width, height) {
    var res = new Array(height);
    for (var i = 0; i < height; i++) {
        res[i] = new Array(width);
        for (var j = 0; j < width; j++)
            res[i][j] = false;
    }
    return res;
};

var directions = [
    {x:0, y:1},
    {x:0, y:-1},
    {x:1, y:0},
    {x:-1, y:0}
];

// Make a breadth-first fill.
Board.prototype.change_color = function(start_x, start_y, to_color, board, board_flag) {
    var from_color = board[start_y][start_x];
    var count_repaint = 1;
    var queue = [{x:start_x, y:start_y}];
    board_flag[start_y][start_x] = true;
    board[start_y][start_x] = to_color;
    while (queue.length > 0) {
        var cur_pos = queue.shift();
        for (var i = 0; i < directions.length; i++) {
            var x = cur_pos.x+directions[i].x, 
                y = cur_pos.y+directions[i].y;
            
            if (!(0 <= y && y < board.length) ||
                !(0 <= x && x < board[y].length) ||
                board_flag[y][x] ||
                board[y][x] !== from_color)
                continue;
            
            queue.push({x:x, y:y});
            board_flag[y][x] = true;
            board[y][x] = to_color;
            count_repaint++;
        }
    }
    return count_repaint;
};

Board.prototype.move = function(player_id, x, y) {
    if (!(player_id in this.players))
        return {success:false, type:"WRONG_PLAYER"};
    if (!(0 <= x && x < this.width) ||
        !(0 <= y && y < this.height))
        return {success:false, type:"WRONG_POSITION"};
    
    var player = this.players[player_id];
    var to_color = this.board[y][x];
    
    if (this.board[player.y][player.x] === to_color)
        return {success:false, type:"SAME_COLOR"};
    
    var board2 = this.copy_board(this.board);
    var board_flag = this.empty_board(this.width, this.height);
    
    // 1. Repaint our old cells to the new color.
    this.change_color(player.x, player.y, to_color, board2, board_flag);

    // 2. Flag and count all the new cells.
    var board_flag2 = this.empty_board(this.width, this.height);
    var count = this.change_color(player.x, player.y, to_color, board2, board_flag2);

    for (var i = 0; i < this.player_ids.length; i++) {
        var pl = this.players[this.player_ids[i]];
        if (board_flag2[pl.y][pl.x] !== (player_id === this.player_ids[i]))
            return {success:false, type:"FILL_OTHER_PLAYER"};
    }
    
    player.count = count;
    this.board = board2;
    return {success:true, changed: board_flag, new_count: count};
}

Board.prototype.isFinished = function() {
    var colors_found = {};
    
    for (var y = 0; y < this.height; y++)
        for (var x = 0; x < this.width; x++)
            colors_found[this.board[y][x]] = true;
    
    var ncolors = 0;
    for (var i = 0; i < this.colors; i++)
        if (colors_found[i])
            ncolors++;
    
    return ncolors == this.player_ids.length;
}

// Make this module accessible from node.js.
try {
    module.exports = Board;
} catch (e)
{}


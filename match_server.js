var dgram = require("dgram");
var http = require('http')
var url = require('url')
var uuid = require('node-uuid')
var port = 60000;

var idCounter = 0;

var players = {};


// Server stuff
exports.createServer = function () {
	var server = dgram.createSocket("udp4");
	server.on("message", function(msg, rinfo) {
		console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);

		// Find player who previous connected so we can store the open port for other players to connect to
		if(players[msg]) {
			console.log("Player: " + players[msg].name + " found.  Hosting Port: " + rinfo.port);
			players[msg].port = rinfo.port;
			players[msg].ip = rinfo.address;

		} else {
			console.log("Player not found!");
		}

		remoteClient = rinfo;
		// Response is in LISP format now to make it easy for the engine to parse
		var response = Buffer('ping'); 
		server.send(response, 0, response.length, remoteClient.port, remoteClient.address, function(err, bytes) {
			if(err) { 
				"An error occured: " + err; 
				server.close(); 
			}
		});
	});

	server.on("listening", function() {
		var address = server.address();
		console.log("server listening" + address.address + ":" + address.port);
	});

	server.bind(port+1);
}

exports.createWebServer = function() {
        // Timeout players who are not responding
        setInterval(function() {
			for(var key in players) {
				// Only list the users which we have the open port for
                                players[key].timeout = players[key].timeout - 1;
                                if(players[key].timeout == 0) {
                                    delete players[key];
                                }
			}
        }, 5000);
	http.createServer(function(req, res) {
		var info = url.parse(req.url, true);
		if(info.pathname == '/register') {
			var data = info.query;

			// Generate a unique key for the session
			var key = uuid.v4();
			players[key] = {"name" : data.user, "ip" : req.connection.remoteAddress, "mode" : "VS", "timeout" : 5};
			console.log(players[key]);

			// Using S-Expressions for response because thats what the engine uses
			res.write('(' + key + ')');
			res.end();
		} else if(info.pathname == '/get_players') {
			var data = info.query;
			var message = '(PlayerList (';

			for(var key in players) {
				// Only list the users which we have the open port for
				if(players[key] && players[key].port && key != data.key) {
					message += '('+ players[key].ip + ' ' + players[key].name + ' ' + players[key].port + ' ' + players[key].mode + ')';
				}
			}
			message += '))';
			res.write(message);
			res.end();

                        if(data.key && players[data.key]) {
                            console.log("Session refreshed for " + players[data.key].name);
                            players[data.key].timeout = 5;
                        }
		} else if(info.pathname == '/update_status') {
			var data = info.query;
			console.log("Player: " + players[data.key].name + " changed status to: " + data.status);

                        players[data.key].timeout = 5;
			// Remove player from available
                        delete players[data.key];
			res.write('(Success)');
			res.end();
		} else if(info.pathname == '/set_mode') {
			var data = info.query;
			console.log("Player:" + players[data.key].name + " changed mode to: " + data.mode);
			players[data.key].mode = data.mode;
			res.write('(Success)');
			res.end();
		} else {
                    console.log(data);
                }


	}).listen(port);
	console.log("Created Matchmaking Web Service");

}

exports.createServer();

exports.createWebServer();


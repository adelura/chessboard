var jsonServer = require('json-server'),
	bodyParser = require('body-parser'),
	express = require('express'),
	elo = new (require('arpad'))(),
	auth = require('http-auth');

var basic = auth.basic({
	realm: "Who are you?",
	file: __dirname + "/users.htpasswd"
});


var jsonRouter = jsonServer.router('./db.json');
var db = jsonRouter.db;

var router = express.Router();

router.use(auth.connect(basic));
router.use(bodyParser.json({limit: '10mb'}));
router.use(bodyParser.urlencoded({ extended: false }));

// functions
function userPlayedGame(user, game) {
	return game.players.white == user.id || game.players.black == user.id;
}

function userWonGame(user, game) {
	return game.winner == 'white' && game.players.white == user.id || game.winner == 'black' && game.players.black == user.id;
}

function userLostGame(user, game) {
	return game.winner == 'white' && game.players.black == user.id || game.winner == 'black' && game.players.white == user.id;
}

function formatDate(date) {
	return 	('00' + date.getDate()).slice(-2) + '/' +
			('00' + (date.getMonth() + 1)).slice(-2) + '/' +
			date.getFullYear() + ' ' +
	       	('00' + date.getHours()).slice(-2) + ':' +
	       	('00' + date.getMinutes()).slice(-2);
}

// routes
router.get('/', function(req, res) {
	var users = db('users')
		.chain()
		.sortBy('points')
		.reverse()
		.value();

	var games = db('games')
		.chain()
		.sortBy('id')
		.reverse()
		.value();

	games.forEach(function(game) {
		if (game.createdDate != null) {
			game.createdDate = formatDate(new Date(game.createdDate));
		}
	});

	users.forEach(function(user) {
		user.played = 0;
		user.won = 0;
		user.drawn = 0;
		user.lost = 0;

		games.forEach(function(game) {
			if (userPlayedGame(user, game)) {
				user.played += 1;

				if (userWonGame(user, game)) {
					user.won += 1;

				} else if (userLostGame(user, game)) {
					user.lost += 1;

				} else {
					user.drawn += 1;
				}
			}
		});
	});

	res.render('index.jade', {
		users: users,
		games: games
	});
});

router.get('/admin', function(req, res) {
	var users = db('users').value();

	res.render('admin.jade', {
		users: users
	});
});

router.post('/users', function (req, res, next) {
	req.body.points = 1000;
	req.body.createdDate = new Date();

	db('users').insert(req.body);

    res.redirect('/');
});

router.post('/games', function (req, res, next) {
	req.body.createdDate = new Date();
	req.body.players = {
		white: Number(req.body['player.white']),
		black: Number(req.body['player.black'])
	};

	delete req.body['player.white'];
	delete req.body['player.black'];

	var isDraw = req.body['winner'] == 'draw';

	if (isDraw) {
		var winnerColor = 'white';
		var loserColor = 'black';
	} else {
		var winnerColor = req.body['winner'];
		var loserColor = winnerColor == 'white' ? 'black' : 'white';
	}

	var winnerId = req.body.players[winnerColor];
	var loserId = req.body.players[loserColor];

	var winner = db('users').find(function (user) {
		return user.id == winnerId;
	});

	var loser = db('users').find(function (user) {
		return user.id == loserId;
	});

	if (isDraw) {
		var winnerNewPoints = elo.newRatingIfTied(winner.points, loser.points);
		var loserNewPoints = elo.newRatingIfTied(loser.points, winner.points);
	} else {
		var winnerNewPoints = elo.newRatingIfWon(winner.points, loser.points);
		var loserNewPoints = elo.newRatingIfLost(loser.points, winner.points);
	}

	req.body.change = {};

	req.body.change[winnerColor] = winnerNewPoints - winner.points;
	req.body.change[loserColor] = loserNewPoints - loser.points;

	winner.points = winnerNewPoints;
	loser.points = loserNewPoints;

	db('games').insert(req.body);

	res.redirect('/');
});

var app = express();

app.set('view engine', 'jade');

app.use(jsonServer.defaults());
app.use(router);
app.use(jsonRouter);

app.listen(5000);
console.log('Server listening on port', 5000);

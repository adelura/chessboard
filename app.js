'use strict';

var jsonServer = require('json-server'),
	bodyParser = require('body-parser'),
	express = require('express'),
	elo = new (require('arpad'))(),
	auth = require('http-auth'),
	dateformat = require('dateformat');

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

function findUserById(userId) {
	return db('users').find(function (user) {
		return user.id == userId;
	});
}

function userPlayedGame(user, game) {
	return game.players.white == user.id || game.players.black == user.id;
}

function userWonGame(user, game) {
	return game.winner == 'white' && game.players.white == user.id || game.winner == 'black' && game.players.black == user.id;
}

function userLostGame(user, game) {
	return game.winner == 'white' && game.players.black == user.id || game.winner == 'black' && game.players.white == user.id;
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
		.sortBy('createdDate')
		.reverse()
		.value();


	users.forEach(function(user) {
		user.played = user.won = user.drawn = user.lost = 0;

		games.forEach(function(game) {
			if (!userPlayedGame(user, game)) {
				return;
			}

			user.played += 1;

			if (userWonGame(user, game)) {
				user.won += 1;

			} else if (userLostGame(user, game)) {
				user.lost += 1;

			} else {
				user.drawn += 1;
			}
		});
	});

	if (req.query.userId != null) {
		var currentUser = findUserById(req.query.userId);

		games = games.filter(game => {
			return userPlayedGame(currentUser, game);
		});
	}


	res.render('index.jade', {
		users: users,
		games: games,
		filteredUser: currentUser
	});
});

router.get('/admin', function(req, res) {
	res.render('admin.jade', {
		users: db('users').value()
	});
});

router.post('/users', function (req, res) {
	req.body.points = 1000;
	req.body.createdDate = Date.now();

	db('users').insert(req.body);

	res.redirect('/');
});

router.post('/games', function (req, res) {
	req.body.createdDate = Date.now();
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

	var winner = findUserById(winnerId);
	var loser = findUserById(loserId);

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

app.locals.dateformat = dateformat;

app.listen(5000);
console.log('Server listening on port', 5000);

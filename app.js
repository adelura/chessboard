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

router.get('/', function(req, res) {
	var users = db('users')
		.chain()
		.sortBy('points')
		.reverse()
		.value();

	res.render('index.ejs', {
		users: users
	});
});

router.get('/admin', function(req, res) {
	var users = db('users').value();

	res.render('admin.ejs', {
		users: users
	});
});

router.post('/users', function (req, res, next) {
	req.body.points = 1000;
	next();
});

router.post('/games', function (req, res, next) {
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

	next();
});

var app = express();

app.set('view engine', 'ejs');

app.use(jsonServer.defaults());
app.use(router);
app.use(jsonRouter);

app.listen(5000);
console.log('Server listening on port', 5000);

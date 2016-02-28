module.exports = function (grunt) {

	function getCommandString(commandName, env) {
		env = env || 'production';

		var config = {
			"name": "chessboard",
			"port": 5000,
			"appDir": "../home/ubuntu/chessboard/"
		};

		// Project configuration.
		var appName = config.name;

		var commandsNavigate = [
			'cd ' + config.appDir
		];

		var commandsUpdate = [
			'git fetch --all',
			'git checkout master',
			'git reset --hard origin/master',
			'npm i',
			'bower i --allow-root'
		];

		var commandsStop = [
			'forever stop ' + appName
		];

		var commandsStart = [
			'NODE_ENV=' + env.toUpperCase() + ' forever start --append --uid ' + appName + ' app.js'
		];

		var commands = {
			publish: commandsNavigate.concat(commandsUpdate, commandsStop, commandsStart).join('; ')
		};

		return 'sh -c ' + '\'' + commands[commandName] + '\'';
	}

	try {
		var secret = grunt.file.readJSON('secret.json')
	} catch (e) {
		console.log('Could not file "secret.json" file.', e);
	}

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		sshconfig: {
			'myhost': secret
		},

		sshexec: {
			publish: {
				command: getCommandString('publish'),
				options: {
					config: 'myhost'
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-ssh');
	grunt.registerTask('publish', [
		'sshexec:publish'
	]);
};

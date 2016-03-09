### Chess leader board

##### Installing

You need to have node.js installed

``` sh
$ git clone https://github.com/adelura/chessboard.git
$ cd chessboard
$ touch db.json # creates db.json file
$ chmod ugo+rwx db.json # and give read/write permissions
$ echo admin:pass > users.htpasswd # creates basic http authentication file
$ npm install
```

##### Running

``` sh
$ node app.js
```

Go to http://127.0.0.1:5000

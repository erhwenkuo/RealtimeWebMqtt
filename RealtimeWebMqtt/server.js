// load required packages
var express = require('express');
var bodyParser = require('body-parser');

// create our node.js Express web
var app = express();

// get server configs
var srvConfig = require('./server/config/srvConfig.js')

// load redis client library
var redis = require('redis');

// connect to redis server
var redis_client = redis.createClient(srvConfig.redis.port, srvConfig.redis.host, {});

redis_client.on('connect'     , log('connect'));
redis_client.on('ready'       , log('ready'));
redis_client.on('reconnecting', log('reconnecting'));
redis_client.on('error'       , log('error'));
redis_client.on('end'         , log('end'));

function log(type) {
    return function () {
        console.log(type, arguments);
    }
}


// serving static files resources
app.use(express.static('public'));

// use the body-parser package in web app
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// use environment param to define service port or use port "80"
var port = process.env.port || 1337;

// Start the Node.js webserver service
var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Exmaple app listening at http://%s:%s', host, port);
})
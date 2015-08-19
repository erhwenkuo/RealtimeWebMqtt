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

// load mqtt client library
var mqtt = require('mqtt');
// connect to mqtt broker
var mqtt_client = mqtt.connect(srvConfig.mqtt);

// serving static files resources
app.use(express.static('public'));

// use the body-parser package in web app
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// ======================= Web API =======================/
// Load Api routes
var rest_api_routes = require('./server/routes/rest_api_routes.js')(express, redis_client, mqtt_client);

// Register all routes under path "/api"
app.use('/api', rest_api_routes);

// use environment param to define service port or use port defined in srvConfig.js
var port = process.env.port || srvConfig.servicePort;

// Start the Node.js webserver service
var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("rtWebServer service is running on port[" + srvConfig.servicePort + "]...");
})
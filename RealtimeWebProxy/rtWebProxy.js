// load appConfig object
var appConfig = require('./config/appConfig.js');

// load 'http-proxy' library
// https://github.com/nodejitsu/node-http-proxy
var httpProxy = require('http-proxy')

// construct 'http-proxy' instance with websocket support enabled
var proxy = httpProxy.createProxy({
    ws : true
});

// proxy incoming http request forward to backend http server
var server = require('http').createServer(function (req, res) {
    proxy.web(req, res, {
        target: appConfig.options['http']
    }, function (e) {
        log_error(e, req);
    });
})

// proxy incoming websocket request forward to backend websocket server
// in this demo, we route websocket request to mosquitto (mqtt broker)
server.on('upgrade', function (req, res) {
    proxy.ws(req, res, {
        target: appConfig.options['ws']
    }, function (e) {
        log_error(e, req);
    });
})

server.listen(appConfig.servicePort);
console.log("================================================");
console.log("# rtWebProxy service is running on port[" + appConfig.servicePort + "]... #");
console.log("================================================");

function log_error(e, req) {
    if (e) {
        console.error(e.message);
        console.log(req.headers.host);
        //console.log(req.headers.host, '-->', options[req.headers.host]);
        //console.log('-----');
    }
}
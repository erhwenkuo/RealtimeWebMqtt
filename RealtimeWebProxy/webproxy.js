var httpProxy = require('http-proxy')

var proxy = httpProxy.createProxy({
    ws : true
});

var options = {
    'http': 'http://localhost:1337',
    'mqtt' : 'http://52.69.150.31:9001'
}

var server = require('http').createServer(function (req, res) {
    proxy.web(req, res, {
        target: options['http']
    }, function (e) {
        log_error(e, req);
    });
})

server.on('upgrade', function (req, res) {
    proxy.ws(req, res, {
        target: options['mqtt']
    }, function (e) {
        log_error(e, req);
    });
})

server.listen(80)

function log_error(e, req) {
    if (e) {
        console.error(e.message);
        console.log(req.headers.host, '-->', options[req.headers.host]);
        console.log('-----');
    }
}
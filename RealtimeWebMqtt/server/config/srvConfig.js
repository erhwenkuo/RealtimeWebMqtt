var srvConfig = {};

var server_env = 'aws';

if (server_env == 'aws') {   
    // Redis connection info
    srvConfig.redis = {};
    srvConfig.redis.host = 'localhost';
    srvConfig.redis.port = 6379;

    // IoT Mqtt Connection info
    srvConfig.mqttBrokerUrl = 'localhost';
    srvConfig.mqttBrokerPort = 1883;
    srvConfig.mqttConnUsername = "";
    srvConfig.mqttConnPassword = "";
    srvConfig.org = "witlab";
    srvConfig.type = "websrv";
    srvConfig.id = "witlab-001";
    srvConfig.presence = true;
}
else {
    srvConfig.elasticsearch = {};
    // Redis connection info
    srvConfig.redis = {};
    srvConfig.redis.host = '10.34.217.173';
    srvConfig.redis.port = 6379;

    // IoT Mqtt Connection info
    srvConfig.mqttBrokerUrl = '10.34.217.173';
    srvConfig.mqttBrokerPort = 1883;
    srvConfig.mqttConnUsername = "";
    srvConfig.mqttConnPassword = "";
    srvConfig.org = "witlab";
    srvConfig.type = "websrv";
    srvConfig.id = "witlab-001";
    srvConfig.presence = true;
}

module.exports = srvConfig;


function IotDevice(config){
    if (!(this instanceof IotDevice)) {
        return new IotDevice(config);
    }
    
    this.SUPPORTED_CALLBACKS = ['deviceCommand', 'connect', 'connectionLost'];
    this.DEVICE_COMMAND_PATTERN = /^iot-w\/org\/(.+)\/type\/(.+)\/id\/(.+)\/cmd\/(.+)\/fmt\/(.+)$/;

    this.host = null;
    this.options = {};
    this.callbacks = {};
    this.presence = true;

    // to check if the connection is present
    this.isConnected = false;

    // retryCount
    this.retryCount = 0;

    if (typeof config.org === 'undefined' || config.org === null) {
        throw new Error("Missing required property : org")
    }
    
    if (typeof config.type === 'undefined' || config.type === null) {
        throw new Error("Missing required property : type")
    }
    
    if (typeof config.id === 'undefined' || config.id === null) {
        throw new Error("Missing required property : id")
    }
    
    // mqtt connection clientId
    this.clientId = "d:" + config['org'] + ":" + config['type'] + ":" + config['id'];
    
    this.org = config['org'];
    this.type = config['type'];
    this.id = config['id'];
    
    this.mqttHost = "";
    this.mqttPort = 0;
    var mqttUsername = "";
    var mqttPassword = "";

    if (typeof config.mqttBrokerUrl === 'undefined' || config.mqttBrokerUrl === null)
        this.mqttHost = "localhost"
    else
        this.mqttHost = config['mqttBrokerUrl'];    
    
    if (typeof config.mqttBrokerPort === 'undefined' || config.mqttBrokerPort === null)
        this.mqttPort = 9001;
    else
        this.mqttPort = Number(config['mqttBrokerPort']);
    
    
    if (typeof config.mqttConnUsername === 'undefined' || config.mqttConnUsername === null)
        mqttUsername = ""
    else
        mqttUsername = config['mqttConnUsername'];
    
    if (typeof config.mqttConnPassword === 'undefined' || config.mqttConnPassword === null)
        mqttPassword = ""
    else
        mqttPassword = config['mqttConnPassword'];
    
    if (typeof config.presence === 'undefined' || config.presence === null)
        this.presence = true;
    else
        this.presence = config['presence'];
    
    this.options = {
        userName: mqttUsername,
        password: mqttPassword
    };

    var self = this;
    
    //generate "online" presence payload
    this.getOnlinePresence = function () {
        var payload = {};
        payload.ts = new Date().getTime();
        payload.d = {};
        payload.d.status = 'online';
        payload.d.org = self.org;
        payload.d.type = self.type;
        payload.d.id = self.id;
        
        return JSON.stringify(payload);
    };
    
    //generate "offline" presence payload
    this.getOfflinePresence = function () {
        var payload = {};
        payload.ts = new Date().getTime();
        payload.d = {};
        payload.d.status = 'offline';
        payload.d.org = self.org;
        payload.d.type = self.type;
        payload.d.id = self.id;
        
        return JSON.stringify(payload);
    }
    
    //generate "Device Event" topic
    this.getDeviceEventTopic = function (org, type, id, evt){
        return "iot-w/org/" + org + "/type/" + type + "/id/" + id + "/evt/" + evt + "/fmt/json";
    }
    
    //generate "Device Command" topic
    this.getDeviceCommandTopic = function (org, type, id, cmd){
        return "iot-w/org/" + org + "/type/" + type + "/id/" + id + "/cmd/" + evt + "/fmt/json";
    }
    
    //generate "Device Presence" topic
    this.getPresenceTopic = function (org, type, id){
        return "iot-w/org/" + org + "/type/" + type + "/id/" + id + "/presence";
    }
}

/*
 * Functions used to connect to the IoT Foundation service
 */
IotDevice.prototype.connect = function () {
    // create Mqtt connection options
    var connOptions = {};
    if (this.mqttUsername && this.mqttUsername.length > 0) {
        connOptions.userName = this.mqttUsername;
        connOptions.password = this.mqttPassword;
    }
    // if "presence" feature is enabled, then setup LWT to notify offline
    if (this.presence) { // set lwt to update presence if offline
        var topic = this.getPresenceTopic(this.org, this.type, this.id);
        var lwtPaylod = this.getOfflinePresence();
        
        var lwtMessage = new Paho.MQTT.Message(lwtPaylod);
        lwtMessage.destinationName = topic;
        lwtMessage.qos = 0;
        lwtMessage.retained = true;

        connOptions.willMessage = lwtMessage; //set lwt message
    }
    
    this.mqtt = new Paho.MQTT.Client(this.mqttHost, Number(this.mqttPort), this.clientId);
    
    // set callback handlers
    this.mqtt.onConnectionLost = onConnectionLost;
    
    this.mqtt.onMessageArrived = onMessageArrived;
    
    // if connect success, callback "onConnect" function
    connOptions.onSuccess = onConnect;
    
    // if connect fail, callback
    connOptions.onFailure = onFailure;

    // connect the client
    this.mqtt.connect(connOptions);

    var self = this;
    
    // called when the client connects
    function onConnect() {
        self.isConnected = true;

        // reset the counter to 0 incase of reconnection
        self.retryCount = 0;
            
        // publish "online" presence message
        if (self.presence) {
            var topic = self.getPresenceTopic(self.org, self.type, self.id);
            var lwtPayload = self.getOnlinePresence();            
            var message = new Paho.MQTT.Message(lwtPayload);
            message.destinationName = topic;
            message.qos = 0;
            message.retained = true;
            self.mqtt.send(message);
        }
        
        // subscribe to commands       
        var wildCardTopic = 'iot-w/org/' + self.org + '/type/' + self.type + '/id/' + self.id + '/cmd/+/fmt/+';
        self.mqtt.subscribe(wildCardTopic);

        // check if customise callback exist or not
        if (self.callbacks.connect) {
            //pass isConnected flag
            self.callbacks.connect(self.isConnected);
        }
    }
    
    // called when the client connect fail
    function onFailure(message) {
        console.log("onFailure:" + message);
    }
    
    // called when the client loses its connection
    function onConnectionLost(responseObject) {
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost:" + responseObject.errorMessage);
        }
        
        self.isConnected = false;
        // check callback
        if (self.callbacks.connectionLost) {
            self.callbacks.connectionLost(self.isConnected);
        }
    }
    
    // called when a message arrives
    function onMessageArrived(message) {
        console.log("onMessageArrived:" + message.payloadString);

        var topic = message.destinationName;
        var payload = message.payloadString;
        var qos = message.qos;
        var retained = message.regained;

        if (self.callbacks.deviceCommand) {
            var match = self.DEVICE_COMMAND_PATTERN.exec(topic);
            if (match) {
                var org = match[1];
                var type = match[2];
                var id = match[3];
                var cmd = match[4];
                // call the commandCallback
                self.callbacks.deviceCommand(org, type, id, cmd, payload, topic);
                return;
            }
        }
    }
};

/*
* Function to publish events to IoT Foundation.
* @param {String} eventType - Type of event e.g status, gps
* @param {String} eventFormat - format of the event e.g. json, xml
* @param {String} payload - Payload of the event
* @param {int} qos - qos for the publish. Accepted values are 0,1,2. Default is 0
* @returns {IotfDevice} this - for chaining
*/
IotDevice.prototype.publish = function (eventType, payload, qos) {
    var topic = this.getDeviceEventTopic(this.org, this.type, this.id, eventType);
    var QOS = qos || 0;
    
    if (!this.mqtt) {        
        throw new Error("Device Client is not yet Initialized. Call the constructor first IotfDevice(config)");
    }
        
    var message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    message.qos = QOS;
    message.retained = false;
    this.mqtt.send(message);

    return this;
};

/*
* Function to disconnect from MQTT broker.
*
*/
IotDevice.prototype.disconnect = function () {

    if (!this.mqtt) {
        throw new Error("Device Client is not yet Initialized. Call the constructor first IotfDevice(config)");
    }
    
    if (!this.isConnected) {
        throw new Error("IoT App is not yet Connected.");
    }

    var self = this;
    this.isConnected = false;
    
    // publish "online" presence message
    if (this.presence) {
        var topic = self.getPresenceTopic(self.org, self.type, self.id);
        var lwtPayload = self.getOfflinePresence();
        var message = new Paho.MQTT.Message(lwtPayload);
        message.destinationName = topic;
        message.qos = 0;
        message.retained = true;
        this.mqtt.send(message);
    }
    
    // close mqtt connection
    this.mqtt.disconnect();
    
    this.mqtt = null;
};

/**
* on - register <callback> for <type>
* 
* @param {String} type - one of 'command', 'connect'
* @param {Function} callback - the function to be registered
* @returns {IotfApplication} this - for chaining
*/
IotDevice.prototype.on = function (type, callback) {
    var found = false;
    for (var i = 0; i < this.SUPPORTED_CALLBACKS.length; i++) {
        if (this.SUPPORTED_CALLBACKS[i] === type) {
            this.callbacks[type] = callback;
            found = true;
            break;
        }
    }
    
    if (!found)
        console.log("The callback of type " + type + " is not supported");
    
    return this;
};

function IotApplication(config){
    if (!(this instanceof IotApplication)) {
        return new IotApplication(config);
    }

    this.DEVICE_EVENT_PATTERRN      = /^iot-w\/org\/(.+)\/type\/(.+)\/id\/(.+)\/evt\/(.+)\/fmt\/(.+)$/;
    this.DEVICE_COMMAND_PATTERN     = /^iot-w\/org\/(.+)\/type\/(.+)\/id\/(.+)\/cmd\/(.+)\/fmt\/(.+)$/;
    this.DEVICE_PRESENCE_PATTERN    = /^iot-w\/org\/(.+)\/type\/(.+)\/id\/(.+)\/presence/;
    
    this.SUPPORTED_CALLBACKS = ['deviceEvent', 'deviceCommand', 'devicePresence', 'deviceStatus', 'connect', 'connectionLost'];

    this.host = null;
    this.options = {};
    this.callbacks = {};
    this.presence = true;
    
    // maintain the subs list so that on reconnection subscribe them back
    this.subscriptions = {};
    this.subscriptionCount = 0;

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
    
    // iot device unique identifier
    this.deviceId = "d:" + config['org'] + ":" + config['type'] + ":" + config['id'];
    
    this.org = config['org'];
    this.type = config['type'];
    this.id = config['id'];
    
    this.mqttHost = "";
    this.mqttPort = 0;
    this.mqttUsername = "";
    this.mqttPassword = "";

    if (typeof config.mqttBrokerUrl === 'undefined' || config.mqttBrokerUrl === null)
        this.mqttHost = "localhost"
    else
        this.mqttHost = config['mqttBrokerUrl'];    
    
    if (typeof config.mqttBrokerPort === 'undefined' || config.mqttBrokerPort === null)
        this.mqttPort = 9001; //mqtt websocket port
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
        userName: this.mqttUsername,
        password: this.mqttPassword
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
        return "iot-w/org/" + org + "/type/" + type + "/id/" + id + "/cmd/" + cmd + "/fmt/json";
    }
    
    //generate "Device Presence" topic
    this.getPresenceTopic = function (org, type, id){
        return "iot-w/org/" + org + "/type/" + type + "/id/" + id + "/presence";
    }
}

/*
 * Functions used to connect to the IoT Foundation service
 */
IotApplication.prototype.connect = function () {
    if (this.mqtt && this.isConnected) {
        console.log("Alread connected to MQTT broker!");
        return;
    }

    // create Mqtt connection options
    var connOptions = {};
    if (this.mqttUsername && this.mqttUsername.length > 0) {
        connOptions.userName = this.mqttUsername;
        connOptions.password = this.mqttPassword;
    }

    if (this.presence) { // set lwt to update presence if offline
        var topic = this.getPresenceTopic(this.org, this.type, this.id);
        var lwtPaylod = this.getOfflinePresence();
        
        var lwtMessage = new Paho.MQTT.Message(lwtPaylod);
        lwtMessage.destinationName = topic;
        lwtMessage.qos = 0;
        lwtMessage.retained = true;

        connOptions.willMessage = lwtMessage; // set lwt
    }
    
    // create Paho Mqtt client instance
    this.mqtt = new Paho.MQTT.Client(this.mqttHost, Number(this.mqttPort), this.deviceId);
    
    // set callback handlers to detect connecitonLost
    this.mqtt.onConnectionLost = onConnectionLost;
    
    // set callback handlers to detect message arrived
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

        // check callback
        if (self.callbacks.connect) {
            //pass isConnected flag
            self.callbacks.connect(self.isConnected);
        }
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
    
    function onFailure(message){
        console.log("onFailure:" + message);
    }
    
    // called when a message arrives
    function onMessageArrived(message) {
        console.log("onMessageArrived:" + message.payloadString);

        var topic = message.destinationName;
        var payload = message.payloadString;
        var qos = message.qos;
        var retained = message.regained;       

        // For each type of registered callback, check the incoming topic against a Regexp.
        // If matches, forward the payload and various fields from the topic (extracted using groups in the regexp)        
        
        // iot device command message callback handler
        if (self.callbacks.deviceCommand) {
            var match = self.DEVICE_COMMAND_PATTERN.exec(topic);
            if (match) {
                var org = match[1];
                var type = match[2];
                var id = match[3];
                var cmd = match[4];
                // call the eventCallback
                self.callbacks.deviceCommand(org, type, id, cmd, payload, topic);
                return;
            }
        }
        
        // iot device event message callback handler
        if (self.callbacks.deviceEvent) {
            var match = self.DEVICE_EVENT_PATTERRN.exec(topic);
            if (match) {
                var org = match[1];
                var type = match[2];
                var id = match[3];
                var evt = match[4];
                // call the eventCallback
                self.callbacks.deviceEvent(org, type, id, evt, payload, topic);
                return;
            }
        }
        
        // iot device presence message callback handler
        if (self.callbacks.devicePresence) {
            var match = self.DEVICE_PRESENCE_PATTERN.exec(topic);
            if (match) {
                var org = match[1];
                var type = match[2];
                var id = match[3];
                // call the eventCallback
                self.callbacks.devicePresence(org, type, id, payload, topic);
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
IotApplication.prototype.publish = function (eventType, eventFormat, payload, qos) {
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
IotApplication.prototype.disconnect = function () {
    if (!this.mqtt) {
        throw new Error("IoT App is not yet Initialized. Call the constructor first IotApplication(config)");
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
IotApplication.prototype.on = function (type, callback) {
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

/**
 * subscribe - subscribe to <topic>
 * 
 * @param {String} toppic - topic to subscribe to
 */
IotApplication.prototype.subscribe = function (topic) {
    if (!this.mqtt) {        
        throw new Error("IoT App Client is not yet Initialized. Call the constructor first IotApplication(config)");
    }
    
    console.log("Subscribe: " + topic);
    this.subscriptions[this.subscriptionCount] = topic;
    this.subscriptionCount++;
        
    if (this.isConnected) {
        // subscribe to commands       
        this.mqtt.subscribe(topic);
        console.log("Freshly Subscribed to: " + this.subscriptions[this.subscriptionCount - 1]);
    } else {
        console.log("Unable to subscribe as application is not currently connected");
    }
    return;
}

/**
 * subscribeToDeviceEvents - builds and subscribes to iot-w/type/<deviceType>/<deviceId>/evt/<event>/fmt/<format>.
 *                           If no value is specified, it subscribes to all events('+')
 * @param {String} org
 * @param {String} deviceType
 * @param {String} deviceId
 * @param {String} event
 * @param {String} format
 * @returns {IotApplication} this - for chaining
 */
IotApplication.prototype.subscribeToDeviceEvents = function (org, deviceType, deviceId, event, format) {
    org = org || '+';
    deviceType = deviceType || '+';
    deviceId = deviceId || '+';
    event = event || '+';
    format = format || '+';
    var topic = this.getDeviceEventTopic(org, deviceType, deviceId, event);
    this.subscribe(topic);
    return this;
};

/**
 * subscribeToDeviceCommands - builds and subscribes to iot-w/org/<org>/type/<deviceType>/<deviceId>/cmd/<command>/fmt/<format>.
 *                           If no value is specified, it subscribes to all commands('+')
 * @param {String} org
 * @param {String} deviceType
 * @param {String} deviceId
 * @param {String} command
 * @param {String} format
 * @returns {IotApplication} this - for chaining
 */
IotApplication.prototype.subscribeToDeviceCommands = function (org, deviceType, deviceId, command, format) {
    org = org || '+';
    deviceType = deviceType || '+';
    deviceId = deviceId || '+';
    command = command || '+';
    format = format || '+';
    var topic = this.getDeviceCommandTopic(org, deviceType, deviceId, command);
    this.subscribe(topic);
    return this;
};

/**
 * subscribeToDevicePresences - builds and subscribes to iot-w/org/<org>/type/<deviceType>/<deviceId>/presence.
 *                           If no value is specified, it subscribes to all presences('+')
 * @param {String} org
 * @param {String} deviceType
 * @param {String} deviceId
 * @returns {IotApplication} this - for chaining
 */
IotApplication.prototype.subscribeToDevicePresences = function (org, deviceType, deviceId) {
    org = org || '+'
    deviceType = deviceType || '+';
    deviceId = deviceId || '+';
    var topic = this.getPresenceTopic(org, deviceType, deviceId);
    this.subscribe(topic);
    return this;
};

/*
* Function to publish device owned events to IoT Foundation.
* @param {String} event - Type of event e.g status, gps
* @param {String} payload - Payload of the event
* @param {int} qos - qos for the publish. Accepted values are 0,1,2. Default is 0
* @param {boolean} retain - retain flag for the publish. 
* @returns {IotfDevice} this - for chaining
*/
IotApplication.prototype.publishOwnedEvent = function (event, payload, qos, retain) {
    var topic = this.getDeviceEventTopic(this.org, this.type, this.id, event);
    var QOS = qos || 0;
    var RETAIN = retain || false;
    
    var data = {};
    data.ts = new Date().getTime();
    
    if (typeof payload === 'object') {
        data.d = payload;
    } else if (typeof paylod == 'string') {
        try {
            data.d = JSON.parse(payload);
        } catch (err) {
            data.d = {};
            data.d.content = payload;
        }
    } else {
        data.d = {};
        data.d.content = payload;
    }
    
    
    if (!this.mqtt) {
        console.log("IoT App is not yet Initialized. Call the constructor first IotApplication(config)");
        throw new Error("IoT App is not yet Initialized. Call the constructor first IotApplication(config)");
    }
    
    console.log("Publishing to topic : " + topic + " with payload : " + payload);    
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = topic;
    message.qos = QOS;
    message.retained = RETAIN;
    this.mqtt.send(message);

    return this;
};

/*
 * 
 * Function to publish device events to IoT Foundation.
 * @param {String} org - IoT org id
 * @param {String} deviceType - IoT device type
 * @param {String} deviceId - IoT device unique id
 * @param {String} event - Type of event e.g status, gps
 * @param {String} payload - Payload of the event
 * @param {int} qos - qos for the publish. Accepted values are 0,1,2. Default is 0
 * @param {boolean} retain - retain flag for the publish. 
 * @returns {IotfDevice} this - for chaining
 */
IotApplication.prototype.publishDeviceEvent = function (org, deviceType, deviceId, event, payload, qos, retain) {
    var topic = this.getDeviceEventTopic(org, deviceType, deviceId, event);
    var QOS = qos || 0;
    var RETAIN = retain || false;
    
    var data = {};
    data.ts = new Date().getTime();
    
    if (typeof payload === 'object') {
        data.d = payload;
    } else if (typeof paylod == 'string') {
        try {
            data.d = JSON.parse(payload);
        } catch (err) {
            data.d = {};
            data.d.content = payload;
        }
    } else {
        data.d = {};
        data.d.content = payload;
    }
    
    
    if (!this.mqtt) {
        console.log("IoT App Client is not yet Initialized. Call the constructor first IotfDevice(config)");
        throw new Error("Device Client is not yet Initialized. Call the constructor first IotfDevice(config)");
    }   
    
    console.log("Publishing to topic : " + topic + " with payload : " + payload);
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = topic;
    message.qos = QOS;
    message.retained = RETAIN;
    this.mqtt.send(message);

    return this;
};

/*
 * Function to publish device command to MQTT Broker.
 * @param {String} org - IoT org id
 * @param {String} deviceType - IoT device type
 * @param {String} deviceId - IoT device unique id
 * @param {String} command - Type of command e.g start, stop, resume ..
 * @param {String} payload - Payload of the event
 * @param {int} qos - qos for the publish. Accepted values are 0,1,2. Default is 0
 * @param {boolean} retain - retain flag for the publish. 
 * @returns {IotfDevice} this - for chaining
 */
IotApplication.prototype.publishDeviceCommand = function (org, deviceType, deviceId, command, payload, qos, retain) {
    var topic = this.getDeviceCommandTopic(org, deviceType, deviceId, event);
    var QOS = qos || 0;
    var RETAIN = retain || false;
    
    var data = {};
    data.ts = new Date().getTime();
    
    if (typeof payload === 'object') {
        data.d = payload;
    } else if (typeof paylod == 'string') {
        try {
            data.d = JSON.parse(payload);
        } catch (err) {
            data.d = {};
            data.d.content = payload;
        }
    } else {
        data.d = {};
        data.d.content = payload;
    }    
    
    if (!this.mqtt) {
        console.log("IoT App is not yet Initialized. Call the constructor first IotApplication(config)");
        throw new Error("IoT App is not yet Initialized. Call the constructor first IotApplication(config)");
    }
    
    console.log("Publishing to topic : " + topic + " with payload : " + payload);
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = topic;
    message.qos = QOS;
    message.retained = RETAIN;
    this.mqtt.send(message);

    return this;
};

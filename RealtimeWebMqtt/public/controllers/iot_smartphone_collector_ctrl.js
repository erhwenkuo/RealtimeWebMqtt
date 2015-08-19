web_app.controller('iot_smartphone_collector_ctrl', function ($scope, $http, $state, $window, Notification, app_config, deviceDetector) {
    var self = this;
    $scope.deviceOwner = ""; //smart device owner 
    $scope.deviceId = ""; //smart device owner 
    $scope.isConnected = false; //flag indicate the connection status to MQTT Broker
    
    //use "deviceDetector" library to detect smart device
    $scope.os = deviceDetector.os || 'unknown';
    $scope.browser = deviceDetector.browser || 'unknown';
    $scope.device = deviceDetector.device || 'unknown';
    $scope.isMobileDevice = false;
    
    if (deviceDetector.device !== 'unknown')
        $scope.isMobileDevice = true;
    
    //use "witlab IoT SDK" to gnerate "IotApplication" instance
    $scope.iotDevice = null;
    
    //smart device accleration and motion sensor data
    $scope.oa = 0.00; //Alpha
    $scope.ob = 0.00; //Beta
    $scope.og = 0.00; //Gama
    
    $scope.ax = 0.00; //X
    $scope.ay = 0.00; //Y
    $scope.az = 0.00; //Z
    
    this.timerOfPublish = null;
    
    //listen smart device "ondevicemotion" event emitted by browser
    if (window.DeviceMotionEvent && $scope.isMobileDevice) {
        window.addEventListener('devicemotion', function (event) {
            $scope.ax = parseFloat((event.acceleration.x || 0));
            $scope.ay = parseFloat((event.acceleration.y || 0));
            $scope.az = parseFloat((event.acceleration.z || 0));
            $scope.$apply();
        }, false);
    }
    
    //listne smart device "ondeviceorientation" event emitted by browser
    if (window.DeviceOrientationEvent && $scope.isMobileDevice) {
        window.addEventListener('deviceorientation', function (event) {
            $scope.oa = (event.alpha || 0);
            $scope.ob = (event.beta || 0);
            $scope.og = (event.gamma || 0);
            
            if (event.webkitCompassHeading) {
                $scope.oa = -event.webkitCompassHeading;
            }
            $scope.$apply();
        }, false);
    }
    
    //connect to MQTT broker
    $scope.connect = function () {
        //check if a unique identifier is submitted by user or not
        if (!$scope.deviceId || $scope.deviceId.length == 0) {
            Notification.error({ title: "Missing Device Id" , message: "Please input smart phone number!!" });
            return;
        }
        
        //setup "witlab IoT" SDK connection related info
        var iot_config = {};
        iot_config.mqttBrokerUrl = app_config.mqtt_broker_url;
        iot_config.mqttBrokerPort = app_config.mqtt_broker_port;
        iot_config.org = "iot";
        iot_config.type = "smartphone";
        iot_config.id = $scope.deviceOwner + "|" + $scope.deviceId; // use phone number as IoT DeviceId
        iot_config.presence = true;
        
        $scope.iotDevice = new IotDevice(iot_config);
        
        //regist realted callback (check witlab IoT SDK)
        $scope.iotDevice.on("connect", iotConnect);
        $scope.iotDevice.on("connectionLost", iotConnectionLost);
        
        //connect MQTT broker
        $scope.iotDevice.connect();
    }
    
    //disconnect MQTT Broker connection
    $scope.disconnect = function () {
        $scope.iotDevice.disconnect();
    }
    
    //callback to detect if iotDevice connect successfully
    function iotConnect(isConnected) {
        $scope.isConnected = isConnected;
        //Notification.info({ title: "IoT Connect Status" , message: $scope.isConnected.toString() });
        
        /*
		 * Now start the publish cycle to publish 20 times a second. This offers smooth animations 
		 * in the demo, but in most cases a publish rate of 10 msg/sec will be far in excess of any 
		 * real world needs.
		 */
	    self.timerOfPublish = setInterval(publicDeviceSensorEvent, 50);
    }
    
    //callback to detect if iotDevice disconnect abruptly
    function iotConnectionLost(isConnected) {
        $scope.isConnected = isConnected;
        
        //Stop publish sensor data
        if (self.timerOfPublish)
            clearInterval(self.timerOfPublish);
    }
    
    //function to publish mobile device sensor data to MQTT Broker(using witlab IoT SDK)
    function publicDeviceSensorEvent() {
        if ($scope.isConnected) {
            var sensorData = {
                "ax": $scope.ax.toFixed(2),
                "ay": $scope.ay.toFixed(2),
                "az": $scope.az.toFixed(2),
                "oa": $scope.oa.toFixed(2),
                "ob": $scope.ob.toFixed(2),
                "og": $scope.og.toFixed(2)
            };
            
            var payload = {};
            payload.ts = new Date().getTime();
            payload.d = sensorData;
            
            $scope.iotDevice.publish("sensor", JSON.stringify(payload));
        }
    }
});
web_app.controller('iot_smartphone_collector_ctrl', function ($scope, $http, $state, $window, Notification, app_config, deviceDetector) {
    var self = this;
    //讓User鍵入的手機號碼
    $scope.deviceOwner = "";
    $scope.deviceId = "";
    $scope.isConnected = false; //是否連上MQTT Broker
    
    //使用deviceDetector來偵測Device
    $scope.os = deviceDetector.os || 'unknown';
    $scope.browser = deviceDetector.browser || 'unknown';
    $scope.device = deviceDetector.device || 'unknown';
    $scope.isMobileDevice = false;
    
    if (deviceDetector.device !== 'unknown')
        $scope.isMobileDevice = true;
    
    //使用witlab IoT SDK來產生IotApplication的instance
    $scope.iotDevice = null;
    
    //手機上的Sensor資料
    $scope.oa = 0.00; //Alpha
    $scope.ob = 0.00; //Beta
    $scope.og = 0.00; //Gama
    
    $scope.ax = 0.00; //X
    $scope.ay = 0.00; //Y
    $scope.az = 0.00; //Z
    
    this.timerOfPublish = null;
    
    //監聽smartphone brower的ondevicemotion
    if (window.DeviceMotionEvent && $scope.isMobileDevice) {
        window.addEventListener('devicemotion', function (event) {
            $scope.ax = parseFloat((event.acceleration.x || 0));
            $scope.ay = parseFloat((event.acceleration.y || 0));
            $scope.az = parseFloat((event.acceleration.z || 0));
            $scope.$apply();
        }, false);
    }
    
    //監聽smartphone browser的ondeviceorientation   
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
    
    //連接到MQTT Broker
    $scope.connect = function () {
        //檢查是否有手機號碼
        if (!$scope.deviceId || $scope.deviceId.length == 0) {
            Notification.error({ title: "Missing Device Id" , message: "Please input smart phone number!!" });
            return;
        }
        
        //設定連結相關的資訊
        var iot_config = {};
        iot_config.mqttBrokerUrl = app_config.mqtt_broker_url;
        iot_config.mqttBrokerPort = app_config.mqtt_broker_port;
        iot_config.org = "iot";
        iot_config.type = "smartphone";
        iot_config.id = $scope.deviceOwner + "|" + $scope.deviceId; // 使用user在UI輸入的手機號碼來作為deviceId
        iot_config.presence = true;
        
        $scope.iotDevice = new IotDevice(iot_config);
        
        //註冊相關的回呼function
        $scope.iotDevice.on("connect", iotConnect);
        $scope.iotDevice.on("connectionLost", iotConnectionLost);
        
        //連結MQTT broker
        $scope.iotDevice.connect();
    }
    
    //中斷MQTT Broker的連線
    $scope.disconnect = function () {
        $scope.iotDevice.disconnect();
    }
    
    //用來偵測iotDevice是否順利連線的callback
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
    
    //用來偵測iotDevice是否有不小心斷線的callback
    
    
    function iotConnectionLost(isConnected) {
        $scope.isConnected = isConnected;
        //Notification.info({ title: "IoT Connect Status" , message: $scope.isConnected.toString() });
        
        //Stop publish sensor data
        if (self.timerOfPublish)
            clearInterval(self.timerOfPublish);
    }
    
    //用來把手機的sensor資料傳到MQTT Broker
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
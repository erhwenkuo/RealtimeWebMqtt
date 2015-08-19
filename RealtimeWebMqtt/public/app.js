'use strict';

var web_app = angular.module('web_app', ['ui.router', 'ui.bootstrap', 'ngAnimate', 'ui-notification', 'ja.qr', 'ng.deviceDetector']);


web_app.config(function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/home');
    
    $stateProvider
    .state('home', { url: '/home', templateUrl: '/partials/home.html' })   
    .state('mqtt_web_client', { url: '/mqtt_web_client', templateUrl: '/partials/mqtt_web_client.html', controller: 'mqtt_web_client_ctrl' })
    .state('mqtt_web_whoisonline', { url: '/mqtt_web_whoisonline', templateUrl: '/partials/mqtt_web_whoisonline.html', controller: 'mqtt_web_whoisonline_ctrl' })
    .state('mqtt_web_inboxnotification', { url: '/mqtt_web_inboxnotification', templateUrl: '/partials/mqtt_web_inboxnotification.html', controller: 'mqtt_web_inboxnotification_ctrl' })
    .state('iot_smartphone_viewer', { url: '/iot_smartphone_viewer', templateUrl: '/partials/iot_smartphone_viewer.html', controller: 'iot_smartphone_viewer_ctrl' })
    .state('iot_smartphone_collector', { url: '/iot_smartphone_collector', templateUrl: '/partials/iot_smartphone_collector.html', controller: 'iot_smartphone_collector_ctrl' })
    ;
});
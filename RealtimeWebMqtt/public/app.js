'use strict';

var web_app = angular.module('web_app', ['ui.router', 'ui.bootstrap', 'ngAnimate', 'ui-notification']);


web_app.config(function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/home');
    
    $stateProvider
    .state('home', { url: '/home', templateUrl: '/partials/home.html' })   
    .state('mqtt_web_client', { url: '/mqtt_web_client', templateUrl: '/partials/mqtt_web_client.html', controller: 'mqtt_web_client_ctrl' })
    ;
});
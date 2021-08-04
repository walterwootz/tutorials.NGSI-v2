const createError = require('http-errors');
const express = require('express');
const Southbound = require('./controllers/iot/southbound');
const debug = require('debug')('tutorial:iot-device');
const mqtt = require('mqtt');
const iotaClient = require('iota'); // TODO --- Add IOTA --- //
const logger = require('morgan');

/* global MQTT_CLIENT */
/* global IOTA_CLIENT */
const DEVICE_TRANSPORT = process.env.DUMMY_DEVICES_TRANSPORT || 'HTTP';

// The motion sensor offers no commands, hence it does not need an endpoint.

// parse everything as a stream of text
function rawBody(req, res, next) {
    req.setEncoding('utf8');
    req.body = '';
    req.on('data', function (chunk) {
        req.body += chunk;
    });
    req.on('end', function () {
        next();
    });
}

const iot = express();
iot.use(logger('dev'));
iot.use(rawBody);

const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mosquitto';
global.MQTT_CLIENT = mqtt.connect(mqttBrokerUrl);

// TODO --- Add IOTA --- //
const iotaBrokerUrl = process.env.IOTA_BROKER_URL || 'mqtt://mosquitto';
global.IOTA_CLIENT = mqtt.connect(iotaBrokerUrl);


// If the Ultralight Dummy Devices are configured to use the HTTP transport, then
// listen to the command endpoints using HTTP
if (DEVICE_TRANSPORT === 'HTTP') {
    debug('Listening on HTTP endpoints: /iot/bell, /iot/door, iot/lamp');

    const iotRouter = express.Router();

    // The router listening on the IoT port is responding to commands going southbound only.
    // Therefore we need a route for each actuator
    iotRouter.post('/iot/bell:id', Southbound.bellHttpCommand);
    iotRouter.post('/iot/door:id', Southbound.doorHttpCommand);
    iotRouter.post('/iot/lamp:id', Southbound.lampHttpCommand);
    // Dummy ISOBUS/ISOXML endpoint.
    iotRouter.post('/iot/isoxml', Southbound.isobusHttpCommand);

    iot.use('/', iotRouter);
}
// If the IoT Devices are configured to use the MQTT transport, then
// subscribe to the assoicated topics for each device.
if (DEVICE_TRANSPORT === 'MQTT') {
    const apiKeys = process.env.DUMMY_DEVICES_API_KEYS || process.env.DUMMY_DEVICES_API_KEY || '1234';

    MQTT_CLIENT.on('connect', () => {
        apiKeys.split(',').forEach((apiKey) => {
            const topic = '/' + apiKey + '/#';
            debug('Subscribing to MQTT Broker: ' + mqttBrokerUrl + ' ' + topic);
            MQTT_CLIENT.subscribe(topic);
            MQTT_CLIENT.subscribe(topic + '/#');
        });
    });

    mqtt.connect(mqttBrokerUrl);

    MQTT_CLIENT.on('message', function (topic, message) {
        // message is a buffer. The IoT devices will be listening and
        // responding to commands going southbound.
        Southbound.processMqttMessage(topic.toString(), message.toString());
    });
}

// catch 404 and forward to error handler
iot.use(function (req, res) {
    res.status(404).send(new createError.NotFound());
});

// If the IoT Devices are configured to use the IOTA tangle, then
// subscribe to the assoicated topics for each device.
if (DEVICE_TRANSPORT === 'IOTA') {
    const apiKeys = process.env.DUMMY_DEVICES_API_KEYS || process.env.DUMMY_DEVICES_API_KEY || '1234';

    // TODO --- Add IOTA --- //
    IOTA_CLIENT.on('connect', () => {
        apiKeys.split(',').forEach((apiKey) => {
            const topic = '/' + apiKey + '/#';
            debug('Subscribing to MQTT Broker: ' + mqttBrokerUrl + ' ' + topic);
            IOTA_CLIENT.subscribe(topic);
            IOTA_CLIENT.subscribe(topic + '/#');
        });
    });

    iota.connect(iotaBrokerUrl);

    IOTA_CLIENT.on('message', function (topic, message) {
        // message is a buffer. The IoT devices will be listening and
        // responding to commands going southbound.
        Southbound.processIotaMessage(topic.toString(), message.toString());
    });
}

module.exports = iot;

'use strict';

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var path = require('path');

require('colors');

function DriverLoader(app, configPath) {
  this.app = app;

  this.log = app.log.extend('Driver');
  this.configPath = configPath;

  this.drivers = [];

  var driverPaths = Array.prototype.slice.call(arguments);
  // Remove app and configPath params
  driverPaths.shift();
  driverPaths.shift();

  this.log.debug('Using driver paths:', driverPaths);
  this.log.debug('Using config path:', configPath);

  var self = this;

  driverPaths.forEach(function(path) {
    self.log.info('Loading drivers from path', path);

    try {
      fs.readdirSync(path).forEach(function(driver) {
        self.loadDriver(driver, path + '/' + driver);
      });
    } catch(e) {
       self.log.warn('Failed to load drivers from path', path, e);
      return;
    }

  });

}

DriverLoader.prototype.loadDriver = function(name, path) {

  if (this.drivers[name]) {
    this.log.warn('Driver', name.yellow, 'has already been loaded. Skipping.');
    return;
  }

  this.log.info('Loading driver', name.yellow, 'from path', path.yellow);

  // TODO: Handle config
  var config = this.loadConfig(name);

  var driverInfo;

  try {
     driverInfo = require(path + '/package.json');
  } catch(e) {
    this.log.warn('Failed to load', 'package.json'.yellow, 'from path', path.yellow);
    return;
  }

  if (!config) {
    config = driverInfo.config || {};
    this.saveConfig(name, config);
  }

  var Driver;

  try {
    Driver = require(path + '/index');
  } catch(e) {
    this.log.warn('Failed to load driver from', path, e);
    return;
  }

  // Replace the app log briefly... not the nicest way.. but some drivers steal it at the beginning.
  var oldLog = this.app.log;
  this.app.log = this.log.extend(name);

  var driver = new Driver(config, this.app, function(){}); // XXX: Empty 'version' function for ninja-arduino. I don't care.
  driver.log = this.app.log;

  this.app.log = oldLog;

  driver.save = function(cfg) {
    this.saveConfig(name, config);
  }.bind(this);

  driver.on('register', function(device) {
    driver.log.debug('Device registered', device);

    //new CompatibilityDevice(this, device);
  }.bind(this));

  this.drivers[name] = driver;

};

DriverLoader.prototype.loadConfig = function(driver) {
  try {
    return require(path.resolve(this.configPath, driver, 'config.json'));
  } catch(e) {
    this.log.warn('Failed to load config for driver', driver.yellow);
    return null;
  }
};

DriverLoader.prototype.saveConfig = function(driver, config) {
  this.log.debug('Saving config for driver', driver.yellow, config);
  var dir = path.resolve(this.configPath, driver);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  fs.writeFileSync(dir + '/config.json', JSON.stringify(config), 'utf-8');
};

module.exports = DriverLoader;
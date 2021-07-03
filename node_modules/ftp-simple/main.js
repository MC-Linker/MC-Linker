'use strict';
//var ftp = require('./ftp');
//var ftp2 = require('./ftp-imp');
var ftp2 = require('./ftp2');
var ftp = require('./ftp3');
var ftps = require('./ftps');

function creater(config){
  if(config.type === 'ftp2')
  {
    config.type = 'ftp';
     return new ftp2(config);
  }
  else
  {
    return new ftp(config);
  }
}
ftp.ftp2 = ftp2;
ftp.create = creater;
ftp.Parallel = ftps;
module.exports = ftp;
exports.ftp2 = ftp2;
exports.create = creater;
exports.Parallel = ftps;
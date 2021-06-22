'use strict';
var util = require('util');
var fs = require('fs');
var FTPClient  = require('basic-ftp').Client;
var loop = require('easy-loop');
var EventEmitter = require('events');
var pathUtil = require('./lib/path-util');
var fileUtil = require('./lib/file-util');

function FTP(config){
	if(!this instanceof FTP) throw "must 'new FTP(config)'";
	EventEmitter.call(this);
	if(config.username) config.user = config.username;
	if(config.pass) config.password = config.pass;
	if(!config.host) config.host = "127.0.0.1";
	if(!config.port) config.port = 21;
	//if(!Number.isInteger(config.keepalive)) config.keepalive =  1000 * 10;
	if(!Number.isInteger(config.connTimeout)) config.connTimeout =  1000 * 10;
	//config.secure = true //FTPS over TLS
	this.currentPath = "/";
	//this.isPasv = false;
	this.isLoginFail = false;
	this.waitCount = 0;
	this.isConnect = false;
	this.client = new FTPClient(config.connTimeout);
	this.init(config);
}
util.inherits(FTP, EventEmitter);

FTP.prototype.init = function(config){
	var self = this;
	var p = "/";
	if(config.path)	p = this.getRealRemotePath(config.path);
	this.client.access(config)
	.then(() => {
		self.cd(p, function(err, path){
      if(!err) body();
      else
      {
        self.cd("/", function(err, path){
          if(!err) body();
          else self.emit("error", err);
        });
      }
      function body(){
        self.isConnect = true;
        self.currentPath = p;
        self.emit("open", self.client);
        self.emit("ready", self.client);
      }
    });
	})
	.catch(e => {
		self.end();
	});
};
FTP.prototype.waitConnect = function(cb){
	var self = this;
	if(this.isLoginFail || this.waitCount >= 50)
	{
		this.close();
		return;
	}
	if(!this.isConnect)
	{
		this.waitCount++;
		setTimeout(function(){
			self.waitConnect(cb);
		}, 500);
	}
	else
	{
		this.waitCount = 0;
		cb();
	}
};
FTP.prototype.cd = function(path, cb){
	var self = this;
	var p = this.getRealRemotePath(path);
	this.client.cd(p)
	.then(() => {
		self.currentPath = p;
		if(cb)cb(null, p);
	})
	.catch(e => {
		if(cb)cb(e, p);
	});
};
FTP.prototype.rm = function(path, cb){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.rm(path, cb);
		});
		return;
	}
	var p = this.getRealRemotePath(path);
	this.client.remove(p)
	.then(() => {
		if(cb) cb();
	})
	.catch(e => {
		this.client.removeDir(p)
		.then(() => {
			if(cb) cb();
		})
		.catch(e => {
			if(cb) cb(e);
		})
	});
};
FTP.prototype.mkdir = function(path, cb){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.mkdir(path, cb);
		});
		return;
	}
	var p = this.getRealRemotePath(path);
	this.exist(p, function(result){
		if(!result)
		{
			self.client.ensureDir(p)
			.then(() => {
				if(cb) cb();
			})
			.catch(e => {
				if(cb) cb(e);
			});
		}
		else if(cb) cb();
	});
};
FTP.prototype.mv = function(oldPath, newPath, cb){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.mv(oldPath, newPath, cb);
		});
		return;
	}
	var op = this.getRealRemotePath(oldPath);
	var np = this.getRealRemotePath(newPath);
	this.client.rename(op, np)
	.then(() => {
		if(cb) cb(null, np);
	})
	.catch(e => {
		if(cb) cb(e);
	});
};
FTP.prototype.lsAll = function(path, cb){
	var self = this;
	var arr = [];
	path = this.getRealRemotePath(path);
	self.ls(path, function(err, list){
		if(err)	cb(err, list);
		else
		{
			loop(list, function(i, value, next){
				let newPath = pathUtil.join(path, value.name);
				if([".", ".."].indexOf(value.name) > -1) next();
				else if(value.type === 'd')
				{
					self.lsAll(newPath, function(err, list){
						if(list.length === 0) arr.push(newPath);
						arr = arr.concat(list);
						next();
					});
				}
				else
				{
					arr.push(newPath);
					next();
				}
			}, function(err){
				if(cb) cb(err, arr);
			});
		}
	});
}
FTP.prototype.ls = function(path, cb){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.ls(path, cb);
		});
		return;
	}
	var p = this.getRealRemotePath(path);
	this.cd(p, e => {
		if(e){if(cb)cb(e)}
		else
		{
			this.client.list()
			.then(fileInfos => {
				for(let v of fileInfos)
				{
					v.type = v.isDirectory ? 'd' : 'f';
					v.date = new Date(v.date);
				}
				if(cb) cb(null, fileInfos);
			})
			.catch(e => {
				if(cb) cb(e);
			})
		}
	});
	// {
  //   name: '임시 저장소.txt',
  //   type: 0,
  //   size: 54601,
  //   hardLinkCount: 1,
  //   permissions: { user: 3, group: 1, world: 1 },
  //   link: '',
  //   group: 'hosting',
  //   user: 'humy2833',
  //   date: 'Apr  2 2016' }
};
FTP.prototype.pwd = function(cb){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.pwd(cb);
		});
		return;
	}
	this.client.pwd()
	.then(p => {
		if(cb) cb(null, p);
	})
	.catch(e => {
		if(cb) cb(e);
	});
};
FTP.prototype.isDir = function(path, cb){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.isDir(path, cb);
		});
		return;
	}
	var p = this.getRealRemotePath(path);
	this.pwd((e) => {
		if(e)
		{
			if(cb) cb(e);
		}
		else
		{
			this.cd(p, e => {
				if(cb) cb(e ? false : true);
			});
		}
	});
}
FTP.prototype.exist = function(path, cb){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.exist(path, cb);
		});
		return;
	}
	var p = this.getRealRemotePath(path);
	var result = false;
	this.ls(pathUtil.getParentPath(p), function(err, list){
		if(!err)
		{
			for(var i=0; i<list.length; i++)
			{
				if(list[i].name == pathUtil.getFileName(p)) 
				{
					result = true;
					break;
				}
			}
			if(cb) cb(result);
		}
		else if(cb) cb(result);
	});
};
FTP.prototype.upload = function(localPath, remotePath, cb, isRecursive){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.upload(localPath, remotePath, cb, isRecursive);
		});
		return;
	}
	var cwd = this.currentPath;
	if(localPath instanceof Array)
	{
		if(typeof remotePath === 'function')
		{
			cb = remotePath;
			remotePath = null;
		}
		loop(localPath, function(i, value, next){
			var local = value;
			var remote = remotePath;
			if(typeof value === 'object')
			{
				local = value.local;
				remote = value.remote;
			}
			self.upload(local, remote, function(err){
				next(err);
			});
		}, function(err){
			self.cd(cwd, function(){
				if(cb)cb(err);
			});
		});
		return;
	}
	localPath = pathUtil.normalize(localPath);
	if(/\/\*{1,2}$/.test(localPath))
	{
		isRecursive = true;
		localPath = localPath.replace(/\/\*{1,2}$/, '');
	}
	remotePath = this.getRealRemotePath(remotePath);
	fileUtil.isDir(localPath, function(err, isDir){
		if(isDir)
		{
			if(!isRecursive)
			{
				isRecursive = pathUtil.getFileName(localPath) == pathUtil.getFileName(remotePath);
			}
			var parent = pathUtil.normalize(remotePath + (isRecursive ? "" : "/" + pathUtil.getFileName(localPath)));
			self.cd(parent, function(err){
				if(err)	
				{
					self.mkdir(parent, function(err){
						if(err) 
						{
							self.cd(cwd, function(e){
								if(!e) bodyDir();
								else if(cb)cb(err);
							});
						}
						else
						{
							self.emit("upload", parent);
							bodyDir();
						}
					});
				}
				else bodyDir();
			});
			
			function bodyDir(){
				fileUtil.ls(localPath, function(err, list){
					loop(list, function(i, value, next){
						self.upload(localPath + "/" + value, parent + "/" + value, function(err){
							next(err);
						}, true);
					}, function(err){
						self.cd(cwd, function(){
							if(cb)cb(err);
						});
					});
				});
			}	
		}
		else
		{
			if(!isRecursive)
			{
				self.cd(remotePath, function(err){
					if(!err)
					{
						remotePath = pathUtil.normalize(remotePath + "/" + pathUtil.getFileName(localPath));
					}
					var parent = pathUtil.getParentPath(remotePath);
					self.cd(parent, function(err){
						if(err)	
						{
							self.mkdir(parent, function(err){
								if(err) 
								{
									self.cd(cwd, function(e){
										if(!e) uploadFile();
										else if(cb)cb(err);
									});
								}
								else
								{
									self.emit("upload", parent);
									uploadFile();
								}
							});
						}
						else uploadFile();
					});
				});
			}
			else uploadFile();
		}
	});

	function uploadFile(){
		self.client.upload(fs.createReadStream(localPath), remotePath)
		.then(() => {
			self.emit("upload", remotePath);
			return self.cd(cwd, function(){
        if(cb) cb();
      });
		})
		.catch(e => {
			if(cb) cb(e);
		});
	}
};
FTP.prototype.download = function(remotePath, localPath, cb, isRecursive){
	var self = this;
	if(!this.isConnect)
	{
		this.waitConnect(function(){
			self.download(remotePath, localPath, cb, isRecursive);
		});
		return;
	}
	var cwd = this.currentPath;
	if(remotePath instanceof Array)
	{
		if(typeof localPath === 'function')
		{
			cb = localPath;
			localPath = null;
		}
		loop(remotePath, function(i, value, next){
			var local = localPath;
			var remote = value;
			if(typeof value === 'object')
			{
				local = value.local;
				remote = value.remote;
			}
			self.download(remote, local, function(err){
				next(err);
			});
		}, function(err){
			self.cd(cwd, function(){
				if(cb)cb(err);
			});
		});
		return;
	}
	remotePath = this.getRealRemotePath(remotePath);
	var tempLocalPath = localPath;
	localPath = pathUtil.normalize(localPath);
	if(/\/\*{1,2}$/.test(remotePath))
	{
		isRecursive = true;
		remotePath = remotePath.replace(/\/\*{1,2}$/, '');
	}
			
	this.cd(remotePath, function(err, path){
		if(err)
		{
			if(!isRecursive)
			{
				fileUtil.isDir(localPath, function(err, isDir){
					if(isDir)
					{
						localPath = pathUtil.normalize(localPath + "/" + pathUtil.getFileName(remotePath));
						bodyFile();
					}
					else
					{
						if(/\/$/.test(tempLocalPath))
						{	
							fileUtil.mkdir(tempLocalPath, function(){
								localPath = tempLocalPath + pathUtil.getFileName(remotePath);
								bodyFile();
							});
						}
						else
						{
							fileUtil.mkdir(pathUtil.getParentPath(localPath), function(){
								bodyFile();
							});
						}
					}
				});
			}
			else bodyFile();
		}
		else
		{
			if(!isRecursive)
			{
				isRecursive = pathUtil.getFileName(localPath) == pathUtil.getFileName(remotePath);
      }
			var parent = pathUtil.normalize(localPath + (isRecursive ? "" : "/" + pathUtil.getFileName(remotePath)));
			fileUtil.exist(parent, function(bool){
				if(!bool)
				{
					fileUtil.mkdir(parent, function(){
						self.emit("download", parent);
						bodyDir(parent);
					});
				}
				else bodyDir(parent);
			});
		}
	});
	
	function bodyDir(parent){
		self.ls(remotePath, function(err, list){
			loop(list, function(i, value, next){
				self.download(remotePath + "/" + value.name, parent + "/" + value.name, function(err){
					next(err);
				}, true);
			}, function(err){
				self.cd(cwd, function(){
					if(cb)cb();
				});
			});
		});
	}
	
	function bodyFile(){
		self.client.download(fs.createWriteStream(localPath), remotePath)
		.then(() => {
			self.emit("download", localPath);
			self.cd(cwd, function(){
				if(cb)cb();
			});
		})
		.catch(e => {
			if(cb)cb(e);
		});
	}
};
FTP.prototype.end = FTP.prototype.close = function(cb){
	this.isConnect = false;
	try{this.client.close();}catch(e){}
	this.emit("close");
	if(cb)process.nextTick(cb);
};
FTP.prototype.getRealRemotePath = function(path){
	var p = path;
	if(path.indexOf("/") !== 0)
	{
		var tempCurrentPath = this.currentPath;
		if(path.indexOf("./") === 0 && path.length > 2)
		{
			path = path.substring(2);
		}
		var upIdx = path.indexOf("../");		
		while(upIdx === 0 && tempCurrentPath != "/")
		{
			tempCurrentPath = tempCurrentPath.substring(0, tempCurrentPath.lastIndexOf("/"));
			path = path.substring(3);
			upIdx = path.indexOf("../");
		}
		if(tempCurrentPath === '/') 	p = tempCurrentPath + path;
		else 	p = tempCurrentPath + "/" + path;		
	}
	if(p.length > 1 && /\/$/.test(p)) p = p.substring(0, p.length-1);
	return p;
};
module.exports = FTP;
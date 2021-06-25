'use strict';
/**
 * sync easy loop
 */
var easyWhile = require('./easy-while');
var easyFor = require('./easy-for');
var easyManual = require('./easy-manual');
var easyAsync = require('./easy-async');
var easyPing = require('./easy-ping');
var easyTick = require('./easy-tick');
function loop(obj, func, concurrency, last){
	if(typeof obj === 'function' || obj === true)
	{
		if(typeof concurrency === 'function') last = concurrency;
		easyWhile(obj, func, last);
	}
	else if(Array.isArray(obj) && Array.isArray(func))
	{
		easyPing.apply(this, Array.from(arguments));
	}
	else if(Array.isArray(obj) && typeof func === 'number' && typeof concurrency === 'number' && typeof last === 'function')
	{
		easyTick.tick(this, Array.from(arguments));
	}
	else
	{
		easyFor(obj, func, concurrency, last);
	}
}
/**
 * 최초에만 concurrency 숫자만큼 병렬 시작하고 그 담부턴 순차적으로 실행
 * @param {*} obj 
 * @param {*} concurrency 
 * @param {*} func 
 * @param {*} last 
 */
function loopOnce(obj, concurrency, func, last){
	let len = obj.length;
	if(concurrency >= len)
	{
		loop(obj, concurrency, func, last);
	}
	else
	{
		let task = obj.splice(0, concurrency);
		len = obj.length;
		loop(task, concurrency, func, function(err, results1){
			if(err)
			{
				if(last) last(err, results1);
			}
			else
			{
				loop(obj, 1, function(i, value, next){
					func(i+len-1, value, next);
				}, function(err, results2){
					if(results1)
					{
						if(!results2) results2 = [];
						results1 = results1.concat(results2);
						last(err, results1);
					}
					else if(last) last(err);
				});
			}
		});
	}
}
loop["ping"] = loop["waterfall"] = loop["for"] = loop["while"] = loop["loop"] = loop["forEach"] = loop;
loop["create"] = easyManual;
loop["series"] = easyAsync.series;
loop["parallel"] = easyAsync.parallel;
loop["once"] = loopOnce;
loop["tick"] = easyTick.tick;
loop["equalTick"] = easyTick.equalTick;

module.exports = loop;
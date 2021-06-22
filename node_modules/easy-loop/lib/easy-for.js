'use strict';
function easyFor(obj, func, concurrency, last){
	var max = 0;
	var argsLen = arguments.length;
	var isArr = obj instanceof Array;
	var isNum = false;
	var keys = null;
	var isEnd = false;
	var isWaterfall = (func === undefined || typeof func === 'function') && isWaterfallCall(obj);
		
	if(obj instanceof Array)	max = obj.length;
	else if(obj instanceof Object)
	{
		keys = Object.keys(obj);
		max = keys.length;
	}
	else if(typeof obj === 'number' && obj >= 0)
	{
		isNum = true;
		max = obj;
	}
	else	throw "first argument is not Array or Object or number of iterations  => " + obj;
	
	if((argsLen === 3 || argsLen === 4) && typeof func === 'number' && typeof concurrency === 'function')
	{
		var temp = func;
		func = concurrency;
		concurrency = temp;
	}
	if(typeof concurrency === 'function')
	{
		last = concurrency;
		concurrency = 1;
	}
	else
	{
		if(!concurrency || isNaN(concurrency))	concurrency = 1;	
		else	concurrency = parseInt(concurrency);
	}
	if(isWaterfall && typeof func === 'function')
	{
		last = func;
		func = null;
	}
	var count = {start:0, end:0, processing:0};	
	var next = function(err){
		count.processing--;
		count.end++;
		if(count.end >= max || err)
		{
			if(last && !isEnd)
			{
				if(err) last(err);
				else
				{
					if(isWaterfall)	last.apply(this, Array.from(arguments));
					else	last();
				}
			}
			isEnd = true;
		}
		else	
		{
			if(isWaterfall)	run.apply(this, Array.prototype.slice.call(arguments, 1));
			else run();
		}
	};
	var run = function(){
		if(max > count.start)
		{
			count.processing++;
			if(isArr)
			{
				if(isWaterfall) obj[count.start++].apply(this, Array.from(arguments).concat(next));
				else	func(count.start, obj[count.start++], next);
			}
			else if(isNum) func(count.start++, next);
			else		func(keys[count.start], obj[keys[count.start++]], next);
			if(max > count.start && count.processing < concurrency)	run();
		}
	};
	max == 0 ? next() : run();
}
function isWaterfallCall(arr){
	var result = arr instanceof Array;
	if(result)
	{
		if(arr.length === 0) result = false;
		for(var a of arr)
		{
			if(typeof a !== 'function')
			{
				result = false;
				break;
			}
		}
	}
	return result;
}
module.exports = easyFor;
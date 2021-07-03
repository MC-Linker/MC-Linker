'use strict';
function easyWhile(condition, func, last){
	var count = 0;
	if(func === undefined && last === undefined)
	{
		func = condition;
		condition = function(){return true;}
	}
	else if(condition === true)
	{
		condition = function(){return true;}
	}
	var run = function(){
		if(condition())	func(next, count);
		else
		{
			if(last) last();
		}
	};
	var next = function(err){
		if(err)
		{
			if(last) last(err);
		}
		else
		{
			count++;
			run();
		}
	};
	run();
}
module.exports = easyWhile;
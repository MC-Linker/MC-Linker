//var fs = require('fs');
var loop = require('../lib/easy-loop');

/*
var arr = [1,2,3,4,5];
console.log("Case1 Start => Array and 3 arguments");
console.log("Start : Now Second : ", new Date().getSeconds());
loop(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value, " , Date : ", new Date().getSeconds());
		next();	//require	
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 1 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case1 End => Array");
*/

/*
console.log("Case2 Start => Array and 2 arguments");
loop.for(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value);	
		next();	//require	
	}, 1000);
});
console.log("Case2 End");



console.log("Case3 Start => Array and error(or break) and 3 arguments");
loop.while(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value);
		if(i === 2)	next("error or break");
		else		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 3 result");
});
console.log("Case3 End");
*/

/*
var obj = {a:1,b:2,c:3,d:4,e:5};
console.log("Case4 Start => Object and 3 arguments");
loop.loop(obj, function(key, value, next){
	setTimeout(function(){
		console.log(key, "=>", value);
		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 4 result");
});
console.log("Case4 End");
*/


/*


var arr = [];
console.log("Case5 Start => Empty Array and 3 arguments");
loop(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value);
		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case5 result");
});
console.log("Case5 End");






var arr = [];
for(var i=0; i<10000; i++) arr.push(i);
console.log("Case6 Start => concurrency and 4 arguments");
console.log("Start : Now Second : ", new Date().getSeconds());
loop(arr, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=>", value, " , Date : ", new Date().getSeconds());
		next();
	}, 1000);
}, 10000, function(err){
	console.log("err : ", err);
	console.log("Case 6 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case6 End");



var num = 0;
console.log("Case7 Start => while and 3 arguments");
console.log("Start : Now Second : ", new Date().getSeconds());
loop.while(function(){
	return num < 5;
}, function(next){
	setTimeout(function(){
		console.log("Date : ", new Date().getSeconds());
		num++;
		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 7 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case7 End");





var num = 0;
console.log("Case8 Start => while and 3 arguments and break(or error)");
console.log("Start : Now Second : ", new Date().getSeconds());
loop.while(function(){
	return num < 5;
}, function(next){
	setTimeout(function(){
		console.log("Date : ", new Date().getSeconds());
		num++;
		next(num === 1 ? true : false);
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 8 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case8 End");
*/

/*
console.log("Case9 Start => When only know the number of iterations. 2 or 3 arguments possible");
console.log("Start : Now Second : ", new Date().getSeconds());
var loopCount = 5;
loop(loopCount, function(i, next){
	setTimeout(function(){
		console.log(i, "Date : ", new Date().getSeconds());
		next();
	}, 1000);
}, function(err){
	console.log("err : ", err);
	console.log("Case 9 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case9 End");
*/

/*
console.log("Case10 Start => When only know the number of iterations");
console.log("Start : Now Second : ", new Date().getSeconds());
var handle = loop.create(10, function(err){
	console.log("err : ", err);
	console.log("Case 10 result");
	console.log("Result : Now Second : ", new Date().getSeconds());
});
for(var i=0; i<10; i++)
{
	setTimeout(function(){
		console.log("Date : ", new Date().getSeconds());
	  handle.next();
	}, 1000);
}
console.log("Case10 End");
*/



/*
console.log("Case11 Start => Array. Like as 'async.series'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var arr = [
	function(callback){
		console.log("start series");
		callback();
	},
	function(callback){
		setTimeout(function(){
			console.log(100);
			callback(null, 100);
		}, 1000);
	}, 
	function(callback){
		setTimeout(function(){
			console.log(200);
			callback(null, 200);
		}, 1000);
	}
];
loop.series(arr, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case11 End");
*/



/*
console.log("Case12 Start => Object. Like as 'async.series'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var obj = {
	one :	function(callback){
		console.log("start series");
		callback();
	},
	two : function(callback){
		setTimeout(function(){
			console.log(100);
			callback(null, 100);
		}, 1000);
	}, 
	three : function(callback){
		setTimeout(function(){
			console.log(200);
			callback(null, 200);
		}, 500);
	}
};
loop.series(obj, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case12 End");
*/




/*
console.log("Case13 Start => Array. Like as 'async.parallel'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var arr = [
	function(callback){
		console.log("start parallel");
		callback();
	},
	function(callback){
		setTimeout(function(){
			console.log(100);
			callback(null, 100);
		}, 500);
	}, function(callback){
		setTimeout(function(){
			console.log(200);
			callback(null, 200);
		}, 500);
	}
];
loop.parallel(arr, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case13 End");
*/


/*
console.log("Case14 Start => Object. Like as 'async.parallel'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var obj = {
	one :	function(callback){
		console.log("start parallel");
		callback();
	},
	two : function(callback){
		setTimeout(function(){
			console.log(100);
			callback(null, 100);
		}, 500);
	}, 
	three : function(callback){
		setTimeout(function(){
			console.log(200);
			callback(null, 200);
		}, 500);
	}
};
loop.parallel(obj, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case14 End");
*/

/*
console.log("Case15 Start => Array(or Object). Like as 'async.series'. But sub functions run parallel.");
console.log("Start : Now Second : ", new Date().getSeconds());
var obj = [
	[
		function(cb){
			setTimeout(function(){console.log(new Date().getSeconds(), "sub1");
			cb(null, "sub1");}, 1000)
	}, 
		function(cb){
			setTimeout(function(){console.log(new Date().getSeconds(), "sub2");
			cb(null, "sub2");}, 1000)
		}
	],
	function(callback){
		setTimeout(function(){
			console.log(new Date().getSeconds(), 100);
			callback(null, 100);
		}, 1000);
	}, 
	function(callback){
		setTimeout(function(){
			console.log(new Date().getSeconds(), 200);
			callback(null, 200);
		}, 1000);
	}
];
loop.series(obj, function(err, results){
	console.log("err : ", err);
	console.log("results : ", JSON.stringify(results));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case15 End");
*/

/*
Case15 Start => Array(or Object). Like as 'async.series'. But sub functions run
parallel.
Start : Now Second :  59
Case15 End
0 'sub1'
0 'sub2'
1 100
2 200
err :  undefined
results :  [["sub1","sub2"],100,200]
Result : Now Second :  2
*/


/*
console.log("Case16 Start => Array. Like as 'async.waterfall'. If the error is when to stop.");
console.log("Start : Now Second : ", new Date().getSeconds());
var arr = [
	function(callback){
		console.log("start waterfall", arguments);
		callback(null, 1);
	},
	function(num1, callback){
		setTimeout(function(){
			console.log(100);
			callback(null, num1, 100);
		}, 500);
	}, function(num1, num2, callback){
		setTimeout(function(){
			console.log(200);
			callback(null, num1, num2, 200);
		}, 500);
	}
];
loop.waterfall(arr, function(err, num1, num2, num3){
	console.log("result : ", JSON.stringify(arguments));
	console.log("Result : Now Second : ", new Date().getSeconds());
});
console.log("Case16 End");
*/

/*
Case16 Start => Array. Like as 'async.waterfall'. If the error is when to stop.
Start : Now Second :  14
start waterfall { '0': [Function] }
Case16 End
100
200
result :  {"0":null,"1":1,"2":100,"3":200}
Result : Now Second :  15
*/



/*
Case17 Start => Ping function. [[function...], [function...], concurrency, isAllEnd, callback]
"arg1 function end" then "arg2 function async call"
arg1, arg2 required. other args option.
concurrency - default : 1
isAllEnd - default : false


example

var arr1 = [
	function(next){
		console.log("1 start");
		setTimeout(function(){
			console.log("1 end");
			next(null, 1);
		}, 2000);
	}, 
	function(next){
		console.log("11 start");
		setTimeout(function(){
			console.log("11 end");
			next(null, 11);
		}, 1000)
	}, 
	function(next){
		console.log("111 start");
		setTimeout(function(){
			console.log("111 end");
			next(null, 111);
		}, 3000)
	}];
var arr2 = [
	function(data, next){
		console.log("2 start");
		setTimeout(function(){
			console.log("2 end");
			next(null, data*10)
		}, 5000)
	}, 
	function(data, next){
		console.log("22 start");
		setTimeout(function(){
			console.log("22 end");
			next(null, data*10)
		}, 1000)
	}, 
	function(data, next){
		console.log("222 start");
		setTimeout(function(){
			console.log("222 end");
			next(null, data*10)
		}, 1000)
	}];
loop.ping(arr1, arr2, false, function(err){
	console.log("end", arguments);
});

/* result *
1 start
1 end
11 start
2 start
11 end
111 start
22 start
22 end
111 end
222 start
222 end
2 end
end { '0': undefined, '1': [ 1, 11, 111 ], '2': [ 10, 110, 1110 ] }
*/


/* example 2 
loop.ping(arr1, arr2, false, function(err){
	console.log("end", arguments);
});

/* result *

1 start
1 end
11 start
2 start
11 end
111 start
22 start
22 end
111 end
end { '0': undefined, '1': [ 1, 11, 111 ], '2': [ , 110,  ] }
222 start
2 end
222 end
*/

//Case18 Start => once parallel. after series Processing
/*
loop.once([1,2,3,4,5], 2, function(i, value, next){
	setTimeout(function(){
		console.log(i, "=", value);
		next();
	}, 1000);
}, function(err, results){
	console.log("result",arguments);
});
*/




/*
//Case19 Start => tick parallel(arg : array, tick-time(ms), concurrency, callback)
console.log(new Date(), "start");
loop.tick([1,2,3,4,5,6,7,8,9,10], 1000, 3, function(i, value, next){
	console.log(new Date(), i, "=", value);
	setTimeout(function(){
		next();
	}, 2000);
}, function(err){
	console.log(new Date(), "end", arguments);
});
*/
/*
//result
2017-09-08T01:43:23.774Z 'start'
2017-09-08T01:43:23.779Z 0 '=' 1
2017-09-08T01:43:23.781Z 1 '=' 2
2017-09-08T01:43:23.781Z 2 '=' 3
2017-09-08T01:43:24.782Z 3 '=' 4
2017-09-08T01:43:24.782Z 4 '=' 5
2017-09-08T01:43:24.782Z 5 '=' 6
2017-09-08T01:43:25.783Z 6 '=' 7
2017-09-08T01:43:25.784Z 7 '=' 8
2017-09-08T01:43:25.784Z 8 '=' 9
2017-09-08T01:43:26.783Z 9 '=' 10
2017-09-08T01:43:28.784Z 'end' { '0': null }
*/






# easy-loop
	* 쉬운 동기식 반복처리
	* 선택적 병렬처리

## iteration function
	1) Method
		: 모두 같은 동작이며 편리한 메소드를 호출하세요.
		
		var loop = require('easy-loop');
		loop(arg, arg [, arg, arg]) == loop.for() == loop.while()		
		
	2) Arguments	
		(1) Array or Object or function or iteration number	- require
		(2) process function 	- require
		(3) concurrency	number 	- option (default : 1)
		(4) callback function 	- option (default : nothing)
		
		* TIP : arg2 와 arg3 의 인자값은 순서 변경 가능(arg3 and arg3 can be swap)


## series or parallel or waterfall function
	1) Method
		var loop = require('easy-loop');
		//series('function array or object' [, concurrency] [, callback]) -> 'concurrency' default 1
		loop.series([
			function(callback){
				var result = "success";
				callback(null, result);
			},
		...], function(err, results){
			//err : undefined
			//results : ["success"...]
		});

		loop.parallel({
			one : function(callback){
				var result = "success";
				callback(null, result);
			},
		...}, function(err, results){
			//err : undefined
			//results : {"one":"success"...}
		});

		loop.waterfall([
			function(callback){
				var arg1 = 1;				
				callback(null, arg1);
			},
			function(arg, callback){
				//console.log(arg) => 1
				var arg1 = 2;				
				callback(null, arg, arg1);
			},
			function(arg1, arg2, callback){
				//console.log(arg1, arg2) => 1, 2
				var arg1 = 3;				
				callback(null, arg1);
			}], function(err, results){
			//err : undefined
			//console.log(results) => 3
		});

	2) Arguments
		(1) Array or Object (waterfall only Array) - require
		(2) callback function - option
	

## Examples

	var loop = require('easy-loop');
	
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
	
	/* 결과(Result) - 5초 소요(run time : 5 second)
	Case1 Start => Array and 3 arguments
	Start : Now Second :  54
	Case1 End => Array
	0 '=>' 1 ' , Date : ' 55
	1 '=>' 2 ' , Date : ' 56
	2 '=>' 3 ' , Date : ' 57
	3 '=>' 4 ' , Date : ' 58
	4 '=>' 5 ' , Date : ' 59
	err :  undefined
	Case 1 result
	Result : Now Second :  59
	*/
	
	
	
	
	var arr = [1,2,3,4,5];
	console.log("Case2 Start => Array and 2 arguments");
	loop.for(arr, function(i, value, next){
		setTimeout(function(){
			console.log(i, "=>", value);	
			next();		
		}, 1000);
	});
	console.log("Case2 End => Array and 2 arguments");
	
	/* 결과(Result) - 5초 소요(run time : 5 second)
	Case2 Start => Array and 2 arguments
	Case2 End => Array and 2 arguments
	0 '=>' 1
	1 '=>' 2
	2 '=>' 3
	3 '=>' 4
	4 '=>' 5
	*/
	
	
	
	
	var arr = [1,2,3,4,5];
	console.log("Case3 Start => Array and error(or break) and 3 arguments");
	loop(arr, function(i, value, next){
		setTimeout(function(){
			console.log(i, "=>", value);
			if(i === 2)	next("error or break");
			else		next();
		}, 1000);
	}, function(err){
		console.log("err : ", err);
		console.log("Case 3 result");
	});
	console.log("Case3 End => Array and error(or break)");
	
	/* 결과(Result) - 3초 소요(run time : 3 second)
	Case3 Start => Array and error(or break) and 3 arguments
	Case3 End => Array and error(or break)
	0 '=>' 1
	1 '=>' 2
	2 '=>' 3
	err :  error or break
	Case 3 result
	*/
	
	
	
	
	var obj = {a:1,b:2,c:3,d:4,e:5};
	console.log("Case4 Start => Object and 3 arguments");
	loop(obj, function(key, value, next){
		setTimeout(function(){
			console.log(key, "=>", value);
			next();
		}, 1000);
	}, function(err){
		console.log("err : ", err);
		console.log("Case 4 result");
	});
	console.log("Case4 End => Object");
	
	/* 결과(Result) - 5초 소요(run time : 5 second)
	Case4 Start => Object and 3 arguments
	Case4 End => Object
	a => 1
	b => 2
	c => 3
	d => 4
	e => 5
	err :  undefined
	Case 4 result
	*/
	
	
	
	
	
	var arr = [];	// or {}
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
	console.log("Case5 End => Empty Array");
	
	/* 결과(Result) - 0초 소요(run time : 0 second)
	Case5 Start => Empty Array and 3 arguments
	err :  undefined
	Case5 result
	Case5 End => Empty Array
	*/
	
	
	
	
	
	var arr = [1,2,3,4,5];
	console.log("Case6 Start => concurrency and 4 arguments");
	console.log("Start : Now Second : ", new Date().getSeconds());
	loop(arr, function(i, value, next){
		setTimeout(function(){
			console.log(i, "=>", value, " , Date : ", new Date().getSeconds());
			next();
		}, 1000);
	}, 3, function(err){
		console.log("err : ", err);
		console.log("Case 6 result");
		console.log("Result : Now Second : ", new Date().getSeconds());
	});
	console.log("Case6 End => concurrency");
	
	/*
	*Tip : arguments(arr, function, concurrency, callback) == arguments(arr, concurrency, function, callback) 
	결과(Result) - 2초 소요(run time : 2 second)
	Case6 Start => concurrency and 4 arguments
	Start : Now Second :  3
	Case6 End => concurrency
	0 '=>' 1 ' , Date : ' 4
	1 '=>' 2 ' , Date : ' 4
	2 '=>' 3 ' , Date : ' 4
	3 '=>' 4 ' , Date : ' 5
	4 '=>' 5 ' , Date : ' 5
	err :  undefined
	Case 6 result
	Result : Now Second :  5
	*/
	
	
	
	
	
	
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
	
	/*
	결과(Result) - 5초 소요(run time : 5 second)
	Case7 Start => while and 3 arguments
	Start : Now Second :  20
	Case7 End
	Date :  21
	Date :  22
	Date :  23
	Date :  24
	Date :  25
	err :  undefined
	Case 7 result
	Result : Now Second :  25
	*/
	
	
	
	
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
	
	/*
	Case8 Start => while and 3 arguments and break(or error)
	Start : Now Second :  21
	Case8 End
	Date :  22
	err :  true
	Case 8 result
	Result : Now Second :  22
	*/



	console.log("Case9 Start => When only know the number of iterations. 2 arguments or 3 arguments(concurrency) and break possible");
	console.log("Start : Now Second : ", new Date().getSeconds());
	var loopCount = 5;
	loop(loopCount, function(i, next){
		setTimeout(function(){
			console.log(i, "Date : ", new Date().getSeconds());
			next();	// break => next(err);
		}, 1000);
	}, function(err){
		console.log("err : ", err);
		console.log("Case 9 result");
		console.log("Result : Now Second : ", new Date().getSeconds());
	});
	console.log("Case9 End");

	/*
	Case9 Start => When only know the number of iterations. 2 arguments or 3 arguments(concurrency) and break possible
	Start : Now Second :  23
	Case9 End
	0 'Date : ' 24
	1 'Date : ' 25
	2 'Date : ' 26
	3 'Date : ' 27
	4 'Date : ' 28
	err :  undefined
	Case 9 result
	Result : Now Second :  28
	*/




	console.log("Case10 Start => When only know the number of iterations. break possible");
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
			handle.next();	// break => handle.next(err);
		}, 1000);
	}
	console.log("Case10 End");

	/*
	Case10 Start => When only know the number of iterations
	Start : Now Second :  20
	Case10 End
	Date :  21
	Date :  21
	Date :  21
	Date :  21
	Date :  21
	Date :  21
	Date :  21
	Date :  21
	Date :  21
	Date :  21
	err :  undefined
	Case 10 result
	Result : Now Second :  21
	*/




	console.log("Case11 Start => Array. Like as 'async.series' of async module. If the error is when to stop.");
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
		}, function(callback){
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

	/*
	Case11 Start => Array. Like as 'async.series' of async module. If the error is when to stop.
	Start : Now Second :  50
	start series
	Case11 End
	100
	200
	err :  undefined
	results :  [null,100,200]
	Result : Now Second :  52
	*/




	console.log("Case12 Start => Object. Like as 'async.series' of async module. If the error is when to stop.");
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
			}, 1000);
		}
	};
	loop.series(obj, function(err, results){
		console.log("err : ", err);
		console.log("results : ", JSON.stringify(results));
		console.log("Result : Now Second : ", new Date().getSeconds());
	});
	console.log("Case12 End");

	/*
	Case12 Start => Object. Like as 'async.series' of async module. If the error is when to stop.
	Start : Now Second :  38
	start series
	Case12 End
	100
	200
	err :  undefined
	results :  {"one":null,"two":100,"three":200}
	Result : Now Second :  40
	*/
	




	console.log("Case13 Start => Array. Like as 'async.parallel' of async module. If the error is when to stop.");
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

	/*
	Case13 Start => Array. Like as 'async.parallel' of async module. If the error is when to stop.
	Start : Now Second :  55
	start parallel
	Case13 End
	100
	200
	err :  undefined
	results :  [null,100,200]
	Result : Now Second :  55
	*/




	console.log("Case14 Start => Object. Like as 'async.parallel' of async module. If the error is when to stop.");
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

	/*
	Case14 Start => Object. Like as 'async.parallel' of async module. If the error is when to stop.
	Start : Now Second :  59
	start parallel
	Case14 End
	100
	200
	err :  undefined
	results :  {"one":null,"two":100,"three":200}
	Result : Now Second :  59
	*/




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
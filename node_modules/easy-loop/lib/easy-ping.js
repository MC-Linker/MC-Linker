'use strict';
var loop = require('./easy-for');
function easyPing(func1, func2, concurrency, isAllEnd, last){
  if(typeof concurrency === 'function')
  {
    last = concurrency;
    concurrency = 1;
  }
  else if(typeof concurrency === 'boolean' )
  {
    if(typeof isAllEnd === 'function')
    {
      last = isAllEnd;
      isAllEnd = concurrency;
    }
    concurrency = 1;
  }
  else if(typeof isAllEnd === 'function')
  {
    last = isAllEnd;
    isAllEnd = false;
  }
  if(!concurrency) concurrency = 1;
  let isEnd = false;
  let len1 = func1.length;
  let len2 = func2.length;
  let cb1 = 0, cb2 = 0;
  let results1 = new Array(len1);
  let results2 = new Array(len1);
  if(len1 > len2 && len2.length === 1)
  {
    for(let i=len2; i<len1; i++)
    {
      func2.push(func2[0]);
    }
    len2 = func2.length;
  }
  let subErr = null;
  loop(func1, concurrency, function(i, value, next){
    value(function(err, val){
      //console.log("main", i, "callback")
      results1[i] = val;
      err = err || subErr;
      cb1++;
      if(err || !isAllEnd || isAllEnd && (cb1 < len1 || cb2 === len1)) next(err);
      if(!err)
      {
        func2[i](val, function(err, v){
          //console.log("sub", i, "callback")
          subErr = err;
          results2[i] = v;
          cb2++;
          if(isAllEnd && cb1 === len1 && cb2 === len1) next(err);
        });
      }
    });
  }, function(err){
    if(!isEnd)
    {
      isEnd = true;
      if(last) last(err, results1, results2);
    }
  });
}
module.exports = easyPing;
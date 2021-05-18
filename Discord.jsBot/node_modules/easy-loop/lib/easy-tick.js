'use strict';
var loop = require('./easy-for');
/**
 * tick(ms) 당 concurrency 개씩 실행한다.
 */
function easyTick(arr, ms, concurrency, func, last){
  var MAX = arr.length;
  var TOTAL_PAGE = Math.ceil(MAX / concurrency);
  var page = 1;
  var successCount = 0;
  var stop = null;
  var isEnd = false;
  loop(TOTAL_PAGE, function(i, next){
    var startIndex = (page - 1) * concurrency;
    var endIndex = page * concurrency;
    if(endIndex > MAX) endIndex = MAX;
    for(var i=startIndex; i<endIndex; i++)
    {
      func(i, arr[i], function(e){
        successCount++;
        if(e) stop = e;
        runLast();
      });
    }
    page++;
    setTimeout(function(){
      if(stop) runLast();
      else next();
    }, ms);
  });
  if(TOTAL_PAGE === 0) runLast();

  function runLast(){
    if(!last || isEnd) return;
    if(MAX <= successCount || stop)
    {
      isEnd = true;
      last(stop);
    }
  }
}
exports.tick = easyTick;
/**
 * tick(ms) 당 concurrency 개씩 실행하는데 (tick / concurrency) ms 초씩 간격을 두고 실행한다.
 * tick 시간 안에 concurrency 개를 실행하는건 위와 동일하다.
 */
function easyEqualTick(arr, ms, concurrency, func, last){
  var MAX = arr.length;
  var tickMS = ms / concurrency;
  var mod = tickMS % 1;
  tickMS = tickMS - mod;
  var lastMS = 0;
  var isLastMS = mod > 0;
  if(isLastMS) lastMS = ms - tickMS * (concurrency - 1);

  var successCount = 0;
  var stop = null;
  var isEnd = false;
  loop(arr, function(i, value, next){
    var tick = isLastMS && (i + 1) % concurrency === 0 ? lastMS : tickMS;
    setTimeout(() => {
      if(stop) runLast();
      else next();
    }, tick);
    func(i, value, function(e){
      successCount++;
      if(e) stop = e;
      runLast();
    });
  });
  if(MAX === 0) runLast();

  function runLast(){
    if(!last || isEnd) return;
    if(MAX <= successCount || stop)
    {
      isEnd = true;
      last(stop);
    }
  }
}
exports.equalTick = easyEqualTick;
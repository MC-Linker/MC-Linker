'use strict';
function Loop(max, last){
	const MAX = max;
	var count = 0;
	var lastFn = last;
	this.getMax = function(){
		return MAX;
	};
	this.getCount = function(){
		return count;
	};
	this.setCount = function(c){
		count = c;
	};
	this.getLastFn = function(){
		return lastFn;
	};
	if(MAX <= 0){ this.last(); }
}
Loop.prototype = {
	/**
	 * 다음 반복 실행
	 */
	next : function(err){
    if(err) this.stop(err);
    else
    {
      this.setCount(this.getCount() + 1);
      if(this.getCount() >= this.getMax())
      {
        this.last();
      }
    }		
	}	
	/**
	 * 최종 함수 호출
	 */
	,last : function(err){
		if(!this.getLastFn()){ return; }		
		this.getLastFn().call(this, err);
	}
	/**
	 * 강제로 반복을 종료
	 */
	,stop : function(err){
		this.setCount(this.getMax());
		this.last(err);
	}
	/**
	 * 아직 반복이 진행중인가?
	 */
	,isRun : function(){
		return this.getCount() < this.getMax();
	}
};
/**
 * 반복문 사용 생성자
 * iterator use constructor
 */
module.exports = function(max, last){
	return new Loop(max, last);
};
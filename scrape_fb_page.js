var fs = require("fs");

const util = require("util");
const EventEmitter = require('events');
var request = require("request");
var extend = require("extend");
var async = require("async");
var moment = require("moment");

/**
  * The _options_ parameter is object with the following fields
  * - page_id (required) - the FB page ID that is to be scraped
  * - access_token (required) - the FB access token to use for scraping
  * - period.from (optional, default: "") - the earliest time in the past that 
  *   scraping will work. Leave empty to parse till the earlist possible time. 
  *   Format: YYYY-MM-DD
  * - period.to (optional, default: "") - the scraping will parse post until this point. 
  *   Leave empty to parse till today. Format: YYYY-MM-DD
  * - limits.posts_limit (optional, default: 30) - the number of posts to request in
  *   a single call. If there is too much data and FB rejects the call - retry
  *   with half the limit.
  * - limits.comments_limit (optional, default: 100) - the number of comments/replies
  *   to request in one call
  * - limits.likes_limit (optional, default: 1000) - the number of likes
  *   to request in one call
  * - limits.include_comments (optional, default: true) - should the comments be scraped
  * - limits.include_likes (optional, default: true) - should the likes be scraped
  * - FB.api_root (optiona, default: https://graph.facebook.com) - the URL of the FB API
  * - FB.api_version (optiona, default: v2.5) - the latest version of the FB API
  * 
  */
function ScrapeFBPage(options) {
	EventEmitter.call(this); // inherit from Event Emitter

	this._options = {}; 	// options that control the ScrapeFBPage
	this._feed = [];  		// array of all the posts
	var self = this;

	// fill in the values for the optional arguments
	extend(
		true,
		this._options
		,{
			period : {
				 from: moment().subtract(30,"days")
			}
			,limits : {
				 posts_limit : 30
				,comments_limit: 100
				,likes_limit: 1000
				,include_comments: true
				,include_likes: true
			}
			,FB : {
				 api_root: "https://graph.facebook.com"
				,api_version: "v2.5"
			}
			,SYSTEM : {
				 concurency : 10
			}
		}
		,options
	);
	console.log(JSON.stringify(this._options,null,2));

	// statistics about the scraping
	this._stats = {
		fb_api_calls : 0,

		posts : 0,
		likes : 0,
		comments 	: 0,

		log : function () {
			console.log("Facebook calls: %d", this.fb_api_calls);
			console.log("Processed results: %d posts, %d likes, %d comments",
				this.posts, this.likes, this.comments
			);
		}
	};

	// create queue to manage the FB API calls to scrape the page
	this._queue = async.priorityQueue(
		function(params, callback) {
			// if a call fails - retry up to 5 times
			async.retry(
				{times: 5, interval: 3000}
				,self.DoRequest(params, callback)
			);
		}
		,this._options.SYSTEM.concurency
	);
}
util.inherits(ScrapeFBPage, EventEmitter);

/**
  * Public function to start the page scrapping according
  * to the options specified in the constructor
  * @param options (options) - options to augment those in the contructor
  * @return this - so that the calls could be chained
  */
ScrapeFBPage.prototype.ScrapePage = function(options) {
	console.log("Starting to scrape the page: %s", this._options.page_id);
	var self = this;

	// set up aditional values
	if (options) {
		extend(
			 true
			,this._options
			,options
		);
	}

	// queu the initial task to scrape the page
	this._queue.push(
		{
			next_url : this.GetRootURL()
			,type : "POST"
			,destination : self._feed
		},
		1
	);

	this._queue.drain = function() {
		console.log('All items have been processed');
		self.emit("END")
	};

	return this;
}

/**
  * Callback function from the this._queue. Makes a the HTTP call
  * to the FB API and call the function to process the result.
  * 
  * @params.next_url - the URL to call
  * @params.type - the type of item that will be returned by the call7
  *                i.e. could be "POSt", "COMMENTS" or "LIKE"
  * @params.destination - where the result is to be appended
  */
ScrapeFBPage.prototype.DoRequest = function(params, callback) {
	console.log("ProcessRequest: %s", params.type, params.next_url);
	var self = this;

	request.get(
		{
			 url : params.next_url
			,json : true //the response is json
		}
		, function (error, response, body) {
			if (error || response.statusCode != 200) {
				// if there is an error - call back the callback 
				// so that async.retry could retry it ..
				return callback(error || response.statusCode);
			}
			//console.log(body);
			if (body.data) {
				var proceed_with_next = self.HandleItemList(
					body.data
					,params
				);
			}

			if (proceed_with_next && body.paging && body.paging.next) {
				if (params.parent) params.parent.__incomplete++;
				self._queue.push(
					{
						 next_url : body.paging.next
						,type : params.type
						,destination : params.destination
					},
					1
				);
			} 

			callback(null); // no error
		}
	);
}

/**
  * Check if 
  */
ScrapeFBPage.prototype.HandleItemList = function(items, params) {
	var self = this;

	for (var i=0;i<items.length;i++) {
		var item = items[i];


		if (params.type=="POST") {

			item_created_at = moment(item.created_time);
			if (item_created_at.isAfter(self._options.period.to)) {
				// past the period we are interested - skip
				continue;
			}

			if (self._options.period.from 
				 && item_created_at.isBefore(self._options.period.from)) {
				// past the period we are interested - stop processing
				return false;
			}

			console.log("%s: Item crated at: %s", item.id, item.created_time);

			item.__incomplete = 0;
			item.__parent = item;
		} else {
			item.__parent = params.parent;
		}
		params.destination.push(item);

		self.ScheduleIncomplete(item);
	}	

	return true;
}

ScrapeFBPage.prototype.ScheduleIncomplete = function (item) {
	var self = this;
	var incomplete = false;

	if (item.likes && item.likes.paging && item.likes.paging.next) {
		// there is more data to be processed 
		console.log("%s: Incomplete likes", item.id);
		item.__parent.__incomplete++;
		self._queue.push(
			{
				next_url : item.likes.paging.next
				,type : "LIKE"
				,destination : item.likes.data
				,parent : item.__parent
			},
			3
		);
		incomplete = true;
	}
	if (item.comments) {
		if (item.comments.data) {
			for (var i=0;i<item.comments.data.length;i++) {
				var comment = item.comments.data[i];
				comment.__parent = item.__parent;

				// for comments recursively check if the comment is comlete
				if ( self.ScheduleIncomplete(comment) ) {
					incomplete = true;
				}
			}
		}

		if (item.comments.paging && item.comments.paging.next) {
			console.log("%s: Incomplete comments", item.id);
			item.__parent.__incomplete++;
			self._queue.push(
				{
					next_url : item.comments.paging.next
					,type : "COMMENT"
					,destination : item.comments.data
					,parent : item.__parent
				},
				2
			);
			incomplete = true;
		}
	}

	return incomplete;
}


ScrapeFBPage.prototype.GetRootURL = function() {
	var fields_template = 
		'message,story,description,created_time,from' + 
		',shares' +
		',likes.summary(true).limit(LIKES_LIMIT).order(reverse_chronological){name}' +
		',comments.summary(true).order(reverse_chronological).limit(COMMETNS_LIMIT)' +
		'{' +
			'from,message' +
			',likes.summary(true).limit(LIKES_LIMIT).order(reverse_chronological){name}' +
			',comments.summary(true).order(reverse_chronological).limit(COMMETNS_LIMIT)' +
				'{' +
					'from,message' +
					',likes.summary(true).limit(LIKES_LIMIT).filter(stream).order(reverse_chronological){name}' +
				'}' +
		'}';
	var comments_limit = this._options.limits.include_comments?this._options.limits.comments_limit:0;
	var likes_limit = this._options.limits.include_likes?this._options.limits.likes_limit:0;
	fields_template = fields_template.replace( /LIKES_LIMIT/g, likes_limit);
	fields_template = fields_template.replace( /COMMETNS_LIMIT/g, comments_limit);

	var period = "";
	if (this._options.period.from) {
		period = period + util.format(
				"&from=%s"
				,this._options.period.from.format("YYYY-MM-DD")
		);
	}
	if (this._options.period.to) {
		period = period + util.format(
				"&until=%s"
				,this._options.period.to.format("YYYY-MM-DD")
		);
	}	

	return util.format(
		"%s/%s/%s/feed?fields=%s&limit=%d%s&access_token=%s",
			this._options.FB.api_root  		// i.e. "https://graph.facebook.com"
			,this._options.FB.api_version 	// i.e. "v2.5"
			,this._options.page_id		  	// the page ID that we would be scraping
			,fields_template 				// fields
			,this._options.limits.posts_limit
			,period 						// period restrictions, i.e. from & until
			,this._options.access_token
	);
}

module.exports = ScrapeFBPage;
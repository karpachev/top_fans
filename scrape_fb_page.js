const util = require("util");
const EventEmitter = require('events');
var request = require("request");
var extend = require("extend");

/**
  * The _options_ parameter is object with the following fields
  * - page_id (required) - the FB page ID that is to be scraped
  * - access_token (required) - the FB access token to use for scraping
  * - posts_limit (optional, default: 30) - the number of posts to request in
  *   a single call. If there is too much data and FB rejects the call - retry
  *   with half the limit.
  * - comments_limit (optional, default: 100) - the number of comments/replies
  *   to request in one call
  * - likes_limit (optional, default: 1000) - the number of likes
  *   to request in one call
  * - include_comments (optional, default: true) - should the comments be scraped
  * - include_likes (optional, default: true) - should the likes be scraped
  * - fb_api_root (optiona, default: https://graph.facebook.com) - the URL of the FB API
  * - fb_api_version (optiona, default: v2.5) - the latest version of the FB API
  * 
  */
function ScrapeFBPage(options) {
	EventEmitter.call(this);
	this._options = {};

	// fill in the values for the optional arguments
	extend(
		this._options
		,{
			posts_limit : 30
			,comments_limit: 100
			,likes_limit: 1000
			,include_comments: true
			,include_likes: true
			,fb_api_root: "https://graph.facebook.com"
			,fb_api_version: "v2.5"
		}
		,options
	);

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
}
util.inherits(ScrapeFBPage, EventEmitter);


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
	var comments_limit = this._options.include_comments?this._options.comments_limit:0;
	var likes_limit = this._options.include_likes?this._options.likes_limit:0;
	fields_template = fields_template.replace( /LIKES_LIMIT/g, likes_limit);
	fields_template = fields_template.replace( /COMMETNS_LIMIT/g, comments_limit);

	return util.format(
		"%s/%s/%s/feed?fields=%s&limit=%d&access_token=%s",
			this._options.fb_api_root  		// i.e. "https://graph.facebook.com"
			,this._options.fb_api_version 	// i.e. "v2.5"
			,this._options.page_id		  	// the page ID that we would be scraping
			,fields_template 				// fields
			,this._options.posts_limit
			,this._options.access_token
	);
}

module.exports = ScrapeFBPage;
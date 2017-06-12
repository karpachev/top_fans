var request = require("request");
var fs = require("fs");
var util = require("util");
var async = require("async");
var winston     = require('winston');
var Promise = require("bluebird")

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp':true});



var ACCESS_TOKEN = fs.readFileSync("access_token.txt",{encoding:"utf8"});
console.log(ACCESS_TOKEN);

// statistics about the calls made
var stats = {
	fb_api_calls : 0,
	fb_api_calls_retries : 0,
	fb_api_calls_failed : 0,


	posts : 0,
	reactions : 0,
	comments 	: 0,

	time_start: Date.now(),

	log : function () {
		winston.info("*****")
		winston.info("  Running for %s seconds up till now", (Date.now()-this.time_start)/1000 )
		winston.info("  Facebook calls: %d, retries: %d, failed", 
					this.fb_api_calls, this.fb_api_calls_retries, this.fb_api_calls_failed);
		winston.info("  Processed results: %d posts, %d reactions, %d comments",
						this.posts, this.reactions, this.comments
		);
	}
};

var fields_query_string = 
	'message,story,description,created_time,update_time,from' + 
	',sharedposts.limit(100){from,message,created_time}' +
	',shares' +
	',reactions.summary(true).limit(100).order(reverse_chronological){name,type}' +
	',comments.summary(true).order(reverse_chronological).limit(100)' +
	'{' +
		 'from,message,created_time,update_time' +
		',reactions.summary(true).limit(100).order(reverse_chronological){name,type}' +
		',comments.summary(true).order(reverse_chronological).limit(100)' +
			'{' +
				'from,message,created_time,update_time' +
				',reactions.summary(true).limit(100).filter(stream).order(reverse_chronological){name,type}' +
			'}' +
	'}';

function FbBotScraper() {
	this.FB_URL= util.format(
		"https://graph.facebook.com/v2.9/%s/feed?fields=%s&limit=%d&access_token=%s",
			"me",
			fields_query_string,
			20,
			ACCESS_TOKEN
	);
	winston.info(this.FB_URL);
	this.users={}
	this.feed(this.FB_URL, ()=>{
		winston.info("----------------------------")
		winston.info("| Scraping finished!       |")
		winston.info("----------------------------")
		stats.log();

		// console.log(this.users)
		var score = Object.values(this.users);
		score.sort(
			(a,b) => {
				return b.total_score - a.total_score
			}
		)

		for (let i=0;i< ((score.length<20)?score.length:20);i++) {
			score[i].log();
		}
	});
}

FbBotScraper.prototype.feed = function (FB_URL, callback) {

	this.getPosts(FB_URL)
		.then( this.getCommentsAndLikes.bind(this)	)
		.then( this.fixAndUpdateStats.bind(this)	)
		.then( (result)=>{
			if (result && result.paging && result.paging.next) {
				stats.log();
				this.feed(result.paging.next, callback)
			} else {
				// finished
				callback();
			}
		} )
}

FbBotScraper.prototype.fixAndUpdateStats = function (result, level) {

	if (!result || !result.data) {
		return result;
	}
	let posts = result.data

	if (!level) {
		winston.log("info", "fixAndUpdateStats: %d posts", posts.length)
	}

	posts.forEach(
		(post) => {
			if (post.reactions) {
				// fix the reactions
				post.reactions.summary = {
					total_count : post.reactions.data.length
				}
				stats.reactions += post.reactions.summary.total_count;
			}
			if (post.comments) {
				// fix the comments
				post.comments.summary = {
					total_count : post.comments.data.length
				}
				stats.comments += post.comments.summary.total_count;
			}

			// recursively update everything bellow 
			this.fixAndUpdateStats(post.comments, 1)

			if (!level) {
				// score only top level posts
				this.scoreUsers(post, level);
			}
		}
	)

	if (!level) {
		// posts
		stats.posts += posts.length;
	} 
	

	return result;
}

FbBotScraper.prototype.scoreUsers = function (post, level) {
	if (!post) return;
	level = level || 0

	if (!level) {
		// post
		this.scoreUsers_IncStats(post.from.id, post.id, 1, 0, 0)
	} else {
		// comment or reply
		this.scoreUsers_IncStats(post.from.id, post.id, 0, 1, 0)
	}

	if (post.reactions && post.reactions.data) {
		post.reactions.data.forEach(
			(reaction) => {
				this.scoreUsers_IncStats(reaction.id, post.id, 0, 0, 1)
			}
		)
	}

	if (post.comments && post.comments.data) {
		post.comments.data.forEach(
			(comment) => {
				this.scoreUsers(comment,level+1)
			}
		)
	}
}


FbBotScraper.prototype.scoreUsers_IncStats = function (user_id, object_id, posts, comments, reactions) {
    if (!this.users[user_id]) {
        this.users[user_id] = {
            total_score : 0,
            posts : 0,
            comments : 0,
            reactions : 0,

            posts_history : [],
            comments_history : [],
            reactions_history : [],

            user_id : user_id,

            log : function () {
                winston.info("User %s: score: %d. Breakdown: l:%d, c:%d, p: %d",
                    this.user_id,
                    this.total_score, this.reactions, this.comments, this.posts,
                )
                winston.info("	Posts:", this.posts_history)
                winston.info("	Comments:", this.comments_history)
                winston.info("	Reactions:", this.reactions_history)
            },

            update : function() {
                this.total_score = Math.floor(
                    this.posts + 0.7*this.comments + 0.2*this.reactions
                )
            }
        }
    }
    let u = this.users[user_id]
    u.posts += posts
    u.comments += comments
    u.reactions += reactions
    u.update()
    
    if (posts) {
        u.posts_history.push(object_id)
    } else if (comments) {
        u.comments_history.push(object_id)
    } else {
        u.reactions_history.push(object_id)
    }

}



FbBotScraper.prototype.getPosts = function (FB_URL) {
	winston.log("info", "+++")
	winston.log("info", "getPosts: Requesting a new batch of posts")
	return new Promise(
		(success,reject) => {
			async.retry(
				{
					times: 5,
					interval: (retry_cout) => {
						return Math.pow(2, retry_cout) * 1000;
					}
				},
				this.process_request.bind(this, {FB_URL:FB_URL}),
				(err,posts) => {
					if (err) {
						stats.fb_api_calls_failed++
						reject(err)
					} else {
						success(posts)
					}
				}
			)
		}
	)
}

FbBotScraper.prototype.getCommentsAndLikes = function (result) {
	let posts = result.data;
	winston.info("getCommentsAndLikes: Working on %s posts", posts.length)

	return new Promise( 
		(success, reject) => {
			async.eachOfLimit(
				posts,
				20,
				this.getCommentsAndLikes_SinglePost.bind(this),
				(err,r) => {
					winston.info("getCommentsAndLikes: Finished working on %s posts. err: %s. result: %s",
									posts.length, err, r);
					success(result)
				}
			)
		}
	)
}

FbBotScraper.prototype.getCommentsAndLikes_SinglePost = function (post,key,callback) {
	// winston.log("info", "processPost(%s):  reactions: %s/%s, comments: %s/%s",
	// 						post.id,
	// 						post.reactions.data.length, post.reactions.summary.total_count,
	// 						post.comments.data.length, post.comments.summary.total_count
	// );

	this.getCommentsAndLikes_Comments(post)
		.then(this.getCommentsAndLikes_Likes.bind(this))
		.then(
			(post) => {
				winston.log("info", "getCommentsAndLikes_SinglePost(%s):  reactions: %s/%s, comments: %s/%s", 
							post.id,
							post.reactions.data.length, post.reactions.summary.total_count,
							post.comments.data.length, post.comments.summary.total_count
				);

				callback();
			}
		)
	return true;
}

FbBotScraper.prototype.getCommentsAndLikes_Comments = function (post) {
	if (!post.comments) {
		return Promise.resolve(post)
	}

	var comments_q = async.queue(
		this.getDataFromNext.bind(this),
		10
	)

	let params = {
		q: comments_q,
		type: "comments",
		post: post
	}

	return new Promise(
		(success,reject) => {

			if (post.comments.paging && post.comments.paging.next) {
				// there are more comments to the post
				params.FB_URL= post.comments.paging.next
				params.root= post.comments
				comments_q.push(params)
			}
			if (post.comments.data) {
				post.comments.data.forEach(
					(comment) => {
						if (comment.comments && comment.comments.paging && comment.comments.paging.next) {
							// there are more replies to this comment
							params.FB_URL= comment.comments.paging.next
							params.root= comment.comments
							comments_q.push(params)
						}						
					}
				)
			}
			if (comments_q.length()==0) {
				// no further processing is needed
				success(post)
			} else { 
				comments_q.drain = () => {
					success(post);
				}
			}
		}
	)
}

FbBotScraper.prototype.getCommentsAndLikes_Likes = function (post) {
	if (!post.reactions) {
		return Promise.resolve(post);
	}
	var reactions_q = async.queue(
		this.getDataFromNext.bind(this),
		10
	)
	let params = {
		q: reactions_q,
		type: "reactions",
		post: post
	}

	return new Promise(
		(success,reject) => {
			if (post.reactions.paging && post.reactions.paging.next) {
				// there are more reactions to the post
				params.FB_URL= post.reactions.paging.next
				params.root= post.reactions
				reactions_q.push(params)
			}
			if (post.comments.data) {
				post.comments.data.forEach(
					(comment) => {
						if (comment.reactions.paging && comment.reactions.paging.next) {
							// there are more reactions to this comment
							params.FB_URL= comment.reactions.paging.next
							params.root= comment.reactions
							reactions_q.push(params)
						}						
					}
				)
			}
			if (reactions_q.length()==0) {
				// no further processing is needed
				success(post)
			} else { 
				reactions_q.drain = () => {
					success(post);
				}
			}
		}
	)
}

FbBotScraper.prototype.getDataFromNext = function (params, callback) {
	// winston.log("info", "getDataFromNext: %s -> %s", params.type, params.FB_URL);
	params.FB_URL = params.FB_URL.replace( /,limit=(\d+)/, "limit=100" )
	
	async.retry(
		{
			times: 3,
			interval: 3000
		},
		this.process_request.bind(this, params),
		(err,res) => {
			if (err) {
				stats.fb_api_calls_failed++
				callback(err)
			} else {
				if (params.type=="comments") {
					// recursively check if those comments are complete
					winston.log("info", "getDataFromNext(%s): Recursively check if there is incomplete data in post", params.post.id);

					this.getCommentsAndLikes(res)
						.then( ()=>{
							this.getDataFromNext_UpdateResult(params,res);
							callback();
						})
				} else {
					// reactions 
					this.getDataFromNext_UpdateResult(params,res);
					callback();
				}
			}
		}
	)
}

FbBotScraper.prototype.getDataFromNext_UpdateResult = function (params,res) {
	params.root.data = params.root.data.concat(res.data)
	winston.log("info", "getDataFromNext(%s): %s: %s out of %s",
							params.post.id, params.type,
							params.root.data.length, params.root.summary.total_count)
	//update stats
	//params.root.summary.total_count = params.root.data.length;
	if (res.paging && res.paging.next){
		params.root.paging.next = res.paging.next
		params.FB_URL = params.root.paging.next;

		// get the next page
		params.q.push(params)
	} else {
		// no more results
		// fix the total count.. mostly it is wrong
		// params.root.summary.total_count = params.root.data.length
	}
}


FbBotScraper.prototype.process_request = function (params, callback) {
	stats.fb_api_calls ++;

	request(
		params.FB_URL,
		(error, response, res) => {
			if (!error && response.statusCode == 200) {
				//fs.appendFile("./logs/results.json", res);
				res = JSON.parse(res);

				
				// console.log(res.data.length);

				if (res.paging && res.paging.next) {
					//there is more data to be processed
					//this.processing_q.push({FB_URL: res.paging.next})
				}
				callback(null, res)
			} else {
				winston.error("Facebook error", error, res)
				stats.fb_api_calls_retries++
				callback({
					error: error,
					res: res
				})
			}
		}
	);
}


f  = new FbBotScraper
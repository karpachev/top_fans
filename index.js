var request = require("request");
var fs = require("fs");
var util = require("util");


var ACCESS_TOKEN = fs.readFileSync("access_token.txt",{encoding:"utf8"});
console.log(ACCESS_TOKEN);

// statistics about the calls made
var stats = {
	fb_api_calls : 1,

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

var fields_query_string = 
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
fields_query_string = fields_query_string.replace( /LIKES_LIMIT/g, 10000);
fields_query_string = fields_query_string.replace( /COMMETNS_LIMIT/g, 1000);

var feed = []; // contains the posts/comments/likes 
var backlog_requests = [] // requests to be fired later
var FB_URL= util.format(
	"https://graph.facebook.com/v2.9/%s/feed?fields=%s&limit=%d&access_token=%s",
		"me",
		fields_query_string,
		100,
		ACCESS_TOKEN
);
console.log(FB_URL);
feed_history(feed, [], FB_URL);


var feed_history_level= 0;
function feed_history(destination, data, next_url, item_type) 
{
	item_type = item_type || "post";
	feed_history_level++ ;
	fs.writeFileSync("./logs/results.json", JSON.stringify(feed));

	if (data && data.length>0) {
		process_posts(destination, data, item_type);
		check_incomplete_data(data);
	}

	if (!next_url) {
		feed_history_level-- ;
		return;
	}

	request(
		next_url,
		function (error, response, res) {
			feed_history_level-- ;
			stats.fb_api_calls++;
			if (!error && response.statusCode == 200) {
				//fs.appendFile("./logs/results.json", res);
				res = JSON.parse(res);

				

				if (res.paging && res.paging.next) {
					feed_history(destination, res.data, res.paging.next, item_type);
				} else {
					process_posts(destination, res.data, item_type);
					check_incomplete_data(res.data);
				}
			} else {
				console.log("Facebook error", error, res)
				setTimeout(
					function(){
						feed_history(destination, [], next_url, item_type);
					}
					,4000
				);
				
			}

			console.log("Feed history level: %s", feed_history_level);
			if (feed_history_level<=0) {
				// processing finished
				console.log("Memmroy used: %d Mb. Total posts: %d. Still to be processed objects: %d",	
					memory_consumption(feed)/1024/1024,
					feed.length,
					backlog_requests.length
				);
				if (feed.length>0)
				console.log("Latest post time: %s",
					feed[feed.length-1].created_time
				);
				stats.log();
			}
		}
	);
}

function check_incomplete_data(data) {
	console.log("Checking for incomplete data");
	data.forEach(function(obj,i){
		if (obj.likes && obj.likes.paging && obj.likes.paging.next) {
			// there is more data to be processed 
			feed_history(obj.likes.data, [], obj.likes.paging.next, "like")
			backlog_requests.push({
				data : obj.likes.data,
				next : obj.likes.paging.next
			});
		}
		if (obj.comments && obj.comments.paging && obj.comments.paging.next) {
			// there is more data to be processed 
			feed_history(obj.comments.data, [], obj.comments.paging.next, "comment")
			backlog_requests.push({
				data : obj.comments.data,
				next : obj.comments.paging.next
			});			
		}		
	});
}

function process_posts(feed, entries, item_type)
{
	item_type = item_type || "post";
	entries.forEach(function(entry,i){
		process.stdout.write(".");
		feed.push(entry);
	});
	stats[item_type+"s"]+= entries.length;

	console.log("Stored %d items", entries.length);
}

function do_rankings()
{
	console.log("Analyzing %s posts", feed.length);

	feed.forEach(function(post) {
		console.log("%s: %s", 
			post.created_time,
			post.message
		);
	});
}

function memory_consumption(obj)
{
	if ( obj === undefined
			|| obj === null
			|| typeof obj === "boolean"
	) {
		return 1;
	}
	if (typeof obj === "number") {
		return 8;
	}
	if (typeof obj === "string") {
		return 2*obj.length + 8;
	}

	var result = 0;
	if (obj.constructor === Array) {
		obj.forEach(function(el, i){
			result+= memory_consumption(el);
		});

		return result;
	}

	//object
	Object.keys(obj).forEach(function(key){
		if (obj.hasOwnProperty(key)) {
			result+= key.length;
			result+= memory_consumption(obj[key]);
		}
	});
	return result;
}
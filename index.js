var FB = require("fb");
var request = require("request");
var fs = require("fs");


var ACCESS_TOKEN = fs.readFileSync("access_token.txt",{encoding:"utf8"});
console.log(ACCESS_TOKEN);

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



var feed = [];

FB.setAccessToken(ACCESS_TOKEN);


FB.api(
	"/7329581606/feed"
	,{
			fields: 'message,story,description,created_time,from' + 
					',shares' +
					',likes.summary(true).limit(100).order(reverse_chronological){name}' +
					',comments.summary(true).order(reverse_chronological).limit(100)' +
						'{' +
							'from,message' +
							',likes.summary(true).limit(100).order(reverse_chronological){name}' +
							',comments.summary(true).order(reverse_chronological).limit(100)' +
								'{' +
									'from,message' +
									',likes.summary(true).limit(100).filter(stream).order(reverse_chronological){name}' +
								'}' +
						'}'
			,limit: 30
	}
	,function(res) {
		stats.fb_api_calls++;
		if(!res || res.error) {
			console.log(!res ? 'error occurred' : res.error);
			return;
		}

		try {fs.unlinkSync("./results.json");} catch (e) {}
		feed_history(feed, res.data, res.paging.next);
	}
);

function feed_history(destination, data, next_url) 
{
	fs.writeFileSync("results.json", JSON.stringify(feed));
	if (!next_url) return;

	if (data && data.length>0) {
		process_posts(destination, data);
		check_incomplete_data(data);
	}

	request(
		next_url,
		function (error, response, res) {
			stats.fb_api_calls++;
			if (!error && response.statusCode == 200) {
				//fs.appendFile("results.json", res);
				res = JSON.parse(res);

				

				if (res.paging && res.paging.next) {
					feed_history(destination, res.data, res.paging.next);
				} else {
					process_posts(destination, res.data);
					check_incomplete_data(res.data);
				}
			}
		}
	);
}

function check_incomplete_data(data) {
	console.log("Checking for incomplete data");
	data.forEach(function(obj,i){
		if (obj.likes && obj.likes.paging && obj.likes.paging.next) {
			// there is more data to be processed 
			feed_history(obj.likes.data, [], obj.likes.paging.next)
		}
	});
}

function process_posts(feed, posts)
{
	posts.forEach(function(post,i,posts){
		process.stdout.write(".");
		feed.push(post);
	});

	console.log("Stored %d posts", posts.length);
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
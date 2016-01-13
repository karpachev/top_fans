var FB = require("fb");
var request = require("request");
var fs = require("fs");


var ACCESS_TOKEN = fs.readFileSync("access_token.txt",{encoding:"utf8"});
console.log(ACCESS_TOKEN);



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
		if(!res || res.error) {
			console.log(!res ? 'error occurred' : res.error);
			return;
		}

		feed_history(feed, res.data, res.paging.next);
	}
);

function feed_history(destination, data, next_url) 
{
	if (!data || data.length==0) {
		return;
	}
	process_posts(destination, data);

	request(
		next_url,
		function (error, response, res) {
			if (!error && response.statusCode == 200) {
				res = JSON.parse(res);

				if (res.paging && res.paging.next) {
					feed_history(destination, res.data, res.paging.next);
				} else {
					process_posts(destination, data);
					do_rankings();
				}
			}
		}
	);
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
var FB = require("fb");
var request = require("request");
var fs = require("fs");


var ACCESS_TOKEN = fs.readFileSync("access_token.txt",{encoding:"utf8"});
console.log(ACCESS_TOKEN);



var feed = [];

FB.setAccessToken(ACCESS_TOKEN);

FB.api(
	"/komfo.bg/feed"
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
			,limit: 100
	}
	,function(res) {
		if(!res || res.error) {
			console.log(!res ? 'error occurred' : res.error);
			return;
		}

	    if (res.data) {
	    	process_posts(res.data);
	    }

		feed_history(res.paging.next);
	}
);

function feed_history(next_url) 
{
	request(
		next_url,
		function (error, response, res) {
			if (!error && response.statusCode == 200) {
				res = JSON.parse(res);
			    // console.dir(res);
			    if (res.data) {
			    	process_posts(res.data);
			    }


				if (res.paging && res.paging.next) {
					feed_history(res.paging.next);
				} else {
					extract_comments();
				}
			}
		}
	);
}

function process_posts(posts)
{
	posts.forEach(function(post,i,posts){
		process.stdout.write(".");
		feed.push(post);
	});

	console.log("Stored %d posts", posts.length);
}

function extract_comments()
{
	console.log("Extracting comments");
}
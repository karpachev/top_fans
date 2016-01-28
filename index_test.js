var fs = require("fs");
var moment = require("moment");
var extend = require("extend");

var FBScraper = require("./scrape_fb_page.js");
var util = require("util");


var ACCESS_TOKEN = "244758198909856|hfW7_SLhITnr1JMGY7uU7Nhyp60"; //fs.readFileSync("access_token.txt",{encoding:"utf8"});
var komfo_bg = new FBScraper({
	page_id : "komfo.bg"
	,access_token : ACCESS_TOKEN
	,limits : {
		 posts_limit : 5
		,include_comments : true
		,include_likes : true
		,likes_limit: 20
	}
	,period : {
	 	 from: moment().subtract(30,"days")
		,to: moment()
	}
});


komfo_bg.ScrapePage()
	.on("",function(){

	})
	.on("END",function(){
		console.log("End in main");

		for (var i=0;i<komfo_bg._feed.length;i++) {
			var post = komfo_bg._feed[i];
			remove_parents(post);
			//console.log(util.inspect(post));
			fs.writeFile(
				util.format("./logs/%s_results.json", post.id)
				,JSON.stringify(post,null,2)
			);
		}
		console.log("Dump complete");

		console.log( top_influencers(komfo_bg._feed) );
		top_engagment(komfo_bg._feed);
	});

function top_influencers(feed) {
	var users = {};

	for (var i=0;i<feed.length;i++) {
		var item = feed[i],
			user_id = item.from.id;

		users[user_id] = extend(
			users[user_id],
			{
				likes : number_likes(item)
				,comments : number_comments(item)
				,shares : number_shares(item)
				,user_name : item.from.name
			}
		);

		if (item.comments && item.comments.data) {
			var more_users = top_influencers(item.comments.data);

			for (u in more_users) {
				if (users.hasOwnProperty(u)) {
					users[u].likes += more_users[u].likes;
					users[u].comments += more_users[u].comments;
					users[u].shares += more_users[u].shares;
				} else {
					users[u] = more_users[u];
				}
			}
		}
	}

	return users;	
}

function number_likes(item) {
	var result = 0;
	if (item.likes && item.likes.summary && item.likes.summary.total_count ) {
		result += item.likes.summary.total_count;
	}
	return result;
}
function number_comments(item) {
	var result = 0;
	if (item.comments && item.comments.summary && item.comments.summary.total_count ) {
		result += item.likes.summary.total_count;
	}
	return result;
}
function number_shares(item) {
	var result = 0;
	if (item.shares && item.shares.count ) {
		result += item.shares.count;
	}
	return result;
}


function top_engagment(feed) {

}


function remove_parents(item) {
	item.__parent = "undefined";

	if (item.comments && item.comments.data) {
			for (var i=0;i<item.comments.data.length;i++) {
				remove_parents(item.comments.data[i]);
			}
	}
	if (item.likes && item.likes.data) {
			for (var i=0;i<item.likes.data.length;i++) {
				remove_parents(item.likes.data[i]);
			}
	}	
}

//console.log(komfo_bg.GetRootURL());	
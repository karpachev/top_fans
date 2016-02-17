var fs = require("fs");
var moment = require("moment");
var extend = require("extend");

var FBScraper = require("./scrape_fb_page.js");
var util = require("util");

start_scraping();

function test() {
	var feed = fs.readFileSync("./logs/feed.json");
	feed = JSON.parse(feed);

	var top_engagment_arr = [];
	top_engagment(feed, {}, top_engagment_arr);
	console.log("===========");
	console.log( top_engagment_arr );
}

function start_scraping()
{
	var ACCESS_TOKEN = "244758198909856|hfW7_SLhITnr1JMGY7uU7Nhyp60"; //fs.readFileSync("access_token.txt",{encoding:"utf8"});
	var komfo_bg = new FBScraper({
		page_id : "tdc"
		,access_token : ACCESS_TOKEN
		,limits : {
			 include_comments : true
			,include_likes : true
			// ,posts_limit : 5
			// ,likes_limit: 20
		}
		,period : {
		 	 from: moment().subtract(5,"months")
			,to: moment()
		}
	});


	komfo_bg.ScrapePage()
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

			var top_influencers_arr = [];
			top_influencers(komfo_bg._feed, {}, top_influencers_arr);
			console.log( top_influencers_arr );
			// fs.writeFileSync("./logs/feed.json",JSON.stringify(komfo_bg._feed,null,2));

			var top_engagment_arr = [];
			top_engagment(komfo_bg._feed, {}, top_engagment_arr);
			console.log("===========");
			console.log( top_engagment_arr );
		});
}


function top_influencers(feed, users_map, users, level) {
	console.log(level);
	for (var i=0;i<feed.length;i++) {
		var item = feed[i],
			user_id = item.from.id;

		if (!users_map.hasOwnProperty(user_id)) {
			// this is new user
			users.push({
				likes : 0
				,comments : 0
				,shares : 0
				,user : item.from
			});
			users_map[user_id] = users.length-1;
		}

		var index = users_map[user_id];
		users[index].likes += number_likes(item);
		users[index].comments += number_comments(item);
		users[index].shares += number_shares(item);

		if (item.comments && item.comments.data) {
			top_influencers(item.comments.data, users_map, users, 1);
		}
	}

	if (level==undefined) {
		users.sort(function(a,b){
			return b.likes + 1.2*b.comments + 1.7*b.shares
					- a.likes - 1.2*a.comments - 1.7*a.shares; 
		});	
	}
}

function number_likes(item) {
	var result = 0;
	// if (item.likes && item.likes.summary && item.likes.summary.total_count ) {
	// 	result += item.likes.summary.total_count;
	// }
	// return result;
	if (item.likes && item.likes.data) {
		for (var i=0;i<item.likes.data.length;i++) {
			var like_obj = item.likes.data[i];
			if (like_obj.id!=item.from.id) {
				result++;
			}
		}
	}
	return result;
}
function number_comments(item) {
	var result = 0;
	// if (item.comments && item.comments.summary && item.comments.summary.total_count ) {
	// 	result += item.comments.summary.total_count;
	// }
	// return result;
	if (item.comments && item.comments.data) {
		for (var i=0;i<item.comments.data.length;i++) {
			var comment_obj = item.comments.data[i];
			if (comment_obj.id!=item.from.id) {
				result++;
			}
		}
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


function top_engagment(feed, users_map, users, post_type, level) {

	post_type = post_type ? post_type : "posts";
	for (var i=0;i<feed.length;i++) {
		var item = feed[i],
			user_id = item.from?item.from.id:item.id;

		if (!users_map.hasOwnProperty(user_id)) {
			// this is new user
			users.push({
				likes : 0
				,comments : 0
				,posts : 0
				,user : {
					id : item.from?item.from.id:item.id,
					name : item.from?item.from.name:item.name
				}
			});
			users_map[user_id] = users.length-1;
		}

		var index = users_map[user_id];
		users[index][post_type] ++;

		if (item.comments && item.comments.data) {
			top_engagment(item.comments.data, users_map, users, "comments", 1);
		}
		if (item.likes && item.likes.data) {
			top_engagment(item.likes.data, users_map, users, "likes", 1);
		}
	}

	if (level==undefined) {
		users.sort(function(a,b){
			return b.likes + 1.2*b.comments + 1.7*b.posts
					- a.likes - 1.2*a.comments - 1.7*a.posts; 
		});	
	}
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


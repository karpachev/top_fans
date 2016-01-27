var fs = require("fs");
var moment = require("moment");

var FBScraper = require("./scrape_fb_page.js");
var util = require("util");


var ACCESS_TOKEN = "244758198909856|hfW7_SLhITnr1JMGY7uU7Nhyp60"; //fs.readFileSync("access_token.txt",{encoding:"utf8"});
var komfo_bg = new FBScraper({
	page_id : "komfo.bg"
	,access_token : ACCESS_TOKEN
	,limits : {
		 posts_limit : 13
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
	});

function remove_parents(item) {
	item.__parent = undefined;

	if (item.comments && item.comments.data) {
			for (var i=0;i<item.comments.data.length;i++) {
				remove_parents(item.comments.data[i]);
			}
	}
}

//console.log(komfo_bg.GetRootURL());	
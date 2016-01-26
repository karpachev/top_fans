var fs = require("fs");
var moment = require("moment");

var FBScraper = require("./scrape_fb_page.js");


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
	});


//console.log(komfo_bg.GetRootURL());	
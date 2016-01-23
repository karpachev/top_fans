var fs = require("fs");
var FBScraper = require("./scrape_fb_page.js");

var ACCESS_TOKEN = "244758198909856|hfW7_SLhITnr1JMGY7uU7Nhyp60"; //fs.readFileSync("access_token.txt",{encoding:"utf8"});
var komfo_bg = new FBScraper({
	page_id : "komfo.bg"
	,access_token : ACCESS_TOKEN
	,posts_limit : 13
	,include_comments : false
	,include_likes : false
});





console.log(komfo_bg.GetRootURL());	
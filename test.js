var url = require('url');

var url_string = "https://graph.facebook.com/v2.5/122386617773431_1171338522878230/comments?fields=from,message,likes.summary%28true%29.limit%281000%29.order%28reverse_chronological%29%7Bname%7D,comments.summary%28true%29.order%28reverse_chronological%29.limit%28100%29%7Bfrom,message,likes.summary%28true%29.limit%281000%29.filter%28stream%29.order%28reverse_chronological%29%7Bname%7D%7D&limit=100&summary=true&after=WTI5dGJXVnVkRjlqZFhKemIzSTZNVEUzTVRRek5qUTRPVFV6TlRFd01Eb3hORFUxTXpBek1EVTE%3D&order=reverse_chronological&access_token=244758198909856|hfW7_SLhITnr1JMGY7uU7Nhyp60";

var url_parsed = url.parse(url_string, true);

url_parsed.query.limit = 23;
delete url_parsed.search;
console.log(url_parsed);


var new_url = url.format(url_parsed);
console.log(new_url);
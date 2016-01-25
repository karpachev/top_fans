# top_fans
Top fans on your Facebook page

komfo.bg/feed?fields=message,story,description,created_time,from,
    likes.summary(true).limit(0).order(reverse_chronological){name},
    comments.summary(true).order(reverse_chronological).limit(0)
        {
            from,message,
            likes.summary(true).limit(100)
                        .filter(stream).order(reverse_chronological){name},
            comments.summary(true).order(reverse_chronological).limit(100)
            {
                from,message,
                likes.summary(true).limit(100)
                        .filter(stream).order(reverse_chronological){name}
            }
        },
    shares

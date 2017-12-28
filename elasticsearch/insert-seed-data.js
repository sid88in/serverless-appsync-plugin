# Insert tweets
curl -s -H "Content-Type: application/json" -XPOST https://search-appsync-x7f52bmdmtw4wno2xxjhxc47eu.us-east-1.es.amazonaws.com/_bulk --data-binary "@users.json"; echo

# Basic Stats
https://search-appsync-x7f52bmdmtw4wno2xxjhxc47eu.us-east-1.es.amazonaws.com/_stats

# Bool Query

All results of a given user (expected = 25)
{
    "query": {
        "bool": {
            "must": {
                "bool" : { "should": [
                      { "match": { "screen_name": "Charles.Hills" }} ] }
            }
        }
    }
}

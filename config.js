var editorName = "BusLanes";
var version = "0.2.0";

var useTestServer = false;

var urlOverpass = "https://overpass-api.de/api/interpreter?data=";
var urlJosm = "http://127.0.0.1:8111/import?url=";
var urlID = "https://www.openstreetmap.org/edit?editor=id";

var urlOsmTest = useTestServer
  ? "https://master.apis.dev.openstreetmap.org"
  : "https://www.openstreetmap.org";

var redirectPath = window.location.origin + window.location.pathname;
var auth = useTestServer
  ? osmAuth({
      url: urlOsmTest,
      oauth_consumer_key: "",
      oauth_secret: "",
      auto: true,
      //singlepage: true
    })
  : osmAuth({
      url: urlOsmTest,
      oauth_consumer_key: "a9CFoAHkYhEZY5G42NjdqsHKXazAZoJ1jtVn0fBV",
      oauth_secret: "sTeC2rplH0RZtyQVl6t2Qtoy8bOU4EFbv8p8rP5x",
      redirect_uri: redirectPath + "land.html",
      auto: true,
      //singlepage: true
    });

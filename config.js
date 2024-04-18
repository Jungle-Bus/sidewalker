var editorName = 'Luke Sidewalker'
var version = '0.0.1'

var useTestServer = false;

var urlOverpass = 'https://overpass-api.de/api/interpreter?data=';
var urlJosm = 'http://127.0.0.1:8111/import?url=';
var urlID = 'https://www.openstreetmap.org/edit?editor=id';

var urlOsm = useTestServer
    ? 'https://master.apis.dev.openstreetmap.org'
    : 'https://www.openstreetmap.org';

var redirectPath = window.location.origin + window.location.pathname;
console.log(redirectPath)
var auth = useTestServer
    ? osmAuth.osmAuth({
        url: urlOsm,
        client_id: "luke_sidewalker",
        redirect_uri: redirectPath + "land.html",
        scope: "read_prefs write_api",
        singlepage: false
    })
    : osmAuth.osmAuth({
        url: urlOsm,
        client_id: "A5-wd3saMmeWsH__bVeSTP1Qv4AmMz5_BheZ7-7Fk8g",
        redirect_uri: redirectPath + "land.html",
        scope: "read_prefs write_api",
        singlepage: false
    });

if (window.location.search.slice(1).split('&').some(function(p) { return p.indexOf('code=') === 0; })) {
    auth.authenticate(function() {
        history.pushState({}, null, window.location.pathname);
        checkOSMAuth();
    });
}
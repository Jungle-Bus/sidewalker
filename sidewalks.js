var map = L.map('map', { preferCanvas: true, fadeAnimation: false, zoomControl: false }).setView([48.83926, 2.6493], 17);;
var hash = new L.Hash(map);



L.tileLayer.grayscale('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
    attribution: '<a target="_blank" href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20,
}).addTo(map);

L.control.zoom({ position: "topright" }).addTo(map);
L.control.locate({ drawCircle: false, drawMarker: true, position: "topright" }).addTo(map);

//------------- Info control --------------------

L.Control.Info = L.Control.extend({
    onAdd: map => {
        var div = L.DomUtil.create('div', 'leaflet-control-layers control-padding control-bigfont control-button');
        div.innerHTML = 'Zoomez pour voir les cheminements';
        div.style.background = 'yellow';
        div.id = 'info';
        div.onclick = () => map.setZoom(viewMinZoom);
        return div;
    }
});

new L.Control.Info({ position: 'topright' }).addTo(map);

//------------- Fast control --------------------

L.Control.Fast = L.Control.extend({
    onAdd: map => {
        var div = L.DomUtil.create('div', 'leaflet-control-layers control-padding control-bigfont control-button');
        div.innerHTML = ' ';
        div.id = 'fast';
        div.onclick = downloadHere;
        return div;
    }
});

new L.Control.Fast({ position: 'topright' }).addTo(map);

//------------- Save control --------------------

L.Control.Save = L.Control.extend({
    onAdd: map => {
        var div = L.DomUtil.create('button', 'leaflet-control-layers control-padding control-bigfont');
        div.id = 'saveChangeset';
        div.innerText = 'Envoyer';
        div.style.background = 'yellow';
        div.style.display = 'none';
        div.onclick = createChangset;
        return div;
    }
});

new L.Control.Save({ position: 'topright' }).addTo(map);

//------------- Sidebar --------------------

var sidebar = L.control.sidebar('sidebar', { position: 'left' }).addTo(map);

//---------------------------------------------------
const footpathsLayer = L.layerGroup();
const surfacicFootpathsLayer = L.layerGroup();
const roadFootpathsLayer = L.layerGroup();
const sidewalkFixmeLayer = L.layerGroup();
const sidewalkNoLayer = L.layerGroup();
const sidewalkSeparateLayer = L.layerGroup();

const overlays = {
    'footpathsLayer': footpathsLayer,
    'surfacicFootpathsLayer': surfacicFootpathsLayer,
    'roadFootpathsLayer': roadFootpathsLayer,
    'sidewalkSeparateLayer': sidewalkSeparateLayer,
    'sidewalkNoLayer': sidewalkNoLayer,
    'sidewalkFixmeLayer': sidewalkFixmeLayer,
};
//var layerControl = L.control.layers({}, overlays).addTo(map);
footpathsLayer.addTo(map)
roadFootpathsLayer.addTo(map)
surfacicFootpathsLayer.addTo(map)

// --

var ways = {};
var nodes = {};

var lanes = {};
var markers = {};

var waysInRelation = {};

var offsetMajor = 6;
var weightMajor = 3;
var offsetMinor = 6;
var weightMinor = 3;

var change = {
    osmChange: {
        $version: '0.1',
        $generator: 'Sidewalker ' + version,
        modify: { way: [] },
        create: { way: [] }
    }
};

var lastBounds;

var editorMode = false;
var saving = false;

var viewMinZoom = 15;

var highwayRegex = new RegExp('^primary|secondary|tertiary|unclassified|residential|service|footway|pedestrian');


// ------------- functions -------------------

function checkOSMAuth() {
    if (auth.authenticated()) {
        document.getElementById("panel_no_auth").style.display = 'none';
        document.getElementById("panel_auth_ok").style.display = 'block';
    } else {
        document.getElementById("panel_no_auth").style.display = 'block';
        document.getElementById("panel_auth_ok").style.display = 'none';
    }
}

addHighwayCheckBox()
document.getElementById('editorcb').onchange = (chb) => {

    var checkAuth = function (err) {
        if (err) {
            document.getElementById('editorActive').style.color = 'red';
            auth.authenticate(checkAuth);
            checkOSMAuth()
        }
        else {
            editorMode = true;
            document.getElementById('editorActive').style.color = 'green';
            lastBounds = undefined;
            mapMoveEnd();
            checkOSMAuth()
        }
    };

    if (chb.currentTarget.checked) {
        auth.authenticate(checkAuth);
        document.getElementById("legend_more").style.display = 'block';
        sidewalkSeparateLayer.addTo(map);
        sidewalkNoLayer.addTo(map);
        sidewalkFixmeLayer.addTo(map);
    }
    else {
        editorMode = false;
        document.getElementById("legend_more").style.display = 'none';
        document.getElementById('editorActive').style.color = 'black';
        sidewalkSeparateLayer.removeFrom(map);
        sidewalkNoLayer.removeFrom(map);
        sidewalkFixmeLayer.removeFrom(map);

    }

};

function mapMoveEnd() {
    var zoom = map.getZoom();

    if (zoom <= 12) {
        offsetMajor = 1;
        weightMajor = 1;
        offsetMinor = 0.5;
        weightMinor = 0.5;
    } else if (zoom >= 13 && zoom <= 14) {
        offsetMajor = 1.5;
        weightMajor = 1.5;
        offsetMinor = 1;
        weightMinor = 1;
    } else if (zoom == 15) {
        offsetMajor = 3;
        weightMajor = 2;
        offsetMinor = 1.25;
        weightMinor = 1.25;
    } else if (zoom == 16) {
        offsetMajor = 5;
        weightMajor = 3;
        offsetMinor = 2;
        weightMinor = 1.5;
    } else if (zoom == 17) {
        offsetMajor = 7;
        weightMajor = 3;
        offsetMinor = 3;
        weightMinor = 1.5;
    } else if (zoom >= 18) {
        offsetMajor = 8;
        weightMajor = 4;
        offsetMinor = 3;
        weightMinor = 2;
    }

    for (var lane in lanes) {
        if (lane === 'right' || lane === 'left' || lane.startsWith('empty'))
            continue;
        var sideOffset
        if (lane.startsWith('middle') || lane.startsWith('separate'))
            sideOffset = 0
        else
            sideOffset = lanes[lane].options.offset > 0 ? 1 : -1;
        var isMajor = lanes[lane].options.isMajor;
        lanes[lane].setOffset(sideOffset * (isMajor ? offsetMajor : offsetMinor));
        lanes[lane].setStyle({ weight: (isMajor ? weightMajor : weightMinor) });
    }

    if (map.getZoom() < viewMinZoom) {
        document.getElementById("info").style.display = 'block';
        return;
    }

    document.getElementById("info").style.display = 'none';

    if (withinLastBbox())
        return;

    downloadHere();
}

function downloadHere() {
    lastBounds = map.getBounds();
    downloading(true);
    if (useTestServer)
        getContent(urlOsmTest + getQuerySidewalks(), parseContent);
    else
        getContent(urlOverpass + encodeURIComponent(getQuerySidewalks()), parseContent);
}

function downloading(downloading) {
    if (downloading)
        document.getElementById('fast').innerHTML = 'Téléchargement des données ... ';
    else
        document.getElementById('fast').innerHTML = '';
}

function withinLastBbox() {
    if (lastBounds == undefined)
        return false;

    var bounds = map.getBounds();
    return bounds.getWest() > lastBounds.getWest() && bounds.getSouth() > lastBounds.getSouth() &&
        bounds.getEast() < lastBounds.getEast() && bounds.getNorth() < lastBounds.getNorth();
}

function parseContent(content) {
    if (content.osm.node) {
        for (var obj of Array.isArray(content.osm.node) ? content.osm.node : [content.osm.node]) {
            nodes[obj.$id] = [obj.$lat, obj.$lon];
        }
    }

    if (content.osm.way) {
        content.osm.way = Array.isArray(content.osm.way) ? content.osm.way : [content.osm.way];
        for (var obj of content.osm.way.filter(x => x.tag != undefined)) {
            parseWay(obj);
        }
    }

    if (content.osm.realtion) {
        content.osm.realtion = Array.isArray(content.osm.realtion) ? content.osm.realtion : [content.osm.realtion];
        for (var obj of content.osm.relation) {
            for (var member of obj.member)
                if (member.$type === 'way' && ways[member.$ref])
                    waysInRelation[member.$ref] = true;
        }
    }

    downloading(false)
}

function parseWay(way) {
    if (!Array.isArray(way.tag))
        way.tag = [way.tag];
    if (lanes['right' + way.$id] || lanes['left' + way.$id] || lanes['empty' + way.$id])
        return;

    var isMajor = wayIsMajor(way.tag);

    if (typeof isMajor !== 'boolean')
        return;

    ways[way.$id] = way;

    var polyline = way.nd.map(x => nodes[x.$ref]);
    var emptyway = true;

    for (var side of ['right', 'left']) {
        if (hasSidewalk(side, way.tag)) {
            addLane(polyline, null, side, 'dodgerblue', way, isMajor ? offsetMajor : offsetMinor, isMajor, roadFootpathsLayer);
            emptyway = false;
        }
    }
    if (isSurfacicSidewalk(way.tag)) {
        addLane(polyline, null, 'middle', 'darkgoldenrod', way, offsetMinor, false, surfacicFootpathsLayer);
        emptyway = false;
    }
    else if (isDedicatedHighway(way.tag)) {
        addLane(polyline, null, 'middle', 'limegreen', way, isMajor ? offsetMajor : offsetMinor, isMajor, footpathsLayer);
        emptyway = false;
    }
    if (editorMode && isSidewalkSeparate(way.tag)) {
        addLane(polyline, null, 'separate', 'grey', way, isMajor ? offsetMajor : offsetMinor, isMajor, sidewalkSeparateLayer);
        emptyway = false;
    }
    if (editorMode && isNoSidewalk(way.tag)) {
        addLane(polyline, null, 'separate', 'grey', way, isMajor ? offsetMajor : offsetMinor, isMajor, sidewalkNoLayer);
        emptyway = false;
    }
    if (editorMode && emptyway && way.tag.filter(x => x.$k == 'highway' && highwayRegex.test(x.$v)).length > 0)
        addLane(polyline, null, 'empty', 'black', way, 0, isMajor, sidewalkFixmeLayer);
}

function confirmSide(side, tags) {
    return hasSidewalk(side, tags);
}

function hasSidewalk(side, tags) {

    if (side == 'right' &&
        tags.find(x => x.$k == 'sidewalk' && x.$v == 'right' || x.$k == 'sidewalk' && x.$v == 'both' || x.$k == 'sidewalk:right' && x.$v == 'yes'))
        return true;
    else if (side == 'left' &&
        tags.find(x => x.$k == 'sidewalk' && x.$v == 'left' || x.$k == 'sidewalk' && x.$v == 'both' || x.$k == 'sidewalk:left' && x.$v == 'yes'))
        return true;
    return false;
}

function isSurfacicSidewalk(tags) {
    return (tags.find(tg => tg.$k == 'area' && tg.$v == 'yes') && isFootway(tags))
}

function isFootway(tags) {
    return (tags.find(tg => tg.$k == 'highway' && (tg.$v == 'footway' || tg.$v == 'pedestrian' || tg.$v == 'steps')))
}
function hasFoot(tags) {
    return (tags.find(tg => tg.$k == 'foot' && (tg.$v == 'yes' || tg.$v == 'designated')))
}

function isSidewalkSeparate(tags) {
    return (tags.find(tg => tg.$k == 'sidewalk' && tg.$v == 'separate'))
}

function isNoSidewalk(tags) {
    return (tags.find(tg => tg.$k == 'sidewalk' && tg.$v == 'no'))
}

function isDedicatedHighway(tags) {
    return hasFoot(tags) || isFootway(tags);
}

function wayIsMajor(tags) {
    if (tags.find(x => x.$k == 'footway' && x.$v == 'crossing')) { return false; }
    if (tags.find(x => x.$k == 'highway' && x.$v == 'path')) { return false; }
    if (tags.find(x => x.$k == 'path' && x.$v == 'crossing')) { return false; }
    if (tags.find(x => x.$k == 'highway' && x.$v == 'steps')) { return false; }
    if (tags.find(x => x.$k == 'highway' && x.$v == 'living_street')) { return false; }
    if (tags.find(x => x.$k == 'highway' && x.$v == 'service')) { return false; }
    return true
}

function wayIsService(tags) {
    if (tags.find(x => x.$k == 'highway' && x.$v == 'service'))
        return true;
    return false;
}


function getContent(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = () => callback(JXON.stringToJs(xhr.responseText));
    xhr.send();
}

function addLane(line, conditions, side, color, osm, offset, isMajor, layer) {
    var id = side + osm.$id;

    var lanes_offsets = {
        'empty': -offset,
        'left': -offset,
        'right': offset,
        'middle': 0
    }

    lanes[id] = L.polyline(line,
        {
            color: color,
            weight: isMajor ? weightMajor : weightMinor,
            offset: lanes_offsets[side],
            conditions: conditions,
            osm: osm,
            isMajor: isMajor
        })
        .on('click', showLaneInfo)
        .addTo(layer);
}

function showLaneInfo(e) {
    closeLaneInfo(e);
    var footwayInfoDetails = document.getElementById('footwayInfoDetails');
    footwayInfoDetails.appendChild(getLaneInfoPanelContent(e.target.options.osm));
    footwayInfoDetails.style.display = 'block';
    var footwayInfoPlaceholder = document.getElementById('footwayInfoPlaceholder');
    footwayInfoPlaceholder.style.display = 'none';
    sidebar.open("footwayInfo");
    map.originalEvent.preventDefault();

}

function getQuerySidewalks() {
    var bounds = map.getBounds();
    if (useTestServer) {
        var bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',');
        return '/api/0.6/map?bbox=' + bbox;
    } else {
        var bbox = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].join(',');
        return editorMode
            ? '[out:xml];(way[highway~"^primary|secondary|tertiary|unclassified|residential|cycleway|service|footway|pedestrian|steps|path"](' + bbox + ');)->.a;(.a;.a >;.a <;);out meta;'
            : '[out:xml];(way["highway"][sidewalk](' + bbox + ');way["highway"]["sidewalk:left"](' + bbox + ');way["highway"]["sidewalk:right"](' + bbox + ');way["highway"~"footway|pedestrian|steps|cycleway|path"](' + bbox + ');)->.a;(.a;.a >;);out meta;';
    }
}

function getQueryOsmId(id) {
    return '[out:xml];(way(id:' + id + ');>;way(id:' + id + ');<;);out meta;';
}

function getLaneInfoPanelContent(osm) {
    setBacklight(osm);

    /*
    if (editorMode) {
        var form = document.createElement("form");
        form.setAttribute('id', osm.$id);
        form.onsubmit = (e) => {
            save(e);
            closeLaneInfo();
        };

        var dl = document.createElement('dl');
        if (wayIsService(osm.tag)) {
            dl.appendChild(getTagsBlock('middle', osm));
        } else {
            for (var side of ['right', 'left'].map(x => getTagsBlock(x, osm)))
                dl.appendChild(side);
        }
        form.appendChild(dl);

        var submit = document.createElement('input');
        submit.setAttribute('type', 'submit');
        submit.setAttribute('value', 'Apply');
        form.appendChild(submit);

        var cancel = document.createElement('input');
        cancel.setAttribute('type', 'reset');
        cancel.setAttribute('value', 'Cancel');
        cancel.onclick =  () => removeFromOsmChangeset(osm.$id);
        form.appendChild(cancel);

        var div = document.createElement('div');
        div.id = 'infoContent';
        div.appendChild(head);
        div.appendChild(document.createElement('hr'));
        div.appendChild(form);

        return div;
    }
    else */{
        var onlyOneSide = false;
        var ParseTagsFromHighway = function (tags) {
            var check_if_sidewalk = false

            var highway_type = "Cheminement piéton"
            if (tags.find(tg => tg.$k == 'highway' && tg.$v == 'steps')) {
                highway_type = "Escalier"
            } else if (isSurfacicSidewalk(tags) && tags.find(tg => tg.$k == 'highway' && tg.$v == 'pedestrian')) {
                highway_type = "Place piétonne surfacique"
            } else if (isSurfacicSidewalk(tags)) {
                highway_type = "Trottoir surfacique"
            } else if (tags.find(tg => tg.$k == 'highway' && tg.$v == 'pedestrian')) {
                highway_type = "Rue piétonne"
            } else if (tags.find(tg => tg.$k == 'highway' && tg.$v == 'footway') && tags.find(tg => tg.$k == 'footway' && tg.$v == 'sidewalk')) {
                highway_type = "Trottoir"
            } else if (tags.find(tg => tg.$k == 'highway' && tg.$v == 'footway') && tags.find(tg => tg.$k == 'footway' && tg.$v == 'access_aisle')) {
                highway_type = "Cheminement piéton d'accès au stationnement"                
            } else if (tags.find(tg => tg.$k == 'highway' && tg.$v == 'footway') && tags.find(tg => tg.$k == 'footway' && tg.$v == 'traffic_island')) {
                highway_type = "Îlot de refuge"
            } else if (tags.find(tg => tg.$k == 'highway' && tg.$v == 'footway') && tags.find(tg => tg.$k == 'footway' && tg.$v == 'crossing')) {
                highway_type = "Passage piéton"
            } else if (tags.find(tg => tg.$k == 'foot' && tg.$v == 'designated') && tags.find(tg => tg.$k == 'path' && tg.$v == 'crossing')) {
                highway_type = "Passage piéton"                
            } else if (tags.find(tg => tg.$k == 'highway' && tg.$v == 'footway') && tags.find(tg => tg.$k == 'indoor' && tg.$v == 'yes')) {
                highway_type = "Cheminement en intérieur"
            } else if (tags.find(tg => tg.$k == 'highway' && tg.$v == 'footway')) {
                highway_type = "Cheminement piéton"
            } else if (tags.find(tg => tg.$k == 'foot' && tg.$v == 'yes') || tags.find(tg => tg.$k == 'foot' && tg.$v == 'designated')) {
                highway_type = "Cheminement accessible aux piétons"
            } else {
                highway_type = "Rue"
                check_if_sidewalk = true
            }

            const highway_properties = [];
            if (tags.find(tg => tg.$k == 'name')) {
                var tag = osm.tag.filter(tg => tg.$k == 'name');
                highway_properties.push(`<b>${tag[0]['$v']}</b>`);
            }
            if (tags.find(tg => tg.$k == 'lit')) {
                var tag = osm.tag.filter(tg => tg.$k == 'lit');
                const lit_mapping = {
                    "yes": "Est éclairé",
                    "no": "N'est pas éclairé",
                }
                highway_properties.push(`${lit_mapping[tag[0]['$v']]}`);
            }
            if (tags.find(tg => tg.$k == 'width')) {
                var tag = osm.tag.filter(tg => tg.$k == 'width');
                highway_properties.push(`Largeur : <i>${tag[0]['$v']}</i> m`);
            } else if (tags.find(tg => tg.$k == 'est_width')) {
                var tag = osm.tag.filter(tg => tg.$k == 'est_width');
                highway_properties.push(`Largeur approx. : <i>${tag[0]['$v']}</i> m`);
            }

            if (tags.find(tg => tg.$k == 'surface')) {
                var tag = osm.tag.filter(tg => tg.$k == 'surface');
                highway_properties.push(`Revêtement : <i>${tag[0]['$v']}</i>`);
            }
            if (tags.find(tg => tg.$k == 'smoothness')) {
                var tag = osm.tag.filter(tg => tg.$k == 'smoothness');
                highway_properties.push(`Confort d'usage : <i>${tag[0]['$v']}</i>`);
            }

            if (tags.find(tg => tg.$k == 'incline')) {
                var tag = osm.tag.filter(tg => tg.$k == 'incline');
                if (tag[0]['$v'] == "up" || tag[0]['$v'] == "down") {
                    highway_properties.push(`Cheminement en pente`);
                } else {
                    highway_properties.push(`Pente : <i>${tag[0]['$v']}</i> %`);
                }
            }
            if (tags.find(tg => tg.$k == 'incline:across')) {
                var tag = osm.tag.filter(tg => tg.$k == 'incline:across');
                highway_properties.push(`Pente latérale : <i>${tag[0]['$v']}</i> %`);
            }

            if (tags.find(tg => tg.$k == 'step_count')) {
                var tag = osm.tag.filter(tg => tg.$k == 'step_count');
                highway_properties.push(`Nombre de marches : <i>${tag[0]['$v']}</i>`);
            } else if (tags.find(tg => tg.$k == 'est_step_count')) {
                var tag = osm.tag.filter(tg => tg.$k == 'est_step_count');
                highway_properties.push(`Nombre approx. de marches : <i>${tag[0]['$v']}</i>`);
            }
            if (tags.find(tg => tg.$k == 'tactile_paving') || tags.find(tg => tg.$k == 'guide_strips')) {
                highway_properties.push(`Guidage podotactile disponible`);
            }

            //TODO :
            // wheelchair
            // all crossing tags

            let prop_as_text = ""
            function display_properties(value, index, array) {
                prop_as_text += `<li>${value}</li>`;
            }
            highway_properties.forEach(display_properties);


            var sidewalk_tag = "pas d'info sur les trottoirs de cette rue"
            if (tags.find(tg => tg.$k == 'sidewalk' && tg.$v == 'both')) {
                var sidewalk_tag = "trottoir des deux côtés"
            } else if (tags.find(tg => tg.$k == 'sidewalk' && tg.$v == ('right' || 'left'))) {
                var sidewalk_tag = "trottoir d'un côté uniquement"
            } else if (tags.find(tg => tg.$k == ('sidewalk:left' || 'sidewalk:right') && tg.$v == 'yes')) {
                var sidewalk_tag = "trottoir d'un côté uniquement"
            }
            var tagsBlock = document.createElement('div');

            var edit_buttons = `
            <div class="w3-bar">
                <button class="w3-button w3-black w3-border w3-round-large" onclick="set_sidewalk_tag(${osm.$id},'no')">Pas de trottoir ici</button>
            </div>
            <div class="w3-bar">
                <button class="w3-button w3-green w3-border w3-round-large" onclick="set_sidewalk_tag(${osm.$id},'separate')">Trottoir déjà cartographié</button> (en vert sur la carte)
            </div>
            <h6>Éditeurs externes</h6>
            `
            if (!editorMode) {
                var edit_buttons = ''
            }

            tagsBlock.innerHTML = `
            <div>
                <div class="w3-content">
                    <h4 class="w3-opacity"><b><span id="object_name_html">${highway_type}</span></b></h4>              
                    <div class="w3-container w3-card w3-white w3-margin-bottom">
                        <div class="w3-container">
                        <h5 class="w3-opacity"><b>Propriétés</b></h5>
                        <ul>
                            ${check_if_sidewalk ? sidewalk_tag : prop_as_text}
                        </ul>
                        </div>
                    </div>
                    <p></p>
                    <div>
                    <div class="w3-container w3-card w3-white w3-margin-bottom">
                        <div class="w3-container">
                        <h5 class="w3-opacity"><b>Modifier</b></h5>
                        ${check_if_sidewalk ? edit_buttons : ""}

                        <div class="w3-bar">
                            <a class="w3-bar-item" target="_blank" href="http://localhost:8111/load_object?objects=w${osm.$id}"><img src="images/logo/josm.png" alt="JOSM icon"
                                style="width:60px"> JOSM</a>
                            <a class="w3-bar-item" target="_blank" href="https://www.openstreetmap.org/edit?editor=id&way=${osm.$id}"><img src="images/logo/iD.png" alt="ID icon"
                                style="width:60px">iD</a>
                            <a class="w3-bar-item" onclick="sidebar.open('mobileEdit')" style="text-decoration: underline;"><img src="images/logo/streetcomplete.svg" alt="StreetComplete icon"
                                style="width:60px">StreetComplete</a>
                        </div>
                        <p><i class="w3-margin-right">🔗</i><a href="https://openstreetmap.org/way/${osm.$id}" target="_blank">Voir
                            sur OpenStreetMap</a></p>
                        </div>
                    </div>
                    </div>
                </div>
                </div>
            `

            return tagsBlock;
        }

        var div = document.createElement('div');
        div.id = 'infoContent';
        div.appendChild(ParseTagsFromHighway(osm.tag));

        return div;
    }
}

function addHighwayCheckBox() {
    var div = document.createElement('div');
    div.innerHTML = `
    <label class="toggle">
                    <input class="toggle-checkbox" type="checkbox" id="editorcb">
                    <div class="toggle-switch"></div>
                    <span id="editorActive" class="toggle-label"> Afficher toutes les rues (mode édition)</span>
                </label>`
    var parent = document.getElementById("home");
    parent.appendChild(div)
}

function setBacklight(osm) {
    var onlyOneSide = false;
    var polyline = [];
    if (lanes['right' + osm.$id]) {
        polyline = lanes['right' + osm.$id].getLatLngs();
    } else if (lanes['left' + osm.$id]) {
        polyline = lanes['left' + osm.$id].getLatLngs();
    } else if (lanes['middle' + osm.$id]) {
        polyline = lanes['middle' + osm.$id].getLatLngs();
        onlyOneSide = true;
    } else {
        polyline = lanes['empty' + osm.$id].getLatLngs();
    };

    if (wayIsService(osm.tag)) {
        onlyOneSide = true;
    };

    var n = 3;

    lanes['middle'] = L.polyline(polyline,
        {
            color: 'fuchsia',
            weight: offsetMajor * n - 4,
            offset: 0,
            opacity: 0.4
        })
        .addTo(map);

    /*if (onlyOneSide){
        lanes['middle'] = L.polyline(polyline,
            {
                color: 'limegreen',
                weight: offsetMajor * n - 4,
                offset: 0,
                opacity: 0.4
            })
            .addTo(map);

    } else {
        lanes['right'] = L.polyline(polyline,
            {
                color: 'fuchsia',
                weight: offsetMajor * n - 4,
                offset: offsetMajor * n,
                opacity: 0.4
            })
            .addTo(map);

        lanes['left'] = L.polyline(polyline,
            {
                color: 'cyan',
                weight: offsetMajor * n - 4,
                offset: -offsetMajor * n,
                opacity: 0.4
            })
            .addTo(map);
    }*/
}


function set_sidewalk_tag(osm_id, sidewalk_value) {

    var osm = ways[osm_id];
    //prepare data for OSM edit
    if (osm.tag.find(tg => tg.$k == 'sidewalk')) {
        osm.tag.find(tg => tg.$k == 'sidewalk').$v = sidewalk_value
    } else {
        osm.tag.push({ $k: 'sidewalk', $v: sidewalk_value })
    }
    //remove sidewalk:left & sidewalk:right tags if any
    if (osm.tag.find(tg => tg.$k == 'sidewalk:left')) {
        var index = osm.tag.indexOf(osm.tag.find(tg => tg.$k == 'sidewalk:left'));
        osm.tag.splice(index, 1);
    }
    if (osm.tag.find(tg => tg.$k == 'sidewalk:right')) {
        var index = osm.tag.indexOf(osm.tag.find(tg => tg.$k == 'sidewalk:right'));
        osm.tag.splice(index, 1);
    }

    //find the already displayed lanes
    var polyline = [];
    if (lanes['right' + osm_id]) {
        polyline = lanes['right' + osm_id].getLatLngs();
    } else if (lanes['left' + osm_id]) {
        polyline = lanes['left' + osm_id].getLatLngs();
    } else if (lanes['middle' + osm_id]) {
        polyline = lanes['middle' + osm_id].getLatLngs();
    } else {
        polyline = lanes['empty' + osm_id].getLatLngs();
    };
    var isMajor = wayIsMajor(osm.tag);
    //add new lane display
    if (sidewalk_value == "no") {
        var layer = sidewalkNoLayer
    } else { var layer = sidewalkSeparateLayer }
    addLane(polyline, null, 'separate', 'grey', osm, isMajor ? offsetMajor : offsetMinor, isMajor, layer);
    //remove display ed lanes
    if (lanes['empty' + osm_id]) {
        lanes['empty' + osm_id].remove();
        delete lanes['empty' + osm_id];
    }
    for (var side of ['right', 'left']) {
        var id = side == 'right' ? 'right' + osm_id : 'left' + osm_id;
        if (lanes[id]) {
            lanes[id].remove();
            delete lanes[id];
        }
    }

    prepare_changeset(osm);
    closeLaneInfo();
}


function prepare_changeset(osm) {

    delete osm.$user;
    delete osm.$uid;
    delete osm.$timestamp;

    var index = change.osmChange.modify.way.findIndex(x => x.$id == osm.$id);

    if (osm.$id > 0) {
        var index = change.osmChange.modify.way.findIndex(x => x.$id == osm.$id);
        if (index > -1)
            change.osmChange.modify.way[index] = osm;
        else
            change.osmChange.modify.way.push(osm);
    } else {
        var index = change.osmChange.create.way.findIndex(x => x.$id == osm.$id);
        if (index > -1)
            change.osmChange.create.way[index] = osm;
        else
            change.osmChange.create.way.push(osm);
    }

    changesCount = change.osmChange.modify.way.length + change.osmChange.create.way.length;
    document.getElementById('saveChangeset').innerText = 'Envoyer sur OSM (' + changesCount + ' modifs.)';
    document.getElementById('saveChangeset').style.display = 'block';

    return false;
}


function removeFromOsmChangeset(id) {
    var form = document.getElementById(id);
    form.reset();
    form['lanes:psv:forward'].onchange();

    var index = change.osmChange.modify.way.findIndex(x => x.$id == id);

    if (index > -1)
        change.osmChange.modify.way.splice(index, 1);

    changesCount = change.osmChange.modify.way.length + change.osmChange.create.way.length;
    if (changesCount == 0)
        document.getElementById('saveChangeset').style.display = 'none';
    document.getElementById('saveChangeset').innerText = 'Save (' + changesCount + ')';

    closeLaneInfo();
}

function saveChangesets(changesetId) {
    for (var way of change.osmChange.modify.way)
        way.$changeset = changesetId;
    for (var way of change.osmChange.create.way)
        way.$changeset = changesetId;

    var path = '/api/0.6/changeset/' + changesetId + '/upload';
    console.log(change)
    var text = JXON.jsToString(change);

    auth.xhr({
        method: 'POST',
        path: path,
        options: { header: { 'Content-Type': 'text/xml' } },
        content: text
    }, function (err, details) {
        closeChangset(changesetId);
    });
}

function closeChangset(changesetId) {
    var path = '/api/0.6/changeset/' + changesetId + '/close';

    auth.xhr({
        method: 'PUT',
        options: { header: { 'Content-Type': 'text/xml' } },
        path: path
    }, function (err, details) {
        document.getElementById('saveChangeset').style.display = 'none';
        for (var way of change.osmChange.modify.way) {
            way.$version = parseInt(way.$version) + 1;
        }
        change.osmChange.modify.way = [];
        change.osmChange.create.way = [];
        saving = false;
    });
}
function createChangset() {
    if (saving)
        return;
    saving = true;

    var path = '/api/0.6/changeset/create';

    var change = {
        osm: {
            changeset: {
                tag: [
                    { $k: 'created_by', $v: editorName + ' ' + version },
                    { $k: 'comment', $v: 'Sidewalk modification' }]
            }
        }
    };

    var text = JXON.jsToString(change);

    auth.xhr({
        method: 'PUT',
        path: path,
        options: { header: { 'Content-Type': 'text/xml' } },
        content: text
    }, function (err, details) {
        if (!err)
            saveChangesets(details);
        else {
            console.error(err)
        }
    });
}

function closeLaneInfo(e) {
    var footwayInfoDetails = document.getElementById('footwayInfoDetails');
    footwayInfoDetails.style.display = 'none';
    footwayInfoDetails.innerHTML = '';
    var footwayInfoPlaceholder = document.getElementById('footwayInfoPlaceholder');
    footwayInfoPlaceholder.style.display = 'block';
    sidebar.close();

    for (var marker in markers) {
        markers[marker].remove();
        delete markers[marker];
    }

    if (lanes['right'])
        lanes['right'].remove();
    if (lanes['left'])
        lanes['left'].remove();
    if (lanes['middle'])
        lanes['middle'].remove();
}

//---------------------------------------------------

checkOSMAuth()
map.on('moveend', mapMoveEnd);
map.on('click', closeLaneInfo);
mapMoveEnd();

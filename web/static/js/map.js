//
// Copyright 2016-2017 Matt Hostetter.
// 
// This is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 3, or (at your option)
// any later version.
// 
// This software is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this software; see the file COPYING.  If not, write to
// the Free Software Foundation, Inc., 51 Franklin Street,
// Boston, MA 02110-1301, USA.
// 

var locationInfoWindow; // Global info window, only one can be displayed at a time
var planeMarkers = new Array(); // Global array of plane markers
// var planeMarkers = new google.maps.MVCArray();
var planeInfoWindows = new Array();
var planeLatLngs = new Array(); // Global array of array of plane locations, used to draw flight paths
var planePolyLines = new Array(); // Global array of arrary of plane flight path lines

// Array of colors in a gradient of red (index 0) to blue (index N-1)
var colorGradient = [
  '#FF0004',
  '#FE1300',
  '#FE2B00',
  '#FD4300',
  '#FD5B00',
  '#FD7300',
  '#FC8A00',
  '#FCA200',
  '#FBBA00',
  '#FBD200',
  '#FBE900',
  '#F4FA00',
  '#DCFA00',
  '#C4F900',
  '#ACF900',
  '#94F900',
  '#7CF800',
  '#64F800',
  '#4DF800',
  '#35F700',
  '#1DF700',
  '#06F600',
  '#00F611',
  '#00F628',
  '#00F53F',
  '#00F556',
  '#00F56E',
  '#00F485',
  '#00F49C',
  '#00F3B2',
  '#00F3C9',
  '#00F3E0',
  '#00EEF2',
  '#00D6F2',
  '#00BFF1',
  '#00A8F1',
  '#0091F1',
  '#0079F0',
  '#0062F0',
  '#004BEF'
];

function initialize() {
  var grey_styles = [{"stylers":[{"saturation":-100},{"gamma":1}]},{"elementType":"labels.text.stroke","stylers":[{"visibility":"off"}]},{"featureType":"poi.business","elementType":"labels.text","stylers":[{"visibility":"off"}]},{"featureType":"poi.business","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"poi.place_of_worship","elementType":"labels.text","stylers":[{"visibility":"off"}]},{"featureType":"poi.place_of_worship","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"geometry","stylers":[{"visibility":"simplified"}]},{"featureType":"water","stylers":[{"visibility":"on"},{"saturation":50},{"gamma":0},{"hue":"#50a5d1"}]},{"featureType":"administrative.neighborhood","elementType":"labels.text.fill","stylers":[{"color":"#333333"}]},{"featureType":"road.local","elementType":"labels.text","stylers":[{"weight":0.5},{"color":"#333333"}]},{"featureType":"transit.station","elementType":"labels.icon","stylers":[{"gamma":1},{"saturation":50}]}];
  grey_styles.push(
    {
      "featureType": "poi.park",
      "elementType": "geometry.fill",
      "stylers": [
        {"visibility": "simplified"},
      ]
    }
  );
  grey_styles.push(
    {
      "featureType": "transit.station.airport",
      "elementType": "geometry.fill",
      "stylers": [
        {"color": "#000000"},
        {"lightness": 50},
        {"saturation": 0},
      ]
    }
  );

  var map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 38.8976451, lng: -77.0367452},
    zoom: 8,
    styles: grey_styles
  });

  map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
  // map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
  // map.setMapTypeId(google.maps.MapTypeId.TERRAIN);
  // map.setMapTypeId(google.maps.MapTypeId.HYBRID);
  
	function initMap(initialLocation) {
        console.log("init map")
        map.setCenter(initialLocation);
        // init marker
        marker = new google.maps.Marker({
            position: initialLocation,
            draggable: true,
            map: map,
            title: "You are here"
        });
		google.maps.event.addListener(marker, 'dragend', function () {
            // you know you'd be better off with 
            // marker.getPosition().lat(), right?
            var lat=marker.getPosition().lat()
            var lng=marker.getPosition().lng()
            socket.emit("updatePos",lat,lng)
        });
	}

  // Try HTML5 geolocation
  locationInfoWindow = new google.maps.InfoWindow({map: map});
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      locationInfoWindow.setPosition(pos);
      locationInfoWindow.setContent('Location found.');
      map.setCenter(pos);
      initMap(new google.maps.LatLng(
                          position.coords.latitude, position.coords.longitude
                      ))
    }, function() {
      handleLocationError(true, locationInfoWindow, map.getCenter());
    });
  } else {
    // Browser doesn't support Geolocation
    handleLocationError(false, locationInfoWindow, map.getCenter());
  }

  // Create SocketIO instance
  var socket = io('http://0.0.0.0:5000');
  
  socket.on('connect', function() {
    console.log('Client has connected via SocketIO.');
  });
  socket.on('disconnect', function() {
    console.log('Client disconnected via SocketIO.');
  });
  socket.on('updatePlane', function(plane) {
    updatePlane(map, plane);
  });

  // google.maps.event.addDomListener(window, 'load', initialize);
}


function updatePlane(map, plane) {
  if (planeMarkers[plane.icao] == undefined) {
    // Add plane marker to the map
    addPlane(map, plane);
  }
  else {
    // Move plane marker and update path
    movePlane(map, plane);
  }
}


function addPlane(map, plane) {
  // Set the initial altitude of the plane
  color = getAltitudeColor(plane.altitude);

  // Set the initial heading of the plane
  rotation = getRotation(plane.heading);

  var arrow = {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: 'black',
    strokeOpacity: 1.0,
    strokeWeight: 1.5,
    rotation: rotation,
    scale: 4
  };

  var location = new google.maps.LatLng(plane.latitude, plane.longitude);

  // Add new plane marker
  planeMarkers[plane.icao] = new google.maps.Marker({
    position: location,
    icon: arrow,
    title: plane.callsign,
    map: map
  });

  // Create info window
  planeInfoWindows[plane.icao] = new google.maps.InfoWindow({
    content: getInfoString(plane)
  });

  // Initialize an array of locations for this plane
  planeLatLngs[plane.icao] = new Array();
  planePolyLines[plane.icao] = new Array();
  planeLatLngs[plane.icao][0] = {lat: Number(plane.latitude), lng: Number(plane.longitude)};

  google.maps.event.addListener(planeMarkers[plane.icao], 'click', function() {
    planeInfoWindows[plane.icao].open(map, this);
  });
}


function movePlane(map, plane) {
  // Add new plane location to paths array
  position_idx = planeLatLngs[plane.icao].length;
  planeLatLngs[plane.icao][position_idx] = {lat: Number(plane.latitude), lng: Number(plane.longitude)};

  // Get the altitude color
  color = getAltitudeColor(plane.altitude);

  // Draw new line between the previous location and current location
  planePolyLines[plane.icao][position_idx-1] = new google.maps.Polyline({
    path: [planeLatLngs[plane.icao][position_idx-1], planeLatLngs[plane.icao][position_idx]],
    geodesic: true,
    strokeColor: color,
    strokeOpacity: 1.0,
    strokeWeight: 3,
    map: map
  });

  var icon = planeMarkers[plane.icao].getIcon();

  // Update the plane's heading
  icon.rotation = getRotation(plane.heading);
  icon.fillColor = color;
  planeMarkers[plane.icao].setIcon(icon);

  // Move plane marker to new location
  var new_location = new google.maps.LatLng(plane.latitude, plane.longitude);
  planeMarkers[plane.icao].setPosition(new_location);
  planeMarkers[plane.icao].setTitle(plane.callsign);
  planeInfoWindows[plane.icao].setContent(getInfoString(plane));
}


// function removePlane(map, plane) {
//   if (planeMarkers[plane.icao] != undefined) {
//     // Remove plane from map
//     console.log('Need to remove this plane.', plane);

//     // Delete all polylines
//     for (var idx = 0; idx < planePolyLines[plane.icao].length; idx++) {
//       planePolyLines[plane.icao].setMap(null);
//     }

//     // Delete plane marker
//     planeMarkers[plane.icao].setMap(null);
//   }
// }


function getAltitudeColor(altitude) {
  if (altitude != undefined && altitude != -1) {
    idx = Math.floor(altitude/1000);
    if (idx >= colorGradient.length) {
      idx = colorGradient.length - 1;
    }

    color = colorGradient[idx];
  }
  else {
    color = 'black';
  }

  return color;
}


function getRotation(heading) {
  rotation = -1*heading + 90.0;
  if (rotation < 0) {
    rotation += 360;
  }

  return rotation;
}


function getInfoString(plane) {
  str = '<table>';
  str += '<tr><td><b>ICAO</b></td><td>' + plane.icao + '</td></tr>';
  str += '<tr><td><b>Callsign</b></td><td><a href=\"http://flightaware.com/live/flight/' + plane.callsign + '\" target=\"_blank\">' + plane.callsign + '</a></td></tr>';
  str += '<tr><td><b>Altitude</b></td><td>' + plane.altitude + ' ft</td></tr>';
  str += '<tr><td><b>Vertical Rate</b></td><td>' + plane.vertical_rate + ' ft/min</td></tr>';
  str += '<tr><td><b>Speed</b></td><td>' + plane.speed.toFixed(0) + ' kt</td></tr>';
  str += '<tr><td><b>Heading</b></td><td>' + plane.heading.toFixed(0) + ' deg</td></tr>';
  str += '<tr><td><b>Latitude</b></td><td>' + plane.latitude.toFixed(4) + '</td></tr>';
  str += '<tr><td><b>Longitude</b></td><td>' + plane.longitude.toFixed(4) + '</td></tr>';  
  str += "</table>"

  return str;
}


function handleLocationError(browserHasGeolocation, locationInfoWindow, pos) {
  locationInfoWindow.setPosition(pos);
  locationInfoWindow.setContent(browserHasGeolocation ? 'Error: The Geolocation service failed.' : 'Error: Your browser doesn\'t support geolocation.');
}

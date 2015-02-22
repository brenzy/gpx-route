/*

 This software is released under the MIT License.

 Copyright (c) 2013-2015, Brenda Zysman

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.

 */
GPXRouteEditor = function(map, panorama) {

  var mapRouter = new MapRouter(map, panorama);
  var gpxFile = new GPXFile();
  var eltFindError = $('.findError');
  var eltFileName = $("#fileName");
  var eltGPXName = $("#gpxName");
  var eltGPXDescription = $("#gpxDescription");
  var eltUseRouting = $("#use-routing");
  var eltClear = $("#clear");
  var eltDistance = $("#route-distance");
  var eltCurrentDistance = $("#current-distance");
  var eltViews = $(".views");
  var eltVertex = $("#vertex");
  var eltLongitude = $("#longitude");
  var eltLatitude = $("#latitude");
  var eltLocation = $("#jumpLocation");
  var eltFollow = $('#follow');
  var following = false;
  var eltSnap =  $("#snap");
  var snapping = false;
  var eltDouble = $("#double");
  var doublingUp = false;
  var eltGetElevation = $("#addElevation");
  var eltElevationStatus = $("#elevationStatus");
  var eltDownload = $("#hiddenDownload");

  function findStatus(status) {
    if (status == google.maps.GeocoderStatus.OK) {
      eltFindError.html("");
    } else if (status == google.maps.GeocoderStatus.ZERO_RESULTS) {
      eltFindError.html("No results were returned for this location.");
    } else {
      eltFindError.html("Error searching for location.");
    }
  }

  function findLocation() {
    var location = $("#location")[0].value;
    mapRouter.findLocation(location, findStatus);
  }

  function updateRoutingMode() {
    var travelMode = "direct";
    if (eltUseRouting.prop('checked')) {
      travelMode = $('input[name=mode]:checked').val();
    }
    mapRouter.travelMode(travelMode);
  }

  // Event Handlers
  $('.navBar li').click(  function (event) {
    var targetButton = $(event.target).parent();
    var targetNavBar = targetButton.parent();
    var active = targetNavBar.find("li.active");
    active.removeClass("active");
    $(".view." + active.attr('class')).hide();
    var newView = $(".view." + targetButton.attr('class'));
    targetButton.addClass('active');
    newView.show();
  });

  $("#find").click(findLocation);
  $("#location").keyup(function(event){
    if(event.keyCode == 13){
      findLocation();
    }
  });

  $("#jumpEnd").click(function(){
    mapRouter.centerOnEndpoint();
  });
  $("#jumpStart").click(function(){
    mapRouter.centerOnStart();
  });
  $("#toLocation").click(function(){
    var locationStr = mapRouter.jumpToLocation(eltLocation.val());
    eltLocation.val(locationStr);
  });

  $("#streetview-pull").click(function(event){
    mapRouter.streetViewPull(event.target.checked);
  });

  eltUseRouting.click(updateRoutingMode);
  $("input:radio[name=mode]").click(updateRoutingMode);

  $('.btn-file :file').change(  function handleFileSelect() {
    var input = $(this);
    var files = input.get(0).files;
    if (files.length == 0)
      return;
    var label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
    $(".currentGPX").val(label);
    var reader = new FileReader();
    reader.onload = function() {
      var xml = reader.result;
      mapRouter.displayRoute( gpxFile.parseGPX(xml));
    };
    reader.readAsText(files[0]);
  });

  function saveGPX(elevations) {
    var gpxName = $.trim(eltGPXName.val());
    var gpxDescription = $.trim(eltGPXDescription.val());
    var newName = $.trim(eltFileName.val());
    if (newName.length == 0) {
      newName = "streeview.gpx";
      eltFileName.val(newName);
    }
    var newXML = gpxFile.saveGPX(mapRouter.getPath(), elevations, gpxName, gpxDescription);
    eltDownload.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(newXML));
    eltDownload.attr('download', newName);
    eltDownload[0].click();
  }

  $("#downloadGPX").click(function(event) {
    if (eltGetElevation.prop('checked')) {
      mapRouter.getElevation(function(elevations) {
        saveGPX(elevations);
      });
    } else {
      saveGPX(null);
    }
  });

  eltClear.click( mapRouter.clearPath);

  eltViews.on("routeDistance", function (event, totalDistance) {
    var strDistance = (Math.round(totalDistance / 10) / 100).toString() + " km";
    eltDistance.text(strDistance);
  });

  eltViews.on("currentPoint", function (event, index, lat, long) {
    eltVertex.text(index != null ? index.toString() : ' --- ');
    eltLatitude.text(lat != null ? (Math.round(lat / 10) / 100).toString() : ' --- ');
    eltLongitude.text(long != null ? (Math.round(long/ 10) / 100).toString() : ' --- ');
  });

  eltViews.on("endFollow", function (/*event, bIsDone*/) {
    following = false;
    eltFollow.text("Follow The Route");
  });

  eltViews.on("endSnap", function (/*event, bIsDone*/) {
    snapping = false;
    eltSnap.text("Snap Points to Street View")
  });

  eltViews.on("endDoubleUp", function (/*event, bIsDone*/) {
    doublingUp = false;
    eltDouble.text("Double Up Points")
  });

  eltViews.on("elevationStatus", function (event, message) {
    eltElevationStatus.text(message);
  });

  $("#calcCurrentDistance").click( function () {
    var distance = mapRouter.getDistanceToCurrent();
    var strDistance = '0 km';
    if (distance) {
      strDistance = (Math.round(distance / 10) / 100).toString() + " km";
    }
    eltCurrentDistance.text(strDistance);
  });

  $("#calcRouteDistance").click( function () {
    mapRouter.calcRouteDistance();
  });

  eltFollow.click(function() {
    following = !following;
    if (following) {
      eltFollow.text("Stop Following The Route");
    } else {
      eltFollow.text("Follow The Route");
    }
    mapRouter.follow(following);
  });

  eltSnap.click(function() {
    snapping = !snapping;
    if (snapping) {
      eltSnap.text("Stop Snapping Points to Street View");
    } else {
      eltSnap.text("Snap Points to Street View");
    }
    mapRouter.snap(snapping);
  });

  eltDouble.click(function() {
    doublingUp = !doublingUp;
    if (doublingUp) {
      eltDouble.text("Stop Doubling Up Points");
    } else {
      eltDouble.text("Double Up Points");
    }
    mapRouter.doubleUp(doublingUp);
  });

  $("#first").click(function() {
    mapRouter.startAtCurrent();
  });

  $("#last").click(function() {
    mapRouter.endAtCurrent();
  });

  $("#reverse").click(function() {
    mapRouter.reverseRoute();
  });

   mapRouter.setViews(eltViews);

};

google.maps.event.addDomListener(window, 'load', function(){
  var mapOptions = {
    center: new google.maps.LatLng(-34.397, 150.644),
    zoom: 10
  };
  var map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
  var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'));
  map.setStreetView(panorama);
  google.maps.visualRefresh = true;
  new GPXRouteEditor(map, panorama);
});
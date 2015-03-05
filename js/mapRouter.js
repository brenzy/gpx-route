MapRouter = function(googleMap, pano) {

  var map = googleMap;
  var panorama = pano;
  var directionsService = new google.maps.DirectionsService();
  var panoService = new google.maps.StreetViewService();
  var elevationService = new google.maps.ElevationService();
  var path = new google.maps.MVCArray();
  var pathPolyline;
  var currentVertex  = null;
  var following = false;
  var snapping = false;
  var doubling = false;
  var displayIsOn = true;
  var mapMode = "create"; // Edit State - create or edit
  var undoManager = new UndoManager();
  var travelMode = google.maps.TravelMode.WALKING;
  var streetViewPull = true;
  var eltViews = null;
  var eltStaticView = $("#staticView");
  var eltPano = $("#panoView");
  var currentPositionMarker;
  var infoWindow = new google.maps.InfoWindow();
  var MY_KEY =  "";  // put your key here...

  var DEFAULT_PROXIMITY = 50;
  var MAX_PROXIMITY = 10000;

  function updatePano(pano, index) {
    eltPano.show();
    eltStaticView.hide();
    panorama.setVisible(true);
    var pathLength = path.getLength();
    panorama.setPano(pano);
    var pov = panorama.getPov();
    if (index + 1 < pathLength) {
      pov.heading = google.maps.geometry.spherical.computeHeading(path.getAt(index), path.getAt(index+1));
    }
    setTimeout(function () {
      // Only way I seem to be able to get the tiles to redraw properly
      panorama.setPov(pov);
    }, 1000);
  }

  function updateStreetView(index) {
    var pathLength = path.getLength();
    if (index < pathLength) {
      panoService.getPanoramaByLocation( path.getAt(index), DEFAULT_PROXIMITY, function processSVData(data, status) {
        if (status == google.maps.StreetViewStatus.OK) {
          updatePano(data.location.pano, index);
        } else {
          panorama.setVisible(false);
        }
      });
    }
  }

  function findClosestStreetView(point, proximity, callback) {
    panoService.getPanoramaByLocation(point, proximity, function processSVData(data, status) {
      if (status == google.maps.StreetViewStatus.OK) {
        callback(data.location.latLng);
      } else {
        if (proximity < MAX_PROXIMITY) {
          findClosestStreetView(point, proximity + 50, callback);
        } else {
          callback(point);
        }
      }
    });
  }

  function endFollow() {
    following = false;
    eltStaticView.hide();
    map.setOptions({streetViewControl: true});
    updateStreetView(currentVertex);
    if (eltViews) {
      eltViews.trigger("endFollow", true );
    }
  }

  function followRoute(index) {
    var pathLength = path.getLength();
    if (following && pathLength > index) {
      setCurrentVertex(index, false);
      var point = path.getAt(index);
      map.panTo(point);
      var streetViewImage = new Image();
      $(streetViewImage).one('load', function() {
        eltStaticView.css('background-image', 'url(' + streetViewImage.src + ')');
        $(streetViewImage).unbind();
        followRoute(index+1);
      });
      $(streetViewImage).error(function() {
        $(streetViewImage).unbind();
        followRoute(index+1);
      });
      var width = eltStaticView.width();
      var height = eltStaticView.height();
      var imageSrc =  "https://maps.googleapis.com/maps/api/streetview?size=" + width + "x" + height +
      "&location=" + point.lat() + "," + point.lng() + MY_KEY;
      if (index + 1 < pathLength) {
        imageSrc +=  "&heading=" + (google.maps.geometry.spherical.computeHeading(point, path.getAt(index+1)));
      } else if (index > 0) {
        imageSrc +=  "&heading=" + (google.maps.geometry.spherical.computeHeading(path.getAt(index-1), point));
      }
      streetViewImage.src = imageSrc;
    } else {
      endFollow();
    }
  }

  function endSnap() {
    snapping = false;
    if (eltViews) {
      eltViews.trigger("endSnap", true );
    }
  }

  function snapToRoute(index, proximity) {
    if (!snapping)
      return;
    var pathLength = path.getLength();
    if (pathLength > index) {
      var point = path.getAt(index);
      panoService.getPanoramaByLocation(point, proximity, function processSVData(data, status) {
        if (status == google.maps.StreetViewStatus.OK) {
          path.setAt(index, data.location.latLng);
          setCurrentVertex(index, false);
          map.panTo(data.location.latLng);
          if (displayIsOn) {
            updatePano(data.location.pano, index);
          }
          snapToRoute(index+1, DEFAULT_PROXIMITY);
        } else {
          if (proximity < MAX_PROXIMITY) {
            snapToRoute(index, proximity + 50);
          } else {
            currentVertex = index;
            map.panTo(point);
            snapToRoute(index+1, DEFAULT_PROXIMITY);
          }
        }
      });
    } else {
      endSnap();
    }
  }

  function endDoubleUp() {
    doubling = false;
    if (eltViews) {
      eltViews.trigger("endDoubleUp", true );
    }
  }

  function findNextMiddlePoint(vertex) {
    if (!doubling)
      return;
    var pathLength = path.getLength();
    if (vertex < pathLength-1) {
      var point = path.getAt(vertex);
      var nextPoint = path.getAt(vertex+1);
      // If the distance between these two points is within our tolerance, move on to the next point
      var distance = google.maps.geometry.spherical.computeDistanceBetween(point, nextPoint);
      if (distance <= 10) {
        setCurrentVertex(vertex + 1, false);
        map.panTo(nextPoint);
        panoService.getPanoramaByLocation( nextPoint, DEFAULT_PROXIMITY, function processSVData(data, status) {
          if (status == google.maps.StreetViewStatus.OK) {
            updatePano(data.location.pano, vertex + 1);
          } else {
            panorama.setVisible(false);
          }
          findNextMiddlePoint(vertex+1);
        });
      } else {
        var middlePoint = new google.maps.LatLng(
            nextPoint.lat() - (0.5 * (nextPoint.lat() - point.lat())),
            nextPoint.lng() - (0.5 * (nextPoint.lng() - point.lng())));
        findClosestMiddlePoint(vertex, point, middlePoint, nextPoint, DEFAULT_PROXIMITY);
      }
    } else {
      endDoubleUp();
    }
  }

  function findClosestMiddlePoint(vertex, point, middlePoint, nextPoint, proximity) {
    if (!doubling)
      return;
    panoService.getPanoramaByLocation(middlePoint, proximity,
        function processSVData(data, status) {
          if (status == google.maps.StreetViewStatus.OK) {
            var nextVertex = vertex + 1;
            var distanceMiddlePoint = google.maps.geometry.spherical.computeDistanceBetween(middlePoint, data.location.latLng);
            var distancePoint = google.maps.geometry.spherical.computeDistanceBetween(point, data.location.latLng);
            if (distanceMiddlePoint > 10 || distancePoint > 10) {
              // Check for a streetview gap
              var distanceNextPoint = google.maps.geometry.spherical.computeDistanceBetween(middlePoint, data.location.latLng);
              if (distancePoint > 15 && distanceNextPoint > 15) {
                path.insertAt(vertex + 1, data.location.latLng);
                setCurrentVertex(vertex + 1, false);
                map.panTo(data.location.latLng);
                updatePano(data.location.pano, vertex + 1);
                nextVertex = vertex;
              }
            }
            setTimeout(function () {
              findNextMiddlePoint(nextVertex);
            }, 0);
          } else if (proximity < MAX_PROXIMITY) {
            findClosestMiddlePoint(vertex, point, middlePoint, nextPoint, proximity + 50);
          } else {
              setTimeout(function () {
                findNextMiddlePoint(vertex + 1);
              }, 0);
          }
        });
  }


  function appendPoint(newPoint) {
    path.push(newPoint);
    mapRouter.centerOnEndpoint();
    refreshRouteDistance();
  }

  function removePoint(point) {
    var bSuccess = false;
    var iLastPoint = path.getLength() - 1;
    if (iLastPoint >= 0) {
     var lastPoint = path.getAt(iLastPoint);
     if (lastPoint.equals(point)) {
       path.pop();
       bSuccess = true;
     }
    }
    mapRouter.centerOnEndpoint();
    if (!bSuccess) {
      console.log('removePoint error');
    }
    refreshRouteDistance();
  }

  function appendPath(newPath) {
    var length = newPath.length;
    for (var i = 0; i < length; i++) {
      path.push(newPath[i]);
    }
    mapRouter.centerOnEndpoint();
    refreshRouteDistance();
  }

  function removePath(toRemove) {
    for (var i = toRemove.length - 1; i >= 0; i--) {
      var iLastPoint = path.getLength() - 1;
      if (iLastPoint >= 0) {
        var lastPoint = path.getAt(iLastPoint);
        if (lastPoint.equals(toRemove[i])) {
          path.pop();
        } else {
          console.log('removePoint error');
          break;
        }
      }
    }
    mapRouter.centerOnEndpoint();
    refreshRouteDistance();
  }

  function addPointToRoute(latLng) {
    undoManager.performAction({
      action: { command: appendPoint,
        data: latLng },
      undo: { command: removePoint,
        data: latLng }
    });
  }

  function addPathToRoute(latLong) {
    var numPoints = path.getLength();
    if (numPoints > 0) {
      var origin = path.getAt(numPoints - 1);
      var request = {
        origin: origin,
        destination: latLong,
        travelMode: travelMode,
        unitSystem: google.maps.UnitSystem.METRIC
      };
      directionsService.route(request, function (route, status) {
        var routeFound = false;
        if (status == google.maps.DirectionsStatus.OK) {
          if (route.routes && route.routes.length > 0) {
            var directions = route.routes[0];
            if (directions.overview_path.length > 2) {
              routeFound = true;
              var pathData = directions.overview_path.slice(1);
              undoManager.performAction({
                action: { command: appendPath,
                  data: pathData },
                undo: { command: removePath,
                  data: pathData }
              });
            }
          }
        }
        if (!routeFound) {
          addPointToRoute(latLong);
        }
      });
    } else {
        addPointToRoute(latLong);
    }
  }

  function addToRoute(latLong) {
    var routing;
    if (path.getLength() == 0 || travelMode == 'direct') {
      routing = addPointToRoute;
    } else {
      routing = addPathToRoute;
    }
    if (streetViewPull) {
      findClosestStreetView(latLong, DEFAULT_PROXIMITY, routing);
    } else {
      routing(latLong);
    }
  }

  function startAtVertex(vertex) {
    var length = path.getLength();
    for (var i = 0; i < vertex && i < length; i++) {
      path.removeAt(0);
    }
    setCurrentVertex(0);
    refreshRouteDistance();
  }

  function appendToStart(appendPath) {
    var length = appendPath.length;
    for (var i = length - 1; i >= 0; i--) {
      path.insertAt(0, appendPath[i]);
    }
    setCurrentVertex(length);
    refreshRouteDistance();
  }

  function endAtVertex(vertex) {
    var length = path.getLength();
    for (var i = vertex+1; i < length; i++) {
      path.removeAt(vertex+1);
    }
    setCurrentVertex(vertex);
    refreshRouteDistance();
  }

  function reversePath() {
    var newPath = new google.maps.MVCArray();
    var pathLength = path.getLength();
    for (var i = pathLength - 1; i >= 0; i--) {
      newPath.push(path.getAt(i));
    }
    pathPolyline.setPath(newPath);
    path = newPath;
  }

  function setInfoWindowContents(point) {
    var html = 'Selected Position<br />Latitude: ' + point.lat().toFixed(6) + '<br />Longitude: ' + point.lng().toFixed(6);
    infoWindow.setContent(html);
  }

  function setCurrentVertex(vertex, bUpdateUI) {
    if (vertex != null) {
      if (path && path.getLength() > vertex) {
        var point = path.getAt(vertex);
        if (bUpdateUI) {
          map.panTo(point);
          updateStreetView(vertex);
        }
        currentVertex = vertex;
        currentPositionMarker.setPosition(point);
        currentPositionMarker.setZIndex(google.maps.Marker.MAX_ZINDEX + 200);
        currentPositionMarker.setVisible(true);
        setInfoWindowContents(point);
      }
    } else {
      currentPositionMarker.setVisible(false);
      infoWindow.close();
    }
  }

  function onPolygonClick(event) {
    if (event.vertex != null) {
      setCurrentVertex(event.vertex, true);
    }
  }

  function onPolygonRightClick(event) {
    if (event.vertex != null)  {
      path.removeAt(event.vertex);
      refreshRouteDistance();
    }
  }

  function onClickMap(location) {
    if (mapMode == "create") {
      addToRoute(location);
    }
  }

  function refreshRouteDistance() {
    // TODO: Add continuous refresh as an option and clear otherwise
    //if (eltViews) {
    //  eltViews.trigger("routeDistance", google.maps.geometry.spherical.computeLength(path) );
    //}
  }

  function initGraph(map) {
    var streetViewLayer = new google.maps.StreetViewCoverageLayer();
    streetViewLayer.setMap(map);

    pathPolyline = new google.maps.Polyline({
      editable: true,
      path: path,
      geodesic: true,
      strokeColor: 'purple',
      strokeOpacity: 1.0,
      strokeWeight: 2
    });
    pathPolyline.setMap(map);

    google.maps.event.addListener(map, 'click', function(e) {
      onClickMap(e.latLng);
    });
    google.maps.event.addListener(pathPolyline, 'click', onPolygonClick);
    google.maps.event.addListener(pathPolyline, 'rightclick', onPolygonRightClick);

    currentPositionMarker = new google.maps.Marker({
      title: "Selected Position",
      zIndex: google.maps.Marker.MAX_ZINDEX + 200,
      map: map,
      optimized: false,
      visible: false
    });

    google.maps.event.addListener(currentPositionMarker, 'click', function() {
      setInfoWindowContents(this.getPosition());
      infoWindow.open(map, currentPositionMarker);
    });

    // For undo of moving points...
    //google.maps.event.addListener(path, 'set_at', function() {
    //  console.log('Vertex moved.');
    //});
    //
    //google.maps.event.addListener(path, 'insert_at', function() {
    //  console.log('Vertex inserted.');
    //});

   }

  var mapRouter = {};
  mapRouter.findLocation = function(location, statusCallback) {
    var geo = new google.maps.Geocoder;
    geo.geocode({'address':location}, function(results, status){
      if (status == google.maps.GeocoderStatus.OK) {
        map.panTo(results[0].geometry.location);
      }
      if (statusCallback) {
        statusCallback(status);
      }
    });
  };

  mapRouter.displayRoute = function(rawValues) {
    if (path) {
      path.clear()
    }
    else {
      path = new google.maps.MVCArray();
    }
    setCurrentVertex(null, false);
    var pathLength = rawValues.length;
    for (var i = 0; i < pathLength; i++) {
      var point = rawValues[i];
      path.push(new google.maps.LatLng(point.lat, point.long));
    }
    pathPolyline = new google.maps.Polyline({
      editable: true,
      path: path,
      geodesic: true,
      strokeColor: 'purple',
      strokeOpacity: 1.0,
      strokeWeight: 2
    });
    pathPolyline.setMap(map);
    google.maps.event.addListener(pathPolyline, 'click', onPolygonClick);
    google.maps.event.addListener(pathPolyline, 'rightclick', onPolygonRightClick);
    setCurrentVertex(0, true);
    refreshRouteDistance();
  };

  mapRouter.centerOnStart = function() {
    var numPoints = path.getLength();
    if (numPoints > 0) {
      setCurrentVertex(0, true);
    }
  };

  mapRouter.centerOnEndpoint = function() {
    var numPoints = path.getLength();
    if (numPoints > 0) {
      setCurrentVertex(numPoints - 1, true);
    }
  };

  mapRouter.centerOnCurrent = function() {
    if (currentVertex != null && currentVertex < path.getLength()) {
      var point = path.getAt(currentVertex);
      map.panTo(point);
    }
  };

  mapRouter.jumpToLocation = function(distance) {
    var pathLength = path.getLength();
    if (pathLength == 0)
      return "0";

    var nDistance = parseFloat(distance);
    nDistance *= 1000; // splitting into 2 statements makes Jetbrains happy
    if (isNaN(nDistance) || nDistance <= 0) {
      nDistance = 0;
    }

    var totalDistance = 0;
    for (var iPoint = 0; iPoint < pathLength - 1 && totalDistance < nDistance; iPoint++) {
      var point = path.getAt(iPoint);
      var nextPoint = path.getAt(iPoint+1);
      totalDistance += google.maps.geometry.spherical.computeDistanceBetween(point, nextPoint);
    }
    setCurrentVertex(iPoint, true);
    return (Math.round(totalDistance / 10) / 100).toString();

  };

  mapRouter.getPath = function() {
    return(path);
  };

  mapRouter.clearPath = function() {
    path.clear();
    undoManager.clear();
    setCurrentVertex(null, false);
    refreshRouteDistance();
  };

  mapRouter.setViews = function(views) {
    eltViews = views;
    setCurrentVertex(currentVertex, false);
  };

  mapRouter.getDistanceToCurrent  = function() {
    if (currentVertex) {
      var totalDistance = 0;
      var pathLength = path.getLength();
      for (var i = 0; i < currentVertex && i < pathLength; i++) {
        var point = path.getAt(i);
        var nextPoint = path.getAt(i + 1);
        totalDistance += google.maps.geometry.spherical.computeDistanceBetween(point, nextPoint);
      }
      return totalDistance;
    } else {
      return null;
    }
  };

  mapRouter.calcRouteDistance= function() {
    var length = 0;
    if (path && path.getLength() != 0) {
      length = google.maps.geometry.spherical.computeLength(path);
    }
    if (eltViews) {
      eltViews.trigger("routeDistance", length );
    }
  };

  mapRouter.follow = function(isFollowing) {
    following = isFollowing;
    if (isFollowing) {
      endSnap();
      if (currentVertex == null) {
        setCurrentVertex(0, false);
      }
      eltPano.hide();
      eltStaticView.show();
      pano.setVisible(false);
      followRoute(currentVertex);
    }
  };

  mapRouter.snap = function(isSnapping) {
    snapping = isSnapping;
    if (isSnapping) {
      endFollow();
      undoManager.clear();
      if (currentVertex == null) {
        setCurrentVertex(0, false);
      }
      snapToRoute(currentVertex, DEFAULT_PROXIMITY);
    }
  };

  mapRouter.doubleUp = function(isDoubling) {
    doubling = isDoubling;
    if (isDoubling) {
      endFollow();
      endSnap();
      undoManager.clear();
      if (currentVertex == null) {
        setCurrentVertex(0, false);
      }
      findNextMiddlePoint(currentVertex);
    }
  };

  mapRouter.startAtCurrent = function() {
    if (currentVertex == null) {
      return;
    }
    var routeStart = [];
    for (var i = 0; i < currentVertex; i++) {
      routeStart.push(path.getAt(i));
    }
    undoManager.performAction({
      action: { command: startAtVertex,
        data: currentVertex },
      undo: { command: appendToStart,
        data: routeStart }
    });
  };

  mapRouter.endAtCurrent = function() {
    var length = path.getLength();
    if (currentVertex && currentVertex < length - 1) {
      var routeEnd = [];
      for (var i = currentVertex+1; i < length; i++) {
        routeEnd.push(path.getAt(i));
      }
      undoManager.performAction({
        action: { command: endAtVertex,
          data: currentVertex },
        undo: { command: appendPath,
          data: routeEnd }
      });
    }
  };

  mapRouter.reverseRoute = function() {
    undoManager.performAction({
      action: { command: reversePath,
        data: null },
      undo: { command: reversePath,
        data: null }
    });
  };

  // State Changes
  mapRouter.streetViewPull = function(isOn) {
    streetViewPull = isOn;
  };

  function getNextElevationSet (vertex, elevations, sleep, requestSize, callback) {
    var dataLength = path.getLength();
    var locations = [];
    if (sleep == 0) {
      if (eltViews) {
        eltViews.trigger("elevationStatus", "Processing elevation for points " + vertex.toString()
        + " to " + (vertex + requestSize).toString() + " out of " + dataLength.toString());
      }
    }
    for (var i = 0, currentVertex = vertex; currentVertex < dataLength && i < requestSize; i++, currentVertex++) {
      var point = path.getAt(currentVertex);
      var latLng = new google.maps.LatLng(point.lat().toFixed(6), point.lng().toFixed(6));
      locations.push(latLng);
    }
    var positionalRequest = {
      'locations': locations
    };
    elevationService.getElevationForLocations(positionalRequest, function (results, status) {
      if (status == google.maps.ElevationStatus.OK) {
        sleep = 0;
        var numResults = results.length;
        for (var iResult = 0; iResult < numResults; iResult++) {
          elevations.push(results[iResult].elevation);
        }
        if (vertex + numResults < dataLength) {
          getNextElevationSet(vertex + numResults, elevations, sleep, requestSize, callback);
        } else if (elevations.length == dataLength) {
          if (eltViews) {
            eltViews.trigger("elevationStatus", "Successfully retrieved elevation.");
          }
          callback(elevations);
        } else {
          if (eltViews) {
            eltViews.trigger("elevationStatus", "Could not retrieve all elevations from google maps.");
          }
          callback(null);
        }
      } else {
        if (sleep > 3000) {
          if (eltViews) {
            eltViews.trigger("elevationStatus", "Could not load elevations from google maps. Status code: " + status);
          }
          callback(null);
        } else {
          if (status == google.maps.ElevationStatus.UNKNOWN_ERROR) {
            requestSize = 250;
          }
          sleep = sleep + 1000;
          if (eltViews) {
            eltViews.trigger("elevationStatus", "Re-trying elevation for points " + vertex.toString()
              + " to " + (vertex + requestSize).toString() + " out of " + dataLength.toString());
          }
          setTimeout(function () {
            getNextElevationSet(vertex, elevations, sleep, requestSize,
                callback)
          }, sleep);
        }
      }
    });
  }

  mapRouter.getElevation = function(callback) {
    var elevations = [];
    if (path.getLength() == 0) {
      callback(elevations);
    }
    var sleep = 0;
    var requestSize = 500;
    getNextElevationSet(0, elevations, sleep, requestSize, callback);
  };

  mapRouter.travelMode = function(mode) {
    switch (mode) {
      case 'walking':
        travelMode = google.maps.TravelMode.WALKING;
        break;
      case 'biking':
        travelMode = google.maps.TravelMode.BICYCLING ;
        break;
      case 'driving':
        travelMode = google.maps.TravelMode.DRIVING;
        break;
      case 'transit':
        travelMode = google.maps.TravelMode.TRANSIT;
        break;
      default:
        travelMode = mode;
        break;
    }
  };

  mapRouter.mapMode = function(mode) {
    if (mapMode != mode) {
      mapMode = mode;
    }
  };

  initGraph(map);
  return mapRouter;

};

GPXFile = function() {

  var gpxFile;
  gpxFile = {
    rawValues: []
  };

  // formatXML taken from https://gist.github.com/sente/1083506 (Stuart Powers)
  gpxFile.formatXML = function (xml) {
    var formatted = '';
    var reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\r\n$2$3');
    var pad = 0;
    jQuery.each(xml.split('\r\n'), function(index, node) {
      node = $.trim(node);
      var indent = 0;
      if (node.match( /.+<\/\w[^>]*>$/ )) {
        indent = 0;
      } else if (node.match( /^<\/\w/ )) {
        if (pad != 0) {
          pad -= 1;
        }
      } else if (node.match( /^<\w[^>]*[^\/]>.*$/ )) {
        indent = 1;
      } else {
        indent = 0;
      }
      var padding = '';
      for (var i = 0; i < pad; i++) {
        padding += '  ';
      }
      formatted += padding + node + '\r\n';
      pad += indent;
    });
    return formatted;
  };

  gpxFile.generateNewHeader = function (xml, gpxName, gpxDescription) {
    var gpxDoc = $.parseXML(xml);
    if (gpxName || gpxDescription) {
      var metaData = $(gpxDoc).find('metadata');
      if (metaData.length > 0) {
        if (gpxName && gpxName.length > 0) {
          var eltName = metaData.find('name');
          if (eltName.length > 0) {
            eltName[0].textContent = gpxName;
          }
        }
        if (gpxDescription && gpxDescription.length > 0) {
          var eltDescription = metaData.find('desc');
          if (eltDescription.length > 0) {
            eltDescription[0].textContent = gpxDescription;
          }
        }
      }
    }
    return(new XMLSerializer()).serializeToString(gpxDoc);
  };

  gpxFile.generateNewGPX = function (xml, dataValues) {
    var gpxDoc = $.parseXML(xml);
    var eleTrkpt =  $(gpxDoc).find('trkpt');
    var numPoints = eleTrkpt.length;
    for (var iDataValue = 0; iDataValue < numPoints; iDataValue++) {
      var eleElevation = $(eleTrkpt[iDataValue]).find("ele");
      if (eleElevation.length > 0) {
        if (dataValues[iDataValue].ele !=  Number(eleElevation[0].textContent)) {
          eleElevation[0].textContent = dataValues[iDataValue].ele.toString();
        }
      } else {
        var newElevation = gpxDoc.createElement("ele");
        newElevation.appendChild(gpxDoc.createTextNode(dataValues[iDataValue].ele.toString()));
        eleTrkpt[iDataValue].appendChild(newElevation);
      }
    }
    return(new XMLSerializer()).serializeToString(gpxDoc);
  };

  gpxFile.parseHeader = function(doc) {
    var metaData = $(doc).find('metadata');
    if (metaData.length > 0) {
      var eltName = metaData.find('name');
      if (eltName.length > 0) {
        var docName = eltName[0].textContent;
        docName = $.trim(docName);
        if (docName.length > 0) {
          gpxFile.gpxName = docName;
        }
      }
      var eltDescription = metaData.find('desc');
      if (eltDescription.length > 0) {
        var docDescription = eltDescription[0].textContent;
        docDescription = $.trim(docDescription);
        if (docDescription.length > 0) {
          gpxFile.gpxDescription = docDescription;
        }
      }
    }
  };

  gpxFile.parseGPX = function (xml) {
    var rawValues = [];
    var doc = $.parseXML(xml);
    gpxFile.parseHeader(doc);
    $(doc).find('trkpt').each(function(){
      var point =  {};
      point.lat = Number($(this).attr("lat"));
      point.long =  Number($(this).attr("lon"));
      rawValues.push(point)
    });
    gpxFile.rawValues = rawValues;
    return rawValues;
  };

  gpxFile.saveGPX = function (path, elevations, gpxName, gpxDescription) {
    var xml = '<?xml version="1.0"?>';
    xml += '<gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" ';
    xml += 'xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="GPX Editor">';
    xml += ' <metadata><name>' + gpxName + '</name><desc>' + gpxDescription+ '</desc></metadata>';
    xml += '<trk>';
    xml += '<trkseg>';
    var pathLength = path.getLength();
    for (var i = 0; i < pathLength; i++) {
      var point = path.getAt(i);
      xml += '<trkpt lat="' + point.lat().toString() + '" lon="' + point.lng().toString() + '">';
      xml += "<ele>"
      if (elevations && elevations[i] != null) {
        xml += elevations[i].toString();
      } else {
        xml += "100";
      }
      xml += "</ele>";
      xml += '</trkpt>'
    }
    xml += '</trkseg>';
    xml += '</trk>';
    xml += '</gpx>';
    return gpxFile.formatXML(xml);
  };

  return gpxFile;

};

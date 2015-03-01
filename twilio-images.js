var fs = require('fs');
var Hapi = require('hapi');
var http = require('https');
var uuid = require('node-uuid');
var request = require('request');
var jpeg = require('jpeg-js');
var png = require('png-js');
var fileType = require('file-type');
var sizeOf = require('image-size');

// This is our helper to download media files from Twilio when we receive them.
var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    if (err) { callback(err); }
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

function writeFile(fileName, data, callback) {
  fs.writeFile(fileName, data, function(err) {
    if (err) { callback(err); } 
  });
}

// Load filters
var filter = require('./lib/filters.js');

// Load our environment variables to setup our twilio client
var accountSid = process.env.twilioSid;
var authToken = process.env.twilioAuthToken;
var client = require('twilio')(accountSid, authToken);

// Setup our hapi server
var server = new Hapi.Server();
server.connection({ port: 8088 });

// This handles applying our filter.  
// This includes decoding the jpeg, applying the filter 
// then re-encoding it back into a jpeg format and writing it to the filesystem.
function applyFilter(filterName, fileName, callback) {
  decodeImage(fileName, function(imageData) {
    if (filterName == 'grayScale') {
      imageData.data = filter.grayScale(imageData.data);
    } else if (filterName == 'threshold') {
      imageData.data = filter.threshold(imageData.data, 128);
    } 
    var filteredFileName = fileName.replace(/\.\d{3}/,"-"+filterName+".jpg");

    var jpegImageData = jpeg.encode(imageData, 90);
    fs.writeFile(filteredFileName, jpegImageData.data, function(err) {
      if (err) { callback(err); } 
      callback(filteredFileName);
    });
  });
}

function decodeImage(fileName, callback) {
  // Read file
  var fileData = fs.readFileSync(fileName);
  // Get file type
  var metaData = fileType(fileData);
  var imageData;

  if (metaData.ext == 'jpg') {
    imageData = jpeg.decode(fileData);
    callback(imageData);
  } else if (metaData.ext == 'png') {
    png.decode(fileName, function(pixels) {
      var size = sizeOf(fileName);
      // Convert to jpeg.  Writing back out to png was a pain.
      imageData = {
        data: pixels,
        width: size.width,
        height: size.height
      };
      callback(imageData);
    });
  }
}




server.route({
  method: 'POST',
  path: '/receiveMessage',
  handler: function(request, reply) {
    var message = request.payload;
    var filterName = message.Body === 'threshold' ? 'threshold' : 'grayScale';
    var file_uuid = uuid.v1();
    var fileName = 'images/'+file_uuid+'.jpg';
    
    // Download media
    download(message.MediaUrl0, fileName, function() {
      
      // Apply the filter to the media
      applyFilter(filterName, fileName, function(filteredFileName) {
        // Create the response and return the filtered media
        var twilioMessage = {
          body: "Filter applied!",
          to: message.From,
          from: message.To,
          mediaUrl: 'http://curs.es:8088/'+filteredFileName
        }
        createMessage(twilioMessage);

      });
    });
  }
});

function createMessage(twilioMessage) {
  client.messages.create(twilioMessage, function(err, twilio) {
    if (err) { console.log(err); }
    else { console.log(twilio.sid); }
  });
}

// This method was purely for testing so I didn't have to keep sending MMS' to test
server.route({
  method: 'GET',
  path: '/test',
  handler: function(request, reply) {
    var fileName = 'images/test.png';
    decodeImage(fileName, function(imageData) {
      var filterName = 'grayScale';
      if (filterName == 'grayScale') {
        imageData.data = filter.grayScale(imageData.data);
      } else if (filterName == 'threshold') {
        imageData.data = filter.threshold(imageData.data, 128);
      } 
      var filteredFileName = fileName.replace(/\.\w{3}/,"-"+filterName+".jpg");
  
      var jpegImageData = jpeg.encode(imageData, 90);
      fs.writeFile(filteredFileName, jpegImageData.data, function(err) {
        if (err) { callback(err); } 
        else { console.log("success"); }
      });
    });

    reply("done");
  }
});


// This lets us serve up our images
server.route({ 
  method: 'GET',
  path: '/images/{file}.{ext}',
  handler: function(request, reply) {
    if (request.params.ext == 'jpg' || request.params.ext == 'png') 
      reply.file('images/'+request.params.file+'.'+request.params.ext);
  }
});


// Start it all up
server.start(function() {
  console.log('Server running at ', server.info.uri);
});

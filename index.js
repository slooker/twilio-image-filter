var fs = require('fs');
var Hapi = require('hapi');
var http = require('https');
var uuid = require('node-uuid');
var request = require('request');
var jpeg = require('jpeg-js');

// This is our helper to download media files from Twilio when we receive them.
var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

// List of valid filters
var filters = {
  'grayScale' : 1,
  'threshold' : 1,
};
console.log(filters);


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
      // Decode jpeg data
      var jpegData = fs.readFileSync(fileName);
      var imageData = jpeg.decode(jpegData);
      var filteredFileName = fileName.replace('.jpg','-'+filterName+'.jpg');

      if (filterName == 'grayScale') {
        imageData = filter.grayScale(imageData);
      } else if (filterName == 'threshold') {
        imageData = filter.threshold(imageData, 128);
      } 

      var jpegImageData = jpeg.encode(imageData, 90);
      fs.writeFile(filteredFileName, jpegImageData.data, function(err) {
        if (err) {
          console.log(err);
        } else {
          console.log('success');
          console.log(filteredFileName);
          callback(filteredFileName);
        }
      });


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
    console.log(twilio.sid);
  });
}

// This method was purely for testing so I didn't have to keep sending MMS' to test
server.route({
  method: 'GET',
  path: '/test',
  handler: function(request, reply) {
    var fileName = 'images/test.jpg';

    // Decode jpeg data
    var jpegData = fs.readFileSync(fileName);
    var imageData = jpeg.decode(jpegData);
    imageData = filter.grayScale(imageData);

    var jpegImageData = jpeg.encode(imageData, 90);
    console.log(jpegImageData);
    fs.writeFile('images/fry-grey.jpg', jpegImageData.data, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log('success');
      }
    });
    reply("done");
  }
});

// This lets us serve up our images
server.route({ 
  method: 'GET',
  path: '/images/{file}.jpg',
  handler: function(request, reply) {
    reply.file('images/'+request.params.file+'.jpg');

  }
});


// Start it all up
server.start(function() {
  console.log('Server running at ', server.info.uri);
});

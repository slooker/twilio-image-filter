'use strict';
const fs = require('fs');
const Hapi = require('hapi');
const http = require('https');
const uuid = require('node-uuid');
const request = require('request');
const jpeg = require('jpeg-js');
const png = require('png-js');
const fileType = require('file-type');
const sizeOf = require('image-size');
const twilio = require('twilio');
const inert = require('inert');

// This is our helper to download media files from Twilio when we receive them.
let download = function(uri, filename, callback){
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
let filter = require('./lib/filters.js');

// Exported in TWILIO_AUTH_TOKEN and TWILIO_ACCOUNT_SID
let client = new twilio.RestClient();

// Setup our hapi server
let server = new Hapi.Server();
server.connection({ port: 8088 });

// Register inert, which is hapi's file handling system?
server.register(inert, () => {});

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
    let filteredFileName = fileName.replace(/\.\d{3}/,"-"+filterName+".jpg");

    let jpegImageData = jpeg.encode(imageData, 90);
    fs.writeFile(filteredFileName, jpegImageData.data, function(err) {
      if (err) { callback(err); } 
      callback(filteredFileName);
    });
  });
}

function decodeImage(fileName, callback) {
  // Read file
  let fileData = fs.readFileSync(fileName);
  // Get file type
  let metaData = fileType(fileData);
  let imageData;

  if (metaData.ext == 'jpg') {
    imageData = jpeg.decode(fileData);
    callback(imageData);
  } else if (metaData.ext == 'png') {
    png.decode(fileName, function(pixels) {
      let size = sizeOf(fileName);
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
    console.log(`Received receiveMessage request at ${new Date}`);
    let message = request.payload;
    let filterName = message.Body === 'threshold' ? 'threshold' : 'grayScale';
    let file_uuid = uuid.v1();
    let fileName = 'images/'+file_uuid+'.jpg';
    
    // Download media
    download(message.MediaUrl0, fileName, function() {
    console.log("Downloaded image");
      
      // Apply the filter to the media
      applyFilter(filterName, fileName, function(filteredFileName) {
        console.log("Applied filter");
        // Create the reply and return the filtered media
        let twilioMessage = {
          body: "Filter applied!",
          to: message.From,
          from: message.To,
          mediaUrl: 'http://slooker.us:8088/'+filteredFileName
        }
        createMessage(twilioMessage);

      });
    });
  }
});

function createMessage(twilioMessage) {
  console.log("Sending message");
  console.log(twilioMessage);
  client.sendMessage(twilioMessage, function(err, twilio) {
    if (err) { console.log(err); }
    else { console.log(twilio.sid); }
  });
}

// This method was for testing twilio messaging
server.route({
  method: 'GET',
  path: '/testMessage',
  handler: function(request, reply) {
    // Create the reply and return the filtered media
    let twilioMessage = {
      body: "Filter applied!",
      to:  '+17029004429',
      from: '+17026660736',
      mediaUrl: 'http://slooker.us:8088/test.png'
    }
    client.sendMessage(twilioMessage, function(err, twilio) {
      if (err) { console.log(err); }
      else { console.log(twilio.sid); }
    });
  }
});

// This method was purely for testing so I didn't have to keep sending MMS' to test
server.route({
  method: 'GET',
  path: '/test',
  handler: function(request, reply) {
    let fileName = 'images/test.png';
    decodeImage(fileName, function(imageData) {
      let filterName = 'grayScale';
      if (filterName == 'grayScale') {
        imageData.data = filter.grayScale(imageData.data);
      } else if (filterName == 'threshold') {
        imageData.data = filter.threshold(imageData.data, 128);
      } 
      let filteredFileName = fileName.replace(/\.\w{3}/,"-"+filterName+".jpg");
  
      let jpegImageData = jpeg.encode(imageData, 90);
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
      console.log(`${__dirname}/images/${request.params.file}.${request.params.ext}`);
      reply.file(`${__dirname}/images/${request.params.file}.${request.params.ext}`);
  }
});

// Start it all up
server.start(function() {
  console.log('Server running at ', server.info.uri);
});

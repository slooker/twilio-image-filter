var jpeg = require('jpeg-js');
module.exports = {
  grayScale: function(imageData) {
    for (var i = 0; i < imageData.data.length; i += 4) {
      var r = imageData.data[i];
      var g = imageData.data[i+1];
      var b = imageData.data[i+2];

      var v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = v;
    }
    return imageData;
  },
  threshold: function(imageData, threshold) {
    for (var i = 0; i < imageData.data.length; i += 4) {
      var r = imageData.data[i];
      var g = imageData.data[i+1];
      var b = imageData.data[i+2];

      var v = (0.2126 * r + 0.7152 * g + 0.0722 * b >= threshold) ? 255 : 0;
      imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = v;

    }
    return imageData;
  },
}

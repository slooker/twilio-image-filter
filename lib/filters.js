const jpeg = require('jpeg-js');
module.exports = {
  grayScale: (pixels) => {
    for (var i = 0; i < pixels.length; i += 4) {
      var r = pixels[i];
      var g = pixels[i+1];
      var b = pixels[i+2];

      var v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      pixels[i] = pixels[i+1] = pixels[i+2] = v;
    }
    console.log("pixels in grayscale: "+pixels.length);
    return pixels;
  },
  threshold: (pixels, threshold) => {
    for (var i = 0; i < pixels.length; i += 4) {
      var r = pixels[i];
      var g = pixels[i+1];
      var b = pixels[i+2];

      var v = (0.2126 * r + 0.7152 * g + 0.0722 * b >= threshold) ? 255 : 0;
      pixels[i] = pixels[i+1] = pixels[i+2] = v;

    }
    return pixels;
  },
}

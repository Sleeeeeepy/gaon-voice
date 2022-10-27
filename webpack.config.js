const path = require("path");

module.exports = {
  entry: {
    index: "./client.js",
  },
  devtool: 'eval-source-map',
  output: {
    path: path.resolve(__dirname, "dist/bundle"),
    filename: "client.bundle.js",
    clean: true,
  },
};
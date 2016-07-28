export default {
  sourceDir: './',

  scripts: {
    src: [
      './index.js', './connection.js', './create-db-state-1.js',
    ],

    addSrc: [
    ],

    test: [
      './test/**/*_spec.js',
    ],

    gulp: 'gulp/**/*.js',
  },

  dist: './dist',

  init: function () {
    this.scripts.babelSrc = this.scripts.src.concat(this.scripts.test).concat(this.scripts.addSrc);
    return this;
  },

}.init();

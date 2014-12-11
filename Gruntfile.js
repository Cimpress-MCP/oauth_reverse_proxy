module.exports = function(grunt) {
  grunt.initConfig({
    coveralls: {
      options: {
        src: 'reports/lcov.info',
      }
    }
  });

  grunt.loadNpmTasks('grunt-coveralls');

  // Default task(s).
  grunt.registerTask('default', ['coveralls']);
}

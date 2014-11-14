module.exports = function(grunt){
    grunt.initConfig({
        env: {
            common: {
                LOG4JS_CONFIG: './test/resources/test_log4js.json',
                AUSPICE_SERVICE_NAME: 'jobsservice',
                AUSPICE_PROXY_PORT: '8000',
                AUSPICE_VERSION: '0.2.6',
            },
            unix: {
                AUSPICE_KEYSTORE: '/var/vistaprint/auspice/'
            },
            win: {
                AUSPICE_KEYSTORE: 'c:\\keystore\\'
            }
        },
        benchmark: {
            all: {
                src: ['test/benchmarks/*.js'],
                dest: 'reports/benchmark-results.csv'
            }
        },
        nodemon: {
            dev: {
                script: 'index.js'
            }
        }
    });
    
    grunt.loadNpmTasks('grunt-benchmark');    
    grunt.loadNpmTasks('grunt-env');
    grunt.loadNpmTasks('grunt-nodemon');
    
    grunt.registerTask('default', function() {
        grunt.task.run('env:common');
       
        if(/^win/.test(process.platform)) {
            grunt.task.run('env:win');
            grunt.task.run('nodemon');
        }
        else {
            grunt.task.run('env:unix');
            grunt.task.run('nodemon');
        }
    });
};
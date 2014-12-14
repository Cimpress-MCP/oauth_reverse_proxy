module.exports = function(grunt){
    grunt.initConfig({
        env: {
            common: {
            },
            unix: {
                OAUTH_REVERSE_PROXY_HOME: '/etc/oauth_reverse_proxy.d'
            },
            win: {
                OAUTH_REVERSE_PROXY_HOME: 'c:\\ProgramData\\oauth_reverse_proxy.d'
            }
        },
        benchmark: {
            all: {
                src_back: ['test/benchmarks/benchmark_authenticator.js'],
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

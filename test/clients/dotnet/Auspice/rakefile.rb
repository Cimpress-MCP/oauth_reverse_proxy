require 'rake'

require File.join(ENV['DEVKIT'], 'rake-tasks/lib/tasklib')

# Resolve dependencies for the Auspice Client and build it.

task :default => [:nuget_retrieve, :msbuild]

nuget_retrieve 'nuget_retrieve' do |t|
    t.input_glob = '**/packages.config'
end

msbuild 'msbuild' do |t|
    t.input_file = 'Auspice.sln'
    t.build_configuration = 'Release'
end
/*  
    Utlimate Jay Mega Gulpfile
 */

(function () {
    "use strict";
 
    var pkg       = require("./package.json"),
        del       = require("del"),
        yargs     = require("yargs"),
        exec      = require("exec"),
        fs        = require("fs"),
        UglifyJs  = require("uglify-js"),
        gulp      = require("gulp"),
        bump      = require("gulp-bump"),
        header    = require("gulp-header"),
        qunit     = require("gulp-qunit"),
        uglify    = require("gulp-uglify"),
        sourcemap = require("gulp-sourcemaps"),
        jshint    = require('gulp-jshint'),
        gutil     = require("gulp-util"),
        zip       = require("gulp-zip"),
        size      = require("gulp-sizereport"),
        rename    = require("gulp-rename"),
        replace   = require("gulp-replace"),
        gsync     = require("gulp-sync"),
        stripCode = require('gulp-strip-code'),
        sync      = gsync(gulp).sync;

    var bumpVersion = yargs.argv.type || "patch";

    var settings = {
        banner: {
            content: [
                '/*! Pin v<%= pkg.version %> (c) <%= year %> Jay Salvat | http://pin.jaysalvat.com */',
                '',
            ].join("\n"),
            vars: {
                pkg: pkg,
                datetime: gutil.date("yyyy-mm-dd"),
                year: gutil.date("yyyy")
            }
        }
    };

    var getPackageJson = function () {
        return JSON.parse(fs.readFileSync('./package.json'));
    };

    gulp.task("clean", function (cb) {
        return del([ "./dist" ], cb);
    });

    gulp.task("tmp-clean", function (cb) {
        return del([ "./tmp" ], cb);
    });

    gulp.task("tmp-create", function (cb) {
        return exec("mkdir -p ./tmp", cb);
    });

    gulp.task("tmp-copy", [ "tmp-create" ], function () {
        return gulp.src("./dist/*")
            .pipe(gulp.dest("./tmp"));
    });

    gulp.task("zip", [ "tmp-create" ], function () {
        var filename = "pin.zip";

        return gulp.src("./dist/*")
            .pipe(zip(filename))
            .pipe(gulp.dest("./tmp"));
    });

    gulp.task("fail-if-dirty", function (cb) {
        return exec('git diff-index HEAD --', function (err, output) { // err, output, code
            if (err) {
                return cb(err);
            }
            if (output) {
                return cb("Repository is dirty");
            }
            return cb();
        });
    });

    gulp.task("fail-if-not-master", function (cb) {
        exec('git symbolic-ref -q HEAD', function (err, output) { // err, output, code
            if (err) {
                return cb(err);
            }
            if (!/refs\/heads\/master/.test(output)) {
                return cb("Branch is not Master");
            }
            return cb();
        });
    });

    gulp.task("git-tag", function (cb) {
        var message = "v" + getPackageJson().version;

        return exec('git tag ' + message, cb);
    });

    gulp.task("git-add", function (cb) {
        return exec('git add -A', cb);
    });

    gulp.task("git-commit", [ "git-add" ], function (cb) {
        var message = "Build v" + getPackageJson().version;

        return exec('git commit -m "' + message + '"', cb);
    });

    gulp.task("git-pull", function (cb) {
        return exec('git pull origin master', function (err, output, code) {
            if (code !== 0) {
                return cb(err + output);
            }
            return cb();
        });
    });

    gulp.task("git-push", [ "git-commit" ], function (cb) {
        return exec('git push origin master --tags', function (err, output, code) {
            if (code !== 0) {
                return cb(err + output);
            }
            return cb();
        });
    });

    gulp.task("meta", [ "tmp-create" ], function (cb) {
        var  metadata = {
                date: gutil.date("yyyy-mm-dd HH:MM"),
                version: "v" + getPackageJson().version
            },
            json = JSON.stringify(metadata, null, 4);

        fs.writeFileSync("tmp/metadata.json", json);
        fs.writeFileSync("tmp/metadata.js", "__metadata(" + json + ");");

        return cb();
    });

    gulp.task("bump", function () {
        return gulp.src([ "package.json", "bower.json" ])
            .pipe(bump(
                /^[a-z]+$/.test(bumpVersion) 
                    ? { type: bumpVersion } 
                    : { version: bumpVersion }
            ))
            .pipe(gulp.dest("."));
    });

    gulp.task("license", function () {
        return gulp.src([ "./LICENSE", "./README.md" ])
            .pipe(replace(/(Copyright )(\d{4})/g, "$1" + gutil.date("yyyy")))
            .pipe(gulp.dest("."));
    });

    gulp.task('lint', function() {
        return gulp.src('./src/**.js')
            .pipe(jshint())
            .pipe(jshint.reporter('default'));
    });

    gulp.task("qunit", function () {
        return gulp.src("./tests/test-runner.html")
            .pipe(qunit());
    });

    gulp.task("uglify", function () {
        settings.banner.vars.pkg = getPackageJson();

        return gulp.src('./dist/**/!(*.min.js)')
            .pipe(rename({ suffix: ".min" }))
            .pipe(sourcemap.init())
            .pipe(uglify({
                compress: {
                    warnings: false
                },
                mangle: true,
                outSourceMap: true
            }))
            .pipe(sourcemap.write('.'))
            .pipe(gulp.dest('./dist/'));
    });

    gulp.task("copy", function () {
        return gulp.src('./src/*.js')
            .pipe(gulp.dest('./dist/'));
    });

    gulp.task('copy-lite', function () {
        return gulp.src('./src/*.js')
            .pipe(rename({ suffix: ".lite" }))
            .pipe(stripCode({
                start_comment: "extended-code",
                end_comment: "end-extended-code"
            }))
            .pipe(gulp.dest('./dist'));
    });

    gulp.task("header", function () {
        settings.banner.vars.pkg = getPackageJson();

        return gulp.src('./dist/*.js')
            .pipe(header(settings.banner.content, settings.banner.vars ))
            .pipe(gulp.dest('./dist/'));
    });

    gulp.task('size-dev', function () {
        return gulp.src('./src/**/*.js')
            .pipe(size({
                gzip: true,
                minifier: function (content) {
                    return UglifyJs.minify(content, { fromString: true }).code;
                }, 
                '*': {
                    'maxMinifiedSize': 5900,
                    'maxMinifiedGzippedSize': 2500
                }
            }));
    });

    gulp.task('size-dist', function () {
        return gulp.src('./dist/**/*.js')
            .pipe(size({
                gzip: true,
                'pin.min.js': {
                    'maxSize': 5000,
                    'maxGzippedSize': 2500
                },
                'pin.lite.min.js': {
                    'maxSize': 1900,
                    'maxGzippedSize': 1000
                }
            }));
    });

    gulp.task("gh-pages", function (cb) {
        var version = getPackageJson().version;

        exec([  'git checkout gh-pages',
                'rm -rf releases/' + version,
                'mkdir -p releases/' + version,
                'cp -r tmp/* releases/' + version,
                'git add -A releases/' + version,
                'rm -rf releases/latest',
                'mkdir -p releases/latest',
                'cp -r tmp/* releases/latest',
                'git add -A releases/latest',
                'git commit -m "Publish release v' + version + '."',
                'git push origin gh-pages',
                'git checkout -'
            ].join(" && "),
            function (err, output, code) {
                if (code !== 0) {
                    return cb(err + output);
                }
                return cb();
            }
        );
    });

    gulp.task("watch-size", function () {
        gulp.watch('./src/**/*.js', [ 'size-dev'] );
    });

    gulp.task("test", sync([
        "lint",
        "qunit"
    ], 
    "building"));

    gulp.task("build", sync([
        "lint",
        "qunit", 
        "clean", 
        "copy-lite",
        "copy", 
        "uglify",
        "header",
        "size-dist"
    ], 
    "building"));

    gulp.task("release", sync([
      [ "fail-if-not-master", "fail-if-dirty" ],
        "git-pull",
        "lint",
        "qunit",
        "bump",
        "license",
        "clean",
        "copy-lite",
        "copy",
        "uglify",
        "header",
        "git-add",
        "git-commit",
        "git-tag",
        "git-push",
        "publish",
        "size-dist"
    ], 
    "releasing"));

    gulp.task("publish", sync([
      [ "fail-if-not-master", "fail-if-dirty" ],
        "tmp-create",
        "tmp-copy",
        "meta",
        "zip",
        "gh-pages",
        "tmp-clean",
        "size-dist"
    ], 
    "publising"));
})();

/*

NPM Installation
----------------

npm install --save-dev del
npm install --save-dev yargs
npm install --save-dev exec
npm install --save-dev fs
npm install --save-dev gulp
npm install --save-dev gulp-bump
npm install --save-dev gulp-header
npm install --save-dev gulp-qunit
npm install --save-dev gulp-uglify
npm install --save-dev gulp-sourcemaps
npm install --save-dev gulp-jshint
npm install --save-dev gulp-util
npm install --save-dev gulp-zip
npm install --save-dev gulp-rename
npm install --save-dev gulp-replace
npm install --save-dev gulp-sync
npm install --save-dev gulp-sizereport
npm install --save-dev gulp-strip-code

Gh-pages creation
-----------------

git checkout --orphan gh-pages
git rm -rf .
rm -fr
echo "Welcome" > index.html
git add index.html
git commit -a -m "First commit"
git push origin gh-pages
git checkout -

*/

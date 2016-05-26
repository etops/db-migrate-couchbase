import gulp         from 'gulp';
import babel        from 'gulp-babel';
import sourcemaps   from 'gulp-sourcemaps';
import config       from '../config';

gulp.task('compile', ['clean'], function () {
    // var cache = new Cache();
    return gulp.src(config.scripts.babelSrc, { base: '.' })
        // .pipe(cache.filter()) // remember files
        .pipe(sourcemaps.init())
        .pipe(babel({
            only: [/(\.(js)$)/i]
        }))
        .pipe(sourcemaps.write('./maps', {includeContent: false, sourceRoot: '../'}))
        // .pipe(cache.cache()) // cache them
        .pipe(gulp.dest(config.dist)); // write them
});

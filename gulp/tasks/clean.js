import gulp from 'gulp';
import config from '../config';
import clean from 'gulp-clean';

gulp.task('clean', () => gulp.src(config.dist, { base: '.' }).pipe(clean()));

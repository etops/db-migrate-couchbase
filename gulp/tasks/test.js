import gulp from 'gulp';
import babel from 'gulp-babel';
import mocha from 'gulp-mocha';
import babelIstanbul from 'gulp-babel-istanbul';
import injectModules from 'gulp-inject-modules';
import config from '../config';
import circleCI from 'mocha-circleci-reporter';
//import debug        from 'gulp-debug';

gulp.task('test', (cb) => {
  const testXMLFile = (process.env.CIRCLE_TEST_REPORTS || '.') + '/test-results.xml';
  process.env.MOCHA_FILE = testXMLFile;

  gulp.src(config.scripts.src)
    .pipe(babelIstanbul())
    .pipe(babelIstanbul.hookRequire()) // or you could use .pipe(injectModules())
    .on('finish', () => {
      gulp.src(config.scripts.test)
        .pipe(babel())
        .pipe(injectModules())
        .pipe(mocha({ reporter: circleCI, timeout: 10000 }))
        .pipe(babelIstanbul.writeReports({
          dir: './coverage',
          reporter: ['lcov'],
        }))
        .on('finish', () => { })
        .on('end', cb);
    });
});

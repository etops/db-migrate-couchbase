import path from 'path';

// Filters out non .js files. Prevents
// accidental inclusion of possible hidden files
export default (name) => /(\.(js)$)/i.test(path.extname(name));

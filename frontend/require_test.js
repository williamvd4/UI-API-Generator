try {
  console.log('node test start');
  const c = require('lightningcss');
  console.log('required ok', typeof c);
} catch (e) {
  console.error('require error', e && e.stack || e);
  process.exit(1);
}

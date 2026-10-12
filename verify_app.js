const { JSDOM } = require('jsdom');

(async () => {
  const dom = await JSDOM.fromFile('index_clean.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });

  const { window } = dom;
  const errors = [];

  window.addEventListener('error', (event) => {
    errors.push(event.error ? event.error.message : event.message);
  });

  await new Promise((resolve) => window.setTimeout(resolve, 500));

  if (errors.length) {
    console.log('ERROR_COUNT=' + errors.length);
    console.log(errors.slice(0, 5).join('\n'));
    process.exit(1);
  }

  const loginScreen = window.document.getElementById('loginScreen');
  const mainApp = window.document.getElementById('mainApp');

  console.log('ERROR_COUNT=0');
  console.log('LOGIN_DISPLAY=' + (loginScreen ? getComputedStyle(loginScreen).display : 'missing'));
  console.log('MAIN_DISPLAY=' + (mainApp ? getComputedStyle(mainApp).display : 'missing'));
})();

import fs from 'fs';
import colors from 'colors';
import fetch from 'node-fetch';
import rimraf from 'rimraf';

// Config

const resultFolder = './files';

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36';

const weightName = {
  100: ['Thin', 'Hairline'],
  200: ['Extra-light', 'Ultra Light'],
  300: ['Light'],
  400: ['Normal', 'Regular'],
  500: ['Medium'],
  600: ['Semi Bold', 'Demi Bold'],
  700: ['Bold'],
  800: ['Extra bold', 'Ultra Bold'],
  900: ['Black', 'Heavy']
};

// Functions
function showProgress(curr, total, message) {
  const precentage = parseInt((curr / total * 100).toString());
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write('[');
  for (let i = 0; i < 100; i = i + 10) {
    process.stdout.write((i < precentage) ? '█' : ' ');
  }
  process.stdout.write(`] ${message}...`);
}

function sleep(millisecond) {
  var start = new Date().getTime() ;
  while (true) {
    if (new Date().getTime() - start > millisecond) break;
  }
}

function parseArgv(argv) {
  const args = {};
  argv.forEach(arg => {
    let parts = arg.split('='),
      name = parts[0].replace('--', '');
    args[name] = parts.length == 1 ? true: parts[1];
    if (!isNaN(parseInt(args[name]))) args[name] = parseFloat(args[name]);
  });
  return args;
}

async function parseGoogleFonts(url) {
  // Check URL
  if (!url)
    throw new Error(`URL Argument is required. Please run with "node app --url=https://fonts.google.com/... `);
  if (!url.startsWith('https://fonts.google.com/'))
    throw new Error(`This programme only support google fonts. Please use URL starts with https://fonts.google.com/`);

  const fontUrlName = url.split('/').pop()
  const fontWeights = {};
  for (let w = 100; w <= 900; w = w + 100) {
    try {
      let response = await fetch(`https://fonts.googleapis.com/css2?family=${fontUrlName}:wght@${w}`, {
        headers: {
          'user-agent': userAgent
        }
      });
      if (response.status === 200) {
        fontWeights[`${w}`] = await response.text();
      }
    } catch (error) {}
  }

  return {
    name: fontUrlName.replace(/\+/g, ' '),
    urlName: fontUrlName,
    weights: fontWeights,
  };
}

function addLocalFontRef(cssContent, fontName, weight) {
  const locals = [];
  weightName[weight].forEach(name => locals.push(`local("${name} ${name}")`));
  weightName[weight].forEach(name => locals.push(`local("${name.replace(/\s/g, '')}-${name}")`));
  return cssContent.replace(/(src\:\s?url\()/g, `src: ${locals.join(', ')}, url(`);
}

function storeCssFile(filepath, content) {
  fs.writeFileSync(filepath, content, 'utf8');
}

async function downloadWithFontWeight(name, urlName, weight, cssContent) {
  let fontUrls = cssContent.match(/(https:\/\/fonts\.gstatic\.com\/.*\.woff2)/ig);
  if (fontUrls.length === 0) return;

  let version = fontUrls[0].split('/')[5];
  let fontFolder = `${resultFolder}/${name}/${version}/${weight}`;

  console.log(`Downloading font file with font-weight ${weight} in version ${version} ...`);
  console.log(`Starting ...`);

  // Remove and create font directory
  if (fs.existsSync(fontFolder)) {
    rimraf.sync(fontFolder);
  }
  fs.mkdirSync(`${fontFolder}/css/`, { recursive: true });
  fs.mkdirSync(`${fontFolder}/fonts/`, { recursive: true });

  for (let index in fontUrls) {
    let fontUrl = fontUrls[index],
      fNamePart = fontUrl.split('/')[6].split('.'),
      newFilename = `${name.replace(/\s/g, '-')}-${fNamePart[1]}.${fNamePart[2]}`;

    // Update file path in css file.
    cssContent = cssContent.replace(fontUrl, `"../fonts/${newFilename}"`);

    // Download font file
    showProgress(parseInt(index), fontUrls.length, `Downloading for file ${colors.cyan(newFilename)}...`);
    const response = await fetch(fontUrl, { headers: {'user-agent': userAgent} });
    response.body.pipe(fs.createWriteStream(`${fontFolder}/fonts/${newFilename}`));

    sleep(50);
  }

  showProgress(1, 1, `Download ${colors.cyan(name)}:${colors.cyan(weight)} completed.\n`);

  // Add local file name to css
  addLocalFontRef(cssContent, name, weight);

  // Store css file
  storeCssFile(`${fontFolder}/css/style.css`, cssContent);
}

const main = async () => {
  try {
    // Handle CLI arguments
    const args = parseArgv(process.argv.slice(2));

    console.log(`\n`);

    let googleObj = await parseGoogleFonts(args.url);
    if (Object.keys(googleObj.weights).length === 0) {
      throw new Error(`Font not found or no font-weight in this font.`);
    }
    for (let weight in googleObj.weights) {
      await downloadWithFontWeight(googleObj.name, googleObj.urlName, weight, googleObj.weights[weight]);
    }

  } catch (error) {
    console.error(colors.red(error.toString()));
    process.exit(1);
  }
};

main();
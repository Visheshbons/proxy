import readline from 'readline';
import chalk from 'chalk';

// Utility functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function caesarCipher(str, shift, decrypt = false) {
  const offset = decrypt ? -shift : shift;
  return str
    .split('')
    .map(char => {
      if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((char.charCodeAt(0) - 65 + offset + 26) % 26) + 65);
      } else if (char >= 'a' && char <= 'z') {
        return String.fromCharCode(((char.charCodeAt(0) - 97 + offset + 26) % 26) + 97);
      }
      return char;
    })
    .join('');
}

function escapeSpecialChars(str) {
  return str.replace(/[\s\S]/g, function (char) {
    const code = char.codePointAt(0);
    if (code > 0x7F) {
      return code > 0xFFFF
        ? '\\u{' + code.toString(16).toUpperCase() + '}'
        : '\\u' + code.toString(16).padStart(4, '0').toUpperCase();
    }
    return char;
  });
}

function base64(str, direction) {
  if (direction === 'encrypt') {
    return Buffer.from(str, 'utf8').toString('base64');
  } else if (direction === 'decrypt') {
    return Buffer.from(str, 'base64').toString('utf8');
  }
}

// Setup readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisified ask()
function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

let PANIC;

// Main sequence
async function main() {
  console.log(chalk.green('PLEASE WAIT...\n'));
  console.log(chalk.green('ACCESS GRANTED.\n'));

  await selectKey();
  await confirm();
  const url = await getUrl();
  await urlCrypt(url);
}

// Ask for panic key
async function selectKey() {
  console.log(chalk.green('PLEASE SELECT A PANIC KEY TO ESCAPE GAME'));
  PANIC = await ask(chalk.green('[PRESS ANY KEY ] '));
}

// Confirm panic key
async function confirm() {
  console.log();
  console.log(chalk.green(`YOU HAVE SELECTED '${PANIC}' AS YOUR ESCAPE KEY.`));
  const ans = await ask(chalk.green('IS THIS OK? (y/n) '));
  if (ans.toLowerCase() === 'n') {
    await selectKey();
    await confirm();
  }
}

// Get the URL to encrypt
async function getUrl() {
  const url = await ask(chalk.green('ENTER URL: '));
  console.log(chalk.green(`\nPLEASE WAIT...\n`));
  return url;
}

// URL encryption + animation
async function urlCrypt(url) {
  url = caesarCipher(escapeSpecialChars(url), 3);

  // CYPHERING
  const label1 = 'CYPHERING REQUEST... [';
  process.stdout.write(chalk.green(label1));
  process.stdout.write(chalk.green('    ]'));
  await delay(1000);
  readline.cursorTo(process.stdout, label1.length);
  process.stdout.write(chalk.greenBright('PASS'));
  console.log('');

  // ENCRYPTING
  url = base64(escapeSpecialChars(url), 'encrypt');
  const label2 = 'ENCRYPTING REQUEST... [';
  process.stdout.write(chalk.green(label2));
  process.stdout.write(chalk.green('    ]'));
  await delay(1000);
  readline.cursorTo(process.stdout, label2.length);
  process.stdout.write(chalk.greenBright('PASS'));
  console.log('');

  // GET
  console.log('');
  const urlMsg = `SENDING GET(${url})... [`;
  process.stdout.write(chalk.green(`SENDING GET(`));
  process.stdout.write(chalk.grey(url));
  process.stdout.write(chalk.green(`)... [`));
  process.stdout.write(chalk.green('    ]'));
  await delay(1000);
  readline.cursorTo(process.stdout, urlMsg.length);
  process.stdout.write(chalk.greenBright('PASS'));
  console.log('');

  // Redirecting + exit
  await delay(1000);
  console.log(chalk.green(`\nREDIRECTING...`));
  await delay(1500);

  process.kill(process.pid, 'SIGINT');
}

// Graceful exit
process.on('SIGINT', () => {
  console.log(chalk.red('\n^C Interrupt received. Exiting.'));
  rl.close();
  process.exit();
});

// GO
main();
// run `node index.js` in the terminal

console.log(`Hello Node.js v${process.versions.node}!`);

console.log(`Server script is at "server.js"`);
console.log(`Running "node server.js"...`);

import { exec } from "child_process";

function runBashCommand(command) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
  });
}

// Example usage:
runBashCommand("node server.js");

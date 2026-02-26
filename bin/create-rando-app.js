#!/usr/bin/env node

const args = process.argv.slice(2);
const target = args[0] || "rando-app";

console.log(`create-rando-app: scaffold placeholder for '${target}'`);
console.log("Next steps:");
console.log("1) cd", target);
console.log("2) npm install");
console.log("3) npm run dev");

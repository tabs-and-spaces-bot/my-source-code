const GitHub = require("github-api");
const settings = require("./settings.json");
const handler = require("./src/handler.js");

let client = global.client = new GitHub(settings);

let me = global.me = client.getUser(settings.username);

handler(client, me);

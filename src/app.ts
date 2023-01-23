// Copyright (C) 2022 MCSManager <mcsmanager-dev@outlook.com>

import http from "http";
import fs from "fs-extra";
import { $t, i18next } from "./i18n";
import { getVersion, initVersionManager } from "./service/version";
import { globalConfiguration } from "./entity/config";
import { Server, Socket } from "socket.io";
import { LOCAL_PRESET_LANG_PATH } from "./const";
import logger from "./service/log";

import Storage from "./common/storage/sys_storage";
import RedisStorage from "./common/storage/redis_storage";

initVersionManager();
const VERSION = getVersion();

console.log(`
______  _______________________  ___                                         
___   |/  /_  ____/_  ___/__   |/  /_____ _____________ _______ _____________
__  /|_/ /_  /    _____ \\__  /|_/ /_  __ \`/_  __ \\  __ \`/_  __ \`/  _ \\_  ___/
_  /  / / / /___  ____/ /_  /  / / / /_/ /_  / / / /_/ /_  /_/ //  __/  /    
/_/  /_/  \\____/  /____/ /_/  /_/  \\__,_/ /_/ /_/\\__,_/ _\\__, / \\___//_/     
                                                        /____/               
________                                                                     
___  __ \\_____ ____________ ________________                                 
__  / / /  __ \`/  _ \\_  __ \`__ \\  __ \\_  __ \\                                
_  /_/ // /_/ //  __/  / / / / / /_/ /  / / /                                
/_____/ \\__,_/ \\___//_/ /_/ /_/\\____//_/ /_/                                 
                                                                             

 + Copyright 2022-2023 MCSManager Dev <https://github.com/MCSManager>
 + Version ${VERSION}
`);

// Initialize the global configuration service
globalConfiguration.load();
const config = globalConfiguration.config;
if (config.redisUrl.length != 0) {
  logger.info("RedisUrl detected, switching to Redis...");
  Storage.setStorageType(1);
  RedisStorage.initialize(config.redisUrl);
}

// Set language
if (fs.existsSync(LOCAL_PRESET_LANG_PATH)) {
  i18next.changeLanguage(fs.readFileSync(LOCAL_PRESET_LANG_PATH, "utf-8"));
} else {
  const lang = config.language || "en_us";
  logger.info(`LANGUAGE: ${lang}`);
  i18next.changeLanguage(lang);
}
logger.info($t("app.welcome"));

import * as router from "./service/router";
import * as koa from "./service/http";
import * as protocol from "./service/protocol";
import InstanceSubsystem from "./service/system_instance";
import { initDependent } from "./service/install";
import "./service/async_task_service";
import "./service/async_task_service/quick_install";
import redis_storage from "./common/storage/redis_storage";
import sys_storage from "./common/storage/sys_storage";

// Initialize HTTP service
const koaApp = koa.initKoa();

// Listen for Koa errors
koaApp.on("error", (error) => {
  // Block all Koa framework error
  // When Koa is attacked by a short connection flood, it is easy for error messages to swipe the screen, which may indirectly affect the operation of some applications
});

const httpServer = http.createServer(koaApp.callback());
httpServer.on("error", (err) => {
  logger.error($t("app.httpSetupError"));
  logger.error(err);
  process.exit(1);
});
httpServer.listen(config.port, config.ip);

// Initialize Websocket service to HTTP service
const io = new Server(httpServer, {
  serveClient: false,
  pingInterval: 5000,
  pingTimeout: 5000,
  cookie: false,
  path: "/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Initialize optional dependencies
initDependent();

// Initialize application instance system
try {
  InstanceSubsystem.loadInstances();
  logger.info($t("app.instanceLoad", { n: InstanceSubsystem.instances.size }));
} catch (err) {
  logger.error($t("app.instanceLoadError"), err);
  process.exit(-1);
}

// Initialize Websocket server
io.on("connection", (socket: Socket) => {
  logger.info($t("app.sessionConnect", { ip: socket.handshake.address, uuid: socket.id }));

  protocol.addGlobalSocket(socket);
  router.navigation(socket);

  socket.on("disconnect", () => {
    protocol.delGlobalSocket(socket);
    for (const name of socket.eventNames()) socket.removeAllListeners(name);
    logger.info($t("app.sessionDisconnect", { ip: socket.handshake.address, uuid: socket.id }));
  });
});

process.on("uncaughtException", function (err) {
  logger.error(`Error: UncaughtException:`, err);
});

process.on("unhandledRejection", (reason, p) => {
  logger.error(`Error: UnhandledRejection:`, reason, p);
});

logger.info("----------------------------");
logger.info($t("app.started"));
logger.info($t("app.doc"));
logger.info($t("app.addr", { port: config.port }));
logger.info($t("app.configPathTip", { path: "" }));
logger.info($t("app.password", { key: config.key }));
logger.info($t("app.passwordTip"));
logger.info($t("app.exitTip"));
logger.info("----------------------------");
console.log("");

async function processExit() {
  try {
    console.log("");
    logger.warn("Program received EXIT command.");
    await InstanceSubsystem.exit();
    logger.info("Exit.");
  } catch (err) {
    logger.error("ERROR:", err);
  } finally {
    process.exit(0);
  }
}

["SIGTERM", "SIGINT", "SIGQUIT"].forEach(function (sig) {
  process.on(sig, () => {
    logger.warn(`${sig} close process signal detected.`);
    processExit();
  });
});

process.stdin.on("data", (v) => {
  const command = v.toString().replace("\n", "").replace("\r", "").trim().toLowerCase();
  if (command === "exit") processExit();
});

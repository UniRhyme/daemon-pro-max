// Copyright (C) 2022 MCSManager <mcsmanager-dev@outlook.com>

import * as protocol from "../service/protocol";
import { routerApp } from "../service/router";
import InstanceSubsystem from "../service/system_instance";
import Instance from "../entity/instance/instance";

import { systemInfo } from "../common/system_info";
import { getVersion } from "../service/version";
import { globalConfiguration } from "../entity/config";
import i18next from "i18next";

// Get the basic information of the daemon system
routerApp.on("info/overview", async (ctx) => {
  const daemonVersion = getVersion();
  let total = 0;
  let running = 0;
  InstanceSubsystem.instances.forEach((v) => {
    total++;
    if (v.status() == Instance.STATUS_RUNNING) running++;
  });
  const info = {
    version: daemonVersion,
    process: {
      cpu: process.cpuUsage().system,
      memory: process.memoryUsage().heapUsed,
      cwd: process.cwd()
    },
    instance: {
      running,
      total
    },
    system: systemInfo()
  };
  protocol.response(ctx, info);
});

routerApp.on("info/setting", async (ctx, data) => {
  const language = String(data.language);
  try {
    i18next.changeLanguage(language);
    globalConfiguration.config.language = language;
    globalConfiguration.store();
    protocol.response(ctx, true);
  } catch (error) {
    protocol.responseError(ctx, error);
  }
});

// Copyright (C) 2023 Rabbit0w0
// This file is a part of our private package

import { $t } from "../../i18n";
import { createClient} from "redis";
import * as deasync from "deasync";
import { IStorage } from "./storage_interface";
import Storage from "./sys_storage";
import logger from "../../service/log";

class RedisStorageSubsystem implements IStorage {

  private client = createClient()

  private async connect() {
    try {
      await this.client.connect();
    } catch (e) {
      logger.error("Error occurred while trying to dial redis\n" + e);
      logger.warn("Due to an unrecoverable error, daemon will temporarily store data in files.")
      Storage.setStorageType(0)
    }
  }

  /*
  Redis commands
   */
  private async keys(param: string, callback: Function) {
    callback(await this.client.keys(param));
  }

  private async set(key: string, value: string) {
    await this.client.set(key, value);
  }

  private async get(key: string, callback: Function) {
    callback(await this.client.get(key));
  }

  private async del(key: string) {
    await this.client.del(key);
  }

  public initialize(url: string) {
    this.client = createClient({ url: url });
    let done = false;
    console.log("Attempting to connect to redis...");
    this.connect().then(() => {done = true});
    deasync.loopWhile(() => {
      return !done;
    })
    console.log("Connected to redis!");
  }

  // 保持行为一致
  private checkFileName(name: string) {
    const blackList = ["\\", "/", ".."];
    for (const ch of blackList) {
      if (name.includes(ch)) return false;
    }
    return true;
  }

  /**
   * Stored in local file based on class definition and identifier
   */
  public store(category: string, uuid: string, object: any) {
    if (!this.checkFileName(uuid)) throw new Error($t("common.uuidIrregular", { uuid: uuid }));
    let done = false;
    this.set(category + ":" + uuid, JSON.stringify(object)).then(() => {done = true});
    deasync.loopWhile(() => {
      return !done;
    })
  }

  /**
   * Instantiate an object based on the class definition and identifier
   */
  public load(category: string, classz: any, uuid: string) {
    if (!this.checkFileName(uuid)) throw new Error($t("common.uuidIrregular", { uuid: uuid }));
    let done = false;
    let result = "";
    this.get(category + ":" + uuid, function(r: string) {
      result = r;
      done = true;
    })
    deasync.loopWhile(() => {
      return !done;
    })
    if (result == null) {
      return null;
    }
    const dataObject = JSON.parse(result);
    const target = new classz();
    return this.defineAttr(target, dataObject);
  }

  /**
   * Return all identifiers related to this class through the class definition
   */
  public list(category: string) {
    let done = false;
    let result: string[] = [];
    let m = Array<string>();
    this.keys(category + "*", function(r: string[]) {
      result = r;
      done = true;
    })
    deasync.loopWhile(() => {
      return !done;
    })
    if (result != null && result.length != 0) {
      for (let i of result) m.push(i.replace(category + ":", ""));
    }
    return m;
  }

  /**
   * Delete an identifier instance of the specified type through the class definition
   */
  public delete(category: string, uuid: string) {
    if (!this.checkFileName(uuid)) throw new Error($t("common.uuidIrregular", { uuid: uuid }));
    let done = false;
    this.del(category + ":" + uuid).then(() => {done = true});
    deasync.loopWhile(() => {
      return !done;
    })
  }

  // deep copy of the primitive type with the copy target as the prototype
  // target copy target object copy source
  protected defineAttr(target: any, object: any): any {
    for (const v of Object.keys(target)) {
      const objectValue = object[v];
      if (objectValue === undefined) continue;
      if (objectValue instanceof Array) {
        target[v] = objectValue;
        continue;
      }
      if (objectValue instanceof Object && typeof objectValue === "object") {
        this.defineAttr(target[v], objectValue);
        continue;
      }
      target[v] = objectValue;
    }
    return target;
  }
}

export default new RedisStorageSubsystem();

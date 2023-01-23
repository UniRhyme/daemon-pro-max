export interface IStorage {
  store(category: string, uuid: string, object: any): void;
  load(category: string, classz: any, uuid: string): any;
  list(category: string): Array<string>;
  delete(category: string, uuid: string): void;
}
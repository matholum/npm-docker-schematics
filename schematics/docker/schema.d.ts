
export interface Schema {
  project: string;
  buildPath: string;
  dockerfile: string;
  dockerignore: string;
  registry: string | undefined;
}
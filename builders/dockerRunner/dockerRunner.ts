import * as fs from 'fs-extra';
import { spawn$ } from 'observable-spawn';
import path from 'path';
import { Observable, of } from 'rxjs';
import { concatAll, concatMap, tap } from 'rxjs/operators';
import _ from 'underscore';

import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { getSystemPath, JsonObject, normalize, resolve } from '@angular-devkit/core';

interface DockerRunnerOptions extends JsonObject {
    vars: Array<string>;
    ports: Array<string>;
    mounts: Array<string>;
  }

export default createBuilder<DockerRunnerOptions>(
    (options: DockerRunnerOptions, context: BuilderContext): Promise<BuilderOutput> => {
        if(context.target === undefined) {
            throw new Error('No target found!');
        }

        if(context.target === undefined) {
            throw new Error('Unable to get project name!');
        }

        const root = context.workspaceRoot;

        const name = context.target.project;
        const vars: any = options.vars !== undefined ? options.vars : {};
        const ports: any = options.ports !== undefined ? options.ports : {};
        let mounts: any = undefined;

        if(options.mounts !== undefined) {
            mounts = _.invert(options.mounts);
            mounts = _.mapObject(mounts, m => getSystemPath(resolve(normalize(root), normalize(m))));
            mounts = _.invert(mounts);

        }

        const createDockerArgs = (obj: any, argName: string, delimeter: string) => {
            return _.map(
                    _.keys(obj), (key: string) => `-${argName} ${key.replace(' ','')}${delimeter}${obj[key].toString().replace(' ','')}`
                ).join(' ');
        };

        const varsString = createDockerArgs(vars, 'e', '=');
        const portsString = createDockerArgs(ports, 'p', ':');
        const mountsString = createDockerArgs(mounts, 'v', ':');

        const args = _.without(['--rm', varsString, portsString, mountsString], '');

        console.log(`Running the previously build docker container for project '${context.target.project}'...`);

        return new Observable<BuilderOutput>(obs => {
            spawn$(`docker run ${args.join(' ')} ${name}`)
            .pipe(
                tap(output => console.log(output))
            )
            .subscribe(
                    undefined,
                    (err: any) => {
                        obs.error(err);
                        obs.complete();
                    },
                    () => {
                        obs.next({ success: true });
                        obs.complete();
                    }
                );
        }).toPromise();
    }
);

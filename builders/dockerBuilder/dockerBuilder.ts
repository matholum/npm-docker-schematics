import * as fs from 'fs-extra';
import { spawn$ } from 'observable-spawn';
import path from 'path';
import { concat, iif, noop, Observable, of } from 'rxjs';
import { concatAll, concatMap, map, merge, tap } from 'rxjs/operators';
import _ from 'underscore';

import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { getSystemPath, JsonObject, normalize, resolve } from '@angular-devkit/core';

import { createBuildCommand } from '../base/dockerBuild';

interface DockerBuilderOptions extends JsonObject {
    buildPath: string;
    dockerfile: string;
    dockerignore: string;
  }

export default createBuilder<DockerBuilderOptions>(
    (options: DockerBuilderOptions, context: BuilderContext): Promise<BuilderOutput> => {
        const command = createBuildCommand(options, context);

        if(context.target === undefined) {
            throw new Error('Unable to get project name!');
        }

        const name = context.target.project;
        const root = context.workspaceRoot;
        const buildPath: string = getSystemPath(resolve(normalize(root), normalize(options.buildPath)));

        const versionPath: string = path.join(buildPath, 'VERSION');
        const version = fs.existsSync(versionPath)
            ? fs.readFileSync(versionPath).toString()
            : undefined;

        console.log(`Doing a docker build on project '${context.target.project}'...`);

        return new Observable<BuilderOutput>(obs => {
            concat(
                spawn$(command),
                iif(() => version !== undefined, spawn$(`docker tag ${name}:latest ${name}:${version}`))
            )
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

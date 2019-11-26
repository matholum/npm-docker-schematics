import * as fs from 'fs-extra';
import { spawn$ } from 'observable-spawn';
import path from 'path';
import { concat, iif, Observable, of } from 'rxjs';
import { concatAll, concatMap, tap } from 'rxjs/operators';
import _ from 'underscore';

import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { getSystemPath, JsonObject, normalize, resolve } from '@angular-devkit/core';

interface DockerRunnerOptions extends JsonObject {
    registry: string;
    buildPath: string;
  }

export default createBuilder<DockerRunnerOptions>(
    (options: DockerRunnerOptions, context: BuilderContext): Promise<BuilderOutput> => {
        if(context.target === undefined) {
            throw new Error('No target found!');
        }

        if(context.target === undefined) {
            throw new Error('Unable to get project name!');
        }

        if(options.registry === undefined || options.registry === '') {
            throw new Error('No registry specified!');
        }

        const root = context.workspaceRoot;
        const name = context.target.project;

        let version: string | undefined = undefined;

        if(options.buildPath !== undefined && options.buildPath !== '') {
            const buildPath: string = getSystemPath(resolve(normalize(root), normalize(options.buildPath)));
            const versionPath: string = path.join(buildPath, 'VERSION');

            version = fs.existsSync(versionPath)
                ? fs.readFileSync(versionPath).toString()
                : undefined;
        }

        console.log(`Pushing the previously build docker container for project '${context.target.project}' to registry '${options.registry}'...`);

        return new Observable<BuilderOutput>(obs => {
            concat(
                iif(
                    () => version !== undefined,
                    concat(
                        spawn$(`docker tag ${name}:latest ${options.registry}/${name}:${version}`),
                        spawn$(`docker push ${options.registry}/${name}:${version}`)
                    )
                ),
                spawn$(`docker tag ${name}:latest ${options.registry}/${name}:latest`),
                spawn$(`docker push ${options.registry}/${name}:latest`)
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

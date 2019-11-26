import * as fs from 'fs-extra';
import { spawn$ } from 'observable-spawn';
import path from 'path';
import { concat, iif, noop, Observable, of } from 'rxjs';
import { concatAll, concatMap, map, merge, tap } from 'rxjs/operators';
import _ from 'underscore';

import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { getSystemPath, JsonObject, normalize, resolve } from '@angular-devkit/core';

interface DockerBuilderOptions extends JsonObject {
    buildPath: string;
    dockerfile: string;
    dockerignore: string;
  }

export default createBuilder<DockerBuilderOptions>(
    (options: DockerBuilderOptions, context: BuilderContext): Promise<BuilderOutput> => {
        if(context.target === undefined) {
            throw new Error('No target found!');
        }

        if (!options.buildPath || !fs.existsSync(options.buildPath)) {
            throw new Error('You must specify a build path.');
        }

        if (!options.dockerfile || !fs.existsSync(options.dockerfile)) {
            throw new Error('You must specify a path to a dockerfile.');
        }

        const root = context.workspaceRoot;
        const buildPath: string = getSystemPath(resolve(normalize(root), normalize(options.buildPath)));
        const dockerfile: string = getSystemPath(resolve(normalize(root), normalize(options.dockerfile)));

        if (!fs.existsSync(buildPath)) {
            throw new Error('The build path specified cannot be found.');
        }

        if (!fs.existsSync(dockerfile)) {
            throw new Error('The dockerfile specified cannot be found.');
        }

        if (options.dockerignore && options.dockerignore !== '') {
            const srcPath: string = getSystemPath(resolve(normalize(root), normalize(options.dockerfile)));
            const destPath: string = path.join(buildPath, '.dockerfile');

            if(srcPath !== destPath) {
                if(!fs.existsSync(srcPath)) {
                    throw new Error('The path provided for the dockerignore is invalid. If no dockerignore is required please remove that field.');
                }

                fs.copyFileSync(srcPath, destPath);
            }
        }

        if(context.target === undefined) {
            throw new Error('Unable to get project name!');
        }

        const name = context.target.project;

        const versionPath: string = path.join(buildPath, 'VERSION');
        const version = fs.existsSync(versionPath)
            ? fs.readFileSync(versionPath).toString()
            : undefined;

        console.log(`Doing a docker build on project '${context.target.project}'...`);

        return new Observable<BuilderOutput>(obs => {
            concat(
                spawn$(`docker build -t ${name}:latest -f ${dockerfile} ${buildPath}`),
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

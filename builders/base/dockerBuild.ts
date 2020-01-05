import * as fs from 'fs-extra';
import path from 'path';
import _ from 'underscore';

import { BuilderContext } from '@angular-devkit/architect';
import { getSystemPath, JsonObject, normalize, resolve } from '@angular-devkit/core';

export interface DockerBuildOptions extends JsonObject {
    buildPath: string;
    dockerfile: string;
    dockerignore: string;
  }

export const createBuildCommand = (options: DockerBuildOptions, context: BuilderContext): string => {
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

    const command = `docker build -t ${name}:latest -f ${dockerfile} ${buildPath}`;

    return command;
};

import * as fs from 'fs-extra';
import path from 'path';
import _ from 'underscore';

import { experimental, join, normalize, strings } from '@angular-devkit/core';
import {
    apply, applyTemplates, chain, filter, mergeWith, move, noop, Rule, SchematicContext,
    SchematicsException, template, Tree, url
} from '@angular-devkit/schematics';
import {
    addDepsToPackageJson, formatFiles, getNpmScope, getProjectConfig, names, NxJson, offsetFromRoot,
    toClassName, updateJsonInTree, updateWorkspaceInTree
} from '@nrwl/workspace';

import dotnetSchematicPkg from '../../package.json';
import { Schema } from './schema';

function check(options: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.project);

    if (projectConfig.architect.buildDocker) {
      throw new Error(`${options.project} already has a buildDocker architect option.`);
    }

    return host;
  };
}

export function createFiles(options: Schema): Rule {
  return chain([createProjectFiles(options), createRootFiles(options)]);
}

function createProjectFiles(options: Schema): Rule {
  return (host, context) => {
    const projectConfig = getProjectConfig(host, options.project);

    return mergeWith(
      apply(url('./files'), [
        filter(f => path.basename(f) !== '.dockerignore'),
        applyTemplates({
          ...options,
          projectRoot: projectConfig.root,
          offsetFromRoot: offsetFromRoot(projectConfig.root)
        }),
        move(projectConfig.root)
      ])
    )(host, context);
  };
}

function createRootFiles(options: Schema): Rule {
  return (host, context) => {
    if(host.exists('.dockerignore')) {
      return noop;
    }

    return mergeWith(
      apply(url('./files'), [
        filter(f => path.basename(f) === '.dockerignore'),
        move('.')
      ])
    )(host, context);
  };
}

export function updateWorkspaceJson(options: Schema): Rule {
  return updateWorkspaceInTree((json: any) => {
    const projectConfig = json.projects[options.project];

    const buildPath = options.buildPath || path.join('dist', projectConfig.root);
    const dockerfile = options.dockerfile || path.join(projectConfig.root, 'dockerfile');
    const dockerignore = options.dockerignore || path.join('.', '.dockerignore');

    const runner = process.argv.length > 2 && process.argv[1].endsWith(`${path.sep}nx`) ? { runner: 'nx' } : {};

    let hasMulti = false;

    const multiBuild = {
      builder: 'common-schematics:multi-builder',
      options: {
        ...runner,
        targets: [ 'buildSrc', 'buildDocker']
      },
      configurations: {
        dev: {},
        prod: {} as any
      }
    };

    const buildDocker = {
      builder: 'docker-schematics:build-docker',
      options: {
        buildPath,
        dockerfile,
        dockerignore
      },
      configurations: {
        dev: {},
        prod: {}
      }
    };

    if(options.registry !== undefined && options.registry !== '') {
      projectConfig.architect.publishDocker = {
        builder: 'docker-schematics:publish-docker',
        options: {
          registry: options.registry,
          buildPath
        },
        configurations: {
          dev: {},
          prod: {}
        }
      };

      hasMulti = true;

      multiBuild.configurations.prod.additionalTargets = multiBuild.configurations.prod.additionalTargets !== undefined
        ? multiBuild.configurations.prod.additionalTargets.concat(['publishDocker'])
        : ['publishDocker'];
    }

    if(projectConfig.architect.build !== undefined) {
      if(projectConfig.architect.build.builder === 'common-schematics:multi-builder') {
        projectConfig.architect.build.options.targets.push('buildDocker');
        hasMulti = true;
      } else {
        projectConfig.architect.buildSrc = projectConfig.architect.build;
        projectConfig.architect.build = multiBuild;
      }

    } else {
      projectConfig.architect.build = hasMulti ? multiBuild : buildDocker;
    }

    if(hasMulti) {
      projectConfig.architect.buildDocker = buildDocker;
    }

    const mounts: any = {};
    mounts[buildPath] = '/usr/share/nginx/html';

    projectConfig.architect.runDocker = {
      builder: 'docker-schematics:run-docker',
      options: {
        ports: {
          80: 80
        },
        mounts
      },
      configurations: {
        dev: {},
        prod: {}
      }
    };

    return json;
  });
}

export default function dotnetApi(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    return chain([
      //init(),
      check(schema),
      createFiles(schema),
      updateWorkspaceJson(schema)
    ])(host, context);
  };
}

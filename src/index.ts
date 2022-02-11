#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import glob from 'glob';
import yaml from 'yaml';
import parseArgs from './cli';
import RokkaHandler, { StyleDefinition, StackDefinition, Style } from './rokka';

function getFiles(folder: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const pattern = path.join(folder, '**/*.yml');
        glob(pattern, (err, matches) => {
            if (err) {
                reject(err);
            } else {
                resolve(matches);
            }
        });
    });
}

function parseFile(filePath: string): Promise<StyleDefinition> {
    return fs.promises
        .readFile(filePath)
        .then((buffer) => buffer.toString())
        .then((contents) => yaml.parse(contents));
}

function mapStyleSizes(definition: StyleDefinition): StackDefinition[] {
    const sizes = definition.sizes || [];
    const ratioW = definition.ratio?.w || 1;
    const ratioH = definition.ratio?.h || 1;
    const ratio = ratioH / ratioW;
    const mode = definition.mode || 'fill';
    const crop = !!definition.crop;
    const composition = definition.composition || undefined;
    const secondary_opacity = definition.secondary_opacity || undefined;
    const secondary_color = definition.secondary_color || undefined;

    return sizes.map((size) => {
        const width = size;
        const height = Math.round(size * ratio);

        return {
            name: `${definition.name}-${width}`,
            width,
            height,
            mode,
            crop,
            composition,
            secondary_opacity,
            secondary_color
        };
    });
}

function mapStylePicture(definition: StyleDefinition): StackDefinition[] {
    const pictures = definition.pictures || {};

    return Object.keys(pictures).map((viewport) => {
        const { width, height, mode, crop } = pictures[viewport];
        const modeFallback = mode ?? 'fill';
        const cropFallback = crop ?? true;

        return {
            name: `${definition.name}-${viewport}`,
            width,
            height,
            viewport,
            mode: modeFallback,
            crop: cropFallback
        };
    });
}

function buildStyles(definitions: StyleDefinition[]): Style[] {
    return definitions.map((definition) => {
        const type = definition.sizes ? 'sizes' : 'picture';

        const stacks =
            type === 'sizes'
                ? mapStyleSizes(definition)
                : mapStylePicture(definition);

        return {
            name: definition.name,
            type,
            stacks,
            ratio: definition.ratio,
            viewport: definition.viewport
        };
    });
}

function writeOutput(styles: Style[], dest: string) {
    const data = styles.reduce<Record<string, Style>>((acc, style) => {
        acc[style.name] = style;
        return acc;
    }, {});
    return fs.promises.writeFile(dest, JSON.stringify(data, null, 2));
}

async function start() {
    const args = parseArgs();
    console.log(args);

    try {
        const rokka = new RokkaHandler(args.options.organization, args.options.apikey);

        const src = path.join(__dirname, args.options.folder);
        const dest = path.join(__dirname, args.options.output);

        console.log('Source', src);
        console.log('Destination', dest);

        const files = await getFiles(src);
        const definitions = await Promise.all(files.map(parseFile));
        const styles = buildStyles(definitions);

        await Promise.all(
            styles.map((style) => {
                return Promise.all(
                    style.stacks.map((definition) => {
                        return rokka.createStack(definition);
                    })
                );
            })
        );

        await writeOutput(styles, dest);
    } catch (error) {
        console.log(error);
    }
}

start();

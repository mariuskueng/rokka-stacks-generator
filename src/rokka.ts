import rokkaClient from 'rokka';
import { RokkaApi } from 'rokka/src/apis';

export interface Ratio {
    w: number;
    h: number;
}

export interface ViewportSize {
    width: number;
    height: number;
    crop?: boolean;
    mode?: string;
}

export interface Viewport {
    mobile: number;
    tablet: number;
    desktop: number;
    widescreen: number;
    fullhd: number;
    fourk: number;
}

export interface StyleDefinition {
    name: string;
    mode?: string;
    crop?: boolean;
    ratio?: Ratio;
    sizes?: number[];
    pictures?: Record<string, ViewportSize>;
    viewport: Viewport;
    composition?: string;
    secondary_opacity?: number;
    secondary_color?: string;
}

export interface StackDefinition {
    name: string;
    width: number;
    height: number;
    viewport?: string;
    mode?: string;
    crop?: boolean;
    composition?: string;
    secondary_opacity?: number;
    secondary_color?: string;
}

export interface Style {
    name: string;
    ratio?: Ratio;
    stacks: StackDefinition[];
}

export default class RokkaHandler {
    organization: string;

    client: RokkaApi;

    constructor(organization: string, apiKey: string) {
        this.organization = organization;
        this.client = rokkaClient({
            apiKey
        });
    }

    createStack(stack: StackDefinition): Promise<StackDefinition> {
        const operations = [
            this.client.operations.resize(stack.width, stack.height, {
                // @ts-ignore
                mode: stack.mode
            })
        ];

        if (stack.crop) {
            operations.push(
                this.client.operations.crop(stack.width, stack.height, {
                    anchor: 'auto',
                    mode: 'absolute'
                })
            );
        }

        if (stack.composition) {
            operations.push(
                this.client.operations.composition(stack.width, stack.height, stack.composition, {
                    secondary_opacity: stack.secondary_opacity,
                    secondary_color: stack.secondary_color
                })
            );
        }

        // const options = {
        //   'jpg.quality': 85,
        //   'webp.quality': 85
        // }

        // const expressions = [
        // this.client.expressions.default('options.dpr > 2', { 'jpg.quality': 80, 'webp.quality': 80 })
        // ]

        const queryParams = { overwrite: true };
        return this.client.stacks
            .create(this.organization, stack.name, { operations }, queryParams)
            .then(() => {
                return stack;
            });
    }
}

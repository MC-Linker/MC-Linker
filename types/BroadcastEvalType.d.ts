import type MCLinker from '../structures/MCLinker.js';
import type { Awaitable, Serialized } from 'discord.js';

export type BroadcastEvalMC = {
    <Result>(
        fn: (client: MCLinker) => Awaitable<Result>,
    ): Promise<Serialized<Result>[]>;

    <Result>(
        fn: (client: MCLinker) => Awaitable<Result>,
        options: { shard: number },
    ): Promise<Serialized<Result>>;

    <Result, Context>(
        fn: (client: MCLinker, context: Serialized<Context>) => Awaitable<Result>,
        options: { context: Context },
    ): Promise<Serialized<Result>[]>;

    <Result, Context>(
        fn: (client: MCLinker, context: Serialized<Context>) => Awaitable<Result>,
        options: { context: Context; shard: number },
    ): Promise<Serialized<Result>>;
};
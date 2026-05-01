import { ComponentType } from 'discord.js';

export const MaxEmbedFieldValueLength = 1024;
export const MaxEmbedDescriptionLength = 4096;
export const MaxEmbedTitleLength = 256;
export const MaxEmbedFields = 25;
export const MaxMessageContentLength = 2000;
export const MaxActionRows = 5;
export const MaxActionRowSize = 5;
export const MaxAutoCompleteChoices = 25;
export const MaxCommandChoiceLength = 100;
export const CODE_BLOCK_OVERHEAD_ANSI = 12; // ```ansi\n\n```

export const MaxComponentsV2TopLevel = 10;
export const MaxComponentsV2Nested = 30;
export const MaxComponentsV2Chars = 4000;

/** The size of each component in an action row (5 takes up the whole row) */
export const ComponentSizeInActionRow = {
    [ComponentType.Button]: 1,
    [ComponentType.StringSelect]: 5,
    [ComponentType.RoleSelect]: 5,
    [ComponentType.ChannelSelect]: 5,
    [ComponentType.UserSelect]: 5,
    [ComponentType.MentionableSelect]: 5,
    [ComponentType.TextInput]: 5,
};

/** Default timeout for message component / message collectors: 10 minutes */
export const DefaultCollectorTimeout = 10 * 60 * 1000;

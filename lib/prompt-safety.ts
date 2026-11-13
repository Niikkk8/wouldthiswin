// Untrusted material (READMEs, files, answers, transcripts, commit messages, fetched pages)
// goes to the model inside delimiter tags. This removes anything in it that could open or
// close one of those tags, including our own trusted blocks, so the material can't pose as
// instructions or as the event's note.

const DELIMITER = /<\/?\s*(untrusted_\w*|event_context|context|system)\b[^>]*>/gi;

export const escapeDelimiters = (s: string) => s.replace(DELIMITER, "[tag removed]");

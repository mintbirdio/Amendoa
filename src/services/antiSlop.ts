export interface AntiSlopChange {
    pattern: string;
    count: number;
    description: string;
}

export interface AntiSlopResult {
    rewritten: string;
    changes: AntiSlopChange[];
}

interface AntiSlopRule {
    pattern: RegExp;
    replacement: string;
    description: string;
}

export const ANTI_SLOP_PATTERNS: ReadonlyArray<AntiSlopRule> = [
    // Em-dash variants -> comma
    { pattern: /\s*—\s*/g, replacement: ', ', description: 'em-dash to comma' },
    { pattern: /\s*–\s*/g, replacement: ', ', description: 'en-dash to comma' },
    { pattern: / -- /g, replacement: ', ', description: 'double hyphen to comma' },

    // Weasel words
    { pattern: /\bdelve\s+into\b/gi, replacement: 'look at', description: 'weasel: delve into' },
    { pattern: /\bdelving\s+into\b/gi, replacement: 'looking at', description: 'weasel: delving into' },
    { pattern: /\bdelve\b/gi, replacement: 'look', description: 'weasel: delve' },
    { pattern: /\btapestry\b/gi, replacement: 'mix', description: 'weasel: tapestry' },
    { pattern: /\bnavigate\s+the\b/gi, replacement: 'work through the', description: 'weasel: navigate the' },
    { pattern: /\bnavigate\b/gi, replacement: 'handle', description: 'weasel: navigate' },
    { pattern: /\bleverage\b/gi, replacement: 'use', description: 'weasel: leverage' },
    { pattern: /\butilize\b/gi, replacement: 'use', description: 'weasel: utilize' },
    { pattern: /\bembark on a journey\b/gi, replacement: 'start', description: 'weasel: embark on a journey' },
    { pattern: /\bin the realm of\b/gi, replacement: 'in', description: 'weasel: in the realm of' },
    { pattern: /\bthe realm of\b/gi, replacement: '', description: 'weasel: the realm of' },

    // Viral templates
    { pattern: /\bIt(?:'|’)s not just ([^,.!?]+), it(?:'|’)s ([^.!?]+)/gi, replacement: '$2', description: 'template: not just X, it\'s Y' },
    { pattern: /\bI don(?:'|’)t ([^,.!?]+), I ([^.!?]+)/gi, replacement: 'I $2', description: 'template: I don\'t X, I Y' },
    { pattern: /\b([A-Za-z][A-Za-z\s]+?) isn(?:'|’)t dead, it(?:'|’)s evolved\b/gi, replacement: '$1 has changed', description: 'template: X isn\'t dead, it\'s evolved' },

    // ChatGPT signatures
    { pattern: /\bCertainly!\s*/g, replacement: '', description: 'GPT: Certainly!' },
    { pattern: /\bI(?:'|’)d be happy to\b/gi, replacement: 'I will', description: 'GPT: I\'d be happy to' },
    { pattern: /\bIt(?:'|’)s important to note that\b/gi, replacement: '', description: 'GPT: It\'s important to note that' },
    { pattern: /\bIt(?:'|’)s important to note\b/gi, replacement: '', description: 'GPT: It\'s important to note' },
    { pattern: /\bHere(?:'|’)s the thing:\s*/gi, replacement: '', description: 'GPT: Here\'s the thing:' },
    { pattern: /\bThe truth is:\s*/gi, replacement: '', description: 'GPT: The truth is:' },

    // Multi-char strippers
    { pattern: /([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]){3,}/gu, replacement: '$1', description: 'collapse 3+ emoji' },
    { pattern: /!{3,}/g, replacement: '!', description: 'collapse 3+ exclamation' },
    { pattern: /\?{3,}/g, replacement: '?', description: 'collapse 3+ question marks' },
    { pattern: /\.{4,}/g, replacement: '...', description: 'collapse 4+ dots' },

    // Business buzzwords
    { pattern: /\bgame[- ]changer\b/gi, replacement: 'big shift', description: 'buzzword: game-changer' },
    { pattern: /\bsynergy\b/gi, replacement: 'fit', description: 'buzzword: synergy' },
    { pattern: /\bparadigm shift\b/gi, replacement: 'shift', description: 'buzzword: paradigm shift' },
    { pattern: /\bat the end of the day\b/gi, replacement: '', description: 'buzzword: at the end of the day' },
    { pattern: /\bunlock\b/gi, replacement: 'open up', description: 'buzzword: unlock' }
];

export function applyAntiSlop(text: string): AntiSlopResult {
    let rewritten = text;
    const changes: AntiSlopChange[] = [];

    for (const rule of ANTI_SLOP_PATTERNS) {
        const matches = rewritten.match(rule.pattern);
        const count = matches?.length ?? 0;
        if (count > 0) {
            rewritten = rewritten.replace(rule.pattern, rule.replacement);
            changes.push({
                pattern: rule.pattern.source,
                count,
                description: rule.description
            });
        }
    }

    rewritten = rewritten.replace(/ {2,}/g, ' ');
    rewritten = rewritten.replace(/^[ \t]+/gm, '');
    rewritten = rewritten.replace(/[ \t]+$/gm, '');
    rewritten = rewritten.trim();
    rewritten = rewritten.replace(/^([a-z])/, m => m.toUpperCase());

    return { rewritten, changes };
}

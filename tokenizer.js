class Tokenizer {
    constructor() {
        this.specialTokens = {
            START: "<start>",
            END: "<end>"
        };
    }

    // Normalize input
    preprocess(text) {
        return text.trim().toLowerCase();
    }

    // Tokenize by splitting into words or other logical units
    tokenize(text) {
        text = this.preprocess(text);
        return [this.specialTokens.START, ...text.split(/\s+/), this.specialTokens.END];
    }

    // Detokenize tokens back to a single string
    detokenize(tokens) {
        return tokens.filter(token => !Object.values(this.specialTokens).includes(token)).join(" ");
    }

    // Process API response to tokenize
    processApiResponse(responseText) {
        return this.tokenize(responseText);
    }
}

module.exports = new Tokenizer();
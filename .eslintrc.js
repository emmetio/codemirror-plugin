module.exports = {
    "env": {
        "es6": true,
		"node": true,
		"mocha": true,
		"browser": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module"
    },
    "rules": {
        "indent": [
            "error",
            "tab"
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
		"no-cond-assign": "off",
		"no-empty": [
			"error",
			{ "allowEmptyCatch": true }
		],
		"no-console": "warn"
    }
};

# 🛠️ Pythia - Type-Safe Configuration Loader

A lightweight, zero-dependency configuration loader for Node.js applications, written in TypeScript.

Load your configuration from environment variables based on a predefined schema, with type validation and parsing, into a strongly-typed, immutable configuration object.

Built with modern JavaScript and packaged in both CommonJS and ES Modules formats for seamless integration.

> **Fun fact:** Made in under 3 hours, based on the premise of my existing configuration loader snippet from [NiceBadge](https://github.com/xwirkijowski/nicebadge).

## Features
- 🪶 **Super Tiny** — Runtime size of ~4.7KB, 17.5KB total artifact size.
- 🗺️ **Schema-Based Loading** — Define the structure, types, and requirements of your config using a TypeScript object.
- ✅ **Validation & Parsing** — Automatically parses environment variables into desired types and validates type consistency.
- 🔀️ **Default Values** — Provide fallback values for missing environment variables.
- 🤝 **Static Constants** — Merge your predefined constants alongside dynamically loaded environment variables.
- ⚠️ **Customizable Error Handling** — Callbacks (`onWarn` and `onError`) to customize how errors and warnings are handled.
- 🧊 **Immutability** — Frozen final configuration object prevents accidental modifications.
- 💎 **Zero External Dependencies** — Written in TypeScript, without external libraries.

## How to use?
### 1. Install
```bash
npm install ????
```
### 2. Define your schema and constants

#### With TypeScript:

```ts
// config.ts
import {Pythia, ConfigSchema, PythiaConfig} from "????";

// Your configuration, loaded and built from environment variables
const schema = {
	app: {
		port: {type: 'number', required: true},
		host: {default: 'localhost'},
	},
	database: {
		host: {varName: "DB_HOST", default: "localhost"},
		user: {varName: "DB_USER", required: true},
		pass: {varName: "DB_PASS", required: true},
	},
} as const satisfies ConfigSchema;

// Your own properties that will be attached to the config
const constants = {
	serviceName: "MyCoolService",
	apiVersion: 1,
} as const;

export const config: PythiaConfig<typeof schema, typeof constants> = Pythia(schema, {constants});
```

#### Without TypeScript (CommonJS)
```js
// config.ts
const {Pythia} = require("????")

// Your configuration, loaded and built from environment variables
const schema = {
	app: {
		port: {type: 'number', required: true},
		host: {default: 'localhost'},
	},
	database: {
		host: {varName: "DB_HOST", default: "localhost"},
		user: {varName: "DB_USER", required: true},
		pass: {varName: "DB_PASS", required: true},
    },
};

// Your own properties that will be attached to the config
const constants = {
    serviceName: "MyCoolService",
    apiVersion: 1,
};

module.exports = Pythia(schema, {constans});
```

### 3. Use in your code

// todo
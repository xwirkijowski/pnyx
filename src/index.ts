/**
 * Pnyx - Type-Safe Configuration Loader
 * @author  Sebastian Wirkijowski <sebastian@wirkijowski.me>
 */

// Possible values for loaded environment variables
type InputVariableType = "boolean"|"number"|"string";

// Possible resulting types for loaded environment variables
type VariableType = boolean | number | string;

// Defines the structure for a single
export interface VariableDefinition {
	// Actual name of the environment variable, as accessible by `process.env`.
	varName?: string;
	// Expected type of the variable, defaults to `string`.
	type?: InputVariableType,
	// Is this variable required? Defaults to `false` if default is provided, otherwise `true`.
	required?: boolean,
	// The default value if the environment variable is not set. Only used if `required` is `false`.
	default?: string|number|boolean,
}

// Group of related configuration variables.
export interface ConfigGroup {
	[propName: string]: VariableDefinition;
}

// The entire dynamic configuration schema definition
export interface ConfigSchema {
	[groupName: string]: ConfigGroup;
}

// Helper: Determines the base type from definition
type BaseType<V extends VariableDefinition> =
	V['type'] extends 'boolean' ? boolean:
		V['type'] extends 'number' ? number:
			string;

// Helper: Determines if variable is optional
type IsOptional<V extends VariableDefinition> =
	V['required'] extends true ? false :
		V['default'] extends undefined ? true :
			false;

// Determines the final type of configuration property based on its definition
type MappedVariable<V extends VariableDefinition> =
	IsOptional<V> extends true ? BaseType<V> | undefined
		: BaseType<V>;

// Maps a `ConfigGroup` definition to its resulting object type
type MappedGroup<G extends ConfigGroup> = {
	readonly [K in keyof G]: MappedVariable<G[K]>
}

// Maps the full `ConfigSchema`
type Config<T extends ConfigSchema> = {
	readonly [K in keyof T]: MappedGroup<T[K]>
}

// Custom static constants
type Constant = Record<string, unknown>;

// Maps the static constants
type Constants<C extends Constant> = {
	readonly [K in keyof C]: C[K]
};

// Merges dynamic configuration with optional static constants into the final configuration object type
export type PnyxConfig<T extends ConfigSchema, C extends Constant> = Config<T> & Constants<C>;

export interface PnyxOptions<C extends Constant = {}> {
	/**
	 * **Optional** object containing static constant values to be merged into the configuration.
	 * Recommend defining with 'as const' for type safety and readonly properties.
	 *
	 * @optional
	 */
	constants?: C;
	/**
	 * **Optional** callback function to log any missing non-required variables.
	 * By default, it only logs the message with `console.log()`.
	 * @optional
	 * @param   message {string} The log message.
	 */
	onLog?: (message: string) => void;
	/**
	 * **Optional** callback function to handle warnings during configuration loading, e.g. using default as fallback value.
	 * By default, it only logs the message with `console.warn()`.
	 *
	 * @optional @todo Make better, more parameters (?)
	 * @param   message {string} The warning message.
	 */
	onWarn?: (message: string) => void;
	/**
	 * **Optional** callback function to handle fatal errors during loading.
	 * It's used at the end, to aggregate all errors before exiting.
	 * It should throw an error or terminate the process to prevent from continuing with invalid configuration.
	 * By default, it logs the errors with `console.error()` and exits the process with `process.exit(1)`.
	 *
	 * @optional @todo Make custom error class
	 * @param   errors   {Error[]} Array of error objects.
	 */
	onError?: (errors: Error[]) => void;
}

/**
 * Parses environment variables based on the defined config parameters.
 * Leverages type coercion and validates parsing.
 *
 * @internal
 * @param   value       Value of the environment variable.
 * @param   type        Type to parse into.
 * @param   envVarName  Name of the environment value, as in `process.env`.
 * @throws  {Error}     Received invalid environment variable format.
 */
function parseValue (
	value: string,
	type: InputVariableType,
	envVarName: string,
): VariableType {
	switch (type) {
		case "boolean":
			const valueLower = value.toLowerCase();
			if (valueLower === 'true' || valueLower === '1') return true;
			if (valueLower === 'false' || valueLower === '0') return false;
			else throw new Error(`Invalid boolean format for "${envVarName}" environment variable, received "${value}". Use 'true', '1', 'false', or '0'.`);
		case "number":
			const num: number = Number(value);
			if (isNaN(num) || !isFinite(num)) {
				throw new Error(`Invalid number format for "${envVarName}" environment variable, received "${value}"`);
			}
			return num;
		default:
			return value;
	}
}

/**
 * Loads and validates config based on provided configuration schema, returns results and aggregated errors.
 * Includes schema validation checks.
 *
 * @internal
 * @param   schema  {ConfigSchema}  The configuration schema.
 * @param   onWarn  {function}      Warning callback.
 * @param   onLog   {function}      Logging callback.
 */
function loadSchema<T extends ConfigSchema> (
	schema: T,
	onWarn: (message: string) => void,
	onLog: (message: string) => void,
) {
	// Declare config object and error aggregator
	const config: {[K in keyof T]?: MappedGroup<T[K]>} = {};
	const errors: Error[] = []; // @todo Error class
	const warnings: string[] = []; // @todo Do warning class
	
	// Loop through schema
	for (const groupName in schema) {
		// Define group in configuration object
		config[groupName] = {} as MappedGroup<T[typeof groupName]>;
		// Get group schema
		const groupSchema = schema[groupName];
		
		// Loop through group
		for (const propName in groupSchema) {
			// Extract variable definition
			const definition = groupSchema[propName] as VariableDefinition;
			const {varName, type, required, default: defaultValue} = definition;
			
			const effectiveVarName: string = varName ?? propName;
			const effectiveType: InputVariableType = type ?? "string"; // Defaults to string
			const envValue = process.env[effectiveVarName]; // Retrieve environment variable

			let finalValue: VariableType | undefined = undefined;
			if (envValue !== undefined && envValue !== '') {
				// Environment variable is found and not empty
				try {
					finalValue = parseValue(envValue, effectiveType, effectiveVarName);
				} catch (e: any) {
					errors.push(e);
				}
			} else {
				// Environment variable not found
				
				// Check if default value is valid
				let isDefaultValueValid = true; // Assume valid unless proven otherwise
				if (defaultValue !== undefined) {
					if (typeof defaultValue !== effectiveType) {
						isDefaultValueValid = false;
						errors.push(new Error(`Schema Error: (${groupName}.${propName}): Default value type "${typeof defaultValue}" does not match expected effective type "${effectiveType}".`))
					}
				}
				
				if (required === true) {
					if (defaultValue !== undefined && isDefaultValueValid) {
						finalValue = defaultValue;
						warnings.push(`Required environment variable "${varName} (for ${groupName}.${propName}) was not set. Using provided default value.`)
					} else {
						errors.push(new Error(`Missing required environment variable: "${varName}" (for ${groupName}.${propName}).${!isDefaultValueValid ? ' Provided default value type is invalid.' : ''}`))
					}
				} else if (defaultValue !== undefined && isDefaultValueValid) {
					onWarn(`Required environment variable "${varName} (for ${groupName}.${propName}) was not set. Using provided default value.`)
					finalValue = defaultValue;
				} else if (defaultValue !== undefined && !isDefaultValueValid) {
					onLog(`Environment variable "${varName}" (for ${groupName}.${propName}) was not set.`)
					finalValue = undefined;
				} else {
					onLog(`Environment variable "${varName}" (for ${groupName}.${propName}) was not set.`)
					finalValue = undefined;
				}
			}
			
			(config[groupName] as any)[propName] = finalValue;
		}
		
		Object.freeze(config[groupName]);
	}
	
	if (errors.length > 0) {
		return {config: null, errors, warnings}
	}
	
	return {
		config: config as Config<T>,
		errors,
		warnings,
	}
}

/**
 *
 * @param   schema  {ConfigSchema}
 * @param   options {PnyxOptions<Constant>}
 */
export function Pnyx<
	T extends ConfigSchema,
	C extends Constant = {}
>(
	schema: T,
	options?: PnyxOptions<C>,
): PnyxConfig<T, C> {
	const constants = options?.constants ?? ({} as C);
	
	const onError = options?.onError ?? function (errors: Error[]): void {
		console.group('Pnyx encountered an error!')
		errors.forEach(err => console.error(err));
		console.error('Cannot start due to invalid configuration.');
		console.groupEnd();
		process.exit(1);
	};
	
	const onWarn = options?.onWarn ?? function (message: string): void {
		console.warn(`[Pnyx Config Warning]`, message);
	}
	
	const onLog = options?.onLog ?? function (message: string): void {
		console.log(`[Pnyx Config]`, message);
	}
	
	// Check for potential top-level key collisions between constants and schema groups
	for (const key in constants) {
		if (Object.prototype.hasOwnProperty.call(schema, key)) {
			onWarn(`Constant key "${key}" overlaps with a top-level schema group name. The constant value will overwrite the dynamic group!`)
		}
	}
	
	const {config, errors} = loadSchema(schema, onWarn, onLog);
	
	if (errors.length > 0) {
		onError(errors);
		throw new Error('Pnyx configuration loading failed, and onError handler did not terminate execution!');
	}
	
	const pnyxConfig = {
		...config,
		...constants,
	}
	
	return Object.freeze(pnyxConfig) as PnyxConfig<T, C>;
}
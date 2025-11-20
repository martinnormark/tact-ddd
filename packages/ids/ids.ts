import { createIdGenerator, DEFAULT_ID_LENGTH, FRIENDLY_ALPHABET } from './utils/nanoid';

// Generic brand/tag utility
export type Brand<TBase, TBrand extends string> = TBase & { readonly __brand: TBrand };

export interface IdConfig<P extends string> {
	prefix: P;
	length?: number; // optional: override length per ID type
	strict?: boolean; // optional: enforce strict character set (not implemented here)
}

/**
 * Define a new ID type that:
 *  - is a string at runtime
 *  - always starts with "<prefix>_"
 *  - is branded, so different prefixes are different TS types
 */
export function defineIdType<P extends string>(config: IdConfig<P>) {
	const { prefix, strict } = config;
	const length = config.length ?? DEFAULT_ID_LENGTH;

	// Dedicated generator for this ID type (can vary length per type)
	const generator = createIdGenerator(length);

	// brand name is just a convention; use whatever you like
	type BrandName = `${P}_id`;
	type Id = Brand<string, BrandName>;

	const PREFIX_WITH_SEPARATOR = `${prefix}_`;

	function create(): Id {
		const core = generator();
		return (PREFIX_WITH_SEPARATOR + core) as Id;
	}

	function parse(raw: string): Id {
		if (!raw.startsWith(PREFIX_WITH_SEPARATOR)) {
			throw new Error(`Invalid ID '${raw}': expected prefix '${PREFIX_WITH_SEPARATOR}'`);
		}
		const core = raw.slice(PREFIX_WITH_SEPARATOR.length);
		if (core.length !== length) {
			throw new Error(`Invalid ID '${raw}': expected core length ${length}, got ${core.length}`);
		}

		if (strict) {
			for (const char of core) {
				if (!FRIENDLY_ALPHABET.includes(char)) {
					throw new Error(`Invalid ID '${raw}': contains invalid character '${char}'`);
				}
			}
		}

		return raw as Id;
	}

	function is(raw: string): raw is Id {
		return raw.startsWith(PREFIX_WITH_SEPARATOR) && raw.length === PREFIX_WITH_SEPARATOR.length + length;
	}

	return {
		prefix,
		length,
		create,
		parse,
		is,
		// expose the type through a dummy field if you like:
		// _type: null as unknown as Id,
	};
}

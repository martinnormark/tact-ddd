import { customAlphabet } from 'nanoid';

// No 0/O, 1/l, etc. from the blog post
export const FRIENDLY_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// You can tweak the default length here (16, 18, 20…)
export const DEFAULT_ID_LENGTH = 16;

export const defaultGenerator = customAlphabet(FRIENDLY_ALPHABET, DEFAULT_ID_LENGTH);

export function createIdGenerator(length: number) {
	return customAlphabet(FRIENDLY_ALPHABET, length);
}

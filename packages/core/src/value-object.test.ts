import { describe, expect, test } from 'bun:test';
import { ValueObject } from './value-object';

class Money extends ValueObject {
	constructor(public readonly amount: number, public readonly currency: string) {
		super();
	}

	protected getEqualityComponents(): readonly unknown[] {
		return [this.amount, this.currency];
	}
}

class Address extends ValueObject {
	constructor(public readonly street: string, public readonly city: string, public readonly postalCode: string) {
		super();
	}

	protected getEqualityComponents(): readonly unknown[] {
		return [this.street, this.city, this.postalCode];
	}
}

class Temperature extends ValueObject {
	constructor(public readonly value: number) {
		super();
	}

	protected getEqualityComponents(): readonly unknown[] {
		return [this.value];
	}
}

describe('ValueObject', () => {
	describe('equals', () => {
		test('returns true for identical values', () => {
			const money1 = new Money(100, 'USD');
			const money2 = new Money(100, 'USD');
			expect(money1.equals(money2)).toBe(true);
		});

		test('returns false for different values', () => {
			const money1 = new Money(100, 'USD');
			const money2 = new Money(200, 'USD');
			expect(money1.equals(money2)).toBe(false);
		});

		test('returns false for different currencies', () => {
			const money1 = new Money(100, 'USD');
			const money2 = new Money(100, 'EUR');
			expect(money1.equals(money2)).toBe(false);
		});

		test('returns true for multiple equal components', () => {
			const address1 = new Address('123 Main St', 'Springfield', '12345');
			const address2 = new Address('123 Main St', 'Springfield', '12345');
			expect(address1.equals(address2)).toBe(true);
		});

		test('returns false when any component differs', () => {
			const address1 = new Address('123 Main St', 'Springfield', '12345');
			const address2 = new Address('123 Main St', 'Springfield', '54321');
			expect(address1.equals(address2)).toBe(false);
		});

		test('returns false for null', () => {
			const money = new Money(100, 'USD');
			expect(money.equals(null)).toBe(false);
		});

		test('returns false for undefined', () => {
			const money = new Money(100, 'USD');
			expect(money.equals(undefined)).toBe(false);
		});

		test('returns false for different types', () => {
			const money = new Money(100, 'USD');
			const address = new Address('123 Main St', 'Springfield', '12345');
			expect(money.equals(address as any)).toBe(false);
		});

		test('returns true when comparing same instance', () => {
			const money = new Money(100, 'USD');
			expect(money.equals(money)).toBe(true);
		});

		test('handles special number values correctly', () => {
			const temp1 = new Temperature(0);
			const temp2 = new Temperature(0);
			const temp3 = new Temperature(-0);

			expect(temp1.equals(temp2)).toBe(true);
			// Object.is(0, -0) is false, unlike 0 === -0
			expect(temp1.equals(temp3)).toBe(false);
		});
		test('handles NaN correctly', () => {
			const temp1 = new Temperature(NaN);
			const temp2 = new Temperature(NaN);

			// Object.is(NaN, NaN) returns true, unlike ===
			expect(temp1.equals(temp2)).toBe(true);
		});

		test('is symmetric', () => {
			const money1 = new Money(100, 'USD');
			const money2 = new Money(100, 'USD');

			expect(money1.equals(money2)).toBe(money2.equals(money1));
		});

		test('is transitive', () => {
			const money1 = new Money(100, 'USD');
			const money2 = new Money(100, 'USD');
			const money3 = new Money(100, 'USD');

			expect(money1.equals(money2)).toBe(true);
			expect(money2.equals(money3)).toBe(true);
			expect(money1.equals(money3)).toBe(true);
		});

		test('different number of components returns false', () => {
			class SingleComponent extends ValueObject {
				protected getEqualityComponents(): readonly unknown[] {
					return [1];
				}
			}

			class DoubleComponent extends ValueObject {
				protected getEqualityComponents(): readonly unknown[] {
					return [1, 2];
				}
			}

			const single = new SingleComponent();
			const double = new DoubleComponent();

			expect(single.equals(double as any)).toBe(false);
		});
	});
});

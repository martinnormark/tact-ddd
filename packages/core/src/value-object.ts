export abstract class ValueObject {
	protected abstract getEqualityComponents(): readonly unknown[];

	equals(other: ValueObject | null | undefined): boolean {
		if (!other) return false;
		if (other.constructor !== this.constructor) return false;

		const a = this.getEqualityComponents();
		const b = other.getEqualityComponents();
		if (a.length !== b.length) return false;

		for (let i = 0; i < a.length; i++) {
			if (!Object.is(a[i], b[i])) return false;
		}

		return true;
	}
}

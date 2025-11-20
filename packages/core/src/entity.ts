export abstract class Entity<TId> {
	constructor(public readonly id: TId) {}

	// Basic identity equality
	public equals(other: Entity<TId> | null | undefined): boolean {
		if (!other) return false;
		if (other === this) return true;
		if (other.constructor !== this.constructor) return false;
		return Object.is(this.id, other.id);
	}
}

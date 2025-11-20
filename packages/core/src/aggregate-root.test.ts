import { describe, expect, test } from 'bun:test';
import { AggregateRoot, type DomainEventLike } from './aggregate-root';

interface UserCreatedEvent extends DomainEventLike {
	readonly name: 'UserCreated';
	readonly occurredAt: Date;
	readonly userId: string;
	readonly email: string;
}

interface UserEmailChangedEvent extends DomainEventLike {
	readonly name: 'UserEmailChanged';
	readonly occurredAt: Date;
	readonly userId: string;
	readonly oldEmail: string;
	readonly newEmail: string;
}

type UserEvent = UserCreatedEvent | UserEmailChangedEvent;

class User extends AggregateRoot<string, UserEvent> {
	constructor(id: string, public email: string) {
		super(id);
	}

	static create(id: string, email: string): User {
		const user = new User(id, email);
		user.addDomainEvent({
			name: 'UserCreated',
			occurredAt: new Date(),
			userId: id,
			email,
		});
		return user;
	}

	changeEmail(newEmail: string): void {
		const oldEmail = this.email;
		this.email = newEmail;
		this.addDomainEvent({
			name: 'UserEmailChanged',
			occurredAt: new Date(),
			userId: this.id,
			oldEmail,
			newEmail,
		});
	}
}

describe('AggregateRoot', () => {
	describe('domain events', () => {
		test('starts with no domain events', () => {
			const user = new User('user_123', 'john@example.com');
			expect(user.domainEvents).toEqual([]);
			expect(user.domainEvents.length).toBe(0);
		});

		test('can add domain events', () => {
			const user = User.create('user_123', 'john@example.com');
			expect(user.domainEvents.length).toBe(1);
			expect(user.domainEvents[0]?.name).toBe('UserCreated');
		});

		test('accumulates multiple domain events', () => {
			const user = User.create('user_123', 'john@example.com');
			user.changeEmail('jane@example.com');
			user.changeEmail('jack@example.com');

			expect(user.domainEvents.length).toBe(3);
			expect(user.domainEvents[0]?.name).toBe('UserCreated');
			expect(user.domainEvents[1]?.name).toBe('UserEmailChanged');
			expect(user.domainEvents[2]?.name).toBe('UserEmailChanged');
		});

		test('domainEvents getter returns readonly array', () => {
			const user = User.create('user_123', 'john@example.com');
			const events = user.domainEvents;

			// The array is readonly, TypeScript prevents push/pop
			// but we can verify it's a regular array
			expect(Array.isArray(events)).toBe(true);
		});
	});

	describe('pullDomainEvents', () => {
		test('returns all domain events', () => {
			const user = User.create('user_123', 'john@example.com');
			user.changeEmail('jane@example.com');

			const events = user.pullDomainEvents();
			expect(events.length).toBe(2);
			expect(events[0]?.name).toBe('UserCreated');
			expect(events[1]?.name).toBe('UserEmailChanged');
		});

		test('clears domain events after pulling', () => {
			const user = User.create('user_123', 'john@example.com');
			user.changeEmail('jane@example.com');

			expect(user.domainEvents.length).toBe(2);

			const events = user.pullDomainEvents();
			expect(events.length).toBe(2);
			expect(user.domainEvents.length).toBe(0);
		});

		test('returns empty array when no events', () => {
			const user = new User('user_123', 'john@example.com');
			const events = user.pullDomainEvents();
			expect(events).toEqual([]);
		});

		test('can pull events multiple times', () => {
			const user = User.create('user_123', 'john@example.com');

			const firstPull = user.pullDomainEvents();
			expect(firstPull.length).toBe(1);

			user.changeEmail('jane@example.com');
			const secondPull = user.pullDomainEvents();
			expect(secondPull.length).toBe(1);
			expect(secondPull[0]?.name).toBe('UserEmailChanged');
		});

		test('pulled events are independent of internal state', () => {
			const user = User.create('user_123', 'john@example.com');
			const events = user.pullDomainEvents();

			// Adding more events shouldn't affect the pulled array
			user.changeEmail('jane@example.com');
			expect(events.length).toBe(1);
			expect(user.domainEvents.length).toBe(1);
		});
	});

	describe('clearDomainEvents', () => {
		test('clears all domain events', () => {
			const user = User.create('user_123', 'john@example.com');
			user.changeEmail('jane@example.com');

			expect(user.domainEvents.length).toBe(2);
			user.clearDomainEvents();
			expect(user.domainEvents.length).toBe(0);
		});

		test('does nothing when no events exist', () => {
			const user = new User('user_123', 'john@example.com');
			expect(user.domainEvents.length).toBe(0);
			user.clearDomainEvents();
			expect(user.domainEvents.length).toBe(0);
		});

		test('can add events after clearing', () => {
			const user = User.create('user_123', 'john@example.com');
			user.clearDomainEvents();

			user.changeEmail('jane@example.com');
			expect(user.domainEvents.length).toBe(1);
		});
	});

	describe('entity inheritance', () => {
		test('inherits entity equality based on id', () => {
			const user1 = new User('user_123', 'john@example.com');
			const user2 = new User('user_123', 'jane@example.com');

			expect(user1.equals(user2)).toBe(true);
		});

		test('has id property from Entity', () => {
			const user = new User('user_123', 'john@example.com');
			expect(user.id).toBe('user_123');
		});
	});

	describe('event metadata', () => {
		test('events contain required metadata', () => {
			const user = User.create('user_123', 'john@example.com');
			const events = user.pullDomainEvents();

			const event = events[0];
			expect(event?.name).toBe('UserCreated');
			expect(event?.occurredAt).toBeInstanceOf(Date);
			expect((event as UserCreatedEvent).userId).toBe('user_123');
			expect((event as UserCreatedEvent).email).toBe('john@example.com');
		});

		test('events are ordered by occurrence', () => {
			const user = User.create('user_123', 'john@example.com');
			user.changeEmail('jane@example.com');
			user.changeEmail('jack@example.com');

			const events = user.pullDomainEvents();
			expect(events[0]?.name).toBe('UserCreated');
			expect(events[1]?.name).toBe('UserEmailChanged');
			expect(events[2]?.name).toBe('UserEmailChanged');

			// Verify time ordering
			expect(events[0]?.occurredAt.getTime()).toBeLessThanOrEqual(events[1]?.occurredAt.getTime() ?? 0);
			expect(events[1]?.occurredAt.getTime()).toBeLessThanOrEqual(events[2]?.occurredAt.getTime() ?? 0);
		});
	});
});

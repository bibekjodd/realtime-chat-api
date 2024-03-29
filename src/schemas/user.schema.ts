import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  varchar
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: text('id').notNull().$defaultFn(createId),
    name: varchar('name', { length: 40 }).notNull(),
    email: varchar('email', { length: 40 }).notNull(),
    password: varchar('password', { length: 100 }),
    image: varchar('image', { length: 200 }),
    isGoogleUser: boolean('is_google_user').notNull().default(false),
    lastOnline: timestamp('last_online', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    role: varchar('role', { enum: ['user', 'admin'] })
      .notNull()
      .default('user'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  function constraints(users) {
    return {
      primaryKey: primaryKey({ name: 'users_pkey', columns: [users.id] }),
      uniqueEmail: unique('email').on(users.email)
    };
  }
);
export type User = typeof users.$inferInsert;
export const selectUserSnapshot = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
  isGoogleUser: users.isGoogleUser,
  role: users.role,
  createdAt: users.createdAt,
  lastOnline: users.lastOnline
};
export type UserSnapshot = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isGoogleUser: boolean;
  role: 'user' | 'admin';
  createdAt: string;
  lastOnline: string;
  password?: undefined;
};
export const selectUserJSON = sql<UserSnapshot>`json_build_object(
    'id',${users.id},
    'name',${users.name},
    'email',${users.email},
    'image',${users.image},
    'isGoogleUser',${users.isGoogleUser},
    'role',${users.role},
    'createdAt',${users.createdAt},
    'lastOnline',${users.lastOnline}
    )`;
export const selectUsersJSON = sql<UserSnapshot[]>`json_agg(${selectUserJSON})`;

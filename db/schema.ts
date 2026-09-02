import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const pairs = sqliteTable('pairs', {
 id: text('id').primaryKey(), classId: integer('class_id').notNull(), groupId: integer('group_id').notNull(),
 pairNo: integer('pair_no').notNull(), members: integer('members').notNull(),
 change: text('change').notNull(), difference: text('difference').notNull(), verification: text('verification').notNull(),
 owner: text('owner').notNull(), version: integer('version').notNull().default(1),
 createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, t=>[uniqueIndex('pairs_class_group_number').on(t.classId,t.groupId,t.pairNo)]);
export const conclusions = sqliteTable('conclusions', {
 id:text('id').primaryKey(), classId:integer('class_id').notNull(), groupId:integer('group_id').notNull(),
 choice:text('choice').notNull(), evidence:text('evidence').notNull(), reason:text('reason').notNull(),
 rewrite:text('rewrite').notNull(), uncertainty:text('uncertainty').notNull(),
 owner:text('owner').notNull(), version:integer('version').notNull().default(1),
 updatedAt:text('updated_at').notNull()
}, t=>[uniqueIndex('conclusions_class_group').on(t.classId,t.groupId)]);


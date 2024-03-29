import { db } from '@/config/database';
import { pusher } from '@/config/pusher';
import { emojis, validReactionsSchema } from '@/dtos/common.dto';
import { EVENTS, ReactionAddedResponse } from '@/lib/events';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { chats } from '@/schemas/chat.schema';
import { members } from '@/schemas/member.schema';
import { messages } from '@/schemas/message.schema';
import { reactions } from '@/schemas/reaction.schema';
import { updateLastMessageOnChat } from '@/services/chat.service';
import { and, eq } from 'drizzle-orm';

export const addReaction = handleAsync<
  { id: string },
  unknown,
  { reaction: unknown }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const messageId = req.params.id;
  const reaction = validReactionsSchema.nullable().parse(req.body?.reaction);

  if (!reaction) {
    const [deleted] = await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.userId, req.user.id),
          eq(reactions.messageId, messageId)
        )
      )
      .returning();

    if (!deleted) {
      throw new BadRequestException(
        'Reaction already deleted or you are not eligible to remove reaction'
      );
    }

    // notify user/members
    db.select({ chatId: messages.chatId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)
      .execute()
      .then(([result]) => {
        if (result?.chatId) {
          pusher.trigger(result.chatId, EVENTS.REACTION_ADDED, {
            messageId,
            reaction,
            userId: req.user?.id || ''
          } satisfies ReactionAddedResponse);
        }
      });

    return res.json({ message: 'Reaction removed successfully' });
  }

  const [message] = await db
    .select({
      eligibleUser: members.userId,
      chatId: messages.chatId
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .leftJoin(chats, eq(messages.chatId, chats.id))
    .leftJoin(
      members,
      and(eq(chats.id, members.chatId), eq(members.userId, req.user.id))
    )
    .groupBy(messages.id, members.userId);

  if (message?.eligibleUser !== req.user.id) {
    throw new ForbiddenException(
      'Message does not exist or you are not part of the group to react to the message'
    );
  }

  db.insert(reactions)
    .values({ messageId, reaction, userId: req.user.id })
    .onConflictDoUpdate({
      target: [reactions.userId, reactions.messageId],
      set: { reaction }
    })
    .execute();

  updateLastMessageOnChat(message.chatId, {
    message: `reacted ${emojis[reaction]} to a message`,
    sender: req.user.name,
    senderId: req.user.id
  });

  // notify user/members
  pusher.trigger(message.chatId, EVENTS.REACTION_ADDED, {
    messageId,
    reaction,
    userId: req.user.id
  } satisfies ReactionAddedResponse);

  return res.json({ message: 'Reaction added successfully' });
});

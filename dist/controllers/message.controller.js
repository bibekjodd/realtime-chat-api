"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeReaction = exports.addReaction = exports.updateMessageViewer = exports.sendMessage = void 0;
const cloudinary_1 = require("../lib/cloudinary");
const constants_1 = require("../lib/constants");
const errorHandler_1 = require("../lib/errorHandler");
const messages_1 = require("../lib/messages");
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const Chat_Model_1 = __importDefault(require("../models/Chat.Model"));
const Message_Model_1 = __importDefault(require("../models/Message.Model"));
exports.sendMessage = (0, catchAsyncError_1.catchAsyncError)(async (req, res, next) => {
    const { chatId } = req.params;
    const { text, image } = req.body;
    if (!text && !image) {
        return next(new errorHandler_1.ErrorHandler("Message must contain text or image", 400));
    }
    const chat = await Chat_Model_1.default.findById(chatId);
    if (!chat) {
        return next(new errorHandler_1.ErrorHandler("Chat doesn't exist", 400));
    }
    if (!chat.users.includes(req.user._id.toString())) {
        return next(new errorHandler_1.ErrorHandler("You do not belong to this chat", 400));
    }
    const message = new Message_Model_1.default({
        chat: chatId,
        sender: req.user._id.toString(),
        viewers: [req.user._id.toString()],
    });
    if (text) {
        message.text = text;
    }
    if (image) {
        const { public_id, url } = await (0, cloudinary_1.uploadMessagePicture)(image);
        message.image = {
            public_id,
            url,
        };
    }
    await message.save();
    pusher.trigger(chat._id.toString(), constants_1.EVENTS.MESSAGE_SENT, message);
    await Chat_Model_1.default.findByIdAndUpdate(chatId, {
        $set: {
            latestMessage: message._id.toString(),
        },
    });
    return res.status(200).json({ message: messages_1.messages.send_message_success });
});
exports.updateMessageViewer = (0, catchAsyncError_1.catchAsyncError)(async (req, res, next) => {
    const viewerId = req.user?._id.toString();
    const messageId = req.query.messageId;
    if (!messageId) {
        return next(new errorHandler_1.ErrorHandler("Message id is not provided", 400));
    }
    pusher.trigger(messageId, constants_1.EVENTS.MESSAGE_VIEWED, { viewerId, messageId });
    await Message_Model_1.default.findByIdAndUpdate(messageId, {
        $addToSet: {
            viewers: viewerId,
        },
    });
    res.status(200).json({ message: "Viewers list updated successfully" });
});
exports.addReaction = (0, catchAsyncError_1.catchAsyncError)(async (req, res, next) => {
    const { messageId } = req.params;
    const { reaction } = req.body;
    if (!reaction || !constants_1.validReactions.includes(reaction)) {
        return next(new errorHandler_1.ErrorHandler("Invalid reaction", 400));
    }
    const message = await Message_Model_1.default.findById(messageId);
    if (!message) {
        return next(new errorHandler_1.ErrorHandler("Message already deleted or does not exist", 400));
    }
    const chat = await Chat_Model_1.default.findById(message.chat?.toString());
    if (!chat?.users?.includes(req.user._id.toString())) {
        return next(new errorHandler_1.ErrorHandler("You are not part of this message"));
    }
    const previouslyReacted = message?.reactions.find((reaction) => reaction.user?.toString() === req.user._id.toString());
    if (previouslyReacted) {
        message.reactions = message.reactions.map((reaction) => {
            if (reaction.user?.toString() !== req.user._id.toString()) {
                return reaction;
            }
            return {
                ...reaction,
                value: req.body.reaction,
            };
        });
    }
    else {
        message.reactions.push({
            user: req.user._id.toString(),
            value: req.body.reaction,
        });
    }
    await message.save();
    pusher.trigger(messageId, constants_1.EVENTS.REACTION_ADDED, {
        messageId,
        reaction: {
            userId: req.user._id.toString(),
            value: req.body.reaction,
        },
    });
    res.status(200).json({ message: "Reaction updated successfully" });
});
exports.removeReaction = (0, catchAsyncError_1.catchAsyncError)(async (req, res, next) => {
    const messageId = req.params.messageId;
    const message = await Message_Model_1.default.findById(messageId);
    if (!message) {
        return next(new errorHandler_1.ErrorHandler("Message is deleted or does not exist", 400));
    }
    message.reactions = message?.reactions.filter((reaction) => reaction.user?.toString() !== req.user._id.toString());
    await message.save();
    pusher.trigger(messageId, constants_1.EVENTS.REACTION_REMOVED, {
        messageId,
        userId: req.user._id.toString(),
    });
    res.status(200).json({ message: "Reaction removed successfully" });
});

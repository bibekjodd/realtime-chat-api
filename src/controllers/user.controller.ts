import { catchAsyncError } from "../middlewares/catchAsyncError";
import User from "../models/User.Model";
import { ErrorHandler } from "../lib/errorHandler";
import {
  LoginUserSchema,
  RegisterUserSchema,
} from "../lib/validation/userValidationSchema";
import {
  validateLoginUser,
  validateRegisterUser,
} from "../lib/validation/validateUser";
import { messages } from "../lib/messages";
import { uploadProfilePicture } from "../lib/cloudinary";
import { sendToken } from "../lib/sendToken";

export const createUser = catchAsyncError<unknown, unknown, RegisterUserSchema>(
  async (req, res, next) => {
    validateRegisterUser(req.body);
    const { name, email, password, imageUri } = req.body;

    const user = await User.findOne({ email });
    if (user) return next(new ErrorHandler(messages.email_already_taken, 400));

    const { public_id, url } = await uploadProfilePicture(imageUri);

    const newUser = await User.create({
      name,
      email,
      password,
      picture: { public_id, url },
    });

    sendToken(res, newUser);
  }
);

export const myProfile = catchAsyncError(async (req, res) => {
  const user = await User.findById({ _id: req.user._id.toString() });
  res.status(200).json({
    user,
  });
});

export const logout = catchAsyncError(async (req, res) => {
  req.logOut((err) => {
    if (err) {
      return res
        .status(400)
        .json({ message: "Error occurred while signing out" });
    }
  });
  res.status(200).json({ message: messages.logout_succcess });
});

export const searchUsers = catchAsyncError<{ search: string }>(
  async (req, res, next) => {
    const { search } = req.params;
    if (!search) {
      return next(
        new ErrorHandler("Provide search query to search users", 400)
      );
    }

    const users = await User.find({
      $or: [
        {
          name: { $regex: search, $options: "i" },
        },
        {
          email: { $regex: search, $options: "i" },
        },
      ],
    });

    res.status(200).json({ users });
  }
);

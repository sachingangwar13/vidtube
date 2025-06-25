import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.models.js"
import {uploadOnCloudinary , deleteFromCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {

    try {
        const user = await User.findById(userId)
    
        if(!user){
            throw new ApiError(404 , "User not found");
        }
    
        const accessToken  = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
    
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})
    
        return {accessToken , refreshToken};
    } catch (error) {
        console.error("Token generation error:", error);
        throw new ApiError(500 , "Something went wrong while generating access and refresh token.")
    }
}

const registerUser = asyncHandler(async (req , res) => {
    const {fullname , email , username , password } = req.body

    console.log("fullname:", fullname);
    console.log("username:", username);
    console.log("email:", email);
    console.log("password:", password);

    if(
        [fullname , username , email , password].some( (val) => 
        val?.trim() === "")
    ){
        throw new ApiError(400 , "All Fields is required");
    }

    const existedUser  = await User.findOne({
        $or: [
            {username},
            {email}
        ]
    })

    if(existedUser){
        throw new ApiError(409 , "User already exist");
    }

    console.warn(req.files);
    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverLocalPath = req.files?.coverImage?.[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar file is missing");
    }

    let avatar;

    try {
        avatar = await uploadOnCloudinary(avatarLocalPath);
        console.log("Uploaded avatar" , avatar);
    } catch (error) {
        console.log("Error uploading avatar" , error);
        throw new ApiError(500 , "failed to upload avatar");
    }

    let coverImage;

    try {
        coverImage = await uploadOnCloudinary(coverLocalPath);
        console.log("Uploaded coverImage" , coverImage);
    } catch (error) {
        console.log("Error uploading coverImage" , error);
        throw new ApiError(500 , "failed to upload avatar");
    }

    try {
        const user = await User.create({
            fullname,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        })
    
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )
    
        if(!createdUser){
            throw new ApiError(500 , "Something went wrong while registering a user.")
        }
    
        return res
            .status(201)
            .json(new ApiResponse(200 , createdUser , "User registered Successfully"))


    } catch (error) {
        console.log("User creation failed")

        if(avatar){
            await deleteFromCloudinary(avatar.public_id)
        }

        if(coverImage){
            await deleteFromCloudinary(coverImage.public_id);
        }

        console.error("Detailed Error:", error.message || error);
        throw new ApiError(500 , "Something went wrong while registering a user and images were deleted");
    }
})


const loginUser = asyncHandler( async(req, res) => {
    // get data from body
    const {email , username , password} = req.body

    if(!email){
        throw new ApiError(400 , "Email is required");
    }

    const user  = await User.findOne({
        $or: [
            {username},
            {email}
        ]
    })

    if(!user){
        throw new ApiError(404 , "User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401 , "Invalid credentials");
    }

    const {accessToken , refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");

    if(!loggedInUser){
        throw new ApiError(400 , "User Not found");
    }

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken , options)
        .cookie("refreshToken" , refreshToken , options)
        .json(new ApiResponse(
            200,
            {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in successfully"
        ))
})

const logoutUser = asyncHandler( async (req , res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            }
        },
        {new: true}
    )

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    }

    return res
            .status(200)
            .clearCookie("accessToken" , options)
            .clearCookie("refreshToken")
            .json( new ApiResponse(200 , {} , "User logged out successfully"));
})

const refreshAccessToken = asyncHandler( async (req , res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401 , "Refresh token is required");
    }

    try {
        const decodeToken = jwt.verify(
            incomingRefreshToken , 
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id);

        if(!user){
            throw new ApiError(401 , "Invalid refresh token");
        }

        if(user.refreshToken !== incomingRefreshToken){
            throw new ApiError(401 , "refresh token is expired");
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        }

        const {accessToken , refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("refreshToken" , newRefreshToken , options)
            .cookie("accessToken" , accessToken , options)
            .json(new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refreshed successfully"
            ));

    } catch (error) {
        
        throw new ApiError(500, "Something went wrong while refreshing access token")
    }
})

const changeCurrentPassword = asyncHandler( async (req , res) => {

    const {oldPassword , newPassword} = req.body

    const user = await User.findById(req.user?._id);

    const isPasswordValid = await isPasswordCorrect(oldPassword);

    if(!isPasswordValid){
        throw new ApiError(401 , "Invalid old password");
    }

    user.password = newPassword ;

    await user.sace({validateBeforeSave : false})

    return res
        .status(200)
        .json(new ApiResponse(200 , {} , "Password changed successfully"));

    
})

const getCurrentUser = asyncHandler( async (req , res) => {
    
    return res
        .status(200)
        .json(new ApiResponse(200 , req.user , "Current user details"));
})

const updateAccountDetails = asyncHandler( async (req , res) => {
    
    const {fullname , email} = req.body

    if(!fullname){
        throw new ApiError(400 , "fullname is required");
    }

    if(!email){
        throw new ApiError(400 , "Email is required");
    }

    User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email
            }
        },
        {new: true}
    ).select("-password -refreshToken")
    
    return res
        .status(200)
        .json(new ApiResponse(200 , {} , "Account details updated successfully"));

})

const updateUserAvatar = asyncHandler( async (req , res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar is required");
    }

    const avatar  = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(500 , "something went wrong while uploading avatar");
    }

    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar : avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken");

    res
        .status(200)
        .json(new ApiResponse(200 , user , "Avatar updated successfully"));

})

const updateUserCoverImage = asyncHandler( async (req , res) => {
    
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400 , "Cover image is requried");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(500 , "something went wrong while uploading cover image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200 , user , "Cover image updated successfully"));

})

const getUserChannelProfile = asyncHandler( async (req , res) => {

    const {username} = req.params
    
    if(!username?.trim()){
        throw new ApiError(400 , "username is required");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },

        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            // project only the neccesary data
            $project: {
                fullname: 1,
                username: 1,
                avatar: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404 , "Channel not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200 , channel[0] , "Channel profile fetched successfully"));
})

const getWatchHistory = asyncHandler (async (req , res) => {

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",

                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                },
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ],
                
            }
        }
    ])


    return res.status(200).json(new ApiResponse(
        200,
        user[0]?.watchHistory,
        "Watch history fetched successfully"
    ))
})


export {
    registerUser, 
    loginUser, 
    refreshAccessToken,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};
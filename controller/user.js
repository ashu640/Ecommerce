import { User } from "../model/User.js";
import { OTP } from "../model/otp.js";
import sendOtp from "../utils/sendotp.js";
import TryCatch from "../utils/trycatch.js";
import jwt from 'jsonwebtoken'

export const loginUser=TryCatch(async(req,res)=>{
    const {email}=req.body;
    const subject="Ecommerce App"
    const otp=Math.floor(Math.random()*1000000);
    const prevOtp=await OTP.findOne({
        email,

    });
    console.log("email received",email);
    if(prevOtp){
        await prevOtp.deleteOne();

    }
    console.log("sending email");

    await sendOtp({email,subject,otp});
    console.log("email sent");
    await OTP.create({email,otp});
    console.log("all ok");
    
    res.json({
        message:"OTP send to your mail"
    })
});
export const verifyUser=TryCatch(async(req,res)=>{
    const {email,otp}=req.body;
    const haveOtp=await OTP.findOne({
        email,
        otp
    });
    if(!haveOtp) return res.status(400).json({
        message:"Wrong otp",

    });
    let user=await User.findOne({email})

    if(user){
        const token=jwt.sign({_id:user._id},process.env.JWT_SEC,{
            expiresIn:"15d",
        });
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        await haveOtp.deleteOne();
        res.json({
            message:"User LoggedIn",
            user,

        });
    }else{
        const user=await User.create({
            email,

        });
        const token=jwt.sign({_id:user._id},process.env.JWT_SEC,{
            expiresIn:"15d",
        })
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        await haveOtp.deleteOne();
        res.json({
            message:"user LoggedIn",
            user,  

        });
        
    }
});
export const myProfile=TryCatch(async(req,res)=>{
    const user=await User.findById(req.user._id)
    res.json(user);
});

export const logoutUser = TryCatch(async (req, res) => {
    res.cookie("jwt", "", {
      httpOnly: true,
      secure: true, // VERY important for production
      sameSite: "None", // or "Lax" if you're using cross-origin
      expires: new Date(0), // expire immediately
    });
  
    res.status(200).json({ message: "User logged out successfully" });
  });
  